# INSTRUÇÕES DE RESTAURAÇÃO — Wayflex CRM (ex-WF Digital)

Este guia explica como restaurar e continuar o projeto **fora da Readdy**, incluindo a restauração dos dados do backend.

---

## 1. O que compõe o backup

1. **Código do projeto** (código-fonte completo do SPA).
2. **Dados do backend** — `docs/backup_wayflex_2026-08-26.sql` (script SQL com o conteúdo real das tabelas chave-valor do CRM).

---

## 2. Como descompactar

```bash
# Linux / macOS
unzip backup.zip -d wayflex_crm

# Windows
# Clique com o botão direito no .zip → "Extrair tudo..."
```

---

## 3. Versão recomendada do Node.js

| Ferramenta | Versão recomendada |
|---|---|
| Node.js | **20.x ou 22.x (LTS)** |
| npm | 10.x |

```bash
node -v
npm -v
```

---

## 4. Instalar dependências e rodar

```bash
npm install
npm run dev   # sobe em http://localhost:3000
```

Build de produção:

```bash
npm run build   # gera a pasta out/
npm run preview
```

---

## 5. Configurar o `.env`

```bash
cp .env.example .env
```

Preencha:

```env
VITE_PUBLIC_SUPABASE_URL=
VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

> Para projetos legados, `VITE_PUBLIC_SUPABASE_ANON_KEY` continua compatível. Nunca use service role ou secret key no frontend.

---

## 6. Restaurar os dados do backend (SQL)

O arquivo `docs/backup_wayflex_2026-08-26.sql` contém `INSERT`s para as tabelas chave-valor do CRM (todas com o mesmo `user_id`).

**Como aplicar:**
1. No painel do Readdy Backend, abra o editor SQL (Database) e cole o conteúdo do arquivo.
2. Execute. Cada `INSERT` recria a linha de dados da respectiva tabela.
3. Confirme que as tabelas voltaram a ter conteúdo (ex.: `SELECT count(*) FROM leads;`).

> ⚠️ O `user_id` de origem é `93865cea-314c-4ac7-8cfa-07cd9c587443`. Se o novo ambiente usar outro usuário, substitua esse valor em todos os `INSERT`s antes de executar.

---

## 7. 🔴 Antes de restaurar — trate a chave vazada

A tabela `fontes` tinha uma **chave da Anthropic vazada em texto puro**. No backup ela foi redigida. Ao restaurar:
- **Não** restaure essa chave. Revogue a chave original no painel da Anthropic e gere uma nova.
- Cadastre a nova chave pelo caminho correto (segredo de backend), **não** em texto puro.

---

## 8. Credenciais que ainda precisam ser reconectadas

| Integração | Credencial | Status |
|---|---|---|
| Backend | `VITE_PUBLIC_SUPABASE_URL`, `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ❌ Não exportado |
| Resend (e-mail) | `RESEND_API_KEY`, `RESEND_FROM_DOMAIN` | ❌ Não configurado |
| Stripe | `STRIPE_SECRET_KEY` | ❌ Não conectado |
| Shopify | `ShopifyDomain`, `StorefrontAccessToken` | ❌ Não conectado |
| Toss Payments / PayPal | — | ❌ Não conectado |

---

## 9. Checklist de validação

- [ ] `npm install` concluiu sem erros
- [ ] `npm run dev` sobe o servidor
- [ ] Landing renderiza
- [ ] Navegação entre telas funciona
- [ ] `npm run build` gera a pasta `out/` sem erros
- [ ] Script SQL restaurado com sucesso no backend
- [ ] Chave da Anthropic foi revogada/rotacionada

---

## Nota sobre o estado do projeto

O **frontend** ainda roda sobre mocks + `localStorage` (não está ligado às tabelas do backend). O **backend** contém dados reais em tabelas chave-valor, **já migrados para Wayflex** (concluído em 26/08/2026). Consulte `docs/BACKUP_MANIFEST.md` para o inventário completo.
