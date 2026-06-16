import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const SETORES = ['Escritório', 'Caixa', 'Atendente', 'Estoque', 'Entrega'];

export const TURNOS = [
  { codigo: 'manha',     rotulo: 'Manhã',            cor: '#f6a5c0', inicio: '06:00', fim: '14:30' },
  { codigo: 'tarde',     rotulo: 'Tarde',            cor: '#7fb3ff', inicio: '13:30', fim: '22:00' },
  { codigo: 'noite22',   rotulo: 'Noite até 22h',    cor: '#b9a5e3', inicio: '14:30', fim: '22:00' },
  { codigo: 'noite23',   rotulo: 'Noite até 23h',    cor: '#a48fd6', inicio: '15:00', fim: '23:00' },
  { codigo: 'noite24',   rotulo: 'Noite até 00h',    cor: '#8f78c9', inicio: '16:30', fim: '00:00' },
  { codigo: 'folga',     rotulo: 'Folga da semana',  cor: '#86d191', inicio: null,    fim: null },
  { codigo: 'ferias',    rotulo: 'Férias',           cor: '#ffd84d', inicio: null,    fim: null },
  { codigo: 'falta',     rotulo: 'Falta',            cor: '#e3554a', inicio: null,    fim: null },
  { codigo: 'especial4', rotulo: 'Meio período (4)', cor: '#cdcdcd', inicio: '06:00', fim: '13:00' },
];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS setores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  ordem INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS funcionarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  setor_id INTEGER REFERENCES setores(id),
  cor TEXT,
  aniversario TEXT,
  pin TEXT,
  ativo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS turnos (
  codigo TEXT PRIMARY KEY,
  rotulo TEXT NOT NULL,
  cor TEXT NOT NULL,
  inicio TEXT,
  fim TEXT
);
CREATE TABLE IF NOT EXISTS escala_dia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
  data TEXT NOT NULL,
  turno TEXT NOT NULL REFERENCES turnos(codigo),
  UNIQUE(funcionario_id, data)
);
CREATE TABLE IF NOT EXISTS escala_caixa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  posto TEXT NOT NULL,
  horario TEXT NOT NULL,
  funcionario_id INTEGER REFERENCES funcionarios(id),
  UNIQUE(data, posto, horario)
);
CREATE TABLE IF NOT EXISTS ferias_sugestao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funcionario_id INTEGER REFERENCES funcionarios(id),
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS feriados (
  data TEXT PRIMARY KEY,
  descricao TEXT
);
CREATE TABLE IF NOT EXISTS solicitacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
  tipo TEXT NOT NULL,
  data_inicio TEXT NOT NULL,
  data_fim TEXT,
  data_troca_destino TEXT,
  funcionario_troca_id INTEGER REFERENCES funcionarios(id),
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  motivo_resposta TEXT,
  created_at TEXT NOT NULL,
  respondido_em TEXT
);
CREATE TABLE IF NOT EXISTS notificacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  destinatario TEXT NOT NULL DEFAULT 'patrao',
  solicitacao_id INTEGER REFERENCES solicitacoes(id),
  texto TEXT NOT NULL,
  lida INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
`;

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  const insertTurno = db.prepare(
    'INSERT OR IGNORE INTO turnos (codigo, rotulo, cor, inicio, fim) VALUES (?,?,?,?,?)'
  );
  const insertSetor = db.prepare('INSERT OR IGNORE INTO setores (nome, ordem) VALUES (?,?)');
  const seed = db.transaction(() => {
    for (const t of TURNOS) insertTurno.run(t.codigo, t.rotulo, t.cor, t.inicio, t.fim);
    SETORES.forEach((nome, i) => insertSetor.run(nome, i));
  });
  seed();
  return db;
}
