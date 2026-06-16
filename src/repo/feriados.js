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
  return new Set(rows.map((r) => r.data));
}
