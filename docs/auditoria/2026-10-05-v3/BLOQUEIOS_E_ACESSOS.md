# Bloqueios e acessos — auditoria V3

Não há bloqueio de terminal/rede: ambos foram usados. GitHub foi consultado com sucesso. Não é necessário entregar senha no chat. O impedimento da homologação é a falta de ambiente/contratos/destinos isolados e a existência de defeitos comprovados, não a necessidade genérica de “acesso completo”.

| ID | Tipo / requisito | Evidência e motivo | Como desbloquear com segurança |
|---|---|---|---|
| BL-01 | Ambiente/teste; J01–J16 | Inventário Supabase só main; a empresa operacional está real/automática. Não foi criado tenant de teste em produção | Fornecer/aprovar staging separado com automações e provedores isolados; não copiar segredos/clientes indiscriminadamente |
| BL-02 | Infra/contrato externo; J05/06/11–13 | Zero conta/evento WA-AKG; servidor persistente e versão instalada não comprovados | Gateway Node/Docker HTTPS com persistência, backup de sessão, segredo via canal protegido e tag/digest atestado |
| BL-03 | Consentimento/cota; J03/06/08/09 | Sem busca paga, mensagem, e-mail, modelo ou evento Calendar autorizados para teste real | Definir organização, contas/destinos próprios, cotas e janela; para QR/OTP o titular faz etapa humana |
| BL-04 | Identidades/perfis; J01/02/15 | Apenas admin autenticado disponível na UI; fixture SQL não é GoTrue/PostgREST real | Duas empresas sintéticas, dois vendedores e admin, papéis SDR/CX; contas sem vínculo comercial e nenhuma senha no chat |
| BL-05 | Implementação/regra; J16 | Dono plataforma, planos, suspensão empresarial, suporte temporário não encontrados | Definir escopo comercial; autorizar remediação/implementação ou piloto explicitamente reduzido |
| BL-06 | Continuidade; J15 | Sem restauração isolada, falha de migração ou desastre de gateway executados | Backup verificável e destino descartável autorizado, ensaio restore, plano de RPO/RTO mensurado |
| BL-07 | Teste não realizado; J09/14/15 | Sem volume >200 agenda/>120 catálogo, load/custo, WCAG integral, injeção LLM real e todos formatos de mídia | Fixtures isoladas/quotas, roteiro teclado/leitor de tela, testes controlados de carga e respostas sem chamadas reais no primeiro estágio |
| BL-08 | Autorização de mudança | Modo atual é AUDITORIA_E_TESTES; publicação/correções não decorrem do diagnóstico | Autorizar lote(s) de remediação. Produção somente após evidência e decisão de release separadas |

Não solicitado: login/senha/token em mensagem, desativação de segurança do app, concessão ilimitada de custos, contorno de aprovações ou ativação global. Nenhum acesso adicional foi criado.
