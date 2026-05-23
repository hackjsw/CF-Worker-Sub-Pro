# 🔥 CF-Worker-Sub-Pro

一个基于 Cloudflare Worker 的高级优选 IP 订阅生成器。  
A sophisticated Cloudflare Worker script for VLESS/Trojan subscription optimization.

> **🆕 v2.2.0 更新：** 内置 Clash YAML 生成 + KV 短链分享 + 优选 IP 区域分类，无需依赖任何第三方服务！[查看更新详情](#-最新更新v220)

---

## 📉 简介

CF-Worker-Sub-Pro 是一个运行在 Cloudflare Worker 上的高性能在线工具。它能将你现有的 VLESS / Trojan 节点链接作为模板，批量应用到优选 IP 地址上，并自动进行清洗、测速、按地区分类，最终生成适配主流客户端的配置文件。

---

## ✨ 核心特性 (Features)

### 🎵 现代 UI 设计
- 采用 **蓝紫渐变** (Blue-Purple Gradient) 动态背景
- **毛玻璃** (Glassmorphism) 质感卡片设计
- 完美适配移动端与桌面端
- 支持 **深色模式** (Dark Mode) 自动切换

### 🛎️ 强大的节点处理
- **智能分流**：自动识别节点地区（HK, JP, SG, US 等）并分组
- **深度清洗**：自动重命名节点为标准格式（如 `🇭🇰 香港-443-WS-TLS`），去除冗余信息
- **参数保留**：完整保留原链接中的高级参数（如 `path`, `host`, `sni`, `fp`, `alpn`, `ech` 等）
- **智能去重**：自动过滤重复的 IP:Port 组合

### ⚡ 内置测速与清洗
- **实时测速**：前端直接发起节点可用性测试
- **自动剔除**：一键剔除不可用节点，并重新生成干净的订阅链接
- **延迟排序**：测试结果自动按延迟从低到高排列

### 📦 多格式导出
- **通用订阅**：生成 Base64 编码的通用订阅链接（支持 v2rayN、Clash 等）
- **Clash YAML**：🆕 内置生成完整的 Clash 配置文件，包含 DNS / 规则 / 代理组，无需跳转第三方服务
- **区域筛选**：支持按地区复制节点（例如只复制美国节点）
- **IP 列表**：批量导出 `IP:Port#节点名` 格式
- **分隔符选择**：🆕 支持换行、逗号、竖线、空格四种分隔符导出

### 🔗 短链分享 (NEW)
- **KV 短链**：🆕 将超长订阅参数压缩为 6 位短链 ID，方便分享
- **7 天有效期**：数据存储在 Cloudflare KV，无访问自动过期
- **自动兜底**：订阅内容过长时自动使用短链，避免 URL 长度限制

### 🌍 优选 IP 区域 (NEW)
- **Global / Preferred 分类**：🆕 自动识别 Anycast 全球 IP 及 Cloudflare 优选 IP
- 支持识别 `shopify`、`ubi`、`sin.fan` 等常见优选域名

---

## 🚀 部署方法 (Deployment)

### 快速部署（推荐）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → **Overview** → **Create Application** → **Create Worker**
3. 命名 Worker（例如 `sub-pro`），点击 **Deploy**
4. 点击 **Edit code**
5. 将本仓库中的 `worker.js` 代码完整复制并覆盖编辑器中的内容
6. 点击右上角的 **Deploy** 保存并发布

### 🆕 绑定 KV 命名空间（短链功能需要）

如需使用短链分享功能：

1. 在 Cloudflare Dashboard → **Workers & Pages** → **KV** 中创建一个 KV 命名空间，如 `SUB_KV`
2. 进入你的 Worker → **Settings** → **Variables** → **KV Namespace Bindings**
3. 添加绑定：

| 变量名   | KV 命名空间 |
| -------- | ----------- |
| `SUB_KV` | 你创建的 KV |

> 💡 不绑定 KV 也不影响其他功能正常使用，只是无法使用 `/shorten` 短链。

### 🆕 自定义 Clash 模板（可选）

Worker 内置了默认的 Clash 配置模板。如需自定义，可在 KV 中创建一条 key 为 `clash_template` 的记录，值为你自定义的 Clash YAML 配置。

### 首次访问设置密码

首次访问时需要设置访问密码：
1. 在浏览器中访问：`https://your-worker-url/?pw=your_password`
2. 密码会自动保存到 Cookie，30天有效期
3. 后续访问无需再次输入密码

> 💡 也可以直接修改 `worker.js` 第 1 行的 `AUTH_PASSWORD` 为你的固定密码。

---

## 📚 使用指南 (Usage)

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

3. **测试节点**  
   点击 **🔄 测试连通性** 按钮，系统会自动测试所有节点的可用性并显示延迟

4. **剔除失败节点**  
   测试完成后，点击 **剔除不可用节点** 按钮自动清理

---

### 3️⃣ 导出使用

1. **复制订阅链接**：点击 **复制订阅链接**，粘贴到客户端中使用
2. **复制 Clash YAML 链接**：🆕 点击 **复制 Clash 链接**，获取内置生成的 Clash 配置订阅地址
3. **在线转换**：🆕 Clash 配置已内置生成，无需跳转第三方平台。如需其他格式可手动粘贴到在线转换工具
4. **按区域复制**：选择特定区域后，点击 **复制所选区域 Base64 订阅**

### 🆕 分隔符导出

在导出 IP 列表或域名列表时，可通过顶部下拉框选择分隔符：
- **换行** (默认)
- **逗号** (`,`)  
- **竖线** (`|`)
- **空格**

---

## 🔌 API 端点

| 路径 | 方法 | 说明 |
| ---- | ---- | ---- |
| `/` | GET | Web 管理界面（需密码认证） |
| `/sub` | GET | 生成通用订阅（Base64） |
| `/clash` | 🆕 GET | 生成 Clash YAML 订阅 |
| `/shorten` | 🆕 POST | 压缩订阅参数为短链 ID |
| `/test` | GET | Worker 连通性测试 |

### 🆕 API 请求参数

以下参数适用于 `/sub`、`/clash` 以及 POST `/shorten`：

| 参数 | 类型 | 说明 |
| ---- | ---- | ---- |
| `source` | string | Base64 编码的节点列表 |
| `id` | string | 🆕 使用 `/shorten` 生成的短链 ID（与 `source` 二选一） |
| `template` | string | 自定义 Clash 模板（仅 `/clash`） |
| `raw` | bool | `true` 时返回明文而非 Base64 |
| `format` | string | 🆕 `json` 时返回 JSON 格式 |
| `regions` | string | 按区域筛选节点（如 `HK,JP`） |
| `default_region` | string | 🆕 默认区域标记 |
| `dedup` | bool | 🆕 `false` 时关闭去重（默认开启） |

### 使用示例

```bash
# 生成订阅
curl "https://your-worker.dev/sub?source=<BASE64_NODES>"

# 生成明文订阅
curl "https://your-worker.dev/sub?source=<BASE64_NODES>&raw=true"

# 🆕 生成 Clash YAML
curl "https://your-worker.dev/clash?source=<BASE64_NODES>"

# 🆕 按区域筛选（仅保留香港和日本节点）
curl "https://your-worker.dev/sub?source=<BASE64_NODES>&regions=HK,JP"

# 🆕 创建短链（POST）
curl -X POST "https://your-worker.dev/shorten" \
  -H "Content-Type: application/json" \
  -d '{"source":"<BASE64_NODES>","regions":"HK,SG"}'

# 🆕 使用短链 ID 获取订阅
curl "https://your-worker.dev/sub?id=abc123"
```

---

## 📝 区域识别

Worker 会根据节点名称自动匹配区域标签，支持中英文及常用缩写：

| 区域 | 可识别的名称 |
| ---- | ------------ |
| 香港 HK | HK, HongKong, Hong Kong, 香港, HKG |
| 台湾 TW | TW, Taiwan, Taipei, 台湾, CN_TW, TWN |
| 新加坡 SG | SG, Singapore, 狮城, 新加坡, SGP |
| 日本 JP | JP, Japan, Tokyo, Osaka, 日本, JPN |
| 美国 US | US, USA, America, United States, LosAngeles, SanJose, 美国 |
| 韩国 KR | KR, Korea, Seoul, 韩国 |
| 德国 DE | DE, Germany, Frankfurt, 德国 |
| 法国 FR | FR, France, Paris, 法国 |
| 英国 UK | UK, Britain, England, London, 英国 |
| 加拿大 CA | CA, Canada, 加拿大 |
| 俄罗斯 RU | RU, Russia, 俄罗斯 |
| 🆕 优选 IP | 优选, Cloudflare, CF, CDN, shopify, ubi, sin.fan |
| 🆕 Global | Anycast, Global, IP- |

---

## ✨ 适用场景

### ✅ 适用场景
- 批量应用优选 IP 到现有 VLESS/Trojan 配置
- 生成适用于机场订阅的聚合链接
- 按地区分类测试并筛选节点
- 想保持能用的 DNS/Selector/Rules 等固定配置（UUID、Path 等）
- 机场订阅需要按地区筛选或合并
- 需要测试并剔除不可用节点
- 🆕 需要一个内置 Clash 配置生成且不依赖第三方的方案
- 🆕 需要短链接分享超长订阅内容

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
- ✅ 🆕 KV 短链数据 7 天无访问自动过期
- ✅ 开源代码，可自行审计

---

## 🆕 最新更新 v2.2.0

### 新增功能

#### 🎯 内置 Clash YAML 生成
- 新增 `/clash` 端点，直接在 Worker 内生成完整 Clash 配置
- 包含 DNS 解析、规则匹配、代理组等完整配置
- 不再依赖任何第三方在线转换服务
- 支持自定义模板（通过 KV 中的 `clash_template` key）

#### 🔗 KV 短链分享
- 新增 `/shorten` 端点，将订阅参数压缩为 6 位短链 ID
- 数据存储在 Cloudflare KV，TTL 为 7 天
- 订阅内容过长时自动使用短链兜底

#### 🌍 优选 IP 区域分类
- 新增 **优选 IP** (Preferred) 区域分类
- 自动识别 Cloudflare CDN、shopify、ubi 等优选域名
- 新增 **Global** (Anycast) 区域分类

#### 📎 分隔符选择器
- 导出 IP/域名列表时支持换行、逗号、竖线、空格四种分隔符

#### 📊 JSON 格式输出
- 新增 `format=json` 参数，返回结构化 JSON 数据

#### 🔧 其他增强
- 新增 `dedup` 参数控制去重开关
- 新增 `default_region` 参数指定默认区域
- 节点按区域排序展示

### 升级指南

1. **备份现有 Worker**（可选）：复制当前 `worker.js` 保存
2. **替换代码**：将新版 `worker.js` 完整覆盖到 Worker 编辑器
3. **绑定 KV**（可选）：如需短链功能，创建并绑定 KV 命名空间 `SUB_KV`
4. **上传模板**（可选）：如需自定义 Clash 配置，在 KV 中写入 `clash_template`
5. 点击 **Deploy** 发布

> ✅ **100% 向后兼容**：所有旧版功能和使用方式保持不变，无需修改现有配置。

---

## ❓ 常见问题 (FAQ)

### Q1: 为什么生成的链接在客户端无法使用？
**A:** 请检查：
1. 模板链接是否完整（包含 UUID、加密方式等）
2. IP 地址和端口是否正确
3. 是否选择了正确的传输协议（WS/gRPC/TCP）
4. Path、Host、SNI 等参数是否匹配

### Q2: 如何判断节点是否可用？
**A:** 使用内置的 **🔄 测试连通性** 功能：
- 绿色 + 数字 = 可用 + 延迟时间（ms）
- 红色 = 不可用

### Q3: 支持哪些客户端？
**A:** 生成的订阅链接支持：
- ✅ v2rayN / v2rayNG (Windows/Android)
- ✅ Shadowrocket (iOS)
- ✅ Clash (🆕 直接使用 `/clash` 端点)
- ✅ Sing-box (需在线转换)

### Q4: 为什么 Shadowsocks 节点被过滤了？
**A:** 当前版本暂不支持 SS/SSR 协议，会自动跳过这些节点。

### Q5: 可以自定义节点命名规则吗？
**A:** 当前版本使用固定格式：`地区-端口-协议-加密`（例如 `🇭🇰 香港-443-WS-TLS`），暂不支持自定义。

### Q6: 订阅链接会过期吗？
**A:** Worker 生成的订阅链接是动态的，只要 Worker 在线就永久有效。但建议定期重新生成以获取最新的优选 IP。🆕 短链 ID 有效期为 7 天。

### Q7: 🆕 短链和直接生成有什么区别？
**A:** 
- 直接生成：参数全部在 URL 中，内容过长时可能超过浏览器/客户端限制
- 短链：通过 `/shorten` 接口将完整参数存到 KV，返回 6 位短 ID，使用 `/sub?id=xxx` 访问

---

## 🛠️ 技术架构

```
┌─────────────────┐
│  用户浏览器      │
│  (Web UI)        │
└────────┬────────┘
         │
         │ HTTPS
         │
┌────────▼──────────┐
│ Cloudflare        │
│ Worker            │
│ (JavaScript)      │
└──┬──┬──┬──┬──┬──┘
   │  │  │  │  │
   ├──▼ 解析模板 (VLESS/Trojan/VMess)
   ├──▼ 聚合节点 (HTTP/订阅链接)
   ├──▼ 智能去重 (IP:Port)
   ├──▼ 区域识别 (关键词匹配)
   ├──▼ 🆕 KV 存储 (短链 / Clash 模板)
   └──▼ 生成订阅 (Base64 / Clash YAML)
```

---

## 📜 开源协议

本项目采用 **MIT License** 开源协议。

---

## ⚠️ 免责声明

本项目仅供技术研究和学习使用，请勿用于非法用途。使用本工具所产生的任何后果由使用者自行承担，开发者不承担任何责任。

---

## 🙏 致谢

感谢以下项目和技术的支持：
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [v2ray](https://www.v2ray.com/)
- [eooce/sub-converter](https://github.com/eooce/sub-converter)
- 社区用户的 Bug 反馈与建议

---

## 📧 联系方式

如有问题或建议，欢迎通过以下方式联系：
- 📦 提交 [GitHub Issue](https://github.com/hackjsw/CF-Worker-Sub-Pro/issues)
- 💬 参与 [Discussion](https://github.com/hackjsw/CF-Worker-Sub-Pro/discussions)

---

**⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！**
