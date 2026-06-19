// Tira prints das telas logado, usando o Chrome do PC. Uso: node scripts/shot.mjs
import { chromium } from 'playwright-core';

const BASE = process.env.BASE || 'http://localhost:3960';
const OUT = 'prototipo';

const browser = await chromium.launch({ channel: 'chrome', headless: true });

// --- Patrão ---
const ctx = await browser.newContext({ viewport: { width: 1366, height: 850 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`);
await p.fill('input[name=usuario]', 'Carlos');
await p.fill('input[name=senha]', '1');
await p.click('button');
await p.waitForLoadState('networkidle');
for (const [rota, nome] of [['/quadro','quadro'],['/saldos','saldos'],['/caixas','caixas'],['/domingos','domingos'],['/pendencias','pendencias'],['/auditoria','auditoria']]) {
  await p.goto(`${BASE}${rota}`); await p.waitForLoadState('networkidle');
  await p.screenshot({ path: `${OUT}/live-${nome}.png`, fullPage: false });
  console.log('shot', nome);
}

// --- Funcionário (celular) ---
const ctxm = await browser.newContext({ viewport: { width: 430, height: 880 } });
const m = await ctxm.newPage();
await m.goto(`${BASE}/app/login`);
await m.fill('input[name=nome]', 'Jairo');
await m.fill('input[name=pin]', 'Jairo');
await m.click('button');
await m.waitForLoadState('networkidle');
await m.screenshot({ path: `${OUT}/live-func.png`, fullPage: false });
console.log('shot func');

await browser.close();
console.log('pronto');
