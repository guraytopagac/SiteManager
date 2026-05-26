// Libraries
const path = require('path');
const db = require('../database/db');
const serve = require('electron-serve').default;
const { app, ipcMain, dialog, BrowserWindow, Menu } = require('electron');

// Part 1: Determine the database path based on the environment (development or production)
let mainWindow;
const loadURL = serve({ directory: path.join(__dirname, '..', 'dist') });
const isDev = !app.isPackaged;

// Part 2: Define the application menu with theme switching and developer tools
const menuTemplate = [
    {
        label: 'Dosya',
        submenu: [
            {
                label: 'Tema Değiştir',
                submenu: [
                    {
                        label: 'Koyu',
                        accelerator: 'CmdOrCtrl+Shift+K',
                        click() {
                            if (mainWindow) mainWindow.webContents.send('change-theme', 'dark');
                        }
                    },
                    {
                        label: 'Açık',
                        accelerator: 'CmdOrCtrl+Shift+A',
                        click() {
                            if (mainWindow) mainWindow.webContents.send('change-theme', 'light');
                        }
                    }
                ]
            },
            {
                label: "Yenile",
                role: "reload",
                accelerator: "CmdOrCtrl+R"
            },
            {
                label: 'Çıkış',
                role: 'quit',
                accelerator: 'CmdOrCtrl+Q'
            }
        ]
    },
    {
        label: "Yardım",
        submenu: [
            {
                label: "Hakkında",
                click() {
                    dialog.showMessageBox({
                        title: "Hakkında",
                        message: "Yardım ve destek için lütfen bizimle iletişime geçin: guraytopagac@gmail.com",
                        buttons: ["Tamam"]
                    });
                }
            }
        ]
    }
];

// Part 3: Add developer tools menu item in development mode
if (isDev) {
    menuTemplate.push({
        label: "Geliştirici Araçları",
        accelerator: "F12",
        click(item, focusedWindow) {
            if (focusedWindow) focusedWindow.toggleDevTools();
        }
    });
}

// Part 4: Create the main application window and load the appropriate URL based on the environment
function createMainWindow() {
    const mainMenu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(mainMenu);

    const iconPath = isDev
        ? path.join(__dirname, '../src/assets/icon.ico')
        : path.join(__dirname, '../database/../src/assets/icon.ico');

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "Mavikent Site Yönetimi Uygulaması",
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true
        }
    });

    mainWindow.maximize();

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173/');
    } else {
        loadURL(mainWindow);
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Part 5: Handle IPC events for login and registration, interacting with the SQLite database
function handleLogin(event, credentials) {
    const query = `SELECT * FROM users WHERE username = ? AND is_active = 1`;

    db.get(query, [credentials.username], (err, user) => {
        if (err) {
            dialog.showErrorBox("Giriş Hatası", "Veri tabanı sorgusu sırasında bir hata oluştu.");
            event.reply('login-response', { success: false });
            return;
        }
        if (user && user.password_hash === credentials.password) {
            db.run(`UPDATE users SET last_login = datetime('now') WHERE id = ?`, [user.id]);
            event.reply('login-response', { success: true });
        } else {
            dialog.showErrorBox("Giriş Başarısız", "Kullanıcı adı veya şifre hatalı!");
            event.reply('login-response', { success: false });
        }
    });
}

function handleRegister(event, userData) {
    const query = `
        INSERT INTO users (username, email, password_hash, role) 
        VALUES (?, ?, ?, ?)
    `;
    db.run(query, [userData.username, userData.email, userData.password, 'manager'], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                dialog.showErrorBox("Kayıt Hatası", "Bu kullanıcı adı veya e-posta adresi zaten kullanımda!");
            } else {
                dialog.showErrorBox("Kayıt Hatası", "Veri tabanına kaydedilirken bir hata oluştu.");
            }
            event.reply('register-response', { success: false });
        } else {
            dialog.showMessageBox({
                title: "Kayıt Başarılı",
                message: "Hesabınız başarıyla oluşturuldu! Giriş sayfasına yönlendiriliyorsunuz...",
                buttons: ["Tamam"]
            }).then(() => {
                event.reply('register-response', { success: true });
            });
        }
    });
}

// Part 6: Set up application event listeners for ready, window-all-closed, and activate events
app.on('ready', () => {
    createMainWindow();
    ipcMain.on('login', handleLogin);
    ipcMain.on('register', handleRegister);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createMainWindow();
    }
});