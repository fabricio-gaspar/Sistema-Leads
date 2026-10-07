import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evolutionGoServerActionsAvailable, evolutionGoServerUnsupportedActionCopy } from '@/lib/crm/evolutionGoServerError';

describe('Evolution GO individual', () => {
  it('keeps the former Meu WhatsApp URL compatible by sending it to the Central', () => {
    const page = readFileSync(resolve('src/pages/dashboard/meu-whatsapp/page.tsx'), 'utf8');
    const panel = readFileSync(resolve('src/components/feature/EvolutionGoPanel.tsx'), 'utf8');

    expect(page).toContain("import { Navigate } from 'react-router-dom'");
    expect(page).toContain('<Navigate to="/dashboard/atendimento" replace />');
    expect(panel).toContain('loadMyEvolutionGoAccount');
    expect(panel).toContain("mode === 'self-service'");
    expect(panel).toContain("'my-evolution-go-account'");
  });

  it('keeps connection, activation and Central access inside the seller workspace', () => {
    const panel = readFileSync(resolve('src/components/feature/EvolutionGoPanel.tsx'), 'utf8');

    expect(panel).toContain('Habilitar minha conta');
    expect(panel).toContain("action('activate'");
    expect(panel).toContain('Os controles administrativos de recebimento, envio e Ana não foram alterados.');
    expect(panel).toContain('isEvolutionGoAutomationReady(selected)');
    expect(panel).toContain('Abrir Central de Atendimento');
    expect(panel).toContain('to="/dashboard/atendimento"');
    expect(panel).toContain('autoQrRequest');
    expect(panel).toContain('void loadQr()');
    expect(panel).toContain("action('refresh_status'");
  });

  it('keeps an unconfirmed reload distinct from an operational or protected channel', () => {
    const panel = readFileSync(resolve('src/components/feature/EvolutionGoPanel.tsx'), 'utf8');
    expect(panel).toContain("label: 'Estado não confirmado'");
    expect(panel).toContain("statusUnconfirmed ? 'Não confirmado'");
    expect(panel).toContain('await refreshAfterLifecycleError(error, () => refresh(false))');
    expect(panel).toContain('isEvolutionGoOperational(selected)');
  });

  it('keeps server validation in administration and the QR ceremony in self-service', () => {
    const panel = readFileSync(resolve('src/components/feature/EvolutionGoPanel.tsx'), 'utf8');
    const serverStart = panel.indexOf('{!selfService && canManage && corporateAccount && <div');
    const connectorStart = panel.indexOf('{!selfService && canManage && selected.canManage && <section');
    const centralSellerStart = panel.indexOf('{selfService && inCentral && <div');

    expect(serverStart).toBeGreaterThan(-1);
    expect(connectorStart).toBeGreaterThan(serverStart);
    expect(centralSellerStart).toBeGreaterThan(serverStart);
    expect(panel).toContain('QR Code da minha instância');
    expect(panel).toContain('Dados da minha conexão');
    expect(panel).toContain('Testar conexão');
    expect(panel).not.toContain('Conexão e uso');
    expect(panel).not.toContain('Token da instância<input');
    expect(panel.slice(serverStart, centralSellerStart)).not.toContain("action('connect'");
    expect(panel).toContain("action('connect'");
  });

  it('allows only a corporate account to be added manually and explains seller provisioning', () => {
    const panel = readFileSync(resolve('src/components/feature/EvolutionGoPanel.tsx'), 'utf8');

    expect(panel).toContain('Adicionar conta corporativa');
    expect(panel).toContain("createEvolutionGoAccount({ accountType: 'corporate', label })");
    expect(panel).toContain('Provisionamento automático dos vendedores');
    expect(panel).toContain('Não crie ou associe instâncias de vendedores manualmente neste painel');
    expect(panel).not.toContain('Individual por vendedor');
    expect(panel).not.toContain('Vendedor responsável');
    expect(panel).not.toContain('accountForm.accountType');
  });

  it('makes provider QR recovery failures explicit without implying a message was sent', () => {
    const panel = readFileSync(resolve('src/components/feature/EvolutionGoPanel.tsx'), 'utf8');
    expect(panel).toContain('evolution_go_request_rejected_401:');
    expect(panel).toContain('Gerar QR não cria uma instância');
    expect(panel).toContain('O servidor não reconheceu o token desta instância. QR e pareamento ficam indisponíveis');
    expect(panel).toContain('O estado de QR salvo no WayFlex não confirma uma instância no Evolution GO.');
    expect(panel).toContain('!selectedInstanceAuthRejected && selected?.account.connectionStatus');
    expect(panel).toContain("evolution_go_request_rejected_500: 'A Evolution GO falhou ao recuperar a sessão para gerar o QR.");
    expect(panel).toContain('Nenhum QR, mensagem ou automação foi criado;');
  });

  it('explains an outdated deployed server action without masking unrelated errors', () => {
    expect(evolutionGoServerUnsupportedActionCopy(new Error('unsupported_action'), 'save')).toContain('não foi gravada');
    expect(evolutionGoServerUnsupportedActionCopy(new Error('unsupported_action'), 'test')).toContain('não foi consultado');
    expect(evolutionGoServerUnsupportedActionCopy(new Error('evolution_go_base_url_not_allowed'), 'save')).toBeNull();
  });

  it('blocks credential submission when the published status lacks the server-action contract', () => {
    expect(evolutionGoServerActionsAvailable({ serverConfigured: false, serverValidation: null })).toBe(true);
    expect(evolutionGoServerActionsAvailable({ serverConfigured: true, serverValidation: { status: 'passed' } })).toBe(true);
    expect(evolutionGoServerActionsAvailable({})).toBe(false);
    const panel = readFileSync(resolve('src/components/feature/EvolutionGoPanel.tsx'), 'utf8');
    expect(panel).toContain('if (!corporateAccount || !serverActionsAvailable) return;');
    expect(panel).toContain('serverConfiguring && serverActionsAvailable');
  });
});
