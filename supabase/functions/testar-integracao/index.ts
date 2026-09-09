import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

function zapiErrorDetail(code: string): string {
  const details: Record<string, string> = {
    zapi_credentials_incomplete: 'Informe o ID da instância, o token da instância e o Client Token da Z-API.',
    zapi_client_token_rejected: 'A Z-API recusou o Client Token. No painel Z-API, abra Segurança → Token de Segurança da Conta e salve o token ativo nesse campo.',
    zapi_instance_token_rejected: 'A Z-API recusou o Token da Instância. Copie novamente o token da instância — não o Client Token — no painel Z-API.',
    zapi_instance_id_rejected: 'A Z-API não reconheceu o ID da instância. Confira o identificador exibido em Instâncias no painel Z-API.',
    zapi_invalid_request: 'A Z-API recusou o formato da validação. Revise o ID, o Token da Instância e o Client Token salvos.',
    zapi_http_401: 'A Z-API recusou as credenciais. Confira o ID da instância, o token e o Client Token.',
    zapi_http_403: 'A Z-API bloqueou esta chamada. Confira o Client Token e as permissões da conta.',
    zapi_http_404: 'A instância não foi encontrada. Confira o ID da instância e a URL base.',
    zapi_http_429: 'A Z-API limitou temporariamente os testes. Aguarde alguns minutos e tente de novo.',
    zapi_instance_not_connected: 'A instância foi validada, mas o número ainda não está conectado ao WhatsApp.',
    zapi_phone_offline: 'A instância está autenticada, mas o celular vinculado está sem conexão.',
  };
  return details[code] ?? 'A Z-API recusou a validação. Revise os dados da instância e tente novamente.';
}

function mensagemDoProvedor(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return '';

  // A resposta do provedor nunca é exibida ou persistida: ela pode carregar
  // detalhes operacionais. Somente usamos campos usuais para classificá-la em
  // um código seguro, que a interface consegue explicar sem vazar segredos.
  const record = payload as Record<string, unknown>;
  return ['error', 'message', 'detail', 'details', 'cause']
    .map((key) => record[key])
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
}

function codigoDoErroZapi(status: number, payload: unknown): string {
  if (status !== 400) return `zapi_http_${status}`;

  const message = mensagemDoProvedor(payload)
    .toLocaleLowerCase('pt-BR')
    .replace(/[\s_-]+/g, ' ');

  if (/client\s*token|token\s*client|security\s*token|token\s*de\s*seguran/.test(message)) {
    return 'zapi_client_token_rejected';
  }
  if (/instance\s*(id|identifier)|id\s*(da\s*)?inst[aâ]ncia|inst[aâ]ncia.*(not found|invalid|inval)/.test(message)) {
    return 'zapi_instance_id_rejected';
  }
  if (/instance\s*token|token\s*(da\s*)?inst[aâ]ncia|token.*(invalid|inval|incorrect|incorrecto)/.test(message)) {
    return 'zapi_instance_token_rejected';
  }
  return message ? 'zapi_invalid_request' : 'zapi_http_400';
}

async function corpoJsonOuTexto(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  let admin: ReturnType<typeof createAdminClient> | null = null;
  let organizationId: string | null = null;
  let integrationId: string | null = null;
  let sourceKey: string | null = null;
  let authorized = false;
  try {
    const body = await request.json() as { canal?: string };
    const canal = String(body.canal ?? '').trim();
    if (!['whatsapp', 'ai', 'apify', 'google_places'].includes(canal)) throw new Error('unsupported_channel');
    const { user } = await requireUser(request);
    admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (!profile?.active_organization_id) throw new Error('organization_context_required');
    organizationId = profile.active_organization_id as string;
    await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager']);
    authorized = true;
    const { data: integration, error } = await admin.from('integrations').select('id,provider,connected,enabled,paused,status_detail,last_tested_at')
      .eq('organization_id', organizationId).eq('key', canal).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!integration) throw new Error('integration_not_found');
    integrationId = integration.id as string;
    const { data: credentials, error: credentialsError } = await admin.rpc('read_integration_secret', { p_integration: integration.id });
    if (credentialsError || !credentials) throw credentialsError ?? new Error('integration_credentials_missing');
    sourceKey = ['apify', 'google_places'].includes(canal) ? canal : null;
    let response: Response;
    if (canal === 'whatsapp') {
      const zapi = credentials as { instancia_id?: string; token?: string; client_token?: string; url_base?: string; webhook_token?: string };
      if (!zapi.instancia_id?.trim() || !zapi.token?.trim() || !zapi.client_token?.trim()) {
        throw new Error('zapi_credentials_incomplete');
      }
      const baseUrl = (zapi.url_base || 'https://api.z-api.io').replace(/\/$/, '');
      response = await fetch(
        `${baseUrl}/instances/${encodeURIComponent(zapi.instancia_id)}/token/${encodeURIComponent(zapi.token)}/status`,
        {
          headers: {
            // A própria Z-API exige Content-Type em todas as chamadas. O
            // endpoint de status não possui corpo, mas sem esse header alguns
            // ambientes do provedor devolvem HTTP 400 em vez do diagnóstico.
            'Content-Type': 'application/json',
            'Client-Token': zapi.client_token,
            Accept: 'application/json',
          },
        },
      );
      const status = await corpoJsonOuTexto(response) as { connected?: boolean; smartphoneConnected?: boolean } | string | null;
      if (!response.ok) throw new Error(codigoDoErroZapi(response.status, status));
      if (!status || typeof status !== 'object') throw new Error('zapi_invalid_request');
      if (!status.connected) throw new Error('zapi_instance_not_connected');
      if (!status.smartphoneConnected) throw new Error('zapi_phone_offline');
      // Esta validação confirma somente instância, credenciais e conexão do
      // aparelho, sem modificar webhooks. O callback inbound possui contrato
      // próprio e só pode ser considerado pronto após homologação controlada.
    } else if (canal === 'ai') {
      const ai = credentials as {
        provedor_principal?: string;
        openai_key?: string;
        claude_key?: string;
      };
      const provider = String(ai.provedor_principal ?? '').trim().toLowerCase();
      if (provider === 'claude') {
        if (!ai.claude_key) throw new Error('ai_provider_key_missing');
        response = await fetch('https://api.anthropic.com/v1/models?limit=1', {
          headers: { 'x-api-key': ai.claude_key, 'anthropic-version': '2023-06-01' },
        });
      } else if (provider === 'openai') {
        if (!ai.openai_key) throw new Error('ai_provider_key_missing');
        response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${ai.openai_key}` },
        });
      } else {
        throw new Error('ai_provider_invalid');
      }
    } else if (canal === 'apify') {
      const apify = credentials as { api_token?: string; actor_id?: string; task_id?: string };
      if (!apify.api_token || (!apify.actor_id && !apify.task_id)) throw new Error('source_credentials_missing');
      response = await fetch(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(apify.api_token)}`);
      if (response.ok) {
        const path = apify.task_id ? `/v2/actor-tasks/${encodeURIComponent(apify.task_id)}` : `/v2/acts/${encodeURIComponent(apify.actor_id ?? '')}`;
        response = await fetch(`https://api.apify.com${path}?token=${encodeURIComponent(apify.api_token)}`);
      }
    } else if (canal === 'google_places') {
      const google = credentials as { api_key?: string };
      if (!google.api_key) throw new Error('source_credentials_missing');
      // Places API (New) exige POST, chave no header e FieldMask explícito.
      // Isso evita o endpoint legado, que pode não estar habilitado no projeto.
      response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Goog-Api-Key': google.api_key,
          'X-Goog-FieldMask': 'places.id',
        },
        body: JSON.stringify({ textQuery: 'Wayflex Brasil', languageCode: 'pt-BR', regionCode: 'BR', pageSize: 1 }),
      });
    } else {
      throw new Error('provider_test_not_implemented');
    }
    if (!response.ok) throw new Error('provider_error');
    const ready = true;
    const statusDetail = canal === 'whatsapp'
      ? 'Conexão Z-API validada com segurança.'
      : canal === 'ai'
        ? 'Credencial do provedor principal da Ana validada sem gerar mensagem.'
        : `Conexão ${integration.provider} validada para a Busca de Leads.`;
    await admin.from('integrations').update({ connected: true, enabled: true, paused: false, status_detail: statusDetail, last_tested_at: new Date().toISOString(), last_success_at: new Date().toISOString(), last_error: null, last_error_at: null }).eq('id', integration.id);
    if (sourceKey) {
      await admin.from('lead_source_configs').update({ enabled: true, mode: 'production', connection_status: 'connected', last_success_at: new Date().toISOString(), last_error: null, last_error_at: null, updated_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('source_key', sourceKey);
    }
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: `integration.${body.canal}_checked`, detail: ready ? 'Integração pronta para a fila.' : 'Integração não está pronta para a fila.', entity_table: 'integrations', entity_id: integration?.id, event_data: { ready } });
    return json({ ok: true, pronto: ready, provedor: integration?.provider, detalhe: ready ? (sourceKey ? 'Conexão válida. A fonte pode ser usada no Modo Real.' : 'Conexão válida. Envios continuam passando pela fila segura.') : integration?.status_detail ?? 'Conexão ausente, pausada ou desabilitada.' }, 200, headers);
  } catch (error) {
    const erro = safeError(error);
    // O cartão e a Busca de Leads recebem o diagnóstico real após uma falha.
    // Só registramos isso depois de validar a permissão do usuário; tentativas
    // não autorizadas não podem alterar o estado da empresa.
    if (admin && authorized && organizationId && integrationId) {
      await admin.from('integrations').update({
        connected: false,
        enabled: false,
        status_detail: erro.startsWith('zapi_') ? zapiErrorDetail(erro) : 'Falha no último teste. Revise a configuração e teste novamente.',
        last_error: erro,
        last_error_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', integrationId);
    }
    if (admin && authorized && organizationId && sourceKey) {
      await admin.from('lead_source_configs').update({
        enabled: false,
        connection_status: 'error',
        last_error: erro,
        last_error_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('organization_id', organizationId).eq('source_key', sourceKey);
    }
    return json({
      ok: false,
      erro,
      detalhe: erro.startsWith('zapi_')
        ? zapiErrorDetail(erro)
        : 'Falha no último teste. Revise a configuração e tente novamente.',
    }, 400, headers);
  }
});
