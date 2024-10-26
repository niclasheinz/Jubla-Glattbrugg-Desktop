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
            label: 'Jubla Glattbrugg',
            submenu: [
                {
                    label: 'Agenda',
                    click: () => loadUrlInWindow(mainWindow, config.link_Agenda)
                }
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
                { type: 'separator' },
                {
                    label: 'Beenden',
                    accelerator: 'Command+Q',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'Hilfe',
            submenu: [
                {
                    label: 'Fehler melden',
                    click: () => shell.openExternal(config.help_url)
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

// Function to load a URL into the main window
function loadUrlInWindow(window, url) {
    const formattedUrl = formatUrl(url);

    // Check if the URL is allowed
    if (isAllowedUrl(formattedUrl)) {
        window.loadURL(formattedUrl);
    } else {
        showUrlNotAllowedDialog(formattedUrl);
    }
}

// Format URL to use https and ensure valid domain structure
function formatUrl(url) {
    // Ensure URL uses https protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
    } else if (url.startsWith('http://')) {
        url = url.replace('http://', 'https://');
    }
    return url;
}

// Check if the URL is within allowed domains
function isAllowedUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const allowedDomains = config.allowedDomains;

        // Check if hostname matches any allowed domain
        return allowedDomains.some(domain => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`));
    } catch (e) {
        console.error(`Invalid URL: ${url}`, e);
        return false;
    }
}

// Show a dialog if the URL is not allowed
function showUrlNotAllowedDialog(url) {
    dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'URL nicht erlaubt',
        message: `Die Seite "${url}" kann nicht in der Desktop App geöffnet werden.`,
        buttons: ['In Browser öffnen', 'Zurück zur Startseite']
    }).then(result => {
        if (result.response === 0) {  // 'In Browser öffnen'
            shell.openExternal(url).then(() => mainWindow.close());
        } else {  // 'Zurück zur Startseite'
            loadUrlInWindow(mainWindow, config.url);
        }
    });
}

// Ensure single instance and handle protocol URLs
app.whenReady().then(() => {
    app.setAsDefaultProtocolClient('jgdesktop');

    const urlFromArgs = process.argv.find(arg => arg.startsWith('jgdesktop://'));
    const urlToLoad = urlFromArgs ? formatUrl(urlFromArgs.replace('jgdesktop://', '')) : config.url;
    createWindow(urlToLoad);
});

app.on('second-instance', (event, argv) => {
    const urlFromArgs = argv.find(arg => arg.startsWith('jgdesktop://'));
    const urlToLoad = urlFromArgs ? formatUrl(urlFromArgs.replace('jgdesktop://', '')) : config.url;

    if (mainWindow) {
        loadUrlInWindow(mainWindow, urlToLoad);
        mainWindow.focus();
    } else {
        createWindow(urlToLoad);
    }
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) createWindow();
});
