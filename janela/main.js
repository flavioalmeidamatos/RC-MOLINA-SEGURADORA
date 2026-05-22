const { app, BrowserWindow, screen } = require('electron');

const getFlagValue = (flagName) => {
  const flag = process.argv.find((value) => value.startsWith(`${flagName}=`));
  return flag ? flag.slice(flagName.length + 1) : null;
};

const getNumberFlag = (flagName, fallback) => {
  const value = Number(getFlagValue(flagName));
  return Number.isFinite(value) ? value : fallback;
};

function resolveHostBounds() {
  const screenX = getNumberFlag('--host-screen-x', 0);
  const screenY = getNumberFlag('--host-screen-y', 0);
  const outerWidth = Math.max(getNumberFlag('--host-outer-width', 0), 0);
  const outerHeight = Math.max(getNumberFlag('--host-outer-height', 0), 0);
  const innerWidth = Math.max(getNumberFlag('--host-inner-width', outerWidth), 0);
  const innerHeight = Math.max(getNumberFlag('--host-inner-height', outerHeight), 0);

  return {
    screenX,
    screenY,
    outerWidth,
    outerHeight,
    innerWidth,
    innerHeight,
  };
}

function resolveAnchorBounds() {
  return {
    left: Math.max(getNumberFlag('--anchor-left', 0), 0),
    top: Math.max(getNumberFlag('--anchor-top', 0), 0),
    right: Math.max(getNumberFlag('--anchor-right', 0), 0),
    bottom: Math.max(getNumberFlag('--anchor-bottom', 0), 0),
    width: Math.max(getNumberFlag('--anchor-width', 0), 0),
    height: Math.max(getNumberFlag('--anchor-height', 0), 0),
  };
}

function resolveWindowPlacement() {
  const sidebarWidth = Math.max(getNumberFlag('--sidebar', 350), 0);
  const hostBounds = resolveHostBounds();
  const anchorBounds = resolveAnchorBounds();
  const hasHostWindow = hostBounds.outerWidth > 0 && hostBounds.outerHeight > 0;

  const targetPoint = hasHostWindow
    ? {
        x: Math.round(hostBounds.screenX + hostBounds.outerWidth / 2),
        y: Math.round(hostBounds.screenY + hostBounds.outerHeight / 2),
      }
    : screen.getCursorScreenPoint();

  const targetDisplay = screen.getDisplayNearestPoint(targetPoint);
  const workArea = targetDisplay.workArea;

  if (!hasHostWindow) {
    return {
      x: workArea.x + sidebarWidth,
      y: workArea.y,
      width: Math.max(workArea.width - sidebarWidth, 480),
      height: workArea.height,
    };
  }

  const browserChromeWidth = Math.max(hostBounds.outerWidth - hostBounds.innerWidth, 0);
  const browserChromeHeight = Math.max(hostBounds.outerHeight - hostBounds.innerHeight, 0);
  const leftInset = Math.round(browserChromeWidth / 2);
  const rightInset = Math.max(browserChromeWidth - leftInset, 0);
  const topInset = browserChromeHeight;

  const contentX = hostBounds.screenX + leftInset;
  const contentY = hostBounds.screenY + topInset;
  const maxContentWidth = Math.max(hostBounds.innerWidth, 480);
  const maxContentHeight = Math.max(hostBounds.innerHeight, 320);
  const anchorGap = 8;
  const anchorBottom = anchorBounds.bottom > 0 ? anchorBounds.bottom + anchorGap : 0;

  const preferredX = contentX + sidebarWidth;
  const preferredY = contentY + anchorBottom;
  const preferredWidth = Math.max(maxContentWidth - sidebarWidth, 480);
  const preferredHeight = Math.max(maxContentHeight - anchorBottom, 320);

  const availableWidth = Math.max(workArea.x + workArea.width - preferredX, 480);
  const availableHeight = Math.max(workArea.y + workArea.height - preferredY, 320);

  return {
    x: Math.min(Math.max(preferredX, workArea.x), workArea.x + workArea.width - 480),
    y: Math.min(Math.max(preferredY, workArea.y), workArea.y + workArea.height - 320),
    width: Math.min(preferredWidth, availableWidth),
    height: Math.min(preferredHeight, availableHeight),
    rightInset,
  };
}

function createWindow() {
  const placement = resolveWindowPlacement();

  const win = new BrowserWindow({
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    resizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL('https://solutions.hcommerce.com.br/dashboard');

  win.webContents.on('did-finish-load', () => {
    win.webContents.insertCSS(`
      body { overflow: hidden !important; }
      ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
    `);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
