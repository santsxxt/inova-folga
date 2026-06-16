import { Router } from 'express';
import { BOSS_USER, BOSS_PASS } from '../config.js';
import * as F from '../repo/funcionarios.js';

const router = Router();

router.get('/login', (req, res) => res.render('login-boss', { erro: null }));

router.post('/login', (req, res) => {
  const { usuario, senha } = req.body;
  if (String(usuario).trim() === BOSS_USER && String(senha) === BOSS_PASS) {
    req.session.boss = true;
    return res.redirect('/quadro');
  }
  res.render('login-boss', { erro: 'Usuário ou senha inválidos' });
});

router.get('/app/login', (req, res) => res.render('login-func', { erro: null }));

router.post('/app/login', (req, res) => {
  const { nome, pin } = req.body;
  const f = F.autenticar(req.db, nome, pin);
  if (!f) return res.render('login-func', { erro: 'Nome ou PIN inválidos' });
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
