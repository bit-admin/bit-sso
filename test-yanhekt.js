// 测试新的 token 获取方法
// 这个文件用于验证基于 worker/index.js 逆向研究的新实现

const axios = require('axios');
const CryptoJS = require('crypto-js');
const { URLSearchParams } = require('url');

// 模拟 example.js 中的核心逻辑
async function testTokenExtraction(username, password) {
    const serviceUrl = 'https://cbiz.yanhekt.cn/v1/cas/callback';
    let sessionCookies = '';

    try {
        console.log('🚀 开始测试基于worker/index.js的Token获取流程...');

        // 阶段 1: 获取会话Cookie和页面参数
        const API_LOGIN_PAGE = "https://sso.bit.edu.cn/cas/login";
        console.log('📝 步骤1: 获取登录页面和初始Cookie...');
        
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
        console.log('✅ 步骤1完成: 已获取加密密钥和执行令牌');

        // 阶段 2: 加密密码并提交登录表单
        console.log('🔐 步骤2: 加密密码并提交登录...');
        
        function encryptPassword(cryptoKey, password) {
            if (!cryptoKey) {
                throw new Error("加密密钥(cryptoKey)缺失，无法加密密码。");
            }
            const key = CryptoJS.enc.Base64.parse(cryptoKey);
            const encrypted = CryptoJS.AES.encrypt(password, key, {
                mode: CryptoJS.mode.ECB,
                padding: CryptoJS.pad.Pkcs7
            });
            return encrypted.toString();
        }

        const encryptedPassword = encryptPassword(cryptoKey, password);
        const API_LOGIN_ACTION = "https://sso.bit.edu.cn/cas/login";

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

        console.log('✅ 步骤2完成: SSO登录成功，开始重定向处理');

        // 阶段 3: 手动处理第一次重定向
        console.log('🔄 步骤3: 手动处理重定向流程...');
        
        const ssoSuccessCookiesHeader = loginResponse.headers['set-cookie'];
        if (ssoSuccessCookiesHeader) {
            const newCookies = ssoSuccessCookiesHeader.map(c => c.split(';')[0]).join('; ');
            sessionCookies += '; ' + newCookies;
        }

        const firstRedirectLocation = loginResponse.headers['location'];
        if (!firstRedirectLocation) throw new Error("SSO登录成功，但未找到第一次重定向地址。");
        
        console.log('📍 第一次重定向URL:', firstRedirectLocation);
        
        const secondResponse = await axiosInstance.get(firstRedirectLocation, {
            headers: {
                'Cookie': sessionCookies
            },
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400,
        });

        if (secondResponse.status !== 302) {
            throw new Error("Ticket验证重定向失败，服务器未返回最终的Token地址。");
        }
        
        // 阶段 4: 捕获最终重定向并提取Token
        const finalRedirectLocation = secondResponse.headers['location'];
        if (!finalRedirectLocation) throw new Error("已成功验证Ticket，但未找到包含Token的最终重定向地址。");
        
        console.log('🎯 最终重定向URL:', finalRedirectLocation);
        
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
            throw new Error("在最终的重定向URL中未找到Token参数。");
        }
        
        console.log('🎉 成功获取Token:', token);
        return {
            success: true,
            token: token
        };

    } catch (error) {
        console.error('❌ Token获取失败:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// 如果直接运行这个文件，进行测试
if (require.main === module) {
    console.log('⚠️  注意: 这是一个测试文件，需要真实的用户名和密码');
    console.log('用法: node test-yanhekt.js');
    console.log('请在代码中直接修改用户名和密码进行测试');
    
    // 取消注释以下行并填入真实凭据进行测试
    // testTokenExtraction('your_username', 'your_password').then(result => {
    //     console.log('测试结果:', result);
    // });
}

module.exports = { testTokenExtraction };
