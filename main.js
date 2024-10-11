const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Function to create the main application window
function createWindow(url = 'https://jublaglattbrugg.ch') {
    if (mainWindow) {
        mainWindow.focus();
        loadUrlInWindow(mainWindow, url);
        return;
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'build/icons/icon-512x512.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    loadUrlInWindow(mainWindow, url);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Function to load a URL into the window with a loader
function loadUrlInWindow(window, url) {
    const loaderHtml = `
        <style>
            body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif; }
            .loader { border: 16px solid #f3f3f3; border-top: 16px solid #3498db; border-radius: 50%; width: 120px; height: 120px; animation: spin 2s linear infinite; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
        <div class="loader"></div>
    `;

    window.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(loaderHtml)}`, { baseURLForDataURL: '' });
    
    window.webContents.once('did-finish-load', () => {
        if (isAllowedUrl(url)) {
            window.loadURL(url);
        } else {
            showUrlNotAllowedDialog(url);
        }
    });
}

// Check if the URL is allowed
function isAllowedUrl(url) {
    const allowedDomains = ['jublaglattbrugg.ch'];
    const parsedUrl = new URL(url);
    return allowedDomains.includes(parsedUrl.hostname);
}

// Show dialog when URL is not allowed
function showUrlNotAllowedDialog(url) {
    dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'URL nicht erlaubt',
        message: `Die Seite "${url}" kann nicht in der Desktop App geöffnet werden.`,
        buttons: ['In Browser öffnen', 'Abbrechen']
    }).then(result => {
        if (result.response === 0) { // If the user clicked 'Open in Browser'
            shell.openExternal(url);
        }
    });
}

// Ensure single instance of the app
app.whenReady().then(() => {
    app.setAsDefaultProtocolClient('jgdesktop');

    const urlFromArgs = process.argv.find(arg => arg.startsWith('jgdesktop://'));
    const urlToLoad = urlFromArgs ? urlFromArgs.replace('jgdesktop://', 'https://') : 'https://jublaglattbrugg.ch';
    createWindow(urlToLoad);
});

// Handle deep linking when app is already running
app.on('second-instance', (event, argv) => {
    const urlFromArgs = argv.find(arg => arg.startsWith('jgdesktop://'));
    const urlToLoad = urlFromArgs ? urlFromArgs.replace('jgdesktop://', 'https://') : 'https://jublaglattbrugg.ch';

    if (mainWindow) {
        loadUrlInWindow(mainWindow, urlToLoad);
        mainWindow.focus();
    } else {
        createWindow(urlToLoad);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
