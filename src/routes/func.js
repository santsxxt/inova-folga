import { Router } from 'express';
import { requireFuncionario } from '../auth.js';
import * as E from '../repo/escala.js';
import * as S from '../repo/solicitacoes.js';
import * as C from '../repo/config.js';
import { hojeISO } from '../lib/datas.js';

const router = Router();

router.get('/', requireFuncionario, (req, res) => {
  const id = req.session.funcionarioId;
  const hoje = hojeISO();
  const proximos = E.turnosDoFuncionario(req.db, id, hoje, 30);
  const rotuloTurno = C.rotuloPorTurno(req.db);
  const corPorTurno = C.corPorTurno(req.db);
  const hojeTurno = proximos.find((p) => p.data === hoje);
  const proximaFolga = proximos.find((p) => p.turno === 'folga');
  const proximasFerias = proximos.find((p) => p.turno === 'ferias');
  res.render('func/home', {
    nome: req.session.funcionarioNome, hoje, hojeTurno, proximaFolga, proximasFerias,
    rotuloTurno, corPorTurno,
  });
});

router.get('/pedido', requireFuncionario, (req, res) => {
  const tipo = ['ferias', 'folga', 'troca'].includes(req.query.tipo) ? req.query.tipo : 'folga';
  res.render('func/pedido', { tipo });
});

router.post('/pedido', requireFuncionario, (req, res) => {
  const { tipo, dataInicio, dataFim, dataTrocaDestino, observacao } = req.body;
  if (dataInicio && ['ferias', 'folga', 'troca'].includes(tipo)) {
    S.criar(req.db, {
      funcionarioId: req.session.funcionarioId, tipo, dataInicio,
      dataFim: dataFim || null, dataTrocaDestino: dataTrocaDestino || null,
      observacao: observacao || null,
    }, new Date().toISOString());
  }
  res.redirect('/app/meus-pedidos');
});

router.get('/meus-pedidos', requireFuncionario, (req, res) => {
  res.render('func/meus-pedidos', { pedidos: S.doFuncionario(req.db, req.session.funcionarioId) });
});

export default router;
