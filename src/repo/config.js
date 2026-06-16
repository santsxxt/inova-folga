// Setores e turnos — ambos editáveis pelo patrão (nome, cor, horário, ordem).

export function listarSetores(db) {
  return db.prepare('SELECT id, nome, ordem FROM setores ORDER BY ordem, nome').all();
}

export function criarSetor(db, nome, ordem = 99) {
  db.prepare('INSERT OR IGNORE INTO setores (nome, ordem) VALUES (?,?)').run(nome.trim(), ordem);
}

export function renomearSetor(db, id, nome, ordem) {
  db.prepare('UPDATE setores SET nome = ?, ordem = ? WHERE id = ?').run(nome.trim(), ordem, id);
}

export function removerSetor(db, id) {
  // funcionários ficam com setor_id NULL ('Sem setor')
  db.prepare('UPDATE funcionarios SET setor_id = NULL WHERE setor_id = ?').run(id);
  db.prepare('DELETE FROM setores WHERE id = ?').run(id);
}

export function listarHorariosCaixa(db) {
  return db.prepare('SELECT id, horario, ordem FROM horarios_caixa ORDER BY ordem, horario').all();
}

export function criarHorarioCaixa(db, horario, ordem = 99) {
  db.prepare('INSERT OR IGNORE INTO horarios_caixa (horario, ordem) VALUES (?,?)').run(horario.trim(), ordem);
}

export function removerHorarioCaixa(db, id) {
  db.prepare('DELETE FROM horarios_caixa WHERE id = ?').run(id);
}

export function listarTurnos(db) {
  return db.prepare('SELECT codigo, rotulo, cor, inicio, fim FROM turnos').all();
}

export function corPorTurno(db) {
  return Object.fromEntries(listarTurnos(db).map((t) => [t.codigo, t.cor]));
}

export function rotuloPorTurno(db) {
  return Object.fromEntries(listarTurnos(db).map((t) => [t.codigo, t.rotulo]));
}

export function salvarTurno(db, { codigo, rotulo, cor, inicio, fim }) {
  db.prepare(`
    INSERT INTO turnos (codigo, rotulo, cor, inicio, fim) VALUES (?,?,?,?,?)
    ON CONFLICT(codigo) DO UPDATE SET rotulo=excluded.rotulo, cor=excluded.cor,
      inicio=excluded.inicio, fim=excluded.fim
  `).run(codigo.trim(), rotulo, cor, inicio || null, fim || null);
}

export function removerTurno(db, codigo) {
  // só remove se ninguém está usando esse turno na escala
  const usado = db.prepare('SELECT COUNT(*) c FROM escala_dia WHERE turno = ?').get(codigo).c;
  if (usado > 0) return { ok: false, usado };
  db.prepare('DELETE FROM turnos WHERE codigo = ?').run(codigo);
  return { ok: true };
}
