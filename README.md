# BIT SSO 单点登录模块

一个用于北京理工大学（BIT）SSO 单点登录系统的 Node.js 模块，通过深入逆向工程实现了完整的登录流程和延河课堂 Token 获取。

## 特性

- 🔐 **完整的 SSO 登录实现** - 支持北京理工大学统一身份认证系统
- 🛡️ **内置加密支持** - 集成完整的 CryptoJS 库，实现 AES/ECB 密码加密
- 🍪 **精确的会话管理** - 基于逆向工程的精确 Cookie 处理和会话状态管理
- ⚡ **独立模块设计** - `bit-sso.js` 为纯 SSO 模块，易于集成
- 🎯 **多重 Token 获取方案** - 手动重定向处理 + 备用 localStorage 方案
- 🚀 **Cloudflare Worker 支持** - 包含完整的边缘函数实现
- 🖥️ **Electron 优化** - 专门优化的 Electron 应用集成方案

## 项目结构

```
bit-sso/
├── bit-sso.js           # 核心 SSO 登录模块
├── example.js           # Electron 应用示例
├── worker/
│   └── index.js         # Cloudflare Worker 边缘函数实现
├── test-sso.js          # SSO 登录测试工具
├── test-yanhekt.js      # Token 获取测试工具
└── README.md
```

## 安装

```bash
npm install axios crypto-js
```

然后将 `bit-sso.js` 文件复制到你的项目中。

## 快速开始

### 1. 基础 SSO 登录（获取认证 Cookie）

```javascript
const SSOHandler = require('./bit-sso.js');

async function login() {
    const serviceUrl = 'https://cbiz.yanhekt.cn/v1/cas/callback';
    const ssoHandler = new SSOHandler(serviceUrl);
    
    try {
        const result = await ssoHandler.doLogin('你的学号', '你的密码');
        
        if (result.success) {
            console.log('登录成功！');
            console.log('认证 Cookies:', result.cookies);
        } else {
            console.error('登录失败:', result.reason);
        }
    } catch (error) {
        console.error('登录过程发生错误:', error.message);
    }
}

login();
```

### 2. 在 Electron 应用中获取完整延河课堂 Token

基于深入逆向工程研究，`example.js` 实现了完整的 Token 获取流程，包括：

1. **手动重定向处理** - 精确控制每一步重定向，确保 Cookie 正确传递
2. **Cookie 累积管理** - 正确累积和传递所有认证 Cookie
3. **Token 直接提取** - 从重定向 URL 直接提取 Token，不依赖页面加载
4. **备用方案** - 提供 localStorage 备用提取方案

```javascript
// 在 Electron 主进程中
const { ipcMain } = require('electron');

ipcMain.handle('login-and-get-token', async (event, { username, password }) => {
    // 详细实现请参考 example.js
    // 返回: { success: true, token: "your_token" }
});
```

### 3. Cloudflare Worker 边缘函数部署

`worker/index.js` 提供了完整的 Cloudflare Worker 实现，可以部署为边缘函数：

```javascript
// POST /worker-endpoint
{
    "username": "your_username", 
    "password": "your_password"
}

// 响应
{
    "success": true,
    "token": "your_token"
}
```

### 4. 独立测试工具

使用 `test-yanhekt.js` 进行功能验证：

```bash
node test-yanhekt.js
```

## API 文档

### SSOHandler 类

#### 构造函数

```javascript
const ssoHandler = new SSOHandler(serviceUrl);
```

**参数:**
- `serviceUrl` (string) - 目标服务的回调 URL（延河课堂为 `https://cbiz.yanhekt.cn/v1/cas/callback`）

#### doLogin(username, password)

执行 SSO 登录操作，获取认证 Cookie。

**参数:**
- `username` (string) - 学号
- `password` (string) - 密码

**返回值:**
返回 Promise，resolve 为对象：
- 成功: `{ success: true, cookies: [...] }`
- 失败: `{ success: false, reason: "错误原因" }`

## 技术原理

### SSO 登录流程

1. **初始化上下文** - 访问 SSO 登录页面，获取会话 Cookie 和动态参数
2. **密码加密** - 使用从页面获取的密钥对密码进行 AES/ECB 加密  
3. **提交登录** - 发送表单数据到 SSO 服务器
4. **处理重定向** - 手动处理重定向流程，确保 Cookie 正确传递

### Token 获取流程（基于逆向研究）

1. **阶段1**: 获取会话 Cookie 和页面参数
2. **阶段2**: 加密密码并提交登录表单
3. **阶段3**: 手动处理第一次重定向（Ticket 验证）
4. **阶段4**: 捕获最终重定向并提取 Token

## 技术细节

### 密码加密

模块实现了与官方登录页面完全相同的加密逻辑：
- 使用页面动态生成的 Base64 密钥
- AES/ECB 模式加密
- PKCS7 填充

### 表单参数

登录请求包含以下关键参数：
- `username` - 学号
- `password` - 加密后的密码
- `type` - 固定为 "UsernamePassword"
- `_eventId` - 固定为 "submit"
- `execution` - 动态执行令牌
- `croypto` - 加密密钥（注意：原始参数名确实是 "croypto"）
- `geolocation` - 地理位置（通常为空）
- `captcha_code` - 验证码（通常为空）

## 文件说明

- **`bit-sso.js`** - 核心 SSO 登录模块，提供基础的登录和 Cookie 获取功能
- **`example.js`** - Electron 应用完整示例，实现基于逆向研究的 Token 获取流程
- **`worker/index.js`** - Cloudflare Worker 边缘函数实现，可直接部署
- **`test-yanhekt.js`** - 独立测试工具，用于验证 Token 获取流程
- **`package.json`** - 项目依赖配置

## 依赖说明

- **`axios`** - HTTP 请求库，用于网络通信
- **`crypto-js`** - 加密库，用于密码加密

## 使用测试工具

运行测试脚本验证 Token 获取流程：

```bash
node test-yanhekt.js
```

在文件中修改用户名和密码，然后取消注释测试调用进行验证。

或者运行 SSO 登录测试脚本：

```bash
node test-sso.js
```

该脚本会提示输入学号密码，并测试完整的登录流程。

## 注意事项

⚠️ **重要提醒:**
- 此模块仅用于学习和研究目的
- 请遵守北京理工大学的相关规定和服务条款
- 不要将个人凭据硬编码在代码中
- 建议在生产环境中实施适当的安全措施
- 部分功能可能需要在校园网环境下使用

## 故障排除

### 常见问题

**Q: 登录返回 "未能从页面解析到加密密钥" 错误**
A: 这通常表示 SSO 服务器页面结构发生了变化。请检查登录页面的 HTML 结构是否有更新。

**Q: 登录返回 "未能获取到初始 Cookie" 错误**
A: 检查网络连接，确保能够正常访问 `https://sso.bit.edu.cn/cas/login`。

**Q: Token 获取失败**
A: 确保目标服务 URL 正确，检查重定向流程中的 Cookie 传递是否完整。

## 许可证

MIT License - 详见 LICENSE 文件

---

**免责声明:** 此项目仅用于教育和研究目的，使用者需自行承担使用风险并遵守相关法律法规。
