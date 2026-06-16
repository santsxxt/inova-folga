import { hashSecret, verifySecret } from '../auth.js';

const SELECT_BASE = `
  SELECT f.id, f.nome, f.setor_id, s.nome AS setor, s.ordem AS setor_ordem,
         f.cor, f.aniversario, f.ativo
  FROM funcionarios f LEFT JOIN setores s ON s.id = f.setor_id
`;

export function criar(db, { nome, setorId = null, cor = null, aniversario = null }) {
  const info = db.prepare(
    'INSERT INTO funcionarios (nome, setor_id, cor, aniversario) VALUES (?,?,?,?)'
  ).run(nome.trim(), setorId, cor, aniversario);
  return info.lastInsertRowid;
}

export function editar(db, id, { nome, setorId = null, cor = null, aniversario = null }) {
  db.prepare(
    'UPDATE funcionarios SET nome = ?, setor_id = ?, cor = ?, aniversario = ? WHERE id = ?'
  ).run(nome.trim(), setorId, cor, aniversario, id);
}

export function listarAtivos(db) {
  return db.prepare(SELECT_BASE + ' WHERE f.ativo = 1 ORDER BY s.ordem, f.nome').all();
}

// Agrupa os ativos por setor, na ordem dos setores. [{ setor, funcionarios: [...] }]
export function listarPorSetor(db) {
  const grupos = [];
  for (const f of listarAtivos(db)) {
    const nomeSetor = f.setor || 'Sem setor';
    let g = grupos.find((x) => x.setor === nomeSetor);
    if (!g) { g = { setor: nomeSetor, funcionarios: [] }; grupos.push(g); }
    g.funcionarios.push(f);
  }
  return grupos;
}

export function listarTodos(db) {
  return db.prepare(SELECT_BASE + ' ORDER BY s.ordem, f.nome').all();
}

export function buscar(db, id) {
  return db.prepare(SELECT_BASE + ' WHERE f.id = ?').get(id);
}

export function definirPin(db, id, pin) {
  db.prepare('UPDATE funcionarios SET pin = ? WHERE id = ?').run(hashSecret(pin), id);
}

export function autenticar(db, nome, pin) {
  const row = db.prepare('SELECT * FROM funcionarios WHERE nome = ? AND ativo = 1').get(nome.trim());
  if (!row || !verifySecret(pin, row.pin)) return null;
  return { id: row.id, nome: row.nome };
}

export function desativar(db, id) {
  db.prepare('UPDATE funcionarios SET ativo = 0 WHERE id = ?').run(id);
}

export function reativar(db, id) {
  db.prepare('UPDATE funcionarios SET ativo = 1 WHERE id = ?').run(id);
}
