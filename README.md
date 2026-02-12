# ⚡ CF-Worker-Sub-Pro

一个基于 Cloudflare Worker 的高级优选 IP 订阅生成器。  
A sophisticated Cloudflare Worker script for VLESS/Trojan subscription optimization.

> **🆕 v2.1.0 更新：** 修复了 Path 参数在包含多个查询参数时被截断的关键 Bug，现已完美支持 EdgeTunnel、自定义 CDN 等高级场景。[查看更新详情](#-最新更新-v210)

---

## 📖 简介

CF-Worker-Sub-Pro 是一个运行在 Cloudflare Worker 上的高性能在线工具。它能将你现有的 VLESS / Trojan 节点链接作为模板，批量应用到优选 IP 地址上，并自动进行清洗、测速、按地区分类，最终生成适配主流客户端的配置文件。

---

## ✨ 核心特性 (Features)

### 💎 现代 UI 设计
- 采用 **蓝紫渐变** (Blue-Purple Gradient) 动态背景
- **毛玻璃** (Glassmorphism) 质感卡片设计
- 完美适配移动端与桌面端
- 支持 **深色模式** (Dark Mode) 自动切换

### 🛠️ 强大的节点处理
- **智能分流**：自动识别节点地区（HK, JP, SG, US 等）并分组
- **深度清洗**：自动重命名节点为标准格式（如 `🇭🇰 香港-443-WS-TLS`），去除冗余信息
- **参数保留**：完整保留原链接中的高级参数（如 `path`, `host`, `sni`, `fp`, `alpn`, `ech` 等）
- **智能去重**：自动过滤重复的 IP:Port 组合

### ⚡ 内置测速与清洗
- **实时测速**：前端直接发起节点可用性测试
- **自动剔除**：一键剔除不可用节点，并重新生成干净的订阅链接
- **延迟排序**：测速结果自动按延迟从低到高排列

### 📦 多格式导出
- **通用订阅**：生成 Base64 编码的通用订阅链接（支持 v2rayN、Clash 等）
- **在线转换**：一键跳转第三方平台转换为 Clash 配置
- **区域筛选**：支持按地区复制节点（例如只复制美国节点）
- **IP 列表**：批量导出 `IP:Port#节点名` 格式

---

## 🚀 部署方法 (Deployment)

### 快速部署（推荐）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → **Overview** → **Create Application** → **Create Worker**
3. 命名 Worker（例如 `sub-pro`），点击 **Deploy**
4. 点击 **Edit code**
5. 将本仓库中的 `worker.js` 代码完整复制并覆盖编辑器中的内容
6. 点击右上角的 **Deploy** 保存并发布
7. 访问 Worker 的 URL 即可使用（例如 `https://sub-pro.your-account.workers.dev`）

### 初次访问设置密码

首次访问时需要设置访问密码：
1. 在浏览器中访问：`https://your-worker-url/?pw=your_password`
2. 密码会自动保存到 Cookie（30天有效期）
3. 后续访问无需再次输入密码

---

## 📖 使用指南 (Usage)

### 1️⃣ 基础配置

#### **节点模板**（可选）
输入一个可用的 VLESS 或 Trojan 链接，包含完整参数：
```
vless://uuid@ip:port?encryption=none&security=tls&sni=example.com&fp=chrome&type=ws&host=example.com&path=%2F%3Fed%3D2048#NodeName
```

> 💡 **提示：** 如果留空，则保留源节点的原始协议和参数。

#### **节点来源**（必填）
输入优选 IP 列表或订阅链接：

**方式 1：直接输入 IP 列表**
```
1.1.1.1:443
8.8.8.8:8443
172.64.1.1:2053
```

**方式 2：输入订阅链接**
```
https://example.com/subscription
vmess://base64encodedconfig...
vless://uuid@ip:port...
```

**方式 3：混合输入**
```
https://subscription-url.com
1.2.3.4:443
vless://uuid@5.6.7.8:8443...
```

---

### 2️⃣ 生成与测试

1. **生成订阅**  
   输入上述信息后，点击 **生成 / 聚合订阅** 按钮

2. **查看结果**  
   系统会自动解析并显示所有可用节点，按地区分类（如 🇺🇸 美国、🇭🇰 香港）

3. **测试节点**（推荐）  
   点击 **🔍 测试连通性** 按钮，等待测试完成：
   - ✅ 绿色显示：节点可用 + 延迟时间
   - ❌ 红色显示：节点不可用

4. **清洗节点**（可选）  
   如果有节点不可用，会出现 **🗑️ 剔除失败节点** 按钮，点击即可自动清洗并重新生成

---

### 3️⃣ 导出订阅

#### **方式 1：通用订阅链接**
点击 **复制订阅链接**，将 URL 粘贴到客户端：
- ✅ v2rayN / v2rayNG
- ✅ Shadowrocket
- ✅ Clash (需在线转换)
- ✅ Sing-box (需在线转换)

#### **方式 2：在线转换 Clash**
点击 **🌐 在线转换 Clash**，自动跳转第三方平台生成 `.yaml` 配置文件

#### **方式 3：按区域复制**
1. 点击下方的地区按钮（如 `🇺🇸 美国`），按钮会高亮显示
2. 可以选择多个地区
3. 点击 **复制选中区域** 即可获取指定地区的 Base64 订阅

#### **方式 4：复制 IP 列表**
点击 **复制 IP 列表**，导出格式：
```
1.1.1.1:443#美国-443-WS-TLS
8.8.8.8:8443#香港-8443-GRPC-TLS
```

---

## ⚙️ 高级配置

### 修改默认密码

编辑 `worker.js` 文件顶部：

```javascript
// --- 配置区 ---
const AUTH_PASSWORD = "your_custom_password"; 
// --------------
```

### 自定义区域关键词

```javascript
const REGION_CONFIG = {
    "🇭🇰 香港": ["HK", "HongKong", "Hong Kong", "香港", "HKG"],
    "🇯🇵 日本": ["JP", "Japan", "Tokyo", "日本", "JPN"],
    "🇸🇬 新加坡": ["SG", "Singapore", "狮城", "新加坡"],
    // ... 添加更多区域
};
```

### Cloudflare 非 TLS 端口

以下端口会自动禁用 TLS（强制 HTTP）：
```javascript
const CF_NON_TLS_PORTS = new Set(['80', '8080', '8880', '2052', '2082', '2086', '2095']);
```

---

## 🆕 最新更新 (v2.1.0)

### 🐛 关键 Bug 修复：Path 参数完整性问题

**问题描述：**  
当模板中的 `path` 参数包含多个查询参数时（例如 `/?ed=2048&proxyip=kr.william.us.ci`），生成的订阅链接会丢失 `&` 符号后的内容。

**影响场景：**
- ❌ **EdgeTunnel** 的 ProxyIP 功能无法使用
- ❌ 自定义 **CDN 路由**参数丢失
- ❌ 动态 Path 中的 `token`、`key` 等参数缺失

**修复效果对比：**
```diff
模板: path=/?ed=2048&proxyip=kr.william.us.ci

- 修复前: path=/?ed=2048  ❌ 丢失 &proxyip=kr.william.us.ci
+ 修复后: path=/?ed=2048&proxyip=kr.william.us.ci  ✅ 完整保留
```

**技术改进：**
- ✅ 使用精确的 VLESS/Trojan 参数白名单进行正则匹配
- ✅ 避免将 Path 值内部的 `&` 误认为协议参数分隔符
- ✅ 支持任意复杂度的 Path 查询字符串
- ✅ 完美支持 EdgeTunnel、ProxyIP、动态路由等高级功能

**升级方式：**
1. 直接替换 `worker.js` 文件内容
2. 点击 **Deploy** 保存
3. 无需修改任何配置，立即生效 ✅

**向后兼容：** 100% 兼容旧版本，所有现有配置无需修改。

**推荐升级：** 🔥 **强烈推荐所有用户升级**，特别是使用复杂 Path 配置或 EdgeTunnel 的用户。

---

## 🎯 适用场景

### ✅ 推荐使用
- 拥有大量优选 IP 需要批量生成节点
- 需要定期更新订阅但保留固定配置（UUID、Path 等）
- 机场订阅需要按地区筛选或合并
- 需要测速并剔除不可用节点

### ⚠️ 不适用场景
- Shadowsocks (SS/SSR) 协议（暂不支持，会自动过滤）
- 需要完全离线使用（依赖 Cloudflare Worker 环境）

---

## 📝 支持的协议

| 协议 | 支持状态 | 说明 |
|------|---------|------|
| **VLESS** | ✅ 完整支持 | 包括 TCP/WS/gRPC/H2 传输，TLS/Reality 加密 |
| **Trojan** | ✅ 完整支持 | 包括 TCP/WS/gRPC 传输 |
| **VMess** | ✅ 完整支持 | JSON 格式配置 |
| **Shadowsocks** | ❌ 暂不支持 | 会自动过滤跳过 |

---

## 🔒 安全性说明

- ✅ 所有数据处理均在 Cloudflare Worker 内完成，不经过第三方服务器
- ✅ 密码通过 Cookie 本地存储，30天有效期
- ✅ 不记录任何用户输入的节点信息
- ✅ 开源代码，可自行审计

---

## ❓ 常见问题 (FAQ)

### Q1: 为什么生成的链接在客户端无法使用？
**A:** 请检查：
1. 模板链接是否完整（包含 UUID、加密方式等）
2. IP 地址和端口是否正确
3. 是否选择了正确的传输协议（WS/gRPC/TCP）
4. Path、Host、SNI 等参数是否匹配

### Q2: 如何判断节点是否可用？
**A:** 使用内置的 **🔍 测试连通性** 功能：
- 绿色 + 数字 = 可用 + 延迟时间（ms）
- 红色 = 不可用

### Q3: 支持哪些客户端？
**A:** 生成的订阅链接支持：
- ✅ v2rayN / v2rayNG (Windows/Android)
- ✅ Shadowrocket (iOS)
- ✅ Clash (需在线转换)
- ✅ Sing-box (需在线转换)

### Q4: 为什么 Shadowsocks 节点被过滤了？
**A:** 当前版本暂不支持 SS/SSR 协议，会自动跳过这些节点。

### Q5: 可以自定义节点命名规则吗？
**A:** 当前版本使用固定格式：`地区-端口-协议-加密`（例如 `🇭🇰 香港-443-WS-TLS`），暂不支持自定义。

### Q6: 订阅链接会过期吗？
**A:** Worker 生成的订阅链接是动态的，只要 Worker 在线就永久有效。但建议定期重新生成以获取最新的优选 IP。

---

## 🛠️ 技术架构

```
┌─────────────────┐
│  用户浏览器      │
│  (Web UI)       │
└────────┬────────┘
         │
         │ HTTPS
         │
┌────────▼────────┐
│ Cloudflare      │
│ Worker          │
│ (JavaScript)    │
└────────┬────────┘
         │
         ├─► 解析模板 (VLESS/Trojan/VMess)
         ├─► 聚合节点 (HTTP/订阅链接)
         ├─► 智能去重 (IP:Port)
         ├─► 区域识别 (关键词匹配)
         ├─► 节点测速 (Fetch API)
         └─► 生成订阅 (Base64)
```

---

## 📄 开源协议

本项目采用 **MIT License** 开源协议。

---

## ⚠️ 免责声明

本项目仅供技术研究和学习使用，请勿用于非法用途。使用本工具所产生的任何后果由使用者自行承担，开发者不承担任何责任。

---

## 🙏 致谢

感谢以下项目和技术的支持：
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [v2ray](https://www.v2ray.com/)
- 社区用户的 Bug 反馈与建议

---

## 📧 联系方式

如有问题或建议，欢迎通过以下方式联系：
- 📮 提交 [GitHub Issue](https://github.com/your-repo/issues)
- 💬 参与 [Discussion](https://github.com/your-repo/discussions)

---

**⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！**
