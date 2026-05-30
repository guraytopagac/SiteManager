// Libraries
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const serve = require('electron-serve').default;
const { app, ipcMain, dialog, BrowserWindow, Menu } = require('electron');

// Variables
let mainWindow;
const loadURL = serve({ directory: path.join(__dirname, '..', 'dist') });
const isDev = !app.isPackaged;

// Menu
const menuTemplate = [
    {
        label: 'Dosya',
        submenu: [
            {
                label: 'Tema Değiştir',
                accelerator: 'CmdOrCtrl+Shift+T',
                click() {
                    mainWindow.webContents.send('toggle-theme');
                }
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
                    dialog.showMessageBox(mainWindow, {
                        type: 'info',
                        title: 'Hakkında',
                        message: 'Mavikent Site Yönetim Sistemi',
                        detail: '\nDestek ve sorularınız için:\nguraytopagac@gmail.com',
                        buttons: ['Tamam'],
                        icon: path.join(__dirname, '../src/assets/icon.ico')
                    });
                }
            }
        ]
    }
];

// Dev Mode
if (isDev) {
    menuTemplate.push({
        label: "Geliştirici Araçları",
        accelerator: "F12",
        click(item, focusedWindow) {
            if (focusedWindow) focusedWindow.toggleDevTools();
        }
    });
}

// Main Window
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
app.whenReady().then(createMainWindow);

// IPC Functions
ipcMain.handle('login', async (event, credentials) => {
    return new Promise((resolve) => {
        const query = `SELECT * FROM users WHERE username = ? AND is_active = 1`;
        db.get(query, [credentials.username], (err, user) => {
            if (err) return resolve({ success: false, message: "Veritabanı hatası. Lütfen hakkında kısmından bilgi alınız." });
            if (user && bcrypt.compareSync(credentials.password, user.password_hash)) {
                db.run(`UPDATE users SET last_login = datetime('now') WHERE id = ?`, [user.id]);
                return resolve({ success: true, user });
            }
            resolve({ success: false, message: "Kullanıcı Adı / Şifre Hatalı!" });
        });
    });
});
ipcMain.handle('register', async (event, userData) => {
    return new Promise((resolve) => {
        const query = `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`;
        const hashedPassword = bcrypt.hashSync(userData.password, 10);
        db.run(query, [userData.username, userData.email, hashedPassword, 'manager'], function (err) {
            if (err) return resolve({ success: false, message: "Benzersiz Kullanıcı Adı / Email Gerekli!" });
            resolve({ success: true, message: "Kayıt Başarılı!" });
        });
    });
});
ipcMain.handle('add-apartment', async (event, data) => {
    return new Promise((resolve) => {
        const query = `INSERT INTO apartments (apartment_no, floor, type, square_meters, due_amount) VALUES (?, ?, ?, ?, ?)`;
        db.run(query, [data.apartment_no, data.floor, data.type, data.square_meters, data.due_amount], function (err) {
            if (err) return resolve({ success: false, message: "Daire eklenemedi. Lütfen hakkında kısmından bilgi alınız." });
            resolve({ success: true, message: "Daire eklendi." });
        });
    });
});
ipcMain.handle('get-stats', async () => {
    return new Promise((resolve) => {
        resolve({ success: true, payload: { cash: 12450, collections: 85, delays: 4200 } });
    });
});
ipcMain.handle('get-apartments', async () => {
    return new Promise((resolve) => {
        db.all("SELECT * FROM apartments", [], (err, rows) => {
            if (err) {
                resolve({ success: false, message: "Veriler alınamadı." });
            } else {
                resolve({ success: true, data: rows });
            }
        });
    });
});


// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Re-create the window when the app icon is clicked (macOS behavior)
app.on('activate', () => {
    if (mainWindow === null) {
        createMainWindow();
    }
});