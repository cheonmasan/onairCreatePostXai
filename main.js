const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { startUploadLoop, stopUploadLoop } = require('./scheduler/uploadLoop');
const { fetchPostsFromXAI } = require('./api/xaiClient');
const { savePostsToDB } = require('./db/database');
const { uploadPost } = require('./upload/uploader');
const { scrapeKboResults } = require('./scraping/kboScraper');
const { scrapeWeatherResults } = require('./scraping/weatherScraper');

let mainWindow;
let db;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });
    mainWindow.loadFile('index.html');
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function initializeDB() {
    db = new sqlite3.Database('community.db', (err) => {
        if (err) {
            mainWindow.webContents.send('update-status', Buffer.from(`DB 연결 오류: ${err.message}`, 'utf8').toString('utf8'));
            return;
        }
        mainWindow.webContents.send('update-status', Buffer.from('DB 연결 성공', 'utf8').toString('utf8'));
        db.run(`
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT,
                title TEXT,
                content TEXT,
                topic TEXT,
                created_at TEXT,
                isUpload INTEGER
            )
        `, (err) => {
            if (err) {
                mainWindow.webContents.send('update-status', Buffer.from(`테이블 생성 오류: ${err.message}`, 'utf8').toString('utf8'));
            } else {
                mainWindow.webContents.send('update-status', Buffer.from('DB 테이블 생성 성공', 'utf8').toString('utf8'));
            }
        });
    });
}

app.whenReady().then(() => {
    createWindow();
    initializeDB();

    ipcMain.handle('start-upload', async () => {
        mainWindow.webContents.send('update-status', Buffer.from('업로드 시작', 'utf8').toString('utf8'));
        startUploadLoop(
            mainWindow,
            (win) => fetchPostsFromXAI(win, scrapeKboResults, scrapeWeatherResults),
            savePostsToDB,
            uploadPost,
            db
        );
        return 'Upload loop started';
    });

    ipcMain.handle('stop-upload', async () => {
        stopUploadLoop(mainWindow);
        return 'Upload loop stopped';
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
    if (db) {
        db.close();
    }
});