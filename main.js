const { app, BrowserWindow, Menu, shell, dialog, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Load configuration from config.json
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

let mainWindow;

// Function to create the main application window
function createWindow(url = config.url) {
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
            devTools: false,  // Disable developer tools
        },
    });

    loadUrlInWindow(mainWindow, url);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Create the application menu
    createMenu();

    // Register shortcut to open popup
    globalShortcut.register('Control+O', openPopup);
}

// Function to create the application menu
function createMenu() {
    const menuTemplate = [
        {
            label: 'Jubla Glattbrugg',
            submenu: [
                {
                    label: 'Agenda',
                    click: () => {
                        loadUrlInWindow(mainWindow, config.link_Agenda);
                    }
                },
            ]
        },
        {
            label: 'Datei',
            submenu: [
                {
                    label: 'In Browser öffnen',
                    click: () => {
                        shell.openExternal(config.url);
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Beenden',
                    accelerator: 'Command+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Hilfe',
            submenu: [
                {
                    label: 'Fehler melden',
                    click: () => {
                        shell.openExternal(config.url_help);
                    }
                },
                {
                    label: 'Über',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Über Jubla Glattbrugg',
                            message: 'Die offizielle Desktop-App für Jubla Glattbrugg\nVersion 0.0.8',
                            buttons: ['OK']
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

// Function to open the popup for URL entry
function openPopup() {
    const popupWindow = new BrowserWindow({
        width: 400,
        height: 200,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    const htmlContent = `
        <html>
        <body>
            <h2>Open URL</h2>
            <input id="keyword" type="text" placeholder="Enter keyword (e.g., 'neos')">
            <button id="submit">Submit</button>
            <script>
                const { ipcRenderer } = require('electron');
                document.getElementById('submit').onclick = () => {
                    const keyword = document.getElementById('keyword').value;
                    ipcRenderer.send('keyword-submitted', keyword);
                };
            </script>
        </body>
        </html>
    `;

    popupWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(htmlContent)}`);

    // Handle keyword submission
    ipcMain.on('keyword-submitted', (event, keyword) => {
        if (!popupWindow.isDestroyed()) { // Check if the window is still open
            popupWindow.close(); // Close the window after processing
            const url = config.keywords[keyword]; // Retrieve the URL based on the keyword
            if (url) {
                openProtocolLink(url);
            } else {
                dialog.showMessageBox(mainWindow, {
                    type: 'error',
                    title: 'Ungültiges Schlüsselwort',
                    message: 'Das eingegebene Schlüsselwort ist ungültig oder nicht konfiguriert.'
                });
            }
        }
    });

    // Handle window closed event
    popupWindow.on('closed', () => {
        // Remove the IPC listener when the popup is closed
        ipcMain.removeAllListeners('keyword-submitted');
    });
}

// Function to handle protocol link and validate domain
function openProtocolLink(url) {
    const formattedUrl = formatUrl(url);
    if (isAllowedUrl(formattedUrl)) {
        loadUrlInWindow(mainWindow, formattedUrl);
    } else {
        dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'URL nicht erlaubt',
            message: `Die Seite "${formattedUrl}" kann nicht in der Desktop App geöffnet werden.`,
            buttons: ['In Browser öffnen', 'Zurück zur Startseite']
        }).then(result => {
            if (result.response === 0) {
                shell.openExternal(formattedUrl);
            } else {
                loadUrlInWindow(mainWindow, config.url);
            }
        });
    }
}

// Function to load a URL into the window
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
        window.loadURL(url);
    });
}

// Function to format URLs (replacing http with https)
function formatUrl(url) {
    if (!url.startsWith('http')) {
        url = `https://${url.replace(/^jgdesktop:\/\//, '')}`;
    }
    return url;
}

// Check if the URL is allowed based on the domains in config.json
function isAllowedUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const allowedDomains = config.allowedDomains;
        return allowedDomains.some(domain => parsedUrl.hostname.endsWith(domain));
    } catch {
        return false;
    }
}

// Ensure single instance of the app
app.whenReady().then(() => {
    app.setAsDefaultProtocolClient('jgdesktop');
    const urlFromArgs = process.argv.find(arg => arg.startsWith('jgdesktop://'));
    createWindow(urlFromArgs ? formatUrl(decodeURIComponent(urlFromArgs.replace('jgdesktop://', ''))) : config.url);
});

app.on('second-instance', (event, argv) => {
    const urlFromArgs = argv.find(arg => arg.startsWith('jgdesktop://'));
    if (mainWindow) {
        openProtocolLink(urlFromArgs ? formatUrl(decodeURIComponent(urlFromArgs.replace('jgdesktop://', ''))) : config.url);
        mainWindow.focus();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (!mainWindow) createWindow();
});
