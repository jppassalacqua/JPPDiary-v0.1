const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;

const SERVER_PORT = 8000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

function startServer() {
  const serverPath = path.join(__dirname, 'server.js');
  
  // Spawn the server.js as a child process
  serverProcess = spawn('node', [serverPath], {
    env: { ...process.env, PORT: SERVER_PORT, ELECTRON_RUN: 'true' },
    stdio: 'inherit' // Pipe output to electron console
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Gemini Diary",
    icon: path.join(__dirname, 'dist', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Load the app served by the local backend
  // We poll until the server is ready
  const checkServer = () => {
    http.get(SERVER_URL, (res) => {
      mainWindow.loadURL(SERVER_URL);
    }).on('error', () => {
      setTimeout(checkServer, 500);
    });
  };

  checkServer();

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', () => {
  startServer();
  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});