export const PORT = process.env.PORT || 3900;
export const SESSION_SECRET = process.env.SESSION_SECRET || 'inova-folga-dev-secret';
// Login do patrão (trocar via env em produção).
export const BOSS_USER = process.env.BOSS_USER || 'Carlos';
export const BOSS_PASS = process.env.BOSS_PASS || '1';
export const BOSS_PASS_HASH = process.env.BOSS_PASS_HASH || ''; // alternativa scrypt (salt:hash)
export const DB_PATH = process.env.DB_PATH || 'data/inovafolga.db';

// Em produção, não deixa subir com a senha default '1' (força configurar BOSS_PASS/HASH no .env).
if (process.env.NODE_ENV === 'production' && !BOSS_PASS_HASH && (BOSS_PASS === '1' || !BOSS_PASS)) {
  console.error('[FATAL] BOSS_PASS está com o valor default em produção. Defina BOSS_PASS ou BOSS_PASS_HASH no .env.');
  process.exit(1);
}
