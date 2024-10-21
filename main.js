const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
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
}

// Function to create the application menu
function createMenu() {
    const menuTemplate = [
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
                    accelerator: 'Command+Q', // For macOS
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Bearbeiten',
            submenu: [
                {
                    label: 'Rückgängig',
                    accelerator: 'Command+Z', // For macOS
                    role: 'undo'
                },
                {
                    label: 'Wiederholen',
                    accelerator: 'Shift+Command+Z', // For macOS
                    role: 'redo'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Kopieren',
                    accelerator: 'Command+C', // For macOS
                    role: 'copy'
                },
                {
                    label: 'Einfügen',
                    accelerator: 'Command+V', // For macOS
                    role: 'paste'
                }
            ]
        },
        {
            label: 'Hilfe',
            submenu: [
                {
                    label: 'Fehler melden',
                    click: () => {
                        shell.openExternal('https://www.jublaglattbrugg.ch/desktop-fehler');
                    }
                },
                {
                    label: 'Über',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Über Jubla Glattbrugg',
                            message: 'Die offizielle Desktop-App für Jubla Glattbrugg\nVersion 0.0.6',
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
    try {
        const parsedUrl = new URL(url); // Parse the URL to check if it's valid
        const allowedDomains = config.allowedDomains;
        const isAllowed = allowedDomains.includes(parsedUrl.hostname);

        // Allow URLs that start with 'www.' or the specific allowed URL
        if (parsedUrl.hostname.endsWith('.jublaglattbrugg.ch')) {
            return true; // Allow all subdomains
        }

        return isAllowed;
    } catch (e) {
        console.error(`Invalid URL: ${url}`, e); // Log the error for debugging
        return false; // If the URL is invalid, return false
    }
}

// Show dialog when URL is not allowed
function showUrlNotAllowedDialog(url) {
    dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'URL nicht erlaubt',
        message: `Die Seite "${url}" kann nicht in der Desktop App geöffnet werden.`,
        buttons: ['In Browser öffnen', 'Zurück zur Startseite']
    }).then(result => {
        if (result.response === 0) { // 'In Browser öffnen'
            shell.openExternal(url).then(() => {
                mainWindow.close();  // Close the window after opening the URL in the browser
            });
        } else { // 'Zurück zur Startseite'
            loadUrlInWindow(mainWindow, config.url); // Load default URL
        }
    });
}

// Ensure single instance of the app
app.whenReady().then(() => {
    app.setAsDefaultProtocolClient('jgdesktop');

    const urlFromArgs = process.argv.find(arg => arg.startsWith('jgdesktop://'));
    const urlToLoad = urlFromArgs ? formatUrl(decodeURIComponent(urlFromArgs.replace('jgdesktop://', ''))) : config.url;
    createWindow(urlToLoad);
});

// Handle deep linking when app is already running
app.on('second-instance', (event, argv) => {
    const urlFromArgs = argv.find(arg => arg.startsWith('jgdesktop://'));
    const urlToLoad = urlFromArgs ? formatUrl(decodeURIComponent(urlFromArgs.replace('jgdesktop://', ''))) : config.url;

    if (mainWindow) {
        loadUrlInWindow(mainWindow, urlToLoad);
        mainWindow.focus();
    } else {
        createWindow(urlToLoad);
    }
});

// Function to format the URL correctly
function formatUrl(url) {
    // Check if the URL is missing a protocol (e.g., starts with "jublaglattbrugg.ch")
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`; // Prepend 'https://' if it's missing
    }
    return url;
}


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
