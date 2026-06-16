export function definirCelula(db, funcionarioId, data, turno) {
  db.prepare(`
    INSERT INTO escala_dia (funcionario_id, data, turno) VALUES (?,?,?)
    ON CONFLICT(funcionario_id, data) DO UPDATE SET turno = excluded.turno
  `).run(funcionarioId, data, turno);
}

export function limparCelula(db, funcionarioId, data) {
  db.prepare('DELETE FROM escala_dia WHERE funcionario_id = ? AND data = ?').run(funcionarioId, data);
}

// Mapa { 'funcId|YYYY-MM-DD': turno } para renderizar a grade rápido.
export function periodo(db, inicio, fim) {
  const rows = db.prepare(
    'SELECT funcionario_id, data, turno FROM escala_dia WHERE data BETWEEN ? AND ?'
  ).all(inicio, fim);
  const mapa = {};
  for (const r of rows) mapa[`${r.funcionario_id}|${r.data}`] = r.turno;
  return mapa;
}

export function turnosDoFuncionario(db, funcionarioId, deData, limite = 30) {
  return db.prepare(`
    SELECT data, turno FROM escala_dia
    WHERE funcionario_id = ? AND data >= ?
    ORDER BY data ASC LIMIT ?
  `).all(funcionarioId, deData, limite);
}

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

export function definirCaixa(db, { data, posto, horario, funcionarioId }) {
  db.prepare(`
    INSERT INTO escala_caixa (data, posto, horario, funcionario_id) VALUES (?,?,?,?)
    ON CONFLICT(data, posto, horario) DO UPDATE SET funcionario_id = excluded.funcionario_id
  `).run(data, posto, horario, funcionarioId);
}

export function caixasDoDia(db, data) {
  return db.prepare('SELECT * FROM escala_caixa WHERE data = ? ORDER BY posto, horario').all(data);
}
