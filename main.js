const path = require("path");
const { app, BrowserWindow, ipcMain, screen } = require("electron");

let mainWindow;
let isMini = false;
let prevBounds = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 700,
    minWidth: 360,
    minHeight: 580,
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: true,
    title: "学习桌宠监督器",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("widget:toggle-pin", () => {
  if (!mainWindow) {
    return true;
  }
  const next = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(next, "screen-saver");
  return next;
});

ipcMain.handle("widget:minimize", () => {
  if (!mainWindow) return "full";
  return toggleMiniMode();
});

function toggleMiniMode() {
  if (!isMini) {
    prevBounds = mainWindow.getBounds();
    const { workAreaSize } = screen.getPrimaryDisplay();
    isMini = true;
    mainWindow.setResizable(false);
    mainWindow.setSize(300, 80, true);
    mainWindow.setPosition(
      workAreaSize.width - 316,
      workAreaSize.height - 108,
      true
    );
    mainWindow.webContents.send("widget:mode", "mini");
    return "mini";
  } else {
    isMini = false;
    mainWindow.setResizable(true);
    if (prevBounds) mainWindow.setBounds(prevBounds, true);
    mainWindow.webContents.send("widget:mode", "full");
    return "full";
  }
}

ipcMain.handle("widget:close", () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle("widget:is-pinned", () => {
  if (!mainWindow) {
    return false;
  }
  return mainWindow.isAlwaysOnTop();
});
