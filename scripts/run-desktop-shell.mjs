import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const electronBinary = path.join(
  repoRoot,
  'janela',
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron'
);
const desktopEntry = path.join(repoRoot, 'desktop-shell', 'main.cjs');

if (!fs.existsSync(desktopEntry)) {
  console.error('[Desktop Shell] Arquivo principal nao encontrado:', desktopEntry);
  process.exit(1);
}

if (!fs.existsSync(electronBinary)) {
  console.error('[Desktop Shell] Electron nao encontrado em janela/node_modules.');
  console.error('[Desktop Shell] Execute npm install na pasta janela/ antes de iniciar o shell desktop.');
  process.exit(1);
}

const childEnv = { ...process.env };
delete childEnv.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, [desktopEntry], {
  cwd: repoRoot,
  env: childEnv,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
