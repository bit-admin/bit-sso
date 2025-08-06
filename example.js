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
        const axios = require('axios');
        let sessionCookies = '';

        try {
            // ==========================================================
            // 基于worker/index.js的完整手动重定向流程
            // ==========================================================
            console.log('开始执行完整的手动重定向Token获取流程...');

            // 阶段 1: 获取会话Cookie和页面参数
            const API_LOGIN_PAGE = "https://sso.bit.edu.cn/cas/login";
            console.log('步骤1: 获取登录页面和初始Cookie...');
            
            const axiosInstance = axios.create();
            const initResponse = await axiosInstance.get(`${API_LOGIN_PAGE}?service=${encodeURIComponent(serviceUrl)}`);
            
            const initialCookiesHeader = initResponse.headers['set-cookie'];
            if (!initialCookiesHeader) throw new Error("未能获取到初始Cookie (JSESSIONID)。");
            sessionCookies = initialCookiesHeader.map(c => c.split(';')[0]).join('; ');

            // 从HTML中解析参数的辅助函数
            function getHtmlParam(html, findKey) {
                const start = html.indexOf(findKey);
                if (start === -1) return "";
                const contentStart = html.indexOf('>', start);
                if (contentStart === -1) return "";
                const contentEnd = html.indexOf('<', contentStart);
                if (contentEnd === -1) return "";
                return html.substring(contentStart + 1, contentEnd).trim();
            }

            const html = initResponse.data;
            const cryptoKey = getHtmlParam(html, `id="login-croypto"`);
            const executionKey = getHtmlParam(html, `id="login-page-flowkey"`);

            if (!cryptoKey || !executionKey) throw new Error("未能从登录页解析到加密或执行密钥。");
            console.log('步骤1完成: 已获取加密密钥和执行令牌');

            // 阶段 2: 加密密码并提交登录表单
            console.log('步骤2: 加密密码并提交登录...');
            
            // 使用bit-sso.js中已有的加密逻辑
            // 需要手动构建加密密码，因为我们已经有了所需参数
            function encryptPassword(cryptoKey, password) {
                if (!cryptoKey) {
                    throw new Error("加密密钥(cryptoKey)缺失，无法加密密码。");
                }
                // 这里需要使用与bit-sso.js相同的加密逻辑
                // 由于CryptoJS在bit-sso.js中，我们需要一个简化的方法
                // 或者使用crypto-js包
                const CryptoJS = require('crypto-js');
                const key = CryptoJS.enc.Base64.parse(cryptoKey);
                const encrypted = CryptoJS.AES.encrypt(password, key, {
                    mode: CryptoJS.mode.ECB,
                    padding: CryptoJS.pad.Pkcs7
                });
                return encrypted.toString();
            }

            const encryptedPassword = encryptPassword(cryptoKey, password);
            const API_LOGIN_ACTION = "https://sso.bit.edu.cn/cas/login";

            const { URLSearchParams } = require('url');
            const params = new URLSearchParams();
            params.append('username', username);
            params.append('password', encryptedPassword);
            params.append('type', 'UsernamePassword');
            params.append('_eventId', 'submit');
            params.append('execution', executionKey);
            params.append('croypto', cryptoKey);
            params.append('geolocation', '');
            params.append('captcha_code', '');

            const loginResponse = await axiosInstance.post(`${API_LOGIN_ACTION}?service=${encodeURIComponent(serviceUrl)}`, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': sessionCookies,
                },
                maxRedirects: 0, // 关键: 手动处理重定向
                validateStatus: (status) => status >= 200 && status < 400,
            });

            if (loginResponse.status !== 302) {
                const errorData = loginResponse.data?.message || "登录失败，无法解析错误响应。";
                throw new Error(`SSO登录失败: ${errorData}`);
            }

            console.log('步骤2完成: SSO登录成功，开始重定向处理');

            // 阶段 3: 手动处理第一次重定向 (获取ticket验证URL)
            console.log('步骤3: 手动处理重定向流程...');
            
            // 累积SSO成功后的Cookie
            const ssoSuccessCookiesHeader = loginResponse.headers['set-cookie'];
            if (ssoSuccessCookiesHeader) {
                const newCookies = ssoSuccessCookiesHeader.map(c => c.split(';')[0]).join('; ');
                sessionCookies += '; ' + newCookies;
            }

            // 构造第一次重定向的URL (ticket验证)
            const firstRedirectLocation = loginResponse.headers['location'];
            if (!firstRedirectLocation) throw new Error("SSO登录成功，但未找到第一次重定向地址。");
            
            console.log('步骤3: 访问第一次重定向URL...', firstRedirectLocation);
            
            const secondResponse = await axiosInstance.get(firstRedirectLocation, {
                headers: {
                    'Cookie': sessionCookies
                },
                maxRedirects: 0, // 手动处理重定向
                validateStatus: (status) => status >= 200 && status < 400,
            });

            if (secondResponse.status !== 302) {
                throw new Error("Ticket验证重定向失败，服务器未返回最终的Token地址。很可能是因为缺少了正确的Cookie。");
            }
            
            // 阶段 4: 捕获最终重定向并提取Token
            const finalRedirectLocation = secondResponse.headers['location'];
            if (!finalRedirectLocation) throw new Error("已成功验证Ticket，但未找到包含Token的最终重定向地址。");
            
            console.log('步骤4: 从最终重定向URL提取Token...', finalRedirectLocation);
            
            // 从URL中提取token参数
            function getTokenFromUrl(urlString) {
                try {
                    const url = new URL(urlString);
                    return url.searchParams.get('token');
                } catch (e) {
                    return null;
                }
            }

            const token = getTokenFromUrl(finalRedirectLocation);

            if (!token) {
                console.log('直接重定向方式未获取到Token，尝试备用localStorage方案...');
                return await fallbackTokenExtraction(serviceUrl, sessionCookies);
            }
            
            // 成功: 返回Token
            console.log('成功通过手动重定向流程获取到Token！');
            return {
                success: true,
                token: token
            };

        } catch (error) {
            console.error('手动重定向流程出错，尝试备用方案...', error.message);
            // 如果手动重定向失败，尝试备用方案
            if (sessionCookies) {
                return await fallbackTokenExtraction(serviceUrl, sessionCookies);
            } else {
                return { success: false, error: error.message };
            }
        }
    });

    // 备用Token提取方案 - 使用BrowserWindow加载页面
    async function fallbackTokenExtraction(serviceUrl, sessionCookies) {
        console.log('启动备用Token提取方案...');
        
        const hiddenWindow = new BrowserWindow({ 
            show: false, 
            webPreferences: { 
                nodeIntegration: false, 
                contextIsolation: true 
            } 
        });

        try {
            // 清理并设置Cookie
            await hiddenWindow.webContents.session.clearStorageData({ storages: ['cookies'] });
            
            if (sessionCookies) {
                const targetDomain = 'https://cbiz.yanhekt.cn';
                const cookies = sessionCookies.split('; ');
                for (const cookieStr of cookies) {
                    const [name, value] = cookieStr.split('=');
                    if (name && value) {
                        await hiddenWindow.webContents.session.cookies.set({
                            url: targetDomain,
                            name: name.trim(),
                            value: value.trim(),
                            secure: true,
                            httpOnly: false, // localStorage 访问需要
                            path: '/'
                        });
                    }
                }
            }

            // 加载目标回调URL
            await hiddenWindow.loadURL(serviceUrl);

            // 尝试从 localStorage 获取认证信息
            const authDataString = await hiddenWindow.webContents.executeJavaScript(
                `localStorage.getItem('auth');`,
                true
            );

            if (authDataString) {
                const authData = JSON.parse(authDataString);
                if (authData && authData.token) {
                    console.log('通过备用方案成功获取到Token！');
                    return { success: true, token: authData.token };
                }
            }

            return { success: false, error: '所有Token获取方案均失败，请检查SSO配置或网络连接。' };

        } finally {
            if (!hiddenWindow.isDestroyed()) {
                hiddenWindow.close();
            }
        }
    }

    createWindow();
    // ... (其他Electron应用初始化代码)
});

// ... (其他Electron生命周期事件处理)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
