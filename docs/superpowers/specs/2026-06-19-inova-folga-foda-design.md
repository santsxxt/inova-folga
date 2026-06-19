# Inova Folga 2.0 — "sistema foda" (design)

Data: 2026-06-19 · Autor: Nicolas + Claude

## Visão

Transformar o Inova Folga (escala/folga da Rede Inova, ~40 pessoas em Muriaé) num sistema
**bonito, rápido e premium** ("Glass Premium" escuro), **responsivo de verdade** (patrão e alguns
no PC; funcionários no celular), com escala/folga de nível profissional — incluindo
**Central de Domingos & Feriados com rodízio justo e folga compensada**, **saldos** (férias/folgas/faltas),
**personalização local** (cores/fontes/tamanho) e **auditoria**.

## Regras de produção (LEI)

O sistema já roda na VPS (`tabelafolga.inovadrogaria.com.br`, porta 3900) com dados reais de ~40 pessoas.

1. **Migrações só aditivas** — `CREATE TABLE/INDEX IF NOT EXISTS`; nunca dropar/recriar com dado.
2. **Backup do `.db` da VPS antes de mudança de schema.**
3. **Testar local primeiro** (`node --test` + smoke), depois `git push` → VPS auto-deploya (~2min).
4. **Redesign sem quebrar fluxo** — caminhos (login → quadro → pedido) iguais; só a casca muda.

## Arquitetura (mantida)

Node + Express + EJS + better-sqlite3 (ESM). Zero dependências novas — segurança feita à mão.
Telas compartilham `views/partials/topo.ejs`; estilo central em `public/css/app.css`
(reescrito por classe → redesign sem tocar no HTML das telas).

## Stack visual

- **Glass Premium escuro**: fundo radial vermelho/roxo, vidro fosco (`backdrop-filter`), vermelho Inova (#ff3b4e/#c8102e).
- Animações: fade-up nas páginas, hover nas células, anéis/barras animados, toasts.
- Responsivo mobile-first pro funcionário; quadro com scroll lateral no PC.

## Modelo de dados

Tabelas existentes preservadas. **Novas (aditivas):**

- `auditoria(id, ator, acao, alvo, detalhe, created_at)` + índice por `created_at`.
- Índice `idx_escala_data` em `escala_dia(data)`.

**Planejadas (Fases 2+):**

- `domingo_turno(id, data, turno 'manha'|'noite', funcionario_id, entrada, almoco, saida)` — escala detalhada de domingo/feriado.
- `folga_compensada(id, funcionario_id, origem_data, folga_data, status)` — folga ganha por trabalhar domingo/feriado.
- `saldo_ferias(funcionario_id, dias_direito=30, ano)` — base do contador; "tirados" derivam de `escala_dia` turno=ferias.
- `preferencia_visual` — guardada no **localStorage do PC** (não no servidor): cores/fonte/tamanho por aparelho.

## Frentes

### ✅ FASE 1 — entregue 2026-06-19 (redesign + segurança + auditoria + seed)

- **Redesign Glass Premium** aplicado a todas as telas via `app.css` (sem mudar markup) + nav premium com aba Auditoria.
- **Segurança (sem dep nova):** `src/security.js` com headers (CSP frouxa p/ EJS, nosniff, frame-options, HSTS em prod),
  **rate-limit de login** in-memory (5/10min por IP+usuário) em `/login` e `/app/login`, **error handler global**.
  Cookie de sessão `httpOnly`+`sameSite:lax`+`secure` (em prod) + `trust proxy`.
- **Senha do patrão:** suporte a `BOSS_PASS_HASH` (scrypt) e **guard** que recusa subir em produção com o default `'1'`.
- **PIN:** o atalho "nome = PIN" agora vale **só enquanto não há PIN definido**; ao definir um PIN, o nome para de logar.
- **Auditoria:** tabela + `src/repo/auditoria.js` + captura em (alterar escala, aprovar/recusar pedido, mudar PIN, desativar/reativar)
  + tela `/auditoria` (filtro por ator, paginação 100).
- **Seed dos ~40 funcionários reais** (idempotente, `npm run seed`).
- **Testes:** 11/11 (inclui PIN fallback, auditoria, rate-limit).

### 🔜 FASE 2 — Central de Domingos & Feriados "foda"

- Dois turnos por data (Manhã/Noite) com **Entrada · Almoço · Saída** por pessoa (`domingo_turno`).
- **Rodízio justo:** contar domingos/feriados trabalhados por pessoa no trimestre; barra de "quem trabalhou menos".
- **Montar escala justa automática:** sugere quem trabalhou menos e preenche as vagas.
- **Folga compensada automática:** ao escalar no domingo/feriado, reserva folga na semana (`folga_compensada`).
- **Cobertura ao vivo:** status coberto/falta por data; anel de % coberto.

### 🔜 FASE 3 — Saldos & contadores

- Tela **Saldos**: por pessoa — **férias** (tirados × faltam de 30, derivado de `escala_dia`),
  **folgas no mês**, **faltas no ano**, **domingos trabalhados**.

### 🔜 FASE 4 — Edição total / personalização

- **Tudo editável pelo Carlos:** célula clica e cicla turno; **sortear folgas** (aleatório) ou manual;
  **arrastar pra trocar pessoas de lugar**.
- **Personalizar visual** (por PC, localStorage): cores dos turnos, cor da marca, **fonte**, tamanho da célula, cantos.

### 🔜 FASE 5 — Avisos no WhatsApp (Hub360)

- Chamada do dia (quem folga/trabalha), escala alterada, **SLA**: avisar Carlos se pedido ficar 24h sem resposta.
- Reusa a ponte Hub360 já usada nos outros sistemas da Rede Inova.

### 🔜 FASE 6 — Exportar / Imprimir

- PDF/Excel da escala mensal pro mural físico e pro grupo.

## Protótipo de referência

`prototipo/index.html` — app completo clicável (todas as telas + animações + features das Fases 2–4),
usado como norte visual na implementação.

## Deploy

`git push origin main` → VPS faz auto-deploy. Após deploy, rodar `npm run seed` 1x na VPS (idempotente)
e, recomendado, definir `BOSS_PASS`/`BOSS_PASS_HASH` + `NODE_ENV=production` no `.env`.
Migrações desta fase são aditivas → sem risco aos dados existentes.
