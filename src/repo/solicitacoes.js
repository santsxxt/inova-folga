import * as E from './escala.js';

// Datas 'YYYY-MM-DD' de inicio até fim (inclusive), só data, sem timezone.
function diasNoIntervalo(inicio, fim) {
  const out = [];
  let [y, m, d] = inicio.split('-').map(Number);
  const limite = fim || inicio;
  let atual = inicio;
  while (atual <= limite) {
    out.push(atual);
    d += 1;
    const dt = new Date(Date.UTC(y, m - 1, d));
    y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate();
    atual = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
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
    'SELECT * FROM solicitacoes WHERE funcionario_id = ? ORDER BY created_at DESC, id DESC'
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
      E.definirCelula(db, s.funcionario_id, s.data_inicio, 'folga');
    }
    db.prepare("UPDATE solicitacoes SET status='aprovado', respondido_em=? WHERE id=?")
      .run(agora, solicitacaoId);
  });
  tx();
}

export function recusar(db, solicitacaoId, motivo, agora) {
  db.prepare(
    "UPDATE solicitacoes SET status='recusado', motivo_resposta=?, respondido_em=? WHERE id=? AND status='pendente'"
  ).run(motivo || null, agora, solicitacaoId);
}
