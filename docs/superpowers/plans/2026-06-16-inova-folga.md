# Inova Folga — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App de escala onde Carlos (patrão) monta o Quadro de Horário e a Escala de Caixas no PC, e cada funcionário consulta seu turno/folga no celular e pede férias/folga/troca — pedido que vira notificação pro Carlos aprovar.

**Architecture:** Servidor Node + Express (ESM) servindo views EJS. Dados em SQLite via `better-sqlite3` (síncrono, fácil de testar). A lógica de negócio (cadastro, célula de escala, fluxo de solicitação→aprovação) vive em módulos de repositório puros, testados com `node --test` contra um banco temporário. As rotas e views são camadas finas por cima. Quando Carlos aprova uma solicitação, o repositório grava o turno correspondente direto na `escala_dia`.

**Tech Stack:** Node 18+ (ESM), Express, better-sqlite3, EJS, express-session, node:crypto (scrypt p/ senha do patrão e PIN), node:test + node:assert.

**Spec:** `docs/superpowers/specs/2026-06-16-inova-folga-design.md`

---

## File Structure

```
inova folga/
  package.json
  .gitignore
  server.js                      # bootstrap Express + sessão + rotas
  src/
    db.js                        # abre SQLite, roda migrations, seed do catálogo de turnos
    config.js                    # porta, segredo de sessão, senha do patrão (env)
    auth.js                      # hash/verify scrypt + middleware requireBoss / requireFuncionario
    repo/
      funcionarios.js            # CRUD funcionários
      escala.js                  # escala_dia (célula) + período + escala_caixa
      ferias.js                  # sugestão de férias por mês
      solicitacoes.js            # criar pedido, listar pendentes, aprovar/recusar, notificações
    routes/
      boss.js                    # telas/endpoints do PC (Quadro, Caixas, aprovação, cadastros)
      func.js                    # telas/endpoints do celular (home, pedidos, meus pedidos)
      auth.js                    # login patrão e login funcionário (nome+PIN)
  views/
    layout-boss.ejs  layout-func.ejs
    boss/quadro.ejs  boss/caixas.ejs  boss/pendencias.ejs  boss/cadastros.ejs
    func/home.ejs    func/pedido.ejs   func/meus-pedidos.ejs
    login-boss.ejs   login-func.ejs
  public/
    css/app.css      js/quadro.js
  data/                          # banco .db (gitignored)
  test/
    funcionarios.test.js  escala.test.js  solicitacoes.test.js  auth.test.js
```

Catálogo de turnos (seed inicial — a tabela é **editável** pelo patrão depois). A operação é **06:00–00:00**, então os horários default cobrem essa faixa. Definido em `src/db.js`:

```js
export const TURNOS = [
  { codigo: 'manha',     rotulo: 'Manhã',           cor: '#f6a5c0', inicio: '06:00', fim: '14:30' },
  { codigo: 'tarde',     rotulo: 'Tarde',           cor: '#7fb3ff', inicio: '13:30', fim: '22:00' },
  { codigo: 'noite22',   rotulo: 'Noite até 22h',   cor: '#b9a5e3', inicio: '14:30', fim: '22:00' },
  { codigo: 'noite23',   rotulo: 'Noite até 23h',   cor: '#a48fd6', inicio: '15:00', fim: '23:00' },
  { codigo: 'noite24',   rotulo: 'Noite até 00h',   cor: '#8f78c9', inicio: '16:30', fim: '00:00' },
  { codigo: 'folga',     rotulo: 'Folga da semana', cor: '#86d191', inicio: null,    fim: null },
  { codigo: 'ferias',    rotulo: 'Férias',          cor: '#ffd84d', inicio: null,    fim: null },
  { codigo: 'falta',     rotulo: 'Falta',           cor: '#e3554a', inicio: null,    fim: null },
  { codigo: 'especial4', rotulo: 'Meio período (4)',cor: '#cdcdcd', inicio: '06:00', fim: '13:00' },
];
```

---

## Task 0: Scaffold do projeto

**Files:**
- Create: `package.json`, `.gitignore`, `src/config.js`

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "inova-folga",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "test": "node --test"
  },
  "dependencies": {
    "better-sqlite3": "^11.3.0",
    "ejs": "^3.1.10",
    "express": "^4.19.2",
    "express-session": "^1.18.0"
  }
}
```

- [ ] **Step 2: Criar `.gitignore`**

```
node_modules/
data/*.db
data/*.db-*
.env
```

- [ ] **Step 3: Criar `src/config.js`**

```js
export const PORT = process.env.PORT || 3900;
export const SESSION_SECRET = process.env.SESSION_SECRET || 'inova-folga-dev-secret';
// Senha inicial do patrão (trocar via env em produção). PIN dos funcionários fica no banco.
export const BOSS_USER = process.env.BOSS_USER || 'carlos';
export const BOSS_PASS = process.env.BOSS_PASS || 'inova2026';
export const DB_PATH = process.env.DB_PATH || 'data/inovafolga.db';
```

- [ ] **Step 4: Instalar dependências**

Run: `cd "/c/Users/PC/Desktop/inova folga" && npm install`
Expected: cria `node_modules/` e `package-lock.json` sem erro.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore src/config.js
git commit -m "chore: scaffold do projeto inova-folga"
```

---

## Task 1: Banco e migrations

**Files:**
- Create: `src/db.js`, `test/db.test.js`

- [ ] **Step 1: Escrever o teste que falha** — `test/db.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, TURNOS } from '../src/db.js';

test('openDb cria tabelas e popula o catálogo de turnos', () => {
  const db = openDb(':memory:');
  const tabelas = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table'"
  ).all().map(r => r.name);
  for (const t of ['setores','funcionarios','turnos','escala_dia','escala_caixa','ferias_sugestao','feriados','solicitacoes','notificacoes']) {
    assert.ok(tabelas.includes(t), `faltou tabela ${t}`);
  }
  const n = db.prepare('SELECT COUNT(*) c FROM turnos').get().c;
  assert.equal(n, TURNOS.length);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/db.js'`.

- [ ] **Step 3: Implementar `src/db.js`**

```js
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const SETORES = ['Escritório', 'Caixa', 'Atendente', 'Estoque', 'Entrega'];

export const TURNOS = [
  { codigo: 'manha',     rotulo: 'Manhã',            cor: '#f6a5c0', inicio: '06:00', fim: '14:30' },
  { codigo: 'tarde',     rotulo: 'Tarde',            cor: '#7fb3ff', inicio: '13:30', fim: '22:00' },
  { codigo: 'noite22',   rotulo: 'Noite até 22h',    cor: '#b9a5e3', inicio: '14:30', fim: '22:00' },
  { codigo: 'noite23',   rotulo: 'Noite até 23h',    cor: '#a48fd6', inicio: '15:00', fim: '23:00' },
  { codigo: 'noite24',   rotulo: 'Noite até 00h',    cor: '#8f78c9', inicio: '16:30', fim: '00:00' },
  { codigo: 'folga',     rotulo: 'Folga da semana',  cor: '#86d191', inicio: null,    fim: null },
  { codigo: 'ferias',    rotulo: 'Férias',           cor: '#ffd84d', inicio: null,    fim: null },
  { codigo: 'falta',     rotulo: 'Falta',            cor: '#e3554a', inicio: null,    fim: null },
  { codigo: 'especial4', rotulo: 'Meio período (4)', cor: '#cdcdcd', inicio: '06:00', fim: '13:00' },
];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS setores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,   -- 'Escritório','Caixa','Atendente','Estoque','Entrega'...
  ordem INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS funcionarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  setor_id INTEGER REFERENCES setores(id),
  cor TEXT,
  aniversario TEXT,            -- 'DD/MM'
  pin TEXT,                    -- hash scrypt do PIN
  ativo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS turnos (
  codigo TEXT PRIMARY KEY,
  rotulo TEXT NOT NULL,
  cor TEXT NOT NULL,
  inicio TEXT,                 -- 'HH:MM' (null p/ folga/férias/falta)
  fim TEXT
);
CREATE TABLE IF NOT EXISTS escala_dia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
  data TEXT NOT NULL,          -- 'YYYY-MM-DD'
  turno TEXT NOT NULL REFERENCES turnos(codigo),
  UNIQUE(funcionario_id, data)
);
CREATE TABLE IF NOT EXISTS escala_caixa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  posto TEXT NOT NULL,         -- 'Caixa 1' | 'Caixa 2' | 'Caixa 3' | 'Entrega'
  horario TEXT NOT NULL,       -- '06:00-14:30' etc
  funcionario_id INTEGER REFERENCES funcionarios(id),
  UNIQUE(data, posto, horario)
);
CREATE TABLE IF NOT EXISTS ferias_sugestao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funcionario_id INTEGER REFERENCES funcionarios(id),
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS feriados (
  data TEXT PRIMARY KEY,        -- 'YYYY-MM-DD'
  descricao TEXT
);
CREATE TABLE IF NOT EXISTS solicitacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
  tipo TEXT NOT NULL,          -- 'ferias' | 'folga' | 'troca'
  data_inicio TEXT NOT NULL,
  data_fim TEXT,
  data_troca_destino TEXT,
  funcionario_troca_id INTEGER REFERENCES funcionarios(id),
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente'|'aprovado'|'recusado'
  motivo_resposta TEXT,
  created_at TEXT NOT NULL,
  respondido_em TEXT
);
CREATE TABLE IF NOT EXISTS notificacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  destinatario TEXT NOT NULL DEFAULT 'patrao',
  solicitacao_id INTEGER REFERENCES solicitacoes(id),
  texto TEXT NOT NULL,
  lida INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
`;

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  const insertTurno = db.prepare(
    'INSERT OR IGNORE INTO turnos (codigo, rotulo, cor, inicio, fim) VALUES (?,?,?,?,?)'
  );
  const insertSetor = db.prepare('INSERT OR IGNORE INTO setores (nome, ordem) VALUES (?,?)');
  const seed = db.transaction(() => {
    for (const t of TURNOS) insertTurno.run(t.codigo, t.rotulo, t.cor, t.inicio, t.fim);
    SETORES.forEach((nome, i) => insertSetor.run(nome, i));
  });
  seed();
  return db;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db.js test/db.test.js
git commit -m "feat: schema sqlite + catálogo de turnos"
```

---

## Task 2: Auth (scrypt + middlewares)

**Files:**
- Create: `src/auth.js`, `test/auth.test.js`

- [ ] **Step 1: Teste que falha** — `test/auth.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashSecret, verifySecret } from '../src/auth.js';

test('hash e verify batem; senha errada falha', () => {
  const h = hashSecret('1234');
  assert.notEqual(h, '1234');           // não guarda em texto puro
  assert.equal(verifySecret('1234', h), true);
  assert.equal(verifySecret('9999', h), false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `src/auth.js`**

```js
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

export function hashSecret(secret) {
  const salt = randomBytes(16).toString('hex');
  const dk = scryptSync(String(secret), salt, 32).toString('hex');
  return `${salt}:${dk}`;
}

export function verifySecret(secret, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, dk] = stored.split(':');
  const test = scryptSync(String(secret), salt, 32);
  const known = Buffer.from(dk, 'hex');
  return test.length === known.length && timingSafeEqual(test, known);
}

export function requireBoss(req, res, next) {
  if (req.session?.boss) return next();
  return res.redirect('/login');
}

export function requireFuncionario(req, res, next) {
  if (req.session?.funcionarioId) return next();
  return res.redirect('/app/login');
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth.js test/auth.test.js
git commit -m "feat: auth scrypt + middlewares de acesso"
```

---

## Task 3: Repositório de funcionários

**Files:**
- Create: `src/repo/funcionarios.js`, `test/funcionarios.test.js`

- [ ] **Step 1: Teste que falha** — `test/funcionarios.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import * as F from '../src/repo/funcionarios.js';

function setorId(db, nome) {
  return db.prepare('SELECT id FROM setores WHERE nome = ?').get(nome).id;
}

test('criar, editar, listar ativos, definir pin e autenticar', () => {
  const db = openDb(':memory:');
  const caixa = setorId(db, 'Caixa');
  const id = F.criar(db, { nome: 'Larissa', setorId: caixa, cor: '#7fb3ff', aniversario: '10/04' });
  assert.ok(id > 0);

  const ativos = F.listarAtivos(db);
  assert.equal(ativos.length, 1);
  assert.equal(ativos[0].nome, 'Larissa');
  assert.equal(ativos[0].setor, 'Caixa');

  // edita nome, cor e setor
  F.editar(db, id, { nome: 'Larissa M.', setorId: setorId(db, 'Atendente'), cor: '#86d191', aniversario: '11/04' });
  assert.equal(F.buscar(db, id).nome, 'Larissa M.');
  assert.equal(F.buscar(db, id).setor, 'Atendente');

  F.definirPin(db, id, '1234');
  assert.equal(F.autenticar(db, 'Larissa M.', '1234')?.id, id);
  assert.equal(F.autenticar(db, 'Larissa M.', '0000'), null);

  F.desativar(db, id);
  assert.equal(F.listarAtivos(db).length, 0);
});

test('listarPorSetor agrupa os ativos na ordem dos setores', () => {
  const db = openDb(':memory:');
  F.criar(db, { nome: 'Bia', setorId: setorId(db, 'Atendente') });
  F.criar(db, { nome: 'Ana', setorId: setorId(db, 'Caixa') });
  const grupos = F.listarPorSetor(db);
  // 'Caixa' (ordem 1) vem antes de 'Atendente' (ordem 2)
  assert.equal(grupos[0].setor, 'Caixa');
  assert.equal(grupos[0].funcionarios[0].nome, 'Ana');
  assert.equal(grupos[1].setor, 'Atendente');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `src/repo/funcionarios.js`**

```js
import { hashSecret, verifySecret } from '../auth.js';

const SELECT_BASE = `
  SELECT f.id, f.nome, f.setor_id, s.nome AS setor, s.ordem AS setor_ordem,
         f.cor, f.aniversario, f.ativo
  FROM funcionarios f LEFT JOIN setores s ON s.id = f.setor_id
`;

export function criar(db, { nome, setorId = null, cor = null, aniversario = null }) {
  const info = db.prepare(
    'INSERT INTO funcionarios (nome, setor_id, cor, aniversario) VALUES (?,?,?,?)'
  ).run(nome.trim(), setorId, cor, aniversario);
  return info.lastInsertRowid;
}

export function editar(db, id, { nome, setorId = null, cor = null, aniversario = null }) {
  db.prepare(
    'UPDATE funcionarios SET nome = ?, setor_id = ?, cor = ?, aniversario = ? WHERE id = ?'
  ).run(nome.trim(), setorId, cor, aniversario, id);
}

export function listarAtivos(db) {
  return db.prepare(
    SELECT_BASE + ' WHERE f.ativo = 1 ORDER BY s.ordem, f.nome'
  ).all();
}

// Agrupa os ativos por setor, na ordem dos setores. [{ setor, funcionarios: [...] }]
export function listarPorSetor(db) {
  const grupos = [];
  for (const f of listarAtivos(db)) {
    const nomeSetor = f.setor || 'Sem setor';
    let g = grupos.find(x => x.setor === nomeSetor);
    if (!g) { g = { setor: nomeSetor, funcionarios: [] }; grupos.push(g); }
    g.funcionarios.push(f);
  }
  return grupos;
}

export function listarTodos(db) {
  return db.prepare(SELECT_BASE + ' ORDER BY s.ordem, f.nome').all();
}

export function buscar(db, id) {
  return db.prepare(SELECT_BASE + ' WHERE f.id = ?').get(id);
}

export function definirPin(db, id, pin) {
  db.prepare('UPDATE funcionarios SET pin = ? WHERE id = ?').run(hashSecret(pin), id);
}

export function autenticar(db, nome, pin) {
  const row = db.prepare(
    'SELECT * FROM funcionarios WHERE nome = ? AND ativo = 1'
  ).get(nome.trim());
  if (!row || !verifySecret(pin, row.pin)) return null;
  return { id: row.id, nome: row.nome };
}

export function desativar(db, id) {
  db.prepare('UPDATE funcionarios SET ativo = 0 WHERE id = ?').run(id);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repo/funcionarios.js test/funcionarios.test.js
git commit -m "feat: repo de funcionários (CRUD + PIN)"
```

---

## Task 4: Repositório de escala (célula + período + caixas)

**Files:**
- Create: `src/repo/escala.js`, `test/escala.test.js`

- [ ] **Step 1: Teste que falha** — `test/escala.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import * as F from '../src/repo/funcionarios.js';
import * as E from '../src/repo/escala.js';

test('definir célula faz upsert e período retorna o mapa', () => {
  const db = openDb(':memory:');
  const a = F.criar(db, { nome: 'Ana' });
  E.definirCelula(db, a, '2026-06-15', 'manha');
  E.definirCelula(db, a, '2026-06-15', 'folga');   // sobrescreve
  E.definirCelula(db, a, '2026-06-16', 'tarde');

  const mapa = E.periodo(db, '2026-06-15', '2026-06-16');
  assert.equal(mapa[`${a}|2026-06-15`], 'folga');
  assert.equal(mapa[`${a}|2026-06-16`], 'tarde');
});

test('limpar célula remove o turno', () => {
  const db = openDb(':memory:');
  const a = F.criar(db, { nome: 'Ana' });
  E.definirCelula(db, a, '2026-06-15', 'manha');
  E.limparCelula(db, a, '2026-06-15');
  assert.equal(E.periodo(db, '2026-06-15', '2026-06-15')[`${a}|2026-06-15`], undefined);
});

test('escala de caixa faz upsert por posto/horário/dia', () => {
  const db = openDb(':memory:');
  const j = F.criar(db, { nome: 'Jairo' });
  E.definirCaixa(db, { data: '2026-06-15', posto: 'Caixa 1', horario: '06:00-14:30', funcionarioId: j });
  E.definirCaixa(db, { data: '2026-06-15', posto: 'Caixa 1', horario: '06:00-14:30', funcionarioId: j });
  const linhas = E.caixasDoDia(db, '2026-06-15');
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].funcionario_id, j);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `src/repo/escala.js`**

```js
export function definirCelula(db, funcionarioId, data, turno) {
  db.prepare(`
    INSERT INTO escala_dia (funcionario_id, data, turno) VALUES (?,?,?)
    ON CONFLICT(funcionario_id, data) DO UPDATE SET turno = excluded.turno
  `).run(funcionarioId, data, turno);
}

export function limparCelula(db, funcionarioId, data) {
  db.prepare('DELETE FROM escala_dia WHERE funcionario_id = ? AND data = ?').run(funcionarioId, data);
}

// Retorna um mapa { 'funcId|YYYY-MM-DD': turno } para renderizar a grade rápido.
export function periodo(db, inicio, fim) {
  const rows = db.prepare(
    'SELECT funcionario_id, data, turno FROM escala_dia WHERE data BETWEEN ? AND ?'
  ).all(inicio, fim);
  const mapa = {};
  for (const r of rows) mapa[`${r.funcionario_id}|${r.data}`] = r.turno;
  return mapa;
}

// Próximos turnos de um funcionário a partir de uma data (inclusive).
export function turnosDoFuncionario(db, funcionarioId, deData, limite = 30) {
  return db.prepare(`
    SELECT data, turno FROM escala_dia
    WHERE funcionario_id = ? AND data >= ?
    ORDER BY data ASC LIMIT ?
  `).all(funcionarioId, deData, limite);
}

export function definirCaixa(db, { data, posto, horario, funcionarioId }) {
  db.prepare(`
    INSERT INTO escala_caixa (data, posto, horario, funcionario_id) VALUES (?,?,?,?)
    ON CONFLICT(data, posto, horario) DO UPDATE SET funcionario_id = excluded.funcionario_id
  `).run(data, posto, horario, funcionarioId);
}

export function caixasDoDia(db, data) {
  return db.prepare('SELECT * FROM escala_caixa WHERE data = ? ORDER BY posto, horario').all(data);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repo/escala.js test/escala.test.js
git commit -m "feat: repo de escala (célula, período, caixas)"
```

---

## Task 5: Solicitações + notificação + aprovação

**Files:**
- Create: `src/repo/solicitacoes.js`, `test/solicitacoes.test.js`

- [ ] **Step 1: Teste que falha** — `test/solicitacoes.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import * as F from '../src/repo/funcionarios.js';
import * as E from '../src/repo/escala.js';
import * as S from '../src/repo/solicitacoes.js';

const AGORA = '2026-06-16T10:00:00';

test('criar pedido gera notificação pro patrão', () => {
  const db = openDb(':memory:');
  const ana = F.criar(db, { nome: 'Ana' });
  const id = S.criar(db, { funcionarioId: ana, tipo: 'folga', dataInicio: '2026-06-20' }, AGORA);
  assert.ok(id > 0);

  const pend = S.pendentes(db);
  assert.equal(pend.length, 1);
  assert.equal(pend[0].nome, 'Ana');

  const naoLidas = S.notificacoesNaoLidas(db);
  assert.equal(naoLidas.length, 1);
  assert.match(naoLidas[0].texto, /Ana/);
});

test('aprovar folga grava a célula e fecha o pedido', () => {
  const db = openDb(':memory:');
  const ana = F.criar(db, { nome: 'Ana' });
  const id = S.criar(db, { funcionarioId: ana, tipo: 'folga', dataInicio: '2026-06-20' }, AGORA);

  S.aprovar(db, id, AGORA);
  assert.equal(E.periodo(db, '2026-06-20', '2026-06-20')[`${ana}|2026-06-20`], 'folga');
  assert.equal(S.pendentes(db).length, 0);
});

test('aprovar férias preenche todas as datas do intervalo', () => {
  const db = openDb(':memory:');
  const ana = F.criar(db, { nome: 'Ana' });
  const id = S.criar(db, { funcionarioId: ana, tipo: 'ferias', dataInicio: '2026-09-01', dataFim: '2026-09-03' }, AGORA);
  S.aprovar(db, id, AGORA);
  const mapa = E.periodo(db, '2026-09-01', '2026-09-03');
  assert.equal(mapa[`${ana}|2026-09-01`], 'ferias');
  assert.equal(mapa[`${ana}|2026-09-02`], 'ferias');
  assert.equal(mapa[`${ana}|2026-09-03`], 'ferias');
});

test('recusar guarda motivo e não toca na escala', () => {
  const db = openDb(':memory:');
  const ana = F.criar(db, { nome: 'Ana' });
  const id = S.criar(db, { funcionarioId: ana, tipo: 'folga', dataInicio: '2026-06-20' }, AGORA);
  S.recusar(db, id, 'sem cobertura', AGORA);
  assert.equal(E.periodo(db, '2026-06-20', '2026-06-20')[`${ana}|2026-06-20`], undefined);
  const meus = S.doFuncionario(db, ana);
  assert.equal(meus[0].status, 'recusado');
  assert.equal(meus[0].motivo_resposta, 'sem cobertura');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `src/repo/solicitacoes.js`**

```js
import * as E from './escala.js';

// Gera as datas 'YYYY-MM-DD' de inicio até fim (inclusive). Só data, sem timezone.
function diasNoIntervalo(inicio, fim) {
  const out = [];
  let [y, m, d] = inicio.split('-').map(Number);
  const limite = fim || inicio;
  let atual = inicio;
  while (atual <= limite) {
    out.push(atual);
    d += 1;
    let dt = new Date(Date.UTC(y, m - 1, d));
    y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate();
    atual = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  return out;
}

const ROTULO = { ferias: 'férias', folga: 'folga', troca: 'troca de dia' };

export function criar(db, pedido, agora) {
  const { funcionarioId, tipo, dataInicio, dataFim = null,
          dataTrocaDestino = null, funcionarioTrocaId = null, observacao = null } = pedido;
  const tx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO solicitacoes
        (funcionario_id, tipo, data_inicio, data_fim, data_troca_destino,
         funcionario_troca_id, observacao, status, created_at)
      VALUES (?,?,?,?,?,?,?, 'pendente', ?)
    `).run(funcionarioId, tipo, dataInicio, dataFim, dataTrocaDestino,
           funcionarioTrocaId, observacao, agora);
    const sid = info.lastInsertRowid;
    const nome = db.prepare('SELECT nome FROM funcionarios WHERE id = ?').get(funcionarioId).nome;
    const periodo = dataFim && dataFim !== dataInicio ? `${dataInicio} a ${dataFim}` : dataInicio;
    db.prepare(`
      INSERT INTO notificacoes (destinatario, solicitacao_id, texto, created_at)
      VALUES ('patrao', ?, ?, ?)
    `).run(sid, `${nome} pediu ${ROTULO[tipo]} (${periodo})`, agora);
    return sid;
  });
  return tx();
}

export function pendentes(db) {
  return db.prepare(`
    SELECT s.*, f.nome FROM solicitacoes s
    JOIN funcionarios f ON f.id = s.funcionario_id
    WHERE s.status = 'pendente' ORDER BY s.created_at
  `).all();
}

export function doFuncionario(db, funcionarioId) {
  return db.prepare(
    'SELECT * FROM solicitacoes WHERE funcionario_id = ? ORDER BY created_at DESC'
  ).all(funcionarioId);
}

export function notificacoesNaoLidas(db) {
  return db.prepare(
    "SELECT * FROM notificacoes WHERE destinatario='patrao' AND lida=0 ORDER BY created_at DESC"
  ).all();
}

export function marcarNotificacoesLidas(db) {
  db.prepare("UPDATE notificacoes SET lida=1 WHERE destinatario='patrao' AND lida=0").run();
}

export function aprovar(db, solicitacaoId, agora) {
  const s = db.prepare('SELECT * FROM solicitacoes WHERE id = ?').get(solicitacaoId);
  if (!s || s.status !== 'pendente') return;
  const tx = db.transaction(() => {
    if (s.tipo === 'ferias' || s.tipo === 'folga') {
      const turno = s.tipo === 'ferias' ? 'ferias' : 'folga';
      for (const dia of diasNoIntervalo(s.data_inicio, s.data_fim)) {
        E.definirCelula(db, s.funcionario_id, dia, turno);
      }
    } else if (s.tipo === 'troca') {
      // Troca de dia: a data pedida vira folga; o destino fica a cargo do Carlos ajustar manualmente.
      E.definirCelula(db, s.funcionario_id, s.data_inicio, 'folga');
    }
    db.prepare("UPDATE solicitacoes SET status='aprovado', respondido_em=? WHERE id=?")
      .run(agora, solicitacaoId);
  });
  tx();
}

export function recusar(db, solicitacaoId, motivo, agora) {
  db.prepare("UPDATE solicitacoes SET status='recusado', motivo_resposta=?, respondido_em=? WHERE id=? AND status='pendente'")
    .run(motivo || null, agora, solicitacaoId);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS (4 testes do arquivo).

- [ ] **Step 5: Commit**

```bash
git add src/repo/solicitacoes.js test/solicitacoes.test.js
git commit -m "feat: solicitações com notificação e aprovação que grava na escala"
```

---

## Task 6: Repositório de sugestão de férias

**Files:**
- Create: `src/repo/ferias.js`, `test/ferias.test.js`

- [ ] **Step 1: Teste que falha** — `test/ferias.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import * as F from '../src/repo/funcionarios.js';
import * as V from '../src/repo/ferias.js';

test('define e lista sugestão de férias por funcionário', () => {
  const db = openDb(':memory:');
  const ana = F.criar(db, { nome: 'Ana' });
  V.definir(db, { funcionarioId: ana, mes: 9, ano: 2026 });
  const lista = V.listar(db, 2026);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].mes, 9);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `src/repo/ferias.js`**

```js
export function definir(db, { funcionarioId, mes, ano }) {
  db.prepare(
    'INSERT INTO ferias_sugestao (funcionario_id, mes, ano) VALUES (?,?,?)'
  ).run(funcionarioId, mes, ano);
}

export function listar(db, ano) {
  return db.prepare(`
    SELECT v.id, v.mes, v.ano, v.funcionario_id, f.nome
    FROM ferias_sugestao v JOIN funcionarios f ON f.id = v.funcionario_id
    WHERE v.ano = ? ORDER BY v.mes
  `).all(ano);
}

export function remover(db, id) {
  db.prepare('DELETE FROM ferias_sugestao WHERE id = ?').run(id);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repo/ferias.js test/ferias.test.js
git commit -m "feat: repo de sugestão de férias"
```

---

## Task 7: Servidor Express + sessão + login

**Files:**
- Create: `server.js`, `src/routes/auth.js`, `views/login-boss.ejs`, `views/login-func.ejs`, `public/css/app.css`

- [ ] **Step 1: Implementar `server.js`**

```js
import express from 'express';
import session from 'express-session';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openDb } from './src/db.js';
import { PORT, SESSION_SECRET, DB_PATH } from './src/config.js';
import authRoutes from './src/routes/auth.js';
import bossRoutes from './src/routes/boss.js';
import funcRoutes from './src/routes/func.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = openDb(DB_PATH);

const app = express();
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));
app.use(session({
  secret: SESSION_SECRET, resave: false, saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 },
}));
app.use((req, _res, next) => { req.db = db; next(); });

app.use('/', authRoutes);
app.use('/', bossRoutes);
app.use('/app', funcRoutes);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Inova Folga em http://localhost:${PORT}`));
```

- [ ] **Step 2: Implementar `src/routes/auth.js`**

```js
import { Router } from 'express';
import { BOSS_USER, BOSS_PASS } from '../config.js';
import * as F from '../repo/funcionarios.js';

const router = Router();

router.get('/login', (req, res) => res.render('login-boss', { erro: null }));

router.post('/login', (req, res) => {
  const { usuario, senha } = req.body;
  if (usuario === BOSS_USER && senha === BOSS_PASS) {
    req.session.boss = true;
    return res.redirect('/quadro');
  }
  res.render('login-boss', { erro: 'Usuário ou senha inválidos' });
});

router.get('/app/login', (req, res) => res.render('login-func', { erro: null }));

router.post('/app/login', (req, res) => {
  const { nome, pin } = req.body;
  const f = F.autenticar(req.db, nome, pin);
  if (!f) return res.render('login-func', { erro: 'Nome ou PIN inválidos' });
  req.session.funcionarioId = f.id;
  req.session.funcionarioNome = f.nome;
  res.redirect('/app');
});

router.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));
router.get('/app/logout', (req, res) => req.session.destroy(() => res.redirect('/app/login')));

export default router;
```

- [ ] **Step 3: Implementar `views/login-boss.ejs` e `views/login-func.ejs`**

`views/login-boss.ejs`:
```html
<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Inova Folga — Patrão</title><link rel="stylesheet" href="/css/app.css"></head>
<body class="login">
  <form method="post" action="/login" class="card">
    <h1>Inova Folga</h1>
    <% if (erro) { %><p class="erro"><%= erro %></p><% } %>
    <input name="usuario" placeholder="Usuário" autofocus required>
    <input name="senha" type="password" placeholder="Senha" required>
    <button>Entrar</button>
    <a href="/app/login" class="link">Sou funcionário</a>
  </form>
</body></html>
```

`views/login-func.ejs`:
```html
<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Inova Folga</title><link rel="stylesheet" href="/css/app.css"></head>
<body class="login">
  <form method="post" action="/app/login" class="card">
    <h1>Minha Escala</h1>
    <% if (erro) { %><p class="erro"><%= erro %></p><% } %>
    <input name="nome" placeholder="Seu nome" autofocus required>
    <input name="pin" type="password" inputmode="numeric" placeholder="PIN" required>
    <button>Entrar</button>
    <a href="/login" class="link">Sou o patrão</a>
  </form>
</body></html>
```

- [ ] **Step 4: Implementar `public/css/app.css` (base mobile-first)**

```css
* { box-sizing: border-box; }
body { font-family: system-ui, sans-serif; margin: 0; background: #f4f5f7; color: #1d1f24; }
.login { display: grid; place-items: center; min-height: 100vh; }
.card { background: #fff; padding: 24px; border-radius: 14px; box-shadow: 0 8px 24px rgba(0,0,0,.08);
        display: grid; gap: 12px; width: min(92vw, 340px); }
.card h1 { margin: 0 0 4px; color: #c8102e; font-size: 22px; }
.card input, .card button { padding: 12px; border-radius: 10px; border: 1px solid #d6d8de; font-size: 16px; }
.card button { background: #c8102e; color: #fff; border: 0; font-weight: 700; }
.erro { color: #c8102e; margin: 0; font-size: 14px; }
.link { text-align: center; color: #6b7280; font-size: 14px; text-decoration: none; }
.grid-wrap { overflow: auto; }
table.quadro { border-collapse: collapse; font-size: 12px; }
table.quadro th, table.quadro td { border: 1px solid #e1e3e8; padding: 4px 6px; text-align: center; white-space: nowrap; }
table.quadro td.cel { cursor: pointer; min-width: 34px; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; }
```

- [ ] **Step 5: Stub temporário de boss/func p/ subir** — criar `src/routes/boss.js` e `src/routes/func.js` mínimos (serão completados nas próximas tasks):

`src/routes/boss.js`:
```js
import { Router } from 'express';
import { requireBoss } from '../auth.js';
const router = Router();
router.get('/quadro', requireBoss, (req, res) => res.send('Quadro (em construção)'));
export default router;
```

`src/routes/func.js`:
```js
import { Router } from 'express';
import { requireFuncionario } from '../auth.js';
const router = Router();
router.get('/', requireFuncionario, (req, res) => res.send('App (em construção)'));
export default router;
```

- [ ] **Step 6: Subir e verificar login**

Run: `npm start` e abrir `http://localhost:3900/login`
Expected: tela de login; logar com `carlos` / `inova2026` redireciona pra `/quadro` mostrando "Quadro (em construção)". `GET /health` → `{"ok":true}`.

- [ ] **Step 7: Commit**

```bash
git add server.js src/routes/auth.js src/routes/boss.js src/routes/func.js views/login-boss.ejs views/login-func.ejs public/css/app.css
git commit -m "feat: servidor express, sessão e telas de login"
```

---

## Task 8: Quadro de Horário (PC) — visualização e edição de célula

**Files:**
- Modify: `src/routes/boss.js`
- Create: `views/boss/quadro.ejs`, `public/js/quadro.js`
- Create: `src/lib/datas.js` (helpers de período/semana)

- [ ] **Step 1: Helper de datas** — `src/lib/datas.js`

```js
// Lista de N dias a partir de 'inicio' (YYYY-MM-DD), com rótulo de dia da semana.
const SEMANA = ['DOM','2a','3a','4a','5a','6a','SAB'];
export function dias(inicio, n) {
  const out = [];
  let [y, m, d] = inicio.split('-').map(Number);
  for (let i = 0; i < n; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const iso = dt.toISOString().slice(0, 10);
    out.push({ iso, dia: dt.getUTCDate(), semana: SEMANA[dt.getUTCDay()],
               fimDeSemana: [0,6].includes(dt.getUTCDay()) });
  }
  return out;
}
```

- [ ] **Step 2: Rotas do quadro em `src/routes/boss.js`** (substituir o stub)

```js
import { Router } from 'express';
import { requireBoss } from '../auth.js';
import { TURNOS } from '../db.js';
import * as F from '../repo/funcionarios.js';
import * as E from '../repo/escala.js';
import { dias } from '../lib/datas.js';

const router = Router();

// Turnos vêm do banco (são editáveis), não da constante estática.
export function carregarTurnos(db) {
  const turnos = db.prepare('SELECT codigo, rotulo, cor, inicio, fim FROM turnos').all();
  const corPorTurno = Object.fromEntries(turnos.map(t => [t.codigo, t.cor]));
  return { turnos, corPorTurno };
}

router.get('/quadro', requireBoss, (req, res) => {
  const inicio = req.query.inicio || hojeISO();
  const periodoDias = dias(inicio, 21);
  const grupos = F.listarPorSetor(req.db);
  const mapa = E.periodo(req.db, periodoDias[0].iso, periodoDias.at(-1).iso);
  const { turnos, corPorTurno } = carregarTurnos(req.db);
  res.render('boss/quadro', { grupos, dias: periodoDias, mapa, turnos, corPorTurno, inicio });
});

router.post('/quadro/celula', requireBoss, (req, res) => {
  const { funcionarioId, data, turno } = req.body;
  const { corPorTurno } = carregarTurnos(req.db);
  if (turno === '') E.limparCelula(req.db, Number(funcionarioId), data);
  else E.definirCelula(req.db, Number(funcionarioId), data, turno);
  res.json({ ok: true, cor: corPorTurno[turno] || '' });
});

function hojeISO() { return new Date().toISOString().slice(0, 10); }

export default router;
```

- [ ] **Step 3: View `views/boss/quadro.ejs`**

```html
<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Quadro de Horário</title><link rel="stylesheet" href="/css/app.css"></head>
<body>
  <header style="padding:12px 16px;display:flex;gap:12px;align-items:center;background:#fff;border-bottom:1px solid #e1e3e8">
    <strong style="color:#c8102e">Inova Folga</strong>
    <nav style="display:flex;gap:12px">
      <a href="/quadro">Quadro</a><a href="/caixas">Caixas</a>
      <a href="/pendencias">Pendências</a><a href="/cadastros">Cadastros</a>
    </nav>
    <a href="/logout" style="margin-left:auto">Sair</a>
  </header>
  <main style="padding:16px">
    <div class="grid-wrap">
      <table class="quadro">
        <thead><tr><th>Funcionário</th>
          <% dias.forEach(d => { %><th class="<%= d.fimDeSemana ? 'fds' : '' %>"><%= d.dia %><br><small><%= d.semana %></small></th><% }) %>
        </tr></thead>
        <tbody>
          <% grupos.forEach(g => { %>
          <tr class="setor-row"><th colspan="<%= dias.length + 1 %>" style="text-align:left;background:#eef0f4;color:#555"><%= g.setor %></th></tr>
          <% g.funcionarios.forEach(f => { %>
          <tr><th style="text-align:left"><%= f.nome %></th>
            <% dias.forEach(d => { const t = mapa[f.id + '|' + d.iso]; %>
              <td class="cel" data-func="<%= f.id %>" data-data="<%= d.iso %>"
                  style="background:<%= t ? corPorTurno[t] : '' %>"></td>
            <% }) %>
          </tr>
          <% }) %>
          <% }) %>
        </tbody>
      </table>
    </div>
  </main>
  <datalist id="turnos">
    <% turnos.forEach(t => { %><option value="<%= t.codigo %>"><%= t.rotulo %></option><% }) %>
  </datalist>
  <script>
    window.TURNOS = <%- JSON.stringify(turnos) %>;
  </script>
  <script src="/js/quadro.js"></script>
</body></html>
```

- [ ] **Step 4: JS de edição `public/js/quadro.js`**

```js
// Clicar numa célula abre um menu simples de turnos; escolher salva via fetch.
const turnos = window.TURNOS;
document.querySelectorAll('td.cel').forEach(td => {
  td.addEventListener('click', async () => {
    const escolha = prompt(
      'Turno para ' + td.dataset.data + ':\n' +
      turnos.map(t => `${t.codigo} = ${t.rotulo}`).join('\n') +
      '\n(vazio = limpar)'
    );
    if (escolha === null) return;
    const turno = escolha.trim();
    const r = await fetch('/quadro/celula', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcionarioId: td.dataset.func, data: td.dataset.data, turno })
    });
    const j = await r.json();
    td.style.background = j.cor || '';
  });
});
```

- [ ] **Step 5: Verificar manualmente**

Run: `npm start`, cadastrar 1 funcionário pela Task 10 (ou via SQLite), abrir `/quadro`, clicar numa célula, digitar `folga` → célula fica verde; recarregar a página → cor persiste.

- [ ] **Step 6: Commit**

```bash
git add src/routes/boss.js src/lib/datas.js views/boss/quadro.ejs public/js/quadro.js
git commit -m "feat: quadro de horário com edição de célula"
```

---

## Task 9: Pendências do Carlos (aprovar/recusar) + cadastros

**Files:**
- Modify: `src/routes/boss.js`
- Create: `views/boss/pendencias.ejs`, `views/boss/cadastros.ejs`, `views/boss/caixas.ejs`

- [ ] **Step 1: Adicionar rotas em `src/routes/boss.js`** (importar repos e registrar)

```js
import * as S from '../repo/solicitacoes.js';
import * as V from '../repo/ferias.js';

router.get('/pendencias', requireBoss, (req, res) => {
  const pend = S.pendentes(req.db);
  S.marcarNotificacoesLidas(req.db);
  res.render('boss/pendencias', { pend });
});

router.post('/pendencias/:id/aprovar', requireBoss, (req, res) => {
  S.aprovar(req.db, Number(req.params.id), new Date().toISOString());
  res.redirect('/pendencias');
});

router.post('/pendencias/:id/recusar', requireBoss, (req, res) => {
  S.recusar(req.db, Number(req.params.id), req.body.motivo, new Date().toISOString());
  res.redirect('/pendencias');
});

router.get('/cadastros', requireBoss, (req, res) => {
  res.render('boss/cadastros', { funcionarios: F.listarTodos(req.db) });
});

router.post('/cadastros', requireBoss, (req, res) => {
  const { nome, cor, aniversario, pin } = req.body;
  const id = F.criar(req.db, { nome, cor: cor || null, aniversario: aniversario || null });
  if (pin) F.definirPin(req.db, id, pin);
  res.redirect('/cadastros');
});

router.post('/cadastros/:id/pin', requireBoss, (req, res) => {
  F.definirPin(req.db, Number(req.params.id), req.body.pin);
  res.redirect('/cadastros');
});

router.post('/cadastros/:id/desativar', requireBoss, (req, res) => {
  F.desativar(req.db, Number(req.params.id));
  res.redirect('/cadastros');
});
```

Adicionar contador de não-lidas pro sino — middleware no topo do router (depois de `requireBoss` não dá; usar app-level). Registrar em `server.js` antes das rotas boss:

```js
// em server.js, após o middleware que injeta req.db:
import * as Sx from './src/repo/solicitacoes.js';
app.use((req, res, next) => {
  res.locals.naoLidas = req.session?.boss ? Sx.notificacoesNaoLidas(db).length : 0;
  next();
});
```

E no header de `views/boss/quadro.ejs` (e nas outras views boss) trocar o link de Pendências por:
```html
<a href="/pendencias">Pendências<% if (typeof naoLidas !== 'undefined' && naoLidas > 0) { %> <span class="badge" style="background:#c8102e;color:#fff"><%= naoLidas %></span><% } %></a>
```

- [ ] **Step 2: View `views/boss/pendencias.ejs`**

```html
<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pendências</title><link rel="stylesheet" href="/css/app.css"></head>
<body>
  <header style="padding:12px 16px;background:#fff;border-bottom:1px solid #e1e3e8">
    <a href="/quadro">← Quadro</a> &nbsp; <strong>Pedidos pendentes</strong>
  </header>
  <main style="padding:16px;display:grid;gap:12px;max-width:640px">
    <% if (pend.length === 0) { %><p>Nenhum pedido pendente. 🎉</p><% } %>
    <% pend.forEach(s => { %>
      <div class="card" style="width:auto">
        <strong><%= s.nome %></strong> — <%= s.tipo %>
        <div><%= s.data_inicio %><%= s.data_fim ? ' a ' + s.data_fim : '' %></div>
        <% if (s.observacao) { %><div><em><%= s.observacao %></em></div><% } %>
        <div style="display:flex;gap:8px">
          <form method="post" action="/pendencias/<%= s.id %>/aprovar"><button>Aprovar</button></form>
          <form method="post" action="/pendencias/<%= s.id %>/recusar" style="display:flex;gap:6px">
            <input name="motivo" placeholder="motivo (opcional)">
            <button style="background:#6b7280">Recusar</button>
          </form>
        </div>
      </div>
    <% }) %>
  </main>
</body></html>
```

- [ ] **Step 3: View `views/boss/cadastros.ejs`**

```html
<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cadastros</title><link rel="stylesheet" href="/css/app.css"></head>
<body>
  <header style="padding:12px 16px;background:#fff;border-bottom:1px solid #e1e3e8">
    <a href="/quadro">← Quadro</a> &nbsp; <strong>Funcionários</strong>
  </header>
  <main style="padding:16px;display:grid;gap:16px;max-width:640px">
    <form method="post" action="/cadastros" class="card" style="width:auto">
      <strong>Novo funcionário</strong>
      <input name="nome" placeholder="Nome" required>
      <input name="cor" type="color" value="#7fb3ff">
      <input name="aniversario" placeholder="Aniversário DD/MM">
      <input name="pin" placeholder="PIN inicial" inputmode="numeric">
      <button>Adicionar</button>
    </form>
    <table class="quadro" style="font-size:14px">
      <thead><tr><th>Nome</th><th>Aniv.</th><th>Ativo</th><th>PIN</th><th></th></tr></thead>
      <tbody>
        <% funcionarios.forEach(f => { %>
        <tr>
          <td style="text-align:left"><%= f.nome %></td>
          <td><%= f.aniversario || '' %></td>
          <td><%= f.ativo ? 'sim' : 'não' %></td>
          <td><form method="post" action="/cadastros/<%= f.id %>/pin" style="display:flex;gap:4px">
            <input name="pin" placeholder="novo PIN" style="width:90px"><button>OK</button></form></td>
          <td><% if (f.ativo) { %><form method="post" action="/cadastros/<%= f.id %>/desativar">
            <button style="background:#6b7280">Desativar</button></form><% } %></td>
        </tr>
        <% }) %>
      </tbody>
    </table>
  </main>
</body></html>
```

- [ ] **Step 4: View `views/boss/caixas.ejs` + rotas**

Adicionar em `src/routes/boss.js`:
```js
const POSTOS = ['Caixa 1','Caixa 2','Caixa 3','Entrega'];
const HORARIOS = ['06:00-14:30','08:00-16:30','14:30-22:00','16:30-24:00'];

router.get('/caixas', requireBoss, (req, res) => {
  const data = req.query.data || new Date().toISOString().slice(0,10);
  const linhas = E.caixasDoDia(req.db, data);
  const mapa = {};
  for (const l of linhas) mapa[`${l.posto}|${l.horario}`] = l.funcionario_id;
  res.render('boss/caixas', { data, postos: POSTOS, horarios: HORARIOS, mapa, funcionarios: F.listarAtivos(req.db) });
});

router.post('/caixas', requireBoss, (req, res) => {
  const { data, posto, horario, funcionarioId } = req.body;
  E.definirCaixa(req.db, { data, posto, horario, funcionarioId: funcionarioId ? Number(funcionarioId) : null });
  res.redirect('/caixas?data=' + encodeURIComponent(data));
});
```

`views/boss/caixas.ejs`:
```html
<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Escala de Caixas</title><link rel="stylesheet" href="/css/app.css"></head>
<body>
  <header style="padding:12px 16px;background:#fff;border-bottom:1px solid #e1e3e8">
    <a href="/quadro">← Quadro</a> &nbsp; <strong>Caixas — <%= data %></strong>
    <form style="display:inline" method="get"><input type="date" name="data" value="<%= data %>" onchange="this.form.submit()"></form>
  </header>
  <main style="padding:16px;max-width:720px">
    <table class="quadro" style="font-size:14px;width:100%">
      <thead><tr><th>Posto</th><th>Horário</th><th>Funcionário</th></tr></thead>
      <tbody>
        <% postos.forEach(p => horarios.forEach(h => { const sel = mapa[p + '|' + h]; %>
        <tr><td><%= p %></td><td><%= h %></td>
          <td><form method="post" action="/caixas" style="display:flex;gap:6px">
            <input type="hidden" name="data" value="<%= data %>">
            <input type="hidden" name="posto" value="<%= p %>">
            <input type="hidden" name="horario" value="<%= h %>">
            <select name="funcionarioId" onchange="this.form.submit()">
              <option value="">—</option>
              <% funcionarios.forEach(f => { %><option value="<%= f.id %>" <%= sel == f.id ? 'selected' : '' %>><%= f.nome %></option><% }) %>
            </select>
          </form></td>
        </tr>
        <% })) %>
      </tbody>
    </table>
  </main>
</body></html>
```

- [ ] **Step 5: Verificar manualmente**

Run: `npm start`. Em `/cadastros` adicionar funcionário com PIN. Em `/caixas` escolher nome num posto → recarregar persiste. Criar um pedido pelo app (Task 10) e aprová-lo em `/pendencias` → some da lista e aparece no `/quadro`.

- [ ] **Step 6: Commit**

```bash
git add src/routes/boss.js server.js views/boss/pendencias.ejs views/boss/cadastros.ejs views/boss/caixas.ejs views/boss/quadro.ejs
git commit -m "feat: pendências, cadastros, escala de caixas e sino de notificações"
```

---

## Task 10: App do funcionário (celular) — home + pedidos

**Files:**
- Modify: `src/routes/func.js`
- Create: `views/func/home.ejs`, `views/func/pedido.ejs`, `views/func/meus-pedidos.ejs`

- [ ] **Step 1: Rotas em `src/routes/func.js`** (substituir o stub)

```js
import { Router } from 'express';
import { requireFuncionario } from '../auth.js';
import * as E from '../repo/escala.js';
import * as S from '../repo/solicitacoes.js';
import { TURNOS } from '../db.js';

const router = Router();
const rotuloTurno = Object.fromEntries(TURNOS.map(t => [t.codigo, t.rotulo]));

router.get('/', requireFuncionario, (req, res) => {
  const id = req.session.funcionarioId;
  const hoje = new Date().toISOString().slice(0,10);
  const proximos = E.turnosDoFuncionario(req.db, id, hoje, 30);
  const hojeTurno = proximos.find(p => p.data === hoje);
  const proximaFolga = proximos.find(p => p.turno === 'folga');
  const proximasFerias = proximos.find(p => p.turno === 'ferias');
  res.render('func/home', {
    nome: req.session.funcionarioNome, hoje, proximos, hojeTurno,
    proximaFolga, proximasFerias, rotuloTurno,
  });
});

router.get('/pedido', requireFuncionario, (req, res) => {
  res.render('func/pedido', { tipo: req.query.tipo || 'folga' });
});

router.post('/pedido', requireFuncionario, (req, res) => {
  const { tipo, dataInicio, dataFim, observacao } = req.body;
  S.criar(req.db, {
    funcionarioId: req.session.funcionarioId, tipo,
    dataInicio, dataFim: dataFim || null, observacao: observacao || null,
  }, new Date().toISOString());
  res.redirect('/app/meus-pedidos');
});

router.get('/meus-pedidos', requireFuncionario, (req, res) => {
  res.render('func/meus-pedidos', { pedidos: S.doFuncionario(req.db, req.session.funcionarioId) });
});

export default router;
```

- [ ] **Step 2: View `views/func/home.ejs`**

```html
<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Minha Escala</title><link rel="stylesheet" href="/css/app.css"></head>
<body>
  <header style="padding:16px;background:#c8102e;color:#fff">
    <strong>Oi, <%= nome %></strong>
    <a href="/app/logout" style="color:#fff;float:right">Sair</a>
  </header>
  <main style="padding:16px;display:grid;gap:12px;max-width:480px;margin:auto">
    <div class="card" style="width:auto">
      <small>Hoje</small>
      <strong style="font-size:20px"><%= hojeTurno ? rotuloTurno[hojeTurno.turno] : 'Sem turno marcado' %></strong>
    </div>
    <div class="card" style="width:auto">
      <small>Próxima folga</small>
      <strong style="font-size:20px"><%= proximaFolga ? proximaFolga.data : '—' %></strong>
    </div>
    <div class="card" style="width:auto">
      <small>Próximas férias</small>
      <strong style="font-size:20px"><%= proximasFerias ? proximasFerias.data : '—' %></strong>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <a class="badge" style="background:#ffd84d;text-align:center;padding:14px" href="/app/pedido?tipo=ferias">Agendar férias</a>
      <a class="badge" style="background:#86d191;text-align:center;padding:14px" href="/app/pedido?tipo=folga">Agendar folga</a>
      <a class="badge" style="background:#7fb3ff;text-align:center;padding:14px" href="/app/pedido?tipo=troca">Trocar dia</a>
    </div>
    <a href="/app/meus-pedidos">Meus pedidos →</a>
  </main>
</body></html>
```

- [ ] **Step 3: View `views/func/pedido.ejs`**

```html
<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Novo pedido</title><link rel="stylesheet" href="/css/app.css"></head>
<body>
  <main style="padding:16px;max-width:480px;margin:auto">
    <a href="/app">← Voltar</a>
    <form method="post" action="/app/pedido" class="card" style="width:auto;margin-top:12px">
      <strong>Pedido de
        <%= tipo === 'ferias' ? 'férias' : tipo === 'folga' ? 'folga' : 'troca de dia' %></strong>
      <input type="hidden" name="tipo" value="<%= tipo %>">
      <label>Data início <input type="date" name="dataInicio" required></label>
      <% if (tipo === 'ferias') { %>
        <label>Data fim <input type="date" name="dataFim"></label>
      <% } %>
      <textarea name="observacao" placeholder="Observação (opcional)"></textarea>
      <button>Enviar pedido</button>
    </form>
  </main>
</body></html>
```

- [ ] **Step 4: View `views/func/meus-pedidos.ejs`**

```html
<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Meus pedidos</title><link rel="stylesheet" href="/css/app.css"></head>
<body>
  <main style="padding:16px;max-width:480px;margin:auto">
    <a href="/app">← Voltar</a>
    <h2>Meus pedidos</h2>
    <% if (pedidos.length === 0) { %><p>Você ainda não fez pedidos.</p><% } %>
    <% pedidos.forEach(p => { const cor = p.status==='aprovado'?'#86d191':p.status==='recusado'?'#e3554a':'#ffd84d'; %>
      <div class="card" style="width:auto;margin-bottom:10px">
        <strong><%= p.tipo %></strong> — <%= p.data_inicio %><%= p.data_fim ? ' a ' + p.data_fim : '' %>
        <div><span class="badge" style="background:<%= cor %>"><%= p.status %></span></div>
        <% if (p.motivo_resposta) { %><div><em><%= p.motivo_resposta %></em></div><% } %>
      </div>
    <% }) %>
  </main>
</body></html>
```

- [ ] **Step 5: Verificar fluxo ponta-a-ponta**

Run: `npm start`. Logar como funcionário (PIN criado na Task 9), fazer um pedido de folga p/ uma data → aparece em "Meus pedidos" como `pendente`. Logar como Carlos → `/pendencias` mostra o badge no sino e o pedido → Aprovar → no `/quadro` a célula daquele dia fica verde e em "Meus pedidos" vira `aprovado`.

- [ ] **Step 6: Commit**

```bash
git add src/routes/func.js views/func/home.ejs views/func/pedido.ejs views/func/meus-pedidos.ejs
git commit -m "feat: app do funcionário (home + pedidos + status)"
```

---

## Task 11: Seed inicial dos funcionários e ajuste final

**Files:**
- Create: `scripts/seed-funcionarios.js`

- [ ] **Step 1: Script de seed** — `scripts/seed-funcionarios.js`

```js
// Popula os funcionários da foto 1. Rodar uma vez: node scripts/seed-funcionarios.js
import { openDb } from '../src/db.js';
import * as F from '../src/repo/funcionarios.js';
import { DB_PATH } from '../src/config.js';

const NOMES = [
  'Izadora','Ariane Arch','Micaely','Leidiane','Daniel','Marcelo','Joaquim','Deivid',
  'Vitória','Gustavo','Iggor','Ariane','Felipe','Sandro','Maria Olivia','Rogério',
  'Luis Gustavo','Filipe Estag','Luiz Fernan','Nilton','Nicolas','Jesse','Alan','Aragozo',
  'Jairo','Izabela','Fabiana','Larissa','Enzo','Guilherme','Vitória 2','Thales','Diego',
  'Mateus','Rafael','João Paulo',
];

const db = openDb(DB_PATH);
const existentes = new Set(F.listarTodos(db).map(f => f.nome));
let n = 0;
for (const nome of NOMES) {
  if (!existentes.has(nome)) { F.criar(db, { nome }); n++; }
}
console.log(`Seed: ${n} funcionários adicionados.`);
```

- [ ] **Step 2: Rodar o seed**

Run: `node scripts/seed-funcionarios.js`
Expected: imprime quantos foram adicionados; `/quadro` passa a listar todos.

- [ ] **Step 3: Rodar a suíte completa**

Run: `npm test`
Expected: todos os testes PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-funcionarios.js
git commit -m "chore: seed inicial dos funcionários da foto"
```

---

## Task 12: Feriados (repo) + visão Domingos & Feriados

**Files:**
- Create: `src/repo/feriados.js`, `test/feriados.test.js`
- Modify: `src/routes/boss.js`, `src/lib/datas.js`
- Create: `views/boss/domingos.ejs`

- [ ] **Step 1: Teste que falha** — `test/feriados.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import * as H from '../src/repo/feriados.js';

test('cadastra feriado e consulta conjunto do período', () => {
  const db = openDb(':memory:');
  H.definir(db, '2026-06-18', 'Corpus Christi');
  H.definir(db, '2026-07-09', 'Revolução');
  const set = H.conjuntoNoPeriodo(db, '2026-06-15', '2026-06-30');
  assert.ok(set.has('2026-06-18'));
  assert.ok(!set.has('2026-07-09'));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `src/repo/feriados.js`**

```js
export function definir(db, data, descricao = null) {
  db.prepare(
    'INSERT INTO feriados (data, descricao) VALUES (?,?) ON CONFLICT(data) DO UPDATE SET descricao = excluded.descricao'
  ).run(data, descricao);
}

export function remover(db, data) {
  db.prepare('DELETE FROM feriados WHERE data = ?').run(data);
}

export function listar(db) {
  return db.prepare('SELECT data, descricao FROM feriados ORDER BY data').all();
}

export function conjuntoNoPeriodo(db, inicio, fim) {
  const rows = db.prepare('SELECT data FROM feriados WHERE data BETWEEN ? AND ?').all(inicio, fim);
  return new Set(rows.map(r => r.data));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Adicionar rotas em `src/routes/boss.js`** (visão domingos/feriados + cadastro de feriado)

```js
import * as H from '../repo/feriados.js';

router.get('/domingos', requireBoss, (req, res) => {
  const inicio = req.query.inicio || new Date().toISOString().slice(0,10);
  const todos = dias(inicio, 42); // ~6 semanas
  const feriadosSet = H.conjuntoNoPeriodo(req.db, todos[0].iso, todos.at(-1).iso);
  const colunas = todos.filter(d => d.fimDeSemana || feriadosSet.has(d.iso))
                       .map(d => ({ ...d, feriado: feriadosSet.has(d.iso) }));
  const funcionarios = F.listarAtivos(req.db);
  const mapa = E.periodo(req.db, todos[0].iso, todos.at(-1).iso);
  res.render('boss/domingos', { funcionarios, colunas, mapa, turnos: TURNOS, corPorTurno, inicio,
                                feriados: H.listar(req.db) });
});

router.post('/feriados', requireBoss, (req, res) => {
  H.definir(req.db, req.body.data, req.body.descricao || null);
  res.redirect('/domingos');
});

router.post('/feriados/remover', requireBoss, (req, res) => {
  H.remover(req.db, req.body.data);
  res.redirect('/domingos');
});
```

- [ ] **Step 6: View `views/boss/domingos.ejs`** (mesma grade clicável do quadro, só com colunas de fds/feriado)

```html
<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Domingos e Feriados</title><link rel="stylesheet" href="/css/app.css"></head>
<body>
  <header style="padding:12px 16px;background:#fff;border-bottom:1px solid #e1e3e8">
    <a href="/quadro">← Quadro</a> &nbsp; <strong>Domingos e Feriados</strong>
  </header>
  <main style="padding:16px">
    <form method="post" action="/feriados" class="card" style="width:auto;margin-bottom:12px;grid-auto-flow:column;align-items:end">
      <label>Novo feriado <input type="date" name="data" required></label>
      <input name="descricao" placeholder="Descrição">
      <button>Adicionar feriado</button>
    </form>
    <div class="grid-wrap">
      <table class="quadro">
        <thead><tr><th>Funcionário</th>
          <% colunas.forEach(d => { %><th style="<%= d.feriado ? 'background:#ffe08a' : '' %>"><%= d.dia %><br><small><%= d.feriado ? 'FER' : d.semana %></small></th><% }) %>
        </tr></thead>
        <tbody>
          <% funcionarios.forEach(f => { %>
          <tr><th style="text-align:left"><%= f.nome %></th>
            <% colunas.forEach(d => { const t = mapa[f.id + '|' + d.iso]; %>
              <td class="cel" data-func="<%= f.id %>" data-data="<%= d.iso %>"
                  style="background:<%= t ? corPorTurno[t] : '' %>"></td>
            <% }) %>
          </tr>
          <% }) %>
        </tbody>
      </table>
    </div>
  </main>
  <script>window.TURNOS = <%- JSON.stringify(turnos) %>;</script>
  <script src="/js/quadro.js"></script>
</body></html>
```

- [ ] **Step 7: Verificar manualmente**

Run: `npm start`. Em `/domingos` cadastrar um feriado (ex. 18/06) → ele vira coluna destacada. Clicar numa célula salva o turno (reusa `/quadro/celula`).

- [ ] **Step 8: Commit**

```bash
git add src/repo/feriados.js test/feriados.test.js src/routes/boss.js views/boss/domingos.ejs
git commit -m "feat: cadastro de feriados e visão domingos & feriados"
```

---

## Task 13: Visão Férias (só as férias de cada pessoa)

**Files:**
- Modify: `src/repo/escala.js`, `test/escala.test.js`, `src/routes/boss.js`
- Create: `views/boss/ferias.ejs`

- [ ] **Step 1: Teste que falha** — adicionar a `test/escala.test.js`

```js
test('feriasPorFuncionario agrupa os dias de férias de cada um', () => {
  const db = openDb(':memory:');
  const a = F.criar(db, { nome: 'Ana' });
  const b = F.criar(db, { nome: 'Bia' });
  E.definirCelula(db, a, '2026-09-01', 'ferias');
  E.definirCelula(db, a, '2026-09-02', 'ferias');
  E.definirCelula(db, b, '2026-12-20', 'ferias');
  const r = E.feriasPorFuncionario(db, '2026-01-01', '2026-12-31');
  assert.deepEqual(r.find(x => x.nome === 'Ana').dias, ['2026-09-01','2026-09-02']);
  assert.deepEqual(r.find(x => x.nome === 'Bia').dias, ['2026-12-20']);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `E.feriasPorFuncionario is not a function`.

- [ ] **Step 3: Implementar em `src/repo/escala.js`** (adicionar função)

```js
export function feriasPorFuncionario(db, inicio, fim) {
  const rows = db.prepare(`
    SELECT f.nome, e.data FROM escala_dia e
    JOIN funcionarios f ON f.id = e.funcionario_id
    WHERE e.turno = 'ferias' AND e.data BETWEEN ? AND ?
    ORDER BY f.nome, e.data
  `).all(inicio, fim);
  const por = new Map();
  for (const r of rows) {
    if (!por.has(r.nome)) por.set(r.nome, []);
    por.get(r.nome).push(r.data);
  }
  return [...por.entries()].map(([nome, dias]) => ({ nome, dias }));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Rota + view** — em `src/routes/boss.js`:

```js
router.get('/ferias', requireBoss, (req, res) => {
  const ano = Number(req.query.ano) || new Date().getUTCFullYear();
  const lista = E.feriasPorFuncionario(req.db, `${ano}-01-01`, `${ano}-12-31`);
  res.render('boss/ferias', { lista, ano });
});
```

`views/boss/ferias.ejs`:
```html
<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Férias</title><link rel="stylesheet" href="/css/app.css"></head>
<body>
  <header style="padding:12px 16px;background:#fff;border-bottom:1px solid #e1e3e8">
    <a href="/quadro">← Quadro</a> &nbsp; <strong>Férias <%= ano %></strong>
  </header>
  <main style="padding:16px;max-width:640px">
    <% if (lista.length === 0) { %><p>Ninguém com férias marcadas em <%= ano %>.</p><% } %>
    <table class="quadro" style="font-size:14px;width:100%">
      <thead><tr><th>Funcionário</th><th>Dias de férias</th></tr></thead>
      <tbody>
        <% lista.forEach(x => { %>
        <tr><td style="text-align:left"><%= x.nome %></td>
            <td style="text-align:left"><%= x.dias.join(', ') %></td></tr>
        <% }) %>
      </tbody>
    </table>
  </main>
</body></html>
```

- [ ] **Step 6: Adicionar os links no header das views boss** — em `quadro.ejs`, `caixas.ejs`, `pendencias.ejs`, `cadastros.ejs`, `domingos.ejs`, incluir no `<nav>`:

```html
<a href="/quadro">Geral</a>
<a href="/caixas">Caixas</a>
<a href="/domingos">Dom/Feriados</a>
<a href="/ferias">Férias</a>
<a href="/pendencias">Pendências<% if (typeof naoLidas !== 'undefined' && naoLidas > 0) { %> <span class="badge" style="background:#c8102e;color:#fff"><%= naoLidas %></span><% } %></a>
<a href="/cadastros">Cadastros</a>
```

- [ ] **Step 7: Verificar manualmente**

Run: `npm start`. Marcar `ferias` em algumas células no `/quadro`, abrir `/ferias` → cada pessoa aparece com seus dias. Navegar entre Geral / Caixas / Dom-Feriados / Férias pelo menu.

- [ ] **Step 8: Commit**

```bash
git add src/repo/escala.js test/escala.test.js src/routes/boss.js views/boss/ferias.ejs views/boss/quadro.ejs views/boss/caixas.ejs views/boss/pendencias.ejs views/boss/cadastros.ejs views/boss/domingos.ejs
git commit -m "feat: visão de férias por funcionário e menu entre as escalas"
```

---

## Task 14: Deploy no VPS (tabelafolga.inovadrogaria.com.br)

Mesmo padrão dos outros sistemas Inova (INOVAZAP/InovaPED/InovaExpress): repo no GitHub, VPS `162.141.109.187` faz auto-deploy por polling do git, roda em pm2, nginx faz o proxy do subdomínio com HTTPS. **Depende do subdomínio `tabelafolga.inovadrogaria.com.br` já apontando pro VPS** (Nicolas cria o DNS).

**Files:**
- Create: `ecosystem.config.cjs` (pm2), `deploy/nginx-tabelafolga.conf` (referência)

- [ ] **Step 1: pm2 config** — `ecosystem.config.cjs`

```js
module.exports = {
  apps: [{
    name: 'inova-folga',
    script: 'server.js',
    env: { PORT: 3900, NODE_ENV: 'production' },
    autorestart: true,
  }],
};
```

- [ ] **Step 2: nginx de referência** — `deploy/nginx-tabelafolga.conf`

```nginx
server {
  server_name tabelafolga.inovadrogaria.com.br;
  location / {
    proxy_pass http://127.0.0.1:3900;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

- [ ] **Step 3: Criar repositório e primeiro push** (após Nicolas confirmar o remote)

```bash
git add ecosystem.config.cjs deploy/nginx-tabelafolga.conf
git commit -m "chore: configs de deploy (pm2 + nginx) inova-folga"
# git remote add origin <URL do repo>  &&  git push -u origin main
```

- [ ] **Step 4: No VPS** (uma vez): clonar o repo no diretório de deploy, `npm install --omit=dev`, `pm2 start ecosystem.config.cjs`, `pm2 save`. Copiar o nginx, `certbot --nginx -d tabelafolga.inovadrogaria.com.br`, `nginx -t && systemctl reload nginx`. Definir `BOSS_PASS` real via env do pm2.

- [ ] **Step 5: Verificar produção**

Run: abrir `https://tabelafolga.inovadrogaria.com.br/health`
Expected: `{"ok":true}` por HTTPS; `/login` carrega.

---

## Self-Review — cobertura do spec

- **Quadro de Horário (PC)** → Task 8. ✅
- **Folga/férias/falta + turnos** → catálogo `TURNOS` (Task 1) + edição de célula (Task 8). ✅
- **Escala de Caixas (PC)** → Task 9 (rotas + view). ✅
- **Visão Domingos & Feriados (PC)** → Task 12 (feriados + grade filtrada). ✅
- **Visão Férias por pessoa (PC)** → Task 13. ✅
- **Menu entre as 4 escalas (Geral / Caixas / Dom-Feriados / Férias)** → Task 13 step 6. ✅
- **App funcionário (home: próxima folga/turno/férias)** → Task 10. ✅
- **Pedidos: agendar férias/folga/trocar dia** → Task 10 (views + rota) + Task 5 (lógica). ✅
- **Notificação pro Carlos + aprovar/recusar (grava na escala)** → Task 5 (lógica) + Task 9 (sino + telas). ✅
- **Status do pedido no celular** → Task 10 (meus-pedidos). ✅
- **Cadastro de funcionários + PIN** → Task 9. ✅
- **Sugestão de férias por mês** → repo pronto (Task 6); UI de edição fica como melhoria pós-MVP (anotado abaixo).
- **Login patrão (senha) / funcionário (nome+PIN)** → Task 2 + Task 7. ✅

**Lacuna consciente (pós-MVP, não bloqueia):** UI pra editar `ferias_sugestao` e exibir aniversariantes no quadro — o repositório existe (Task 6), falta só a tela. Anotado pra não passar como concluído.

**Pendências do spec a confirmar com Nicolas antes/depois:** rótulo do código "4"; cor da "falta"; nomes/cores reais dos funcionários (o seed usa a lista da foto, ajustável).
