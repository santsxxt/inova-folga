// Lista de N dias a partir de 'inicio' (YYYY-MM-DD), com rótulo de dia da semana.
const SEMANA = ['DOM', '2a', '3a', '4a', '5a', '6a', 'SAB'];

export function dias(inicio, n) {
  const out = [];
  const [y, m, d] = inicio.split('-').map(Number);
  for (let i = 0; i < n; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const iso = dt.toISOString().slice(0, 10);
    out.push({
      iso,
      dia: dt.getUTCDate(),
      semana: SEMANA[dt.getUTCDay()],
      fimDeSemana: [0, 6].includes(dt.getUTCDay()),
    });
  }
  return out;
}

export function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}
