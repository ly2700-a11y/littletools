const path = require("path");
const { app, BrowserWindow, ipcMain, screen, powerMonitor, Notification } = require("electron");

let mainWindow;
let isMini = false;
let prevBounds = null;

// ─── 锁屏期间计时器完成通知 ──────────────────────────────────────────
let isScreenLocked = false;
let finishAt = null;       // 预计完成的 Date.now() 时间戳
let finishTimer = null;    // setTimeout 句柄
let finishLabel = "";     // 通知正文

function scheduleFinishNotification(timestamp, label) {
  clearTimeout(finishTimer);
  finishAt = timestamp;
  finishLabel = label || "时间到";
  const delay = timestamp - Date.now();
  if (delay <= 0) {
    onFinishFired();
    return;
  }
  finishTimer = setTimeout(onFinishFired, delay);
}

function cancelFinishNotification() {
  clearTimeout(finishTimer);
  finishTimer = null;
  finishAt = null;
}

function onFinishFired() {
  finishTimer = null;
  finishAt = null;
  // 只有锁屏/屏保时才由主进程接管；屏幕亮着时渲染层的 tick() 会自行处理
  if (isScreenLocked && mainWindow) {
    new Notification({ title: "学习桌宠", body: finishLabel, silent: false }).show();
    mainWindow.webContents.send("system:timer-finished");
  }
}

// 解锁/唤醒时检查是否已错过完成时刻
function checkFinishOnResume() {
  if (finishAt !== null && Date.now() >= finishAt) {
    finishAt = null;
    clearTimeout(finishTimer);
    finishTimer = null;
    if (mainWindow) {
      new Notification({ title: "学习桌宠", body: finishLabel, silent: false }).show();
      mainWindow.webContents.send("system:timer-finished");
    }
  }
}

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
    isScreenLocked = true;
    if (mainWindow) mainWindow.webContents.send("system:screen-locked");
  });
  powerMonitor.on("suspend", () => {
    isScreenLocked = true;
    if (mainWindow) mainWindow.webContents.send("system:screen-locked");
  });
  powerMonitor.on("unlock-screen", () => {
    checkFinishOnResume(); // 先检查是否错过了计时结束，再改标志位
    isScreenLocked = false;
    if (mainWindow) mainWindow.webContents.send("system:screen-unlocked");
  });
  powerMonitor.on("resume", () => {
    checkFinishOnResume();
    isScreenLocked = false;
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

ipcMain.on("timer:schedule-finish", (_, timestamp, label) => {
  scheduleFinishNotification(timestamp, label);
});

ipcMain.on("timer:cancel-finish", () => {
  cancelFinishNotification();
});
