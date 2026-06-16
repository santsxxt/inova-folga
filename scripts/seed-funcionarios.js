// Popula os funcionários da foto 1, distribuídos em setores. Rodar: npm run seed
import { openDb } from '../src/db.js';
import * as F from '../src/repo/funcionarios.js';
import { DB_PATH } from '../src/config.js';

const db = openDb(DB_PATH);
const setor = (nome) => db.prepare('SELECT id FROM setores WHERE nome = ?').get(nome)?.id || null;

// nome -> setor (ajuste fino depois pelo Cadastros)
const PESSOAS = [
  ['Izadora', 'Atendente'], ['Ariane Arch', 'Atendente'], ['Micaely', 'Atendente'],
  ['Leidiane', 'Escritório'], ['Daniel', 'Atendente'], ['Marcelo', 'Atendente'],
  ['Joaquim', 'Atendente'], ['Deivid', 'Atendente'], ['Vitória', 'Atendente'],
  ['Gustavo', 'Atendente'], ['Iggor', 'Atendente'], ['Ariane', 'Atendente'],
  ['Felipe', 'Escritório'], ['Sandro', 'Estoque'], ['Maria Olivia', 'Atendente'],
  ['Rogério', 'Estoque'], ['Luis Gustavo', 'Atendente'], ['Filipe Estag', 'Escritório'],
  ['Luiz Fernando', 'Atendente'], ['Nilton', 'Estoque'], ['Nicolas', 'Escritório'],
  ['Jesse', 'Atendente'], ['Alan', 'Estoque'], ['Aragozo', 'Estoque'],
  ['Jairo', 'Caixa'], ['Izabela', 'Caixa'], ['Fabiana', 'Entrega'],
  ['Larissa', 'Caixa'], ['Enzo', 'Caixa'], ['Guilherme', 'Entrega'],
  ['Vitória 2', 'Atendente'], ['Thales', 'Atendente'], ['Diego', 'Escritório'],
  ['Mateus', 'Atendente'], ['Rafael', 'Atendente'], ['João Paulo', 'Atendente'],
];

const existentes = new Set(F.listarTodos(db).map((f) => f.nome));
let n = 0;
for (const [nome, s] of PESSOAS) {
  if (!existentes.has(nome)) { F.criar(db, { nome, setorId: setor(s) }); n++; }
}
console.log(`Seed: ${n} funcionários adicionados.`);
