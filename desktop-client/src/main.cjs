const { app, BrowserWindow, Menu, dialog, screen, session, shell } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const PROTOCOL = "urlembeddiag";
const WINDOW_GAP = 16;
const MIN_WINDOW_WIDTH = 640;
const MODAL_LIKE_WINDOW = true;
const AUTO_FIT_TO_WINDOW = true;
const MIN_ZOOM_FACTOR = 0.65;
let mainWindow;
let pendingUrl = null;
let pendingScreenHint = null;
let localServer = null;
let allowQuit = false;

function writeLog(event, data = {}) {
  try {
    const logLine = JSON.stringify({ at: new Date().toISOString(), event, ...data }) + "\n";
    const logPath = path.join(app.getPath("userData"), "desktop-client.log");
    fs.appendFileSync(logPath, logLine);
  } catch {
    // Logging must never prevent navigation.
  }
}

function isSupportedUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function readTargetFromDeepLink(rawValue) {
  if (!rawValue || typeof rawValue !== "string") return null;
  try {
    const parsed = new URL(rawValue);
    if (parsed.protocol !== `${PROTOCOL}:`) return null;
    const target = parsed.searchParams.get("url");
    writeLog("deep_link.received", { rawValue, target });
    return target && isSupportedUrl(target) ? target : null;
  } catch {
    writeLog("deep_link.invalid", { rawValue });
    return null;
  }
}

function readTargetFromArgv(argv) {
  const deepLinkArg = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
  return readTargetFromDeepLink(deepLinkArg);
}

function getWindowBounds(screenHint) {
  if (screenHint && Number.isFinite(screenHint.x) && Number.isFinite(screenHint.y) && Number.isFinite(screenHint.width) && Number.isFinite(screenHint.height)) {
    const x = Math.round(screenHint.x);
    const y = Math.round(screenHint.y);
    const width = Math.round(screenHint.width);
    const height = Math.round(screenHint.height);
    return {
      width,
      height,
      minWidth: width,
      minHeight: height,
      x,
      y
    };
  }

  const hasAnchor = screenHint && Number.isFinite(screenHint.anchorX) && Number.isFinite(screenHint.anchorY);
  const point = hasAnchor
    ? { x: Math.round(screenHint.anchorX), y: Math.round(screenHint.anchorY) }
    : screenHint && Number.isFinite(screenHint.x) && Number.isFinite(screenHint.y)
      ? { x: Math.round(screenHint.x), y: Math.round(screenHint.y) }
      : screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  const area = display.workArea;
  const rightEdge = area.x + area.width;
  const preferredX = hasAnchor ? Math.round(screenHint.anchorX + WINDOW_GAP) : area.x + Math.round(area.width * 0.35);
  const x = Math.min(Math.max(preferredX, area.x), Math.max(area.x, rightEdge - MIN_WINDOW_WIDTH));
  const width = Math.max(MIN_WINDOW_WIDTH, rightEdge - x);
  const preferredY = hasAnchor ? Math.round(screenHint.anchorY) : area.y;
  const y = Math.min(Math.max(preferredY, area.y), area.y + area.height - 560);
  const height = area.y + area.height - y;

  return {
    width,
    height,
    minWidth: width,
    minHeight: height,
    x,
    y
  };
}

function createWindow(screenHint = null) {
  writeLog("window.create");
  const bounds = getWindowBounds(screenHint);
  mainWindow = new BrowserWindow({
    ...bounds,
    title: "URL Embed Diagnostic Desktop",
    frame: false,
    resizable: false,
    movable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: MODAL_LIKE_WINDOW,
    skipTaskbar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs")
    }
  });
  mainWindow.setMenu(null);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSupportedUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "Escape") {
      event.preventDefault();
      hideWindowAndClearSession("escape");
    }
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isSupportedUrl(url) && !url.startsWith("file://")) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on("did-finish-load", () => {
    fitContentToWindow(mainWindow);
  });

  mainWindow.on("close", (event) => {
    if (!allowQuit) {
      event.preventDefault();
      hideWindowAndClearSession("close");
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (pendingUrl) {
    openTargetUrl(pendingUrl, pendingScreenHint);
    pendingUrl = null;
    pendingScreenHint = null;
  } else {
    mainWindow.loadFile(path.join(__dirname, "index.html"));
  }
}

async function clearBrowsingSession(reason) {
  try {
    const defaultSession = session.defaultSession;
    await defaultSession.clearCache();
    await defaultSession.clearStorageData({
      storages: [
        "cookies",
        "filesystem",
        "indexdb",
        "localstorage",
        "shadercache",
        "websql",
        "serviceworkers",
        "cachestorage"
      ]
    });
    await defaultSession.flushStorageData();
    writeLog("session.cleared", { reason });
  } catch (error) {
    writeLog("session.clear_failed", { reason, message: error.message });
  }
}

async function hideWindowAndClearSession(reason) {
  await clearBrowsingSession(reason);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
    writeLog("window.hidden", { reason });
  }
}

async function fitContentToWindow(windowRef) {
  if (!AUTO_FIT_TO_WINDOW || !windowRef || windowRef.isDestroyed()) return;

  try {
    windowRef.webContents.setZoomFactor(1);
    const metrics = await windowRef.webContents.executeJavaScript(
      `(() => {
        const root = document.documentElement;
        const body = document.body;
        return {
          viewportWidth: window.innerWidth,
          contentWidth: Math.max(
            root ? root.scrollWidth : 0,
            body ? body.scrollWidth : 0,
            root ? root.offsetWidth : 0,
            body ? body.offsetWidth : 0
          )
        };
      })();`,
      true
    );

    const viewportWidth = Number(metrics?.viewportWidth || 0);
    const contentWidth = Number(metrics?.contentWidth || 0);
    if (!viewportWidth || !contentWidth || contentWidth <= viewportWidth) {
      writeLog("window.fit.no_zoom_needed", { viewportWidth, contentWidth });
      return;
    }

    const zoomFactor = Math.max(MIN_ZOOM_FACTOR, Math.min(1, viewportWidth / contentWidth));
    windowRef.webContents.setZoomFactor(zoomFactor);
    writeLog("window.fit.zoom_applied", { viewportWidth, contentWidth, zoomFactor });
  } catch (error) {
    writeLog("window.fit.failed", { message: error.message });
  }
}

function openTargetUrl(targetUrl, screenHint = null) {
  writeLog("target.open.requested", { targetUrl, screenHint });
  if (!isSupportedUrl(targetUrl)) {
    dialog.showErrorBox("URL nao permitida", "O aplicativo desktop aceita apenas URLs http:// ou https://.");
    return;
  }

  if (!mainWindow) {
    pendingUrl = targetUrl;
    pendingScreenHint = screenHint;
    createWindow(screenHint);
    return;
  }

  if (screenHint) {
    mainWindow.setBounds(getWindowBounds(screenHint));
  }
  mainWindow.loadURL(targetUrl);
  writeLog("target.open.load_url", { targetUrl });
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.setAlwaysOnTop(MODAL_LIKE_WINDOW);
}

function registerProtocol() {
  if (process.platform === "win32") {
    const wrapperPath = path.join(__dirname, "..", "open-desktop.cmd");
    const command = `"${wrapperPath}" "%1"`;
    execFileSync("reg", ["add", `HKCU\\Software\\Classes\\${PROTOCOL}`, "/ve", "/d", `URL:${PROTOCOL}`, "/f"], { windowsHide: true });
    execFileSync("reg", ["add", `HKCU\\Software\\Classes\\${PROTOCOL}`, "/v", "URL Protocol", "/t", "REG_SZ", "/d", "", "/f"], { windowsHide: true });
    execFileSync("reg", ["add", `HKCU\\Software\\Classes\\${PROTOCOL}\\shell\\open\\command`, "/ve", "/d", command, "/f"], { windowsHide: true });
    writeLog("protocol.register", { registered: true, platform: "win32", command });
    return;
  }

  const registered = process.defaultApp
    ? app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
    : app.setAsDefaultProtocolClient(PROTOCOL);
  writeLog("protocol.register", { registered, defaultApp: process.defaultApp });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(JSON.stringify(payload));
}

function startLocalAgent() {
  if (localServer) return;

  localServer = http.createServer((req, res) => {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { ok: true, app: "url-embed-diagnostic-desktop" });
      return;
    }

    if (req.method === "POST" && req.url === "/open") {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
        if (raw.length > 4096) req.destroy();
      });
      req.on("end", () => {
        try {
          const payload = JSON.parse(raw || "{}");
          const targetUrl = String(payload.url || "");
          if (!isSupportedUrl(targetUrl)) {
            sendJson(res, 400, { ok: false, error: "URL nao permitida." });
            return;
          }
          openTargetUrl(targetUrl, payload.screen ?? null);
          sendJson(res, 200, { ok: true });
        } catch {
          sendJson(res, 400, { ok: false, error: "Payload invalido." });
        }
      });
      return;
    }

    sendJson(res, 404, { ok: false, error: "Rota nao encontrada." });
  });

  localServer.listen(43125, "127.0.0.1", () => {
    writeLog("local_agent.started", { url: "http://127.0.0.1:43125" });
  });

  localServer.on("error", (error) => {
    writeLog("local_agent.error", { message: error.message });
  });
}

app.on("open-url", (event, url) => {
  event.preventDefault();
  writeLog("app.open_url", { url });
  const target = readTargetFromDeepLink(url);
  if (target) openTargetUrl(target);
});

app.whenReady().then(() => {
  const backgroundMode = process.argv.includes("--background");
  writeLog("app.ready", { argv: process.argv });
  Menu.setApplicationMenu(null);
  registerProtocol();
  startLocalAgent();
  const target = readTargetFromArgv(process.argv);
  if (target) pendingUrl = target;

  if (process.argv.includes("--register-protocol")) {
    dialog.showMessageBox({
      type: "info",
      title: "Protocolo registrado",
      message: `Protocolo ${PROTOCOL}:// registrado para este usuario.`
    });
  }

  if (target || !backgroundMode) {
    createWindow();
  } else {
    writeLog("app.background_ready");
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  // Keep the local agent alive in the background. The window is restored by /open.
});

app.on("before-quit", () => {
  allowQuit = true;
});
