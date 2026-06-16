// Clica numa célula → menu de turnos → salva via fetch e repinta.
const turnos = window.TURNOS || [];

function menuTexto() {
  return 'Turno:\n' + turnos.map((t, i) => `${i + 1} = ${t.rotulo}`).join('\n') + '\n0 = limpar';
}

document.querySelectorAll('td.cel').forEach((td) => {
  td.addEventListener('click', async () => {
    const escolha = prompt(menuTexto() + '\n\n(' + td.dataset.data + ')');
    if (escolha === null) return;
    const n = parseInt(escolha.trim(), 10);
    let turno = '';
    if (n >= 1 && n <= turnos.length) turno = turnos[n - 1].codigo;
    else if (n !== 0) { alert('Opção inválida'); return; }
    const r = await fetch('/quadro/celula', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcionarioId: td.dataset.func, data: td.dataset.data, turno }),
    });
    const j = await r.json();
    td.style.background = j.cor || '';
    td.title = turno;
  });
});
