import express from 'express';
import session from 'express-session';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openDb } from './src/db.js';
import { PORT, SESSION_SECRET, DB_PATH } from './src/config.js';
import * as S from './src/repo/solicitacoes.js';
import authRoutes from './src/routes/auth.js';
import bossRoutes from './src/routes/boss.js';
import funcRoutes from './src/routes/func.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = openDb(DB_PATH);

const app = express();
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 },
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

app.listen(PORT, () => console.log(`Inova Folga em http://localhost:${PORT}`));
