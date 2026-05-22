import express from 'express';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const electronAppDir = path.join(repoRoot, 'janela');
const electronBinary = path.join(
  electronAppDir,
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron'
);

const bridgePort = Number(process.env.SOLUTIONS_BRIDGE_PORT) || 32145;
const bridgeHost = process.env.SOLUTIONS_BRIDGE_HOST || '127.0.0.1';
const allowedOrigins = new Set([
  'https://rcmolinaseguros.resolveplanilhas.com.br',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

const app = express();

app.use(express.json({ limit: '1mb' }));

const isOriginAllowed = (origin) => !origin || allowedOrigins.has(origin);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.headers['access-control-request-private-network'] === 'true') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(isOriginAllowed(origin) ? 204 : 403);
  }

  if (!isOriginAllowed(origin)) {
    return res.status(403).json({
      success: false,
      error: 'Origem nao autorizada para acessar o bridge local do Solutions.',
    });
  }

  return next();
});

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    platform: process.platform,
    bridgeHost,
    bridgePort,
  });
});

app.post('/api/launch-solutions', (req, res) => {
  const rawSidebarWidth = Number(req.body?.sidebarWidth);
  const sidebarWidth = Number.isFinite(rawSidebarWidth) && rawSidebarWidth >= 0 ? rawSidebarWidth : 192;

  if (process.platform !== 'win32') {
    return res.status(409).json({
      success: false,
      error: 'O bridge local do Solutions esta disponivel apenas no Windows.',
    });
  }

  if (!fs.existsSync(path.join(electronAppDir, 'package.json'))) {
    return res.status(500).json({
      success: false,
      error: 'A pasta janela/ nao foi encontrada dentro do projeto principal.',
    });
  }

  if (!fs.existsSync(electronBinary)) {
    return res.status(500).json({
      success: false,
      error: 'O Electron do Solutions nao esta instalado. Execute npm install na raiz do projeto.',
    });
  }

  try {
    const electronEnv = { ...process.env };
    delete electronEnv.ELECTRON_RUN_AS_NODE;

    const child = spawn(electronBinary, ['.', `--sidebar=${sidebarWidth}`], {
      cwd: electronAppDir,
      detached: true,
      env: electronEnv,
      stdio: 'ignore',
    });

    child.unref();
    return res.json({ success: true });
  } catch (error) {
    console.error('[Solutions Bridge] Erro ao iniciar o Electron:', error);
    return res.status(500).json({
      success: false,
      error: 'Nao foi possivel abrir o Solutions pela janela nativa.',
    });
  }
});

app.listen(bridgePort, bridgeHost, () => {
  console.log(`[Solutions Bridge] ouvindo em http://${bridgeHost}:${bridgePort}`);
});
