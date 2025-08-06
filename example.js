// Electron main.js
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
// 引入我们刚刚创建的SSO处理模块
const SSOHandler = require('./bit-sso.js');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            // 确保 preload 脚本路径正确
            preload: path.join(__dirname, 'preload.js'),
        },
    });
    mainWindow.loadFile('index.html');
    // mainWindow.webContents.openDevTools(); // 可选：打开开发者工具进行调试
}

app.whenReady().then(() => {
    // 设置IPC监听器，处理从渲染进程发来的登录请求
    ipcMain.handle('login-and-get-token', async (event, { username, password }) => {
        const serviceUrl = 'https://cbiz.yanhekt.cn/v1/cas/callback';
        const ssoHandler = new SSOHandler(serviceUrl);

        try {
            // ==========================================================
            // 第一阶段: 执行SSO登录，获取认证Cookie
            // ==========================================================
            console.log('开始执行SSO登录...');
            const loginResult = await ssoHandler.doLogin(username, password);

            if (!loginResult.success) {
                console.error('SSO登录失败:', loginResult.reason);
                return { success: false, error: loginResult.reason };
            }
            console.log('SSO登录成功，获取到认证Cookie。');

            // ==========================================================
            // 第二阶段: 使用认证Cookie访问目标服务，获取最终Token
            // ==========================================================
            console.log('正在设置Cookie并访问目标服务...');
            const targetDomain = 'https://cbiz.yanhekt.cn';
            
            // 清理旧的Cookie，确保会话干净
            await session.defaultSession.clearStorageData({ storages: ['cookies'] });

            // 使用Electron的session API设置从SSO获取的关键认证Cookie
            for (const cookieStr of loginResult.cookies) {
                // 解析Cookie字符串，例如 "CASTGC=TGT-xxx; Path=/; Secure; HttpOnly"
                const parts = cookieStr.split(';');
                const [name, value] = parts[0].split('=');
                
                await session.defaultSession.cookies.set({
                    url: targetDomain,
                    name: name.trim(),
                    value: value.trim(),
                    secure: cookieStr.toLowerCase().includes('secure'),
                    httpOnly: cookieStr.toLowerCase().includes('httponly'),
                    path: '/', // 通常设置为根路径
                });
            }
            console.log('Cookie设置完毕，正在创建隐藏窗口获取Token...');
            
            // 创建一个隐藏的窗口来加载目标页面，执行JS并提取localStorage
            const hiddenWindow = new BrowserWindow({ 
                show: false, 
                webPreferences: { 
                    nodeIntegration: false, 
                    contextIsolation: true 
                } 
            });
            
            // 加载最终的目标回调URL
            await hiddenWindow.loadURL(serviceUrl);

            // 在隐藏窗口中执行JavaScript，获取localStorage中的'auth'项
            const authDataString = await hiddenWindow.webContents.executeJavaScript(
                `localStorage.getItem('auth');`,
                true // 模拟用户手势
            );

            hiddenWindow.close(); // 操作完成，关闭隐藏窗口

            if (!authDataString) {
                return { success: false, error: '成功登录SSO，但在目标页面未找到认证信息(localStorage.auth)。' };
            }

            const authData = JSON.parse(authDataString);
            if (authData && authData.token) {
                console.log('成功获取到最终Token！');
                return { success: true, token: authData.token };
            } else {
                return { success: false, error: '在目标页面认证信息中未找到Token。' };
            }

        } catch (error) {
            console.error('登录全流程出错:', error);
            return { success: false, error: error.message };
        }
    });

    createWindow();
    // ... (其他Electron应用初始化代码)
});

// ... (其他Electron生命周期事件处理)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
