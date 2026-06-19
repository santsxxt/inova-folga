export const PORT = process.env.PORT || 3900;
export const SESSION_SECRET = process.env.SESSION_SECRET || 'inova-folga-dev-secret';
// Login do patrão (trocar via env em produção).
export const BOSS_USER = process.env.BOSS_USER || 'Carlos';
export const BOSS_PASS = process.env.BOSS_PASS || '1';
export const BOSS_PASS_HASH = process.env.BOSS_PASS_HASH || ''; // alternativa scrypt (salt:hash)
export const DB_PATH = process.env.DB_PATH || 'data/inovafolga.db';

// Em produção, alerta ALTO se a senha do patrão ainda é o default '1'.
// (Avisa, mas NÃO derruba o app — tirar o site do ar dos 40 seria pior que a senha fraca.)
export const SENHA_BOSS_INSEGURA =
  process.env.NODE_ENV === 'production' && !BOSS_PASS_HASH && (BOSS_PASS === '1' || !BOSS_PASS);
if (SENHA_BOSS_INSEGURA) {
  console.warn('\n[AVISO DE SEGURANÇA] BOSS_PASS está com o valor default em produção.');
  console.warn('  → Defina BOSS_PASS ou BOSS_PASS_HASH no .env e reinicie (pm2 restart inova-folga).\n');
}
