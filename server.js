import express from 'express';
import session from 'express-session';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openDb } from './src/db.js';
import { PORT, SESSION_SECRET, DB_PATH } from './src/config.js';
import { securityHeaders, errorHandler } from './src/security.js';
import { aplicarSeVazio } from './src/repo/escalaFoto.js';
import * as S from './src/repo/solicitacoes.js';
import authRoutes from './src/routes/auth.js';
import bossRoutes from './src/routes/boss.js';
import funcRoutes from './src/routes/func.js';

const PROD = process.env.NODE_ENV === 'production';
const __dirname = dirname(fileURLToPath(import.meta.url));
const db = openDb(DB_PATH);

// 1ª vez (quadro vazio): pré-carrega o rascunho da escala extraído das fotos. Nunca sobrescreve.
const _seed = aplicarSeVazio(db);
if (_seed) console.log(`[escala-foto] quadro estava vazio → ${_seed.nQuadro + _seed.nDia} células pré-carregadas (rascunho).`);

const app = express();
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));
if (PROD) app.set('trust proxy', 1); // atrás do nginx na VPS
app.use(securityHeaders);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: 'lax',
    secure: PROD,
  },
}));
app.use((req, _res, next) => { req.db = db; next(); });
app.use((req, res, next) => {
  res.locals.naoLidas = req.session?.boss ? S.notificacoesNaoLidas(db).length : 0;
  next();
});

app.use('/', authRoutes);
app.use('/app', funcRoutes);
app.use('/', bossRoutes);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use(errorHandler);

app.listen(PORT, () => console.log(`Inova Folga em http://localhost:${PORT}`));
