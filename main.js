const path = require("path");
const { app, BrowserWindow, ipcMain, screen, powerMonitor } = require("electron");

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

  // 屏保/锁屏/休眠检测
  powerMonitor.on("lock-screen", () => {
    if (mainWindow) mainWindow.webContents.send("system:screen-locked");
  });
  powerMonitor.on("suspend", () => {
    if (mainWindow) mainWindow.webContents.send("system:screen-locked");
  });
  powerMonitor.on("unlock-screen", () => {
    if (mainWindow) mainWindow.webContents.send("system:screen-unlocked");
  });
  powerMonitor.on("resume", () => {
    if (mainWindow) mainWindow.webContents.send("system:screen-unlocked");
  });

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
    const { workArea } = screen.getPrimaryDisplay();
    isMini = true;
    // 先通知渲染层隐藏内容，再缩小窗口，避免内容闪现
    mainWindow.webContents.send("widget:mode", "mini");
    setTimeout(() => {
      mainWindow.setMinimumSize(1, 1);
      mainWindow.setResizable(false);
      mainWindow.setAlwaysOnTop(true, "screen-saver");
      // 右边距 20px，底部距 Dock 20px
      mainWindow.setBounds(
        {
          x: workArea.x + workArea.width - 340 - 20,
          y: workArea.y + workArea.height - 86 - 20,
          width: 340,
          height: 86,
        },
        false
      );
    }, 80);
    return "mini";
  } else {
    isMini = false;
    mainWindow.webContents.send("widget:mode", "full");
    setTimeout(() => {
      mainWindow.setMinimumSize(360, 580);
      mainWindow.setResizable(true);
      if (prevBounds) mainWindow.setBounds(prevBounds, false);
    }, 80);
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
