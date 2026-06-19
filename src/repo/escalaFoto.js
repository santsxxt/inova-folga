// Escala extraída das fotos (período 15/06–05/07/2026).
// Reutilizado pelo script (scripts/seed-escala-foto.js) e pelo boot guardado do server.
import * as F from './funcionarios.js';
import * as E from './escala.js';

// Papel fixo de caixa/entrega (foto digitada — ALTA confiança).
export const PAPEIS = [
  { nome: 'Jairo',     posto: 'Caixa 1', horario: '06:00-14:30', turno: 'manha'   },
  { nome: 'Izabela',   posto: 'Caixa 2', horario: '08:00-16:30', turno: 'manha'   },
  { nome: 'Fabiana',   posto: 'Entrega', horario: '08:00-16:30', turno: 'manha'   },
  { nome: 'Larissa',   posto: 'Caixa 1', horario: '14:30-22:00', turno: 'tarde'   },
  { nome: 'Enzo',      posto: 'Caixa 3', horario: '16:30-00:00', turno: 'noite24' },
  { nome: 'Guilherme', posto: 'Entrega', horario: '14:30-22:00', turno: 'tarde'   },
];

// Grupo que trabalha TURNO DO DIA (vermelho) em quase todo dia útil (rascunho macro).
export const GRUPO_DIA = [
  'Izadora', 'Ariane Arch', 'Micaely', 'Daniel', 'Marcelo', 'Joaquim', 'Deivid',
  'Vitória', 'Gustavo', 'Higor', 'Ariane', 'Felipe', 'Sandro', 'Maria Olivia',
];

// Dias úteis (2ª-sáb) das 3 semanas. Domingo fica p/ a escala especial.
export const DIAS_UTEIS = [
  '2026-06-15','2026-06-16','2026-06-17','2026-06-18','2026-06-19','2026-06-20',
  '2026-06-22','2026-06-23','2026-06-24','2026-06-25','2026-06-26','2026-06-27',
  '2026-06-29','2026-06-30','2026-07-01','2026-07-02','2026-07-03','2026-07-04',
];

const idPorNome = (db, nome) =>
  db.prepare('SELECT id FROM funcionarios WHERE nome = ? COLLATE NOCASE').get(nome)?.id || null;

export function aplicarEscalaFoto(db) {
  let nCaixa = 0, nQuadro = 0, nDia = 0;
  const tx = db.transaction(() => {
    for (const p of PAPEIS) {
      const fid = idPorNome(db, p.nome);
      if (!fid) continue;
      for (const data of DIAS_UTEIS) {
        E.definirCaixa(db, { data, posto: p.posto, horario: p.horario, funcionarioId: fid });
        E.definirCelula(db, fid, data, p.turno);
        nCaixa++; nQuadro++;
      }
    }
    for (const nome of GRUPO_DIA) {
      const fid = idPorNome(db, nome);
      if (!fid) continue;
      for (const data of DIAS_UTEIS) { E.definirCelula(db, fid, data, 'manha'); nDia++; }
    }
  });
  tx();
  return { nCaixa, nQuadro, nDia };
}

// Aplica só se o quadro estiver vazio (nunca sobrescreve dado real). Usado no boot.
export function aplicarSeVazio(db) {
  const temEscala = db.prepare('SELECT COUNT(*) c FROM escala_dia').get().c > 0;
  if (temEscala) return null;
  return aplicarEscalaFoto(db);
}
