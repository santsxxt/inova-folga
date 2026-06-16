import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, TURNOS } from '../src/db.js';
import * as F from '../src/repo/funcionarios.js';
import * as E from '../src/repo/escala.js';
import * as S from '../src/repo/solicitacoes.js';
import * as H from '../src/repo/feriados.js';
import { hashSecret, verifySecret } from '../src/auth.js';

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
