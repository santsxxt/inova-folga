module.exports = {
  apps: [{
    name: 'inova-folga',
    script: 'server.js',
    cwd: __dirname,
    env: { PORT: 3900, NODE_ENV: 'production' },
    autorestart: true,
    max_restarts: 10,
  }],
};
