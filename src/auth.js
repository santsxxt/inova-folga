import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

export function hashSecret(secret) {
  const salt = randomBytes(16).toString('hex');
  const dk = scryptSync(String(secret), salt, 32).toString('hex');
  return `${salt}:${dk}`;
}

export function verifySecret(secret, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, dk] = stored.split(':');
  const test = scryptSync(String(secret), salt, 32);
  const known = Buffer.from(dk, 'hex');
  return test.length === known.length && timingSafeEqual(test, known);
}

export function requireBoss(req, res, next) {
  if (req.session?.boss) return next();
  return res.redirect('/login');
}

export function requireFuncionario(req, res, next) {
  if (req.session?.funcionarioId) return next();
  return res.redirect('/app/login');
}
