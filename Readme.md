# ⚡ CF-Worker-Sub-Pro

> 一个基于 Cloudflare Worker 的高级优选 IP 订阅生成器。
> A sophisticated Cloudflare Worker script for VLESS/Trojan subscription optimization.

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat&logo=cloudflare&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

**CF-Worker-Sub-Pro** 是一个运行在 Cloudflare Worker 上的高性能在线工具。它能将你现有的 VLESS / Trojan 节点链接作为模板，批量应用到优选 IP 地址上，并自动进行清洗、测速、按地区分类，最终生成适配主流客户端的配置文件。

## ✨ 核心特性 (Features)

* **💎 现代 UI 设计**：
    * 采用 **蓝紫渐变 (Blue-Purple Gradient)** 动态背景。
    * **毛玻璃 (Glassmorphism)** 质感卡片设计。
    * 完美适配移动端与桌面端，支持 **深色模式 (Dark Mode)** 自动切换。
* **🛠️ 强大的节点处理**：
    * **智能分流**：自动识别节点地区（HK, JP, SG, US 等）并分组。
    * **深度清洗**：自动重命名节点为标准格式（如 `🇭🇰 香港-443-TCP`），去除冗余信息。
    * **参数保留**：完整保留原链接中的高级参数（如 `path`, `host`, `sni`, `fp` 等）。
* **⚡ 内置测速与清洗**：
    * **实时测速**：前端直接发起节点可用性测试。
    * **自动剔除**：一键剔除不可用节点，并重新生成干净的订阅链接。
* **� 多格式导出**：
    * **Clash**: 生成标准 `.yaml` 配置文件。
    * **Sing-box**: 生成标准 `.json` 配置文件。
    * **通用订阅**: 生成 Base64 编码的通用订阅链接。
    * **单条复制**: 支持复制单个区域的链接或所有 IP。

## 🚀 部署方法 (Deployment)

1.  登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2.  进入 **Workers & Pages** -> **Overview** -> **Create Application** -> **Create Worker**。
3.  命名 Worker（例如 `sub-pro`），点击 **Deploy**。
4.  点击 **Edit code**。
5.  将本仓库中的 `worker.js` 代码完整复制并覆盖编辑器中的内容。
6.  点击右上角的 **Deploy** 保存并发布。
7.  访问 Worker 的 URL 即可使用。

## 📖 使用指南 (Usage)

### 1. 基础配置
* **节点模板**：输入一个可用的 VLESS 或 Trojan 链接（包含 UUID/密码、Path、Host 等完整参数）。
* **节点来源**：输入优选 IP 列表（每行一个 `IP:端口`），或者包含 IP 的订阅链接。

### 2. 生成与测试
1.  输入上述信息后，点击 **开始生成订阅**。
2.  系统会自动解析并罗列出所有可用节点，按地区分类显示。
3.  (推荐) 点击 **🔍 测试节点可用性**，等待测试完成。
4.  如果有节点不可用，会出现 **🗑️ 剔除不可达节点** 按钮，点击即可清洗列表。

### 3. 导出订阅
* **客户端配置**：直接点击 **📥 下载 Clash 配置** 或 **📥 下载 Sing-box 配置**，文件会自动下载（已修复后缀名问题）。
* **通用订阅**：点击 **复制完整订阅**，将 URL 填入 v2rayN 等软件更新即可。
* **按需复制**：点击下方的地区按钮（如 `🇺🇸 美国`），然后点击 **复制选中区域链接**，即可只获取该地区的节点。

## ⚙️ 简单配置

你可以直接在 `worker.js` 顶部修改默认配置：

```javascript
// 默认访问密码
const AUTH_PASSWORD = "your_password"; 

// 区域关键词映射
const REGION_CONFIG = {
    "🇭🇰 香港": ["HK", "HongKong", "香港"],
    "🇯🇵 日本": ["JP", "Japan", "日本"],
    // ...
};
```

⚠️ **免责声明**: 本项目仅供技术研究和学习使用，请勿用于非法用途。
