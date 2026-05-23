const path = require('path');
const { app, BrowserView, BrowserWindow, ipcMain, shell } = require('electron');

const APP_URL = process.env.RC_MOLINA_DESKTOP_URL || 'https://rcmolinaseguros.resolveplanilhas.com.br/dashboard';
const SOLUTIONS_URL = 'https://solutions.hcommerce.com.br/dashboard';

let mainWindow = null;
let solutionsView = null;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeBounds = (rawBounds) => {
  if (!mainWindow) {
    return { x: 0, y: 0, width: 1280, height: 720 };
  }

  const contentBounds = mainWindow.getContentBounds();
  const minWidth = 480;
  const minHeight = 320;
  const width = clamp(Math.round(Number(rawBounds?.width) || 0), minWidth, contentBounds.width);
  const height = clamp(Math.round(Number(rawBounds?.height) || 0), minHeight, contentBounds.height);
  const maxX = Math.max(contentBounds.width - width, 0);
  const maxY = Math.max(contentBounds.height - height, 0);

  return {
    x: clamp(Math.round(Number(rawBounds?.x) || 0), 0, maxX),
    y: clamp(Math.round(Number(rawBounds?.y) || 0), 0, maxY),
    width,
    height,
  };
};

const destroySolutionsView = () => {
  if (!solutionsView) {
    return;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBrowserView(null);
    mainWindow.webContents.send('solutions:embedded-closed');
  }

  solutionsView.webContents.close({ waitForBeforeUnload: false });
  solutionsView = null;
};

const ensureSolutionsView = () => {
  if (solutionsView) {
    return solutionsView;
  }

  solutionsView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  solutionsView.setBackgroundColor('#ffffff');
  solutionsView.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  solutionsView.webContents.on('did-finish-load', () => {
    solutionsView?.webContents.insertCSS(`
      body { overflow: hidden !important; }
      ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
    `).catch(() => {});
  });

  return solutionsView;
};

const createMainWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    title: 'RC Molina Seguradora Desktop',
    autoHideMenuBar: true,
    backgroundColor: '#f0f4f8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  mainWindow.maximize();
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => {
    destroySolutionsView();
    mainWindow = null;
  });

  await mainWindow.loadURL(APP_URL);
};

ipcMain.handle('desktop:get-info', () => ({
  shell: 'electron',
  appUrl: APP_URL,
  solutionsUrl: SOLUTIONS_URL,
}));

ipcMain.handle('solutions:open-embedded', async (_event, payload) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('A janela principal do desktop nao esta disponivel.');
  }

  const view = ensureSolutionsView();
  const bounds = normalizeBounds(payload?.bounds);

  mainWindow.setBrowserView(view);
  view.setBounds(bounds);
  view.setAutoResize({ width: false, height: false });

  await view.webContents.loadURL(SOLUTIONS_URL);

  view.webContents.focus();
  return { success: true, bounds };
});

ipcMain.handle('solutions:update-embedded-bounds', (_event, payload) => {
  if (!mainWindow || mainWindow.isDestroyed() || !solutionsView) {
    return { success: false };
  }

  const bounds = normalizeBounds(payload?.bounds);
  solutionsView.setBounds(bounds);
  return { success: true, bounds };
});

ipcMain.handle('solutions:close-embedded', () => {
  destroySolutionsView();
  return { success: true };
});

app.whenReady().then(async () => {
  await createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
