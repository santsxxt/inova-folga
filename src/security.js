// Camada de segurança sem dependências externas (helmet/rate-limit feitos à mão).

const PROD = process.env.NODE_ENV === 'production';

// Cabeçalhos de proteção (substituto enxuto do helmet).
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // CSP frouxa o bastante p/ as views EJS (inline script/style usados no quadro).
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"
  );
  if (PROD) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
}

// Rate-limit de login em memória: por IP+usuário. Bloqueia após N tentativas.
export function makeLoginLimiter({ max = 5, janelaMs = 10 * 60 * 1000, campoUsuario = 'usuario' } = {}) {
  const tentativas = new Map(); // chave -> { count, until, first }
  const chave = (req) => `${req.ip}|${String(req.body?.[campoUsuario] || '').toLowerCase().trim()}`;

  function middleware(req, res, next) {
    const k = chave(req);
    const reg = tentativas.get(k);
    const agora = Date.now();
    if (reg && reg.until && agora < reg.until) {
      const seg = Math.ceil((reg.until - agora) / 1000);
      res.status(429);
      req.rateLimited = `Muitas tentativas. Tente de novo em ${Math.ceil(seg / 60)} min.`;
    }
    next();
  }
  function falhou(req) {
    const k = chave(req);
    const agora = Date.now();
    let reg = tentativas.get(k);
    if (!reg || agora - reg.first > janelaMs) reg = { count: 0, first: agora, until: 0 };
    reg.count += 1;
    if (reg.count >= max) reg.until = agora + janelaMs;
    tentativas.set(k, reg);
  }
  function ok(req) { tentativas.delete(chave(req)); }
  // limpeza ocasional
  setInterval(() => {
    const agora = Date.now();
    for (const [k, v] of tentativas) if (agora - v.first > janelaMs && (!v.until || agora > v.until)) tentativas.delete(k);
  }, janelaMs).unref?.();

  return { middleware, falhou, ok };
}

// Tratamento global de erros: loga e responde página amigável (sem vazar stack).
export function errorHandler(err, req, res, _next) {
  console.error('[erro]', req.method, req.originalUrl, '\n', err);
  if (res.headersSent) return;
  res.status(500);
  if (req.accepts('html')) {
    res.send('<!doctype html><meta charset="utf-8"><title>Erro</title><body style="font-family:system-ui;background:#0a0709;color:#fff;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="color:#ff3b4e">Ops…</h1><p>Algo deu errado. Já registramos. Tente de novo.</p><a href="/" style="color:#ff3b4e">Voltar</a></div></body>');
  } else {
    res.json({ ok: false, erro: 'erro interno' });
  }
}
