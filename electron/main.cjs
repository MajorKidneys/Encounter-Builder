const { app, BrowserWindow, nativeTheme, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");

// Serve the built site from a tiny local web server bound to this Mac only.
// file:// blocks the app's script modules, and a fixed address keeps the
// saved data (encounters, spell lists) in the same place between launches.
const PORT = 47615;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const ROOT = path.join(__dirname, "..", "dist", "client");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]).replace(/^\/+/, "");
  for (const rel of [clean, path.join(clean, "index.html"), clean + ".html"]) {
    const full = path.normalize(path.join(ROOT, rel));
    if (!full.startsWith(ROOT)) continue;
    try {
      if (fs.statSync(full).isFile()) return full;
    } catch {}
  }
  // Unknown paths (e.g. /spells) fall back to the app shell; the router takes over.
  return path.join(ROOT, "index.html");
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const file = resolveFile(req.url || "/");
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

function createWindow(url = ORIGIN + "/") {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Encounter Tracker",
    icon: path.join(__dirname, "icon", "icon.png"),
    // Match the app background so launch doesn't flash a different color.
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#2c1c1d" : "#f2f3f2",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Spell links that open "in a new tab" open as another app window;
  // anything outside the app opens in the normal web browser.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith(ORIGIN)) {
      createWindow(target);
      return { action: "deny" };
    }
    shell.openExternal(target);
    return { action: "deny" };
  });

  win.loadURL(url);
}

// Only one copy runs at a time so two windows never fight over the server.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    await startServer();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
