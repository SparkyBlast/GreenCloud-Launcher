const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');
const { Client, Authenticator } = require('minecraft-launcher-core');
const { Auth } = require('msmc');

const launcher = new Client();
const gameDir = path.join(os.homedir(), 'AppData', 'Roaming', '.greencloud');
const modsDir = path.join(gameDir, 'mods');
const logFile = path.join(gameDir, 'launcher.log');

function log(msg) {
    if (!fs.existsSync(gameDir)) {
        fs.mkdirSync(gameDir, { recursive: true });
    }
    const time = new Date().toISOString();
    const formatted = `[${time}] ${msg}\n`;
    console.log(msg);
    try {
        fs.appendFileSync(logFile, formatted);
    } catch (e) { }
}

let currentAuth = null;
let mainWindow = null;

// ── Auto-Updater Logic ──
autoUpdater.autoDownload = true;

function checkUpdates() {
    log("Checking for updates...");
    autoUpdater.checkForUpdates().catch(err => {
        log(`Update check failed: ${err}`);
    });
}

autoUpdater.on('update-available', () => {
    log("Update available!");
    if (mainWindow) {
        mainWindow.webContents.send('update-available');
    }
});

autoUpdater.on('update-downloaded', () => {
    log("Update downloaded and ready to install.");
    if (mainWindow) {
        mainWindow.webContents.send('update-ready');
    }
});

ipcMain.handle('restart-and-update', async () => {
    log("Restarting to install update...");
    await autoUpdater.quitAndInstall();
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 700,
        frame: false,
        transparent: true,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    ipcMain.on('close-window', () => {
        mainWindow.close();
    });
}

app.whenReady().then(() => {
    createWindow();
    checkUpdates();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('microsoft-login', async () => {
    try {
        const authManager = new Auth("select_account");
        const xboxManager = await authManager.launch("electron");
        const token = await xboxManager.getMinecraft();
        currentAuth = token.mclc();
        return { name: currentAuth.name };
    } catch (e) {
        console.error("Microsoft login error:", e);
        return null;
    }
});

ipcMain.on('offline-login', (event, username) => {
    currentAuth = Authenticator.getAuth(username);
});

ipcMain.handle('get-username', () => {
    return os.userInfo().username;
});

async function downloadFile(url, dest, redirectCount = 0) {
    if (fs.existsSync(dest)) return;
    if (redirectCount > 5) throw new Error("Too many redirects");

    console.log(`Downloading ${url}...`);
    const options = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://files.minecraftforge.net/'
        }
    };

    return new Promise((resolve, reject) => {
        const request = https.get(url, options, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadFile(response.headers.location, dest, redirectCount + 1).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                return reject(new Error(`Server returned ${response.statusCode}`));
            }

            const totalSize = parseInt(response.headers['content-length'], 10);
            const file = fs.createWriteStream(dest);
            let downloadedSize = 0;

            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
            });

            response.pipe(file);
            file.on('finish', () => {
                file.close();
                if (!isNaN(totalSize) && downloadedSize < totalSize) {
                    fs.unlinkSync(dest);
                    reject(new Error("Incomplete download"));
                } else {
                    resolve();
                }
            });
            file.on('error', (err) => { fs.unlink(dest, () => { }); reject(err); });
        });
        request.on('error', (err) => { reject(err); });
        request.setTimeout(30000, () => {
            request.destroy();
            reject(new Error("Download timeout"));
        });
    });
}

async function prepareForge() {
    const forgePath = path.join(gameDir, 'forge-universal.jar');
    const forgeUrl = "https://repo.spongepowered.org/repository/maven-public/net/minecraftforge/forge/1.8.9-11.15.1.1722/forge-1.8.9-11.15.1.1722-universal.jar";
    await downloadFile(forgeUrl, forgePath);
    return forgePath;
}

ipcMain.on('launch-minecraft', async (event, ramAllocation) => {
    try {
        log("Launching Minecraft 1.8.9 with Forge...");
        event.sender.send('launch-progress', 'Preparing Forge...');

        const forgePath = await prepareForge();

        // OptiFine Integration
        const optifinePath = path.join(modsDir, 'OptiFine_1.8.9_HD_U_L5.jar');
        const optifineUrl = "https://optifine.net/adloadX?f=OptiFine_1.8.9_HD_U_L5.jar";
        try {
            log("Checking for OptiFine...");
            await downloadFile(optifineUrl, optifinePath);
        } catch (e) {
            log(`OptiFine download failed (optional): ${e.message}`);
        }

        if (fs.existsSync(forgePath)) {
            const stats = fs.statSync(forgePath);
            log(`Forge Installer found: ${stats.size} bytes`);
            if (stats.size < 1000000) {
                log("Forge installer too small, likely corrupted. Deleting...");
                fs.unlinkSync(forgePath);
                throw new Error("Forge download was incomplete.");
            }
        }

        if (!currentAuth || !currentAuth.name) {
            const defaultName = os.userInfo().username || "GreenCloudPlayer";
            log(`Auth missing or invalid name, defaulting to: ${defaultName}`);
            currentAuth = Authenticator.getAuth(defaultName);
        }
        log(`Launching for user: ${currentAuth.name}`);

        const opts = {
            clientPackage: null,
            authorization: currentAuth,
            root: gameDir,
            forge: forgePath,
            version: {
                number: "1.8.9",
                type: "release"
            },
            memory: {
                max: `${ramAllocation || 4}G`,
                min: "1G"
            }
        };

        launcher.removeAllListeners();

        launcher.on('debug', (e) => {
            log(`[DEBUG] ${e}`);
            event.sender.send('launch-progress', `Debug: ${String(e).substring(0, 40)}...`);
        });

        launcher.on('data', (e) => {
            log(`[DATA] ${e}`);
            event.sender.send('launch-progress', `Data: ${String(e).substring(0, 40)}...`);
        });

        launcher.on('progress', (e) => {
            if (e.type && e.task !== undefined && e.total) {
                const pct = Math.round((e.task / e.total) * 100);
                event.sender.send('launch-progress', `${e.type}: ${pct}%`);
            }
        });

        launcher.on('close', () => {
            event.sender.send('launch-progress', 'Closed');
        });

        await launcher.launch(opts);
        event.sender.send('launch-progress', 'Launched!');

    } catch (e) {
        log(`Critical Launch Error: ${e.message}`);
        console.error("Critical Launch Error:", e);
        event.sender.send('launch-progress', `Error: ${e.message.substring(0, 60)}`);
    }
});

ipcMain.handle('select-mod', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Java Archives', extensions: ['jar'] }]
    });
    if (canceled) return [];
    
    for (const filePath of filePaths) {
        const fileName = path.basename(filePath);
        const destPath = path.join(modsDir, fileName);
        fs.copyFileSync(filePath, destPath);
    }
    return filePaths;
});

ipcMain.handle('get-mods', async () => {
    if (!fs.existsSync(modsDir)) return [];
    return fs.readdirSync(modsDir).filter(file => file.endsWith('.jar'));
});

ipcMain.handle('delete-mod', async (event, modName) => {
    try {
        const modPath = path.join(modsDir, modName);
        if (fs.existsSync(modPath)) {
            fs.unlinkSync(modPath);
            return true;
        }
    } catch (e) {
        console.error(`Error deleting mod ${modName}:`, e);
    }
    return false;
});

ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url);
});