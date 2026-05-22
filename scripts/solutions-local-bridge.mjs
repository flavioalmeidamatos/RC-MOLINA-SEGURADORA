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

const normalizeNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

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
  const hostWindow = {
    screenX: normalizeNumber(req.body?.hostWindow?.screenX),
    screenY: normalizeNumber(req.body?.hostWindow?.screenY),
    outerWidth: normalizeNumber(req.body?.hostWindow?.outerWidth),
    outerHeight: normalizeNumber(req.body?.hostWindow?.outerHeight),
    innerWidth: normalizeNumber(req.body?.hostWindow?.innerWidth),
    innerHeight: normalizeNumber(req.body?.hostWindow?.innerHeight),
  };
  const anchorRect = {
    left: normalizeNumber(req.body?.anchorRect?.left),
    top: normalizeNumber(req.body?.anchorRect?.top),
    right: normalizeNumber(req.body?.anchorRect?.right),
    bottom: normalizeNumber(req.body?.anchorRect?.bottom),
    width: normalizeNumber(req.body?.anchorRect?.width),
    height: normalizeNumber(req.body?.anchorRect?.height),
  };

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

    const child = spawn(
      electronBinary,
      [
        '.',
        `--sidebar=${sidebarWidth}`,
        `--host-screen-x=${hostWindow.screenX}`,
        `--host-screen-y=${hostWindow.screenY}`,
        `--host-outer-width=${hostWindow.outerWidth}`,
        `--host-outer-height=${hostWindow.outerHeight}`,
        `--host-inner-width=${hostWindow.innerWidth}`,
        `--host-inner-height=${hostWindow.innerHeight}`,
        `--anchor-left=${anchorRect.left}`,
        `--anchor-top=${anchorRect.top}`,
        `--anchor-right=${anchorRect.right}`,
        `--anchor-bottom=${anchorRect.bottom}`,
        `--anchor-width=${anchorRect.width}`,
        `--anchor-height=${anchorRect.height}`,
      ],
      {
      cwd: electronAppDir,
      detached: true,
      env: electronEnv,
      stdio: 'ignore',
      }
    );

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
