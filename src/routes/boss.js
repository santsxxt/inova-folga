import { Router } from 'express';
import { requireBoss } from '../auth.js';
import * as F from '../repo/funcionarios.js';
import * as E from '../repo/escala.js';
import * as S from '../repo/solicitacoes.js';
import * as H from '../repo/feriados.js';
import * as C from '../repo/config.js';
import { dias, hojeISO } from '../lib/datas.js';

const router = Router();
const POSTOS = ['Caixa 1', 'Caixa 2', 'Caixa 3', 'Entrega'];
const agora = () => new Date().toISOString();

// ---- Geral: Quadro de Horário ----
router.get('/quadro', requireBoss, (req, res) => {
  const inicio = req.query.inicio || hojeISO();
  const periodoDias = dias(inicio, 21);
  const grupos = F.listarPorSetor(req.db);
  const mapa = E.periodo(req.db, periodoDias[0].iso, periodoDias.at(-1).iso);
  const turnos = C.listarTurnos(req.db);
  res.render('boss/quadro', {
    pagina: 'quadro', grupos, dias: periodoDias, mapa, turnos,
    corPorTurno: C.corPorTurno(req.db), inicio,
  });
});

router.post('/quadro/celula', requireBoss, (req, res) => {
  const { funcionarioId, data, turno } = req.body;
  if (turno === '' || turno == null) E.limparCelula(req.db, Number(funcionarioId), data);
  else E.definirCelula(req.db, Number(funcionarioId), data, turno);
  res.json({ ok: true, cor: C.corPorTurno(req.db)[turno] || '' });
});

// ---- Caixas ----
router.get('/caixas', requireBoss, (req, res) => {
  const data = req.query.data || hojeISO();
  const linhas = E.caixasDoDia(req.db, data);
  const mapa = {};
  for (const l of linhas) mapa[`${l.posto}|${l.horario}`] = l.funcionario_id;
  res.render('boss/caixas', {
    pagina: 'caixas', data, postos: POSTOS,
    horarios: C.listarHorariosCaixa(req.db), mapa,
    funcionarios: F.listarAtivos(req.db),
  });
});

router.post('/caixas', requireBoss, (req, res) => {
  const { data, posto, horario, funcionarioId } = req.body;
  E.definirCaixa(req.db, { data, posto, horario, funcionarioId: funcionarioId ? Number(funcionarioId) : null });
  res.redirect('/caixas?data=' + encodeURIComponent(data));
});

router.post('/caixas/horario', requireBoss, (req, res) => {
  if (req.body.horario) C.criarHorarioCaixa(req.db, req.body.horario, Number(req.body.ordem) || 99);
  res.redirect('/caixas?data=' + encodeURIComponent(req.body.data || ''));
});

router.post('/caixas/horario/:id/remover', requireBoss, (req, res) => {
  C.removerHorarioCaixa(req.db, Number(req.params.id));
  res.redirect('/caixas?data=' + encodeURIComponent(req.body.data || ''));
});

// ---- Domingos e Feriados ----
router.get('/domingos', requireBoss, (req, res) => {
  const inicio = req.query.inicio || hojeISO();
  const todos = dias(inicio, 42);
  const feriadosSet = H.conjuntoNoPeriodo(req.db, todos[0].iso, todos.at(-1).iso);
  const colunas = todos.filter((d) => d.fimDeSemana || feriadosSet.has(d.iso))
    .map((d) => ({ ...d, feriado: feriadosSet.has(d.iso) }));
  const grupos = F.listarPorSetor(req.db);
  const mapa = E.periodo(req.db, todos[0].iso, todos.at(-1).iso);
  res.render('boss/domingos', {
    pagina: 'domingos', grupos, colunas, mapa, turnos: C.listarTurnos(req.db),
    corPorTurno: C.corPorTurno(req.db), inicio, feriados: H.listar(req.db),
  });
});

router.post('/feriados', requireBoss, (req, res) => {
  if (req.body.data) H.definir(req.db, req.body.data, req.body.descricao || null);
  res.redirect('/domingos');
});

router.post('/feriados/remover', requireBoss, (req, res) => {
  H.remover(req.db, req.body.data);
  res.redirect('/domingos');
});

// ---- Férias por pessoa ----
router.get('/ferias', requireBoss, (req, res) => {
  const ano = Number(req.query.ano) || new Date().getUTCFullYear();
  const lista = E.feriasPorFuncionario(req.db, `${ano}-01-01`, `${ano}-12-31`);
  res.render('boss/ferias', { pagina: 'ferias', lista, ano });
});

// ---- Pendências / aprovação ----
router.get('/pendencias', requireBoss, (req, res) => {
  const pend = S.pendentes(req.db);
  S.marcarNotificacoesLidas(req.db);
  res.render('boss/pendencias', { pagina: 'pendencias', pend });
});

router.post('/pendencias/:id/aprovar', requireBoss, (req, res) => {
  S.aprovar(req.db, Number(req.params.id), agora());
  res.redirect('/pendencias');
});

router.post('/pendencias/:id/recusar', requireBoss, (req, res) => {
  S.recusar(req.db, Number(req.params.id), req.body.motivo, agora());
  res.redirect('/pendencias');
});

// ---- Cadastros: funcionários ----
router.get('/cadastros', requireBoss, (req, res) => {
  res.render('boss/cadastros', {
    pagina: 'cadastros',
    funcionarios: F.listarTodos(req.db),
    setores: C.listarSetores(req.db),
  });
});

router.post('/cadastros', requireBoss, (req, res) => {
  const { nome, setorId, cor, aniversario, pin } = req.body;
  const id = F.criar(req.db, {
    nome, setorId: setorId ? Number(setorId) : null, cor: cor || null, aniversario: aniversario || null,
  });
  if (pin) F.definirPin(req.db, id, pin);
  res.redirect('/cadastros');
});

router.post('/cadastros/salvar-tudo', requireBoss, (req, res) => {
  for (const f of F.listarTodos(req.db)) {
    const nome = req.body['nome_' + f.id];
    if (nome == null || !String(nome).trim()) continue;
    F.editar(req.db, f.id, {
      nome,
      setorId: req.body['setor_' + f.id] ? Number(req.body['setor_' + f.id]) : null,
      cor: req.body['cor_' + f.id] || null,
      aniversario: req.body['aniv_' + f.id] || null,
    });
  }
  res.redirect('/cadastros');
});

router.post('/cadastros/:id/editar', requireBoss, (req, res) => {
  const { nome, setorId, cor, aniversario } = req.body;
  F.editar(req.db, Number(req.params.id), {
    nome, setorId: setorId ? Number(setorId) : null, cor: cor || null, aniversario: aniversario || null,
  });
  res.redirect('/cadastros');
});

router.post('/cadastros/:id/pin', requireBoss, (req, res) => {
  if (req.body.pin) F.definirPin(req.db, Number(req.params.id), req.body.pin);
  res.redirect('/cadastros');
});

router.post('/cadastros/:id/desativar', requireBoss, (req, res) => {
  F.desativar(req.db, Number(req.params.id));
  res.redirect('/cadastros');
});

router.post('/cadastros/:id/reativar', requireBoss, (req, res) => {
  F.reativar(req.db, Number(req.params.id));
  res.redirect('/cadastros');
});

// ---- Configurações: setores e turnos (editáveis) ----
router.get('/config', requireBoss, (req, res) => {
  res.render('boss/config', {
    pagina: 'config',
    setores: C.listarSetores(req.db),
    turnos: C.listarTurnos(req.db),
  });
});

router.post('/config/setor', requireBoss, (req, res) => {
  const { id, nome, ordem } = req.body;
  if (id) C.renomearSetor(req.db, Number(id), nome, Number(ordem) || 0);
  else C.criarSetor(req.db, nome, Number(ordem) || 99);
  res.redirect('/config');
});

router.post('/config/setor/:id/remover', requireBoss, (req, res) => {
  C.removerSetor(req.db, Number(req.params.id));
  res.redirect('/config');
});

router.post('/config/turno', requireBoss, (req, res) => {
  const { codigo, rotulo, cor, inicio, fim } = req.body;
  C.salvarTurno(req.db, { codigo, rotulo, cor, inicio, fim });
  res.redirect('/config');
});

router.post('/config/turno/:codigo/remover', requireBoss, (req, res) => {
  C.removerTurno(req.db, req.params.codigo);
  res.redirect('/config');
});

export default router;
