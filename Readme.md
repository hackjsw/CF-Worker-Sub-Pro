# ⚡ CF-Worker-Sub-Pro

> 一个基于 Cloudflare Worker 的高级优选 IP 订阅生成器。
> A sophisticated Cloudflare Worker script for VLESS/Trojan subscription optimization.

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat&logo=cloudflare&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

**CF-Worker-Sub-Pro** 是一个轻量级但功能强大的在线工具。它能将你现有的 VLESS / Trojan / Hysteria2 节点链接，批量替换为优选 IP 地址，并自动清洗节点名称、按地区分类，生成美观、整洁的永久订阅链接。

## ✨ 特性 (Features)

* **🎨 优雅界面**：采用淡金色与暖白色（Light Gold & Warm White）的现代化 UI 设计，视觉舒适。
* **🌍 智能分区**：自动识别节点地区（HK, JP, SG, US, KR 等），并进行分组展示。
* **🧹 深度清洗**：自动剔除原节点名称中的杂乱信息，统一重命名为标准格式（如 `HK 1`, `JP 2`, `SG 3`）。
* **🔄 全协议支持**：支持 `vless://`, `trojan://`, `hysteria2://`, `ss://` 等常见协议的优选替换。
* **🛠️ 灵活操作**：
    * 支持复制单条优选 IP。
    * 支持复制单个优选节点链接。
    * 支持**定制订阅**：可生成只包含特定地区（如仅香港+新加坡）的永久订阅链接。
* **🔌 完美兼容**：生成的订阅链接完美适配 v2rayN, Clash, Shadowrocket 等主流客户端。
* **🔧 参数保留**：完美修复并保留原链接中的复杂参数（如 `path` 中的查询参数），防止节点失效。

## 🚀 部署方法 (Deployment)

你可以直接在 Cloudflare Workers 上免费部署此项目。

1.  登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2.  进入 **Workers & Pages** -> **Overview** -> **Create Application** -> **Create Worker**。
3.  给 Worker 起一个名字（例如 `sub-pro`），点击 **Deploy**。
4.  点击 **Edit code**。
5.  将本仓库中的 `worker.js` 代码完整复制并覆盖编辑器中的内容。
6.  点击右上角的 **Deploy** 保存并发布。
7.  访问 Worker 的 URL 即可使用。

## 📖 使用指南 (Usage)

### 1. 准备工作
* **模板链接**：你需要一个可用的节点链接作为“模板”（包含 uuid, key, path 等参数）。
* **优选 IP 源**：准备一批优选 IP（可以是 IP:端口，也可以是包含地区的订阅链接）。

### 2. 生成订阅
1.  在 **模板链接** 输入框中粘贴你的节点链接。
2.  在 **节点来源** 输入框中粘贴优选 IP 列表或订阅地址。
3.  (可选) 设置默认归类名称（如输入 `HK`，则无法识别地区的 IP 会被归类为 `HK`）。
4.  点击 **⚡ 生成订阅 & 提取IP**。

### 3. 获取结果
* **复制完整订阅**：点击“复制完整订阅”按钮，将链接填入 v2rayN/Clash 更新即可。
* **定制区域订阅**：在下方“按地区分类操作”中，点击你想要的地区（如 `HK`, `JP`），然后点击 **🌐 复制选中区域的订阅链接**。生成的链接将只包含你选中的地区，且支持自动更新。

## ⚙️ 配置 (Configuration)

代码顶部包含简单的配置区：

```javascript
// 区域关键词配置 (Key 为标准英文缩写)
const REGION_CONFIG = {
    "HK": ["香港", "HK", "HongKong", "HKG", "Hong Kong"],
    "TW": ["台湾", "TW", "Taiwan", "TWN", "Taipei"],
    // ... 你可以在代码中自定义更多关键词

};

⚠️ 免责声明 (Disclaimer)
本项目仅供学习、技术研究和测试使用。请勿用于非法用途。开发者对使用本项目产生的任何后果不承担法律责任。
