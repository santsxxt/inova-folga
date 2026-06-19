// Registro de quem mexeu no quê e quando (log de auditoria).

export function registrar(db, { ator, acao, alvo = null, detalhe = null }, agora) {
  db.prepare(
    'INSERT INTO auditoria (ator, acao, alvo, detalhe, created_at) VALUES (?,?,?,?,?)'
  ).run(ator || 'desconhecido', acao, alvo, detalhe, agora || new Date().toISOString());
}

export function listar(db, { limite = 100, offset = 0, ator = null } = {}) {
  if (ator) {
    return db.prepare(
      'SELECT * FROM auditoria WHERE ator = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?'
    ).all(ator, limite, offset);
  }
  return db.prepare(
    'SELECT * FROM auditoria ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?'
  ).all(limite, offset);
}

export function contar(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM auditoria').get().n;
}

export function atores(db) {
  return db.prepare('SELECT DISTINCT ator FROM auditoria ORDER BY ator').all().map((r) => r.ator);
}
