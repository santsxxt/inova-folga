import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, TURNOS } from '../src/db.js';
import * as F from '../src/repo/funcionarios.js';
import * as E from '../src/repo/escala.js';
import * as S from '../src/repo/solicitacoes.js';
import * as H from '../src/repo/feriados.js';
import * as AUD from '../src/repo/auditoria.js';
import * as SAL from '../src/repo/saldos.js';
import { hashSecret, verifySecret } from '../src/auth.js';
import { makeLoginLimiter } from '../src/security.js';

const AGORA = '2026-06-16T10:00:00';
const setorId = (db, nome) => db.prepare('SELECT id FROM setores WHERE nome = ?').get(nome).id;

test('schema cria tabelas e seed de turnos/setores', () => {
  const db = openDb(':memory:');
  const tabelas = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  for (const t of ['setores', 'funcionarios', 'turnos', 'escala_dia', 'escala_caixa',
    'ferias_sugestao', 'feriados', 'solicitacoes', 'notificacoes']) {
    assert.ok(tabelas.includes(t), `faltou tabela ${t}`);
  }
  assert.equal(db.prepare('SELECT COUNT(*) c FROM turnos').get().c, TURNOS.length);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM setores').get().c, 5);
});

test('hash/verify de segredo', () => {
  const h = hashSecret('1234');
  assert.notEqual(h, '1234');
  assert.equal(verifySecret('1234', h), true);
  assert.equal(verifySecret('9999', h), false);
});

test('funcionário: criar/editar/listar/pin/autenticar/desativar', () => {
  const db = openDb(':memory:');
  const id = F.criar(db, { nome: 'Larissa', setorId: setorId(db, 'Caixa'), cor: '#7fb3ff' });
  assert.ok(id > 0);
  assert.equal(F.listarAtivos(db)[0].setor, 'Caixa');

  F.editar(db, id, { nome: 'Larissa M.', setorId: setorId(db, 'Atendente'), cor: '#86d191' });
  assert.equal(F.buscar(db, id).nome, 'Larissa M.');
  assert.equal(F.buscar(db, id).setor, 'Atendente');

  F.definirPin(db, id, '1234');
  assert.equal(F.autenticar(db, 'Larissa M.', '1234')?.id, id);
  assert.equal(F.autenticar(db, 'Larissa M.', '0000'), null);

  F.desativar(db, id);
  assert.equal(F.listarAtivos(db).length, 0);
});

test('listarPorSetor agrupa na ordem dos setores', () => {
  const db = openDb(':memory:');
  F.criar(db, { nome: 'Bia', setorId: setorId(db, 'Atendente') });
  F.criar(db, { nome: 'Ana', setorId: setorId(db, 'Caixa') });
  const grupos = F.listarPorSetor(db);
  assert.equal(grupos[0].setor, 'Caixa');
  assert.equal(grupos[0].funcionarios[0].nome, 'Ana');
  assert.equal(grupos[1].setor, 'Atendente');
});

test('escala: célula upsert, período, limpar, caixa', () => {
  const db = openDb(':memory:');
  const a = F.criar(db, { nome: 'Ana' });
  E.definirCelula(db, a, '2026-06-15', 'manha');
  E.definirCelula(db, a, '2026-06-15', 'folga');
  E.definirCelula(db, a, '2026-06-16', 'tarde');
  const mapa = E.periodo(db, '2026-06-15', '2026-06-16');
  assert.equal(mapa[`${a}|2026-06-15`], 'folga');
  assert.equal(mapa[`${a}|2026-06-16`], 'tarde');
  E.limparCelula(db, a, '2026-06-15');
  assert.equal(E.periodo(db, '2026-06-15', '2026-06-15')[`${a}|2026-06-15`], undefined);

  const j = F.criar(db, { nome: 'Jairo' });
  E.definirCaixa(db, { data: '2026-06-15', posto: 'Caixa 1', horario: '06:00-14:30', funcionarioId: j });
  E.definirCaixa(db, { data: '2026-06-15', posto: 'Caixa 1', horario: '06:00-14:30', funcionarioId: j });
  assert.equal(E.caixasDoDia(db, '2026-06-15').length, 1);
});

test('feriasPorFuncionario agrupa dias', () => {
  const db = openDb(':memory:');
  const a = F.criar(db, { nome: 'Ana' });
  E.definirCelula(db, a, '2026-09-01', 'ferias');
  E.definirCelula(db, a, '2026-09-02', 'ferias');
  const r = E.feriasPorFuncionario(db, '2026-01-01', '2026-12-31');
  assert.deepEqual(r.find((x) => x.nome === 'Ana').dias, ['2026-09-01', '2026-09-02']);
});

test('solicitação: cria, notifica, aprova grava na escala, recusa guarda motivo', () => {
  const db = openDb(':memory:');
  const ana = F.criar(db, { nome: 'Ana' });

  const folga = S.criar(db, { funcionarioId: ana, tipo: 'folga', dataInicio: '2026-06-20' }, AGORA);
  assert.equal(S.pendentes(db).length, 1);
  assert.equal(S.notificacoesNaoLidas(db).length, 1);
  S.aprovar(db, folga, AGORA);
  assert.equal(E.periodo(db, '2026-06-20', '2026-06-20')[`${ana}|2026-06-20`], 'folga');
  assert.equal(S.pendentes(db).length, 0);

  const fer = S.criar(db, { funcionarioId: ana, tipo: 'ferias', dataInicio: '2026-09-01', dataFim: '2026-09-03' }, AGORA);
  S.aprovar(db, fer, AGORA);
  const mapa = E.periodo(db, '2026-09-01', '2026-09-03');
  assert.equal(mapa[`${ana}|2026-09-01`], 'ferias');
  assert.equal(mapa[`${ana}|2026-09-03`], 'ferias');

  const rec = S.criar(db, { funcionarioId: ana, tipo: 'folga', dataInicio: '2026-07-01' }, AGORA);
  S.recusar(db, rec, 'sem cobertura', AGORA);
  const meus = S.doFuncionario(db, ana);
  assert.equal(meus[0].status, 'recusado');
  assert.equal(meus[0].motivo_resposta, 'sem cobertura');
});

test('feriados: cadastra e consulta conjunto do período', () => {
  const db = openDb(':memory:');
  H.definir(db, '2026-06-18', 'Corpus Christi');
  const set = H.conjuntoNoPeriodo(db, '2026-06-15', '2026-06-30');
  assert.ok(set.has('2026-06-18'));
  assert.ok(!set.has('2026-07-09'));
});

test('PIN: nome só loga enquanto não há PIN; para de valer após definir', () => {
  const db = openDb(':memory:');
  const id = F.criar(db, { nome: 'Bruno' });
  // sem PIN definido: o nome loga (onboarding)
  assert.equal(F.autenticar(db, 'Bruno', 'bruno')?.id, id);
  assert.equal(F.autenticar(db, 'BRUNO', 'BRUNO')?.id, id); // case-insensitive
  // define PIN próprio
  F.definirPin(db, id, '4321');
  assert.equal(F.autenticar(db, 'Bruno', '4321')?.id, id);
  assert.equal(F.autenticar(db, 'Bruno', 'Bruno'), null); // nome não loga mais
});

test('auditoria: registra e lista em ordem reversa, filtra por ator', () => {
  const db = openDb(':memory:');
  AUD.registrar(db, { ator: 'Carlos', acao: 'alterou escala', alvo: 'Ana', detalhe: '2026-06-15 → noite' }, '2026-06-16T09:00:00');
  AUD.registrar(db, { ator: 'Carlos', acao: 'aprovou folga', alvo: 'Bia' }, '2026-06-16T10:00:00');
  AUD.registrar(db, { ator: 'Sistema', acao: 'reservou folga', alvo: 'Ana' }, '2026-06-16T11:00:00');
  assert.equal(AUD.contar(db), 3);
  const todos = AUD.listar(db);
  assert.equal(todos[0].ator, 'Sistema'); // mais recente primeiro
  assert.equal(AUD.listar(db, { ator: 'Carlos' }).length, 2);
  assert.deepEqual(AUD.atores(db), ['Carlos', 'Sistema']);
});

test('saldos: deriva férias/folgas/faltas/domingos da escala', () => {
  const db = openDb(':memory:');
  const ana = F.criar(db, { nome: 'Ana', setorId: setorId(db, 'Caixa') });
  E.definirCelula(db, ana, '2026-06-01', 'ferias');
  E.definirCelula(db, ana, '2026-06-02', 'ferias');
  E.definirCelula(db, ana, '2026-06-10', 'folga');
  E.definirCelula(db, ana, '2026-06-12', 'falta');
  E.definirCelula(db, ana, '2026-06-07', 'manha'); // domingo 07/06/2026 trabalhado
  E.definirCelula(db, ana, '2026-06-14', 'folga'); // domingo de folga (não conta)
  const s = SAL.saldos(db, { ano: 2026, mes: 6 }).find((x) => x.nome === 'Ana');
  assert.equal(s.ferias_tirados, 2);
  assert.equal(s.ferias_faltam, SAL.DIAS_FERIAS - 2);
  assert.equal(s.folgas_mes, 2);
  assert.equal(s.faltas_ano, 1);
  assert.equal(s.domingos, 1);
});

test('rate-limit de login: bloqueia após N falhas e libera no acerto', () => {
  const lim = makeLoginLimiter({ max: 3, janelaMs: 60000, campoUsuario: 'usuario' });
  const req = { ip: '1.2.3.4', body: { usuario: 'Carlos' } };
  const run = () => { const r = { ...req, rateLimited: undefined }; lim.middleware(r, { status() {} }, () => {}); return r.rateLimited; };
  assert.equal(run(), undefined);
  lim.falhou(req); lim.falhou(req); lim.falhou(req); // 3 falhas
  assert.ok(run(), 'deveria estar bloqueado após 3 falhas');
  lim.ok(req); // acerto limpa
  assert.equal(run(), undefined);
});
