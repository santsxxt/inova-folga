// Lança a escala extraída das fotos (Nova pasta 2) — período 15/06 a 05/07/2026.
// Rodar: node scripts/seed-escala-foto.js  (idempotente — upsert; pode rodar de novo)
import { openDb } from '../src/db.js';
import { DB_PATH } from '../src/config.js';
import { aplicarEscalaFoto, DIAS_UTEIS, PAPEIS, GRUPO_DIA } from '../src/repo/escalaFoto.js';

const db = openDb(DB_PATH);
const r = aplicarEscalaFoto(db);
console.log('Seed escala-foto:');
console.log(`  • Caixa/Entrega: ${r.nCaixa} células (${PAPEIS.length} papéis × ${DIAS_UTEIS.length} dias) — ALTA confiança`);
console.log(`  • Grupo do Dia: ${r.nDia} células (${GRUPO_DIA.length} pessoas × ${DIAS_UTEIS.length} dias) — RASCUNHO`);
console.log('Domingos/feriados + linhas variadas: Carlos confere/ajusta na tela nova.');
