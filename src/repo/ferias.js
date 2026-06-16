export function definir(db, { funcionarioId, mes, ano }) {
  db.prepare('INSERT INTO ferias_sugestao (funcionario_id, mes, ano) VALUES (?,?,?)')
    .run(funcionarioId, mes, ano);
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
