// Quadro: clique OU teclado (setas pra andar, Enter/Espaço pra abrir, Enter pra escolher).
const turnos = window.TURNOS || [];

// --- grade navegável ---
const linhas = [...document.querySelectorAll('table.quadro tbody tr')]
  .map((tr) => [...tr.querySelectorAll('td.cel')])
  .filter((cells) => cells.length);
const grid = linhas; // grid[r][c]
const pos = new Map(); // td -> {r,c}
grid.forEach((cells, r) => cells.forEach((td, c) => {
  pos.set(td, { r, c });
  td.tabIndex = 0;
}));

function foca(r, c) {
  if (r < 0 || r >= grid.length) return;
  const row = grid[r];
  if (!row.length) return;
  const cc = Math.max(0, Math.min(c, row.length - 1));
  row[cc]?.focus();
}

// --- menu de turnos ---
const menu = document.createElement('div');
menu.className = 'turno-menu';
menu.hidden = true;
document.body.appendChild(menu);
let alvo = null; // célula sendo editada
let idx = 0;

const opcoes = [...turnos.map((t) => ({ codigo: t.codigo, rotulo: t.rotulo, cor: t.cor })),
  { codigo: '', rotulo: 'Limpar', cor: '' }];

function pinta() {
  menu.innerHTML = opcoes.map((o, i) =>
    `<div class="opt ${i === idx ? 'sel' : ''}" data-i="${i}">
       <span class="bola" style="background:${o.cor || '#fff'};border:1px solid #ccc"></span>${o.rotulo}
     </div>`).join('');
}

function abre(td) {
  alvo = td; idx = 0; pinta();
  const r = td.getBoundingClientRect();
  menu.style.left = Math.min(r.left, window.innerWidth - 220) + 'px';
  menu.style.top = (r.bottom + window.scrollY) + 'px';
  menu.hidden = false;
}

function fecha() { menu.hidden = true; alvo = null; }

async function escolhe(i) {
  if (!alvo) return;
  const turno = opcoes[i].codigo;
  const r = await fetch('/quadro/celula', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ funcionarioId: alvo.dataset.func, data: alvo.dataset.data, turno }),
  });
  const j = await r.json();
  alvo.style.background = j.cor || '';
  alvo.title = turno;
  const volta = alvo;
  fecha();
  volta.focus();
}

menu.addEventListener('click', (e) => {
  const o = e.target.closest('.opt');
  if (o) escolhe(Number(o.dataset.i));
});

// clique na célula abre o menu
grid.flat().forEach((td) => td.addEventListener('click', () => abre(td)));

// teclado
document.addEventListener('keydown', (e) => {
  if (!menu.hidden) {
    if (e.key === 'ArrowDown') { idx = (idx + 1) % opcoes.length; pinta(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { idx = (idx - 1 + opcoes.length) % opcoes.length; pinta(); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { escolhe(idx); e.preventDefault(); }
    else if (e.key === 'Escape') { const v = alvo; fecha(); v?.focus(); e.preventDefault(); }
    return;
  }
  const p = pos.get(document.activeElement);
  if (!p) return;
  if (e.key === 'ArrowRight') { foca(p.r, p.c + 1); e.preventDefault(); }
  else if (e.key === 'ArrowLeft') { foca(p.r, p.c - 1); e.preventDefault(); }
  else if (e.key === 'ArrowDown') { foca(p.r + 1, p.c); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { foca(p.r - 1, p.c); e.preventDefault(); }
  else if (e.key === 'Enter' || e.key === ' ') { abre(document.activeElement); e.preventDefault(); }
});

document.addEventListener('click', (e) => {
  if (!menu.hidden && !menu.contains(e.target) && !e.target.classList.contains('cel')) fecha();
});
