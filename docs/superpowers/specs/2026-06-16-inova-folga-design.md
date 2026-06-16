# Inova Folga — Spec de Design

**Data:** 2026-06-16
**Autor:** Nicolas + Claude
**Status:** Aprovado (desenho), pronto pro plano de implementação

---

## 1. Problema

Hoje a escala da Rede Inova é montada **no papel/impresso e colada na parede**. Existem duas folhas (ver `WhatsApp Image 2026-06-16 at 13.50.43.jpeg` e `...13.51.33.jpeg`):

1. **Quadro de Horário** — mapão com ~36 funcionários (linhas) × dias (colunas). Cada célula é pintada com a cor do turno daquele funcionário no dia. Inclui sugestão de férias por mês e aniversariantes.
2. **Escala de Caixas/Entrega** — por semana, cada posto (Caixa 1, 2, 3, Entrega) em cada faixa de horário mostra **quem** está naquele posto no dia.

O funcionário precisa ir até a parede pra saber seu turno e sua folga. O objetivo é: **patrão monta no PC, funcionário consulta pelo celular.**

## 2. Objetivo

- **PC (patrão/gerente):** montar as grades clicando em vez de escrever à mão. Marcar **folga, férias, falta** e os turnos de cada um. Receber e aprovar pedidos dos funcionários.
- **Celular (funcionário):** ver **só o que importa pra ele** (próxima folga, turno de hoje/amanhã, suas férias) **e fazer pedidos**: agendar férias, agendar folga ou trocar dia. Cada pedido vira uma **notificação pro Carlos (patrão)**, que aprova ou recusa.

## 3. Fluxo central (pedido → notificação → aprovação)

1. Funcionário abre no celular e toca em **Agendar férias / Agendar folga / Trocar dia**.
2. Escolhe a(s) data(s); no caso de troca, escolhe o dia que quer trocar (e com quem, se aplicável).
3. O pedido cai como **notificação pro Carlos** (sino + lista de pendentes no PC).
4. Carlos **aprova** (a escala é atualizada automaticamente — vira folga/férias no Quadro) ou **recusa** (com motivo opcional).
5. Funcionário vê o **status** do pedido no celular (pendente / aprovado / recusado).

## 4. Não-objetivos (fora do escopo desta versão)

Deixados de fora de propósito pra não inchar. Religar depois se valer:

- Notificação **push** no celular quando a escala sai (a notificação ao patrão é in-app; push fica pra depois).
- Escala de caixas sair **automática** a partir do Quadro de Horário (nesta versão as duas grades são preenchidas à mão, como é hoje).

## 5. Stack e Deploy

- **Backend:** Node + Express (ESM), igual aos outros sistemas Inova.
- **Banco:** SQLite (escala interna, ~36 pessoas — não precisa de Postgres).
- **Front:** EJS/HTML mobile-first pro funcionário; grade larga pro PC.
- **Deploy:** GitHub → VPS (auto-deploy por polling git ~2min, padrão Inova: pm2 + nginx). Subdomínio **`tabelafolga.inovadrogaria.com.br`**.
- **Pasta do projeto:** `C:\Users\PC\Desktop\inova folga`.

## 6. Modelo de Dados (SQLite)

- **funcionarios:** `id`, `nome`, `cor` (opcional, pra identidade visual), `data_aniversario` (dia/mês), `ativo`.
- **turnos (tipos):** catálogo fixo dos códigos da legenda:
  - `manha` (🩷 turno da manhã)
  - `tarde` (🟦 turno da tarde, 13:30)
  - `noite22` / `noite23` / `noite24` (🟪 noite até 22h/23h/24h)
  - `folga` (🟩 folga da semana)
  - `ferias` (**FE**)
  - `falta` (falta do funcionário)
  - `especial4` (o código **4** da folha — meio período; rótulo exato a confirmar com Nicolas)
- **escala_dia:** `id`, `funcionario_id`, `data`, `turno` (ref. ao catálogo). Uma linha por funcionário/dia — é a célula do Quadro de Horário.
- **escala_caixa:** `id`, `data`, `posto` (Caixa 1/2/3, Entrega), `horario` (faixa, ex. `06:00-14:30`), `funcionario_id`. É a célula da grade de caixas.
- **ferias_sugestao:** `id`, `funcionario_id` (ou geral), `mes`, `ano` — a tabela de "sugestão de datas de férias" do topo da foto 1.
- **feriados:** `data` (PK), `descricao` — quais dias entram na visão de Domingos & Feriados.
- **solicitacoes:** `id`, `funcionario_id`, `tipo` (`ferias` | `folga` | `troca`), `data_inicio`, `data_fim`, `data_troca_destino` (pra troca de dia), `funcionario_troca_id` (opcional, com quem troca), `observacao`, `status` (`pendente` | `aprovado` | `recusado`), `motivo_resposta`, `created_at`, `respondido_em`. É o pedido do funcionário e a fila de aprovação do Carlos.
- **notificacoes:** `id`, `destinatario` (ex. `carlos`/patrão), `solicitacao_id`, `texto`, `lida` (bool), `created_at`. Alimenta o sino do PC. (Pode ser derivada de `solicitacoes`; mantida separada pra marcar lida/não-lida.)

## 7. Telas

O lado do patrão tem **4 visões da escala** num menu único: **Geral**, **Caixas**, **Domingos & Feriados** e **Férias**. Geral, Domingos&Feriados e Férias leem a mesma `escala_dia` (são recortes/filtros); Caixas tem dados próprios.

### 7.1 Geral — Quadro de Horário (PC)
- Grade: linhas = funcionários ativos, colunas = dias. Navegação por período (próx. ~3 semanas, igual a folha).
- Clicar numa célula abre um seletor de turno → a célula pinta na cor do catálogo.
- Cabeçalho da coluna mostra o dia + dia da semana (2a, 3a, … SAB, DOM) e destaca fim de semana.
- Lateral/rodapé: aniversariantes do período e bloco de sugestão de férias por mês.

### 7.2 Caixas/Entrega (PC)
- Grade por dia: linhas = posto + faixa de horário; colunas = dias. Célula = nome (dropdown de funcionários).
- Independente do Quadro de Horário nesta versão.

### 7.3 Domingos & Feriados (PC)
- Mesma grade clicável da Geral, mas mostrando **só** as colunas de sábado/domingo e dos feriados cadastrados.
- Inclui cadastro de feriados (data + descrição) que define quais dias úteis entram aqui.

### 7.4 Férias (PC)
- Lista cada funcionário com os dias marcados como `ferias` no período (recorte da `escala_dia`). Visão de leitura pra bater o planejamento de férias.

### 7.5 App do Funcionário (celular)
- Login simples (nome + PIN).
- Tela inicial enxuta: **próxima folga**, **turno de hoje/amanhã**, **suas férias do mês**.
- **Botões de pedido:** Agendar férias · Agendar folga · Trocar dia → abre seletor de data(s) e gera a solicitação.
- **Meus pedidos:** lista com status (pendente / aprovado / recusado + motivo).
- Botão "ver quadro completo" → versão só-leitura do Quadro de Horário.

### 7.6 Pendências do Carlos (PC)
- **Sino de notificações** com contador de pedidos não-lidos.
- Lista de **solicitações pendentes** (quem, tipo, data) com botões **Aprovar** / **Recusar** (motivo opcional).
- Aprovar grava o turno correspondente na `escala_dia` automaticamente (ex.: férias aprovada → célula vira `ferias`).

### 7.7 Cadastros (PC)
- CRUD de funcionários (nome, cor, aniversário, ativo).
- Edição da sugestão de férias por mês.

## 8. Autenticação

- **Patrão/gerente:** usuário + senha (acesso de edição a tudo).
- **Funcionário:** nome + PIN simples — só leitura do que é dele e do quadro completo. Sem fricção.

## 9. Legenda de Cores (fonte: foto 1)

| Código | Rótulo | Cor |
|---|---|---|
| manha | Turno da manhã | rosa/vermelho |
| tarde | Turno da tarde (13:30) | azul |
| noite22 | Noite até 22h | roxo |
| noite23 | Noite até 23h | roxo |
| noite24 | Noite até 24h | roxo |
| folga | Folga da semana | verde |
| ferias | Férias (FE) | amarelo |
| falta | Falta | (definir, ex. vermelho forte) |
| especial4 | Código "4" — meio período (confirmar) | — |

## 10. Critérios de Sucesso

- Patrão monta o Quadro de Horário e a Escala de Caixas de um período inteiro pelo PC, sem papel.
- Funcionário abre no celular e, em 1 tela, sabe seu próximo turno e sua próxima folga.
- A grade do PC reproduz visualmente a folha atual (cores e códigos batem), pra adoção sem reaprender nada.

## 11. Pendências a confirmar com Nicolas

- Rótulo exato do código **4** (meio período até que horas?).
- Quais faixas de horário fixas existem na escala de caixas (a foto mostra 06:00-14:30, 08:00-16:30, 14:30-22:00, 16:30-24:00).
- Lista oficial de funcionários e cores (extrair da foto 1 ou cadastrar do zero).
