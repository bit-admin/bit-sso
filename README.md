# BIT SSO 单点登录模块

一个用于北京理工大学（BIT）SSO 单点登录系统的 Node.js 模块，通过逆向工程实现了完整的登录流程。

## 特性

- 🔐 **完整的 SSO 登录实现** - 支持北京理工大学统一身份认证系统
- 🛡️ **内置加密支持** - 集成完整的 CryptoJS 库，实现 AES/ECB 密码加密
- 🍪 **会话管理** - 自动处理登录过程中的 Cookie 和会话状态
- ⚡ **独立模块** - 自包含所有依赖，易于集成到现有项目
- 🎯 **灵活的回调支持** - 支持任意 service URL 进行 SSO 回调

## 安装

```bash
npm install axios
```

然后将 `bit-sso.js` 文件复制到你的项目中。

## 快速开始

### 基础用法

```javascript
const SSOHandler = require('./bit-sso.js');

async function login() {
    // 替换为你的目标服务 URL
    const serviceUrl = 'https://your-service.com/v1/cas/callback';
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

### 在 Electron 应用中使用

查看 `example.js` 文件了解如何在 Electron 应用中使用此模块获取完整的认证流程，包括：

1. SSO 登录获取认证 Cookie
2. 使用 Cookie 访问目标服务
3. 提取最终的认证 Token

## API 文档

### SSOHandler 类

#### 构造函数

```javascript
const ssoHandler = new SSOHandler(serviceUrl);
```

**参数:**
- `serviceUrl` (string) - 目标服务的回调 URL

#### doLogin(username, password)

执行 SSO 登录操作。

**参数:**
- `username` (string) - 学号
- `password` (string) - 密码

**返回值:**
返回 Promise，resolve 为对象：
- 成功: `{ success: true, cookies: [...] }`
- 失败: `{ success: false, reason: "错误原因" }`

## 工作原理

1. **初始化上下文** - 访问 SSO 登录页面，获取会话 Cookie 和动态参数
2. **密码加密** - 使用从页面获取的密钥对密码进行 AES/ECB 加密
3. **提交登录** - 发送表单数据到 SSO 服务器
4. **处理响应** - 根据服务器响应判断登录结果

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

- `bit-sso.js` - 主模块文件，包含完整的 SSO 登录逻辑
- `test-sso.js` - 命令行测试脚本，用于验证登录功能
- `example.js` - Electron 应用示例，展示完整的集成方案
- `package.json` - 项目配置和依赖

## 注意事项

⚠️ **重要提醒:**

1. **密码安全** - 请确保在生产环境中安全存储和传输用户凭据
2. **仅限学术用途** - 此模块仅供学习和合法的学术项目使用
3. **遵守学校政策** - 使用时请遵守北京理工大学的相关规定
4. **网络环境** - 部分功能可能需要在校园网环境下使用

## 故障排除

### 常见问题

**Q: 登录返回 "未能从页面解析到加密密钥" 错误**
A: 这通常表示 SSO 服务器页面结构发生了变化。请检查登录页面的 HTML 结构是否有更新。

**Q: 登录返回 "未能获取到初始 Cookie" 错误**
A: 检查网络连接，确保能够正常访问 `https://sso.bit.edu.cn/cas/login`。

**Q: 登录成功但后续操作失败**
A: 确保目标服务 URL 正确，并且服务支持 CAS 协议。

## 开发调试

运行测试脚本：

```bash
node test-sso.js
```

该脚本会提示输入学号密码，并测试完整的登录流程。

## 许可证

MIT License

## 免责声明

此项目仅供学习和研究使用。使用者应当遵守相关法律法规和学校规定，不得用于任何非法或不当用途。开发者不对使用此代码造成的任何后果承担责任。
