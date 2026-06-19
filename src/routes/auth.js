import { Router } from 'express';
import { BOSS_USER, BOSS_PASS, BOSS_PASS_HASH } from '../config.js';
import { verifySecret } from '../auth.js';
import { makeLoginLimiter } from '../security.js';
import * as F from '../repo/funcionarios.js';

const router = Router();
const limBoss = makeLoginLimiter({ campoUsuario: 'usuario' });
const limFunc = makeLoginLimiter({ campoUsuario: 'nome' });

function senhaBossOk(senha) {
  if (BOSS_PASS_HASH) return verifySecret(senha, BOSS_PASS_HASH);
  return String(senha) === BOSS_PASS;
}

router.get('/login', (req, res) => res.render('login-boss', { erro: null }));

router.post('/login', limBoss.middleware, (req, res) => {
  if (req.rateLimited) return res.render('login-boss', { erro: req.rateLimited });
  const { usuario, senha } = req.body;
  if (String(usuario).trim().toLowerCase() === BOSS_USER.toLowerCase() && senhaBossOk(senha)) {
    limBoss.ok(req);
    req.session.boss = true;
    return res.redirect('/quadro');
  }
  limBoss.falhou(req);
  res.render('login-boss', { erro: 'Usuário ou senha inválidos' });
});

router.get('/app/login', (req, res) => res.render('login-func', { erro: null }));

router.post('/app/login', limFunc.middleware, (req, res) => {
  if (req.rateLimited) return res.render('login-func', { erro: req.rateLimited });
  const { nome, pin } = req.body;
  const f = F.autenticar(req.db, nome, pin);
  if (!f) { limFunc.falhou(req); return res.render('login-func', { erro: 'Nome ou PIN inválidos' }); }
  limFunc.ok(req);
  req.session.funcionarioId = f.id;
  req.session.funcionarioNome = f.nome;
  res.redirect('/app');
});

router.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));
router.get('/app/logout', (req, res) => req.session.destroy(() => res.redirect('/app/login')));

router.get('/', (req, res) => {
  if (req.session?.boss) return res.redirect('/quadro');
  if (req.session?.funcionarioId) return res.redirect('/app');
  res.redirect('/login');
});

export default router;
