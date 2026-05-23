# 📋 更新日志 (Changelog)

## 🔥 v2.2.0 - 内置 Clash + KV 短链 + 优选 IP 分类 (2026-05-23)

### 🎉 新增功能

#### 🎯 内置 Clash YAML 生成
- 新增 /clash API 端点，直接在 Worker 内生成完整的 Clash 配置文件
- 包含 DNS 解析、规则匹配、代理组、Cloudflare CDN IP 规则等完整配置
- 不再依赖任何第三方在线转换服务，安全可靠
- 支持通过 KV clash_template key 自定义模板

#### 🔗 KV 短链分享
- 新增 /shorten API 端点，将订阅参数压缩为 6 位短链 ID
- 数据存储在 Cloudflare KV，TTL 为 7 天（604800 秒）
- 订阅内容过长时 Web UI 自动使用短链兜底，解决 URL 长度限制
- 需绑定 KV 命名空间 SUB_KV 才能使用

#### 🌍 优选 IP 区域分类
- 新增 **优选 IP** (Preferred) 区域：自动识别 Cloudflare CDN、shopify、ubi、sin.fan 等优选域名
- 新增 **Global** (Anycast) 区域：识别 Anycast 及 IP- 前缀节点
- 所有区域节点按顺序排列展示

#### 📎 分隔符选择器
- Web UI 新增分隔符下拉选择：换行 / 逗号 / 竖线 / 空格
- 导出 IP 列表和域名列表时均可使用

#### 📊 JSON 格式输出
- 新增 ormat=json 参数，返回结构化 JSON 数据便于编程调用

#### 🔧 其他增强
- 新增 dedup 参数：可通过 ?dedup=false 关闭去重
- 新增 default_region 参数：为无区域节点指定默认区域标签
- 新增 id 参数：配合 /shorten 短链使用
- Web UI 添加 Clash 链接复制按钮

### 🔄 升级指南

1. 备份现有 worker.js（可选）
2. 将新版 worker.js 完整覆盖到 Cloudflare Worker 编辑器
3. **（可选）** 创建 KV 命名空间 SUB_KV 并绑定到 Worker，启用短链功能
4. **（可选）** 在 KV 中写入 clash_template key 自定义 Clash 模板
5. 点击 Deploy 发布

### ✅ 兼容性

- ✅ **100% 向后兼容**：所有旧版功能和 API 参数保持不变
- ✅ 不绑定 KV 不影响其他功能，短链接口会返回错误提示

## 🔥 v2.1.0 - Path 参数修复版 (2026)

### 🐛 核心 Bug 修复

#### **问题描述**
在使用包含复杂 `path` 参数的模板时（例如 `path=/?ed=2048&proxyip=***.******.****`），生成的订阅链接会丢失 path 参数中 `&` 符号后的内容。

**受影响的场景：**
```
模板链接: path=%2F%3Fed%3D2048%26proxyip%3D***.******.****
                    (解码: /?ed=2048&proxyip=***.******.****)

错误输出: path=%2F%3Fed%3D2048
                    (解码: /?ed=2048)  ❌ 丢失了 &proxyip=***.******.****
```

这会导致使用 ProxyIP、EdgeTunnel 等高级功能的节点无法正常工作。

---

#### **修复方案**

##### **根本原因**
1. **URL 解析器截断问题**：`URLSearchParams.get('path')` 会将 path 值中的 `&` 误认为是 VLESS 参数分隔符
2. **正则匹配过早停止**：原正则 `(?=&[a-z]+=)` 会在任何 `&字母=` 处停止，无法区分：
   - ✅ VLESS 真实参数：`&type=ws`、`&security=tls`
   - ❌ Path 值内部内容：`&proxyip=...`、`&ed=2048`

##### **技术实现**
使用**精确的 VLESS/Trojan 参数白名单**进行正则匹配：

```javascript
// 修复前（错误）
const pathMatch = template.match(/[?&]path=([^#]+?)(?=&[a-z]+=|#|$)/i);

// 修复后（正确）
const pathMatch = template.match(
    /[?&]path=([^#]+?)(?=&(?:type|security|encryption|host|headerType|sni|fp|alpn|pbk|sid|spx|flow|insecure|allowInsecure|ech)=|#|$)/i
);
```

**支持的 VLESS/Trojan 参数列表：**
- 传输层：`type`, `host`, `headerType`
- 安全层：`security`, `encryption`, `sni`, `fp`, `alpn`, `insecure`, `allowInsecure`
- Reality：`pbk`, `sid`, `spx`, `flow`
- 其他：`ech`

---

### ✅ 修复效果对比

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| **简单 Path** | `/?ed=2048` | `/?ed=2048` ✅ |
| **带 ProxyIP** | `/?ed=2048` ❌ | `/?ed=2048&proxyip=***.******.****` ✅ |
| **多参数 Path** | `/api?token=abc` ❌ | `/api?token=abc&key=xyz&id=123` ✅ |
| **URL 编码** | 自动处理 ✅ | 自动处理 ✅ |

---

### 🎯 影响范围

**受益用户：**
- ✅ 使用 **EdgeTunnel** 的用户（需要 `proxyip` 参数）
- ✅ 使用 **自定义 CDN** 的用户（Path 中包含多个查询参数）
- ✅ 使用 **动态路由** 的用户（Path 中包含 token、key 等参数）
- ✅ 所有在 Path 中使用 `&` 符号的高级配置场景

**不受影响：**
- ✅ 简单的 `/` 或 `/ws` 等基础 Path
- ✅ VMess 协议（使用 JSON 配置，不受此 Bug 影响）
- ✅ 不使用模板功能的用户

---

### 📦 其他改进

#### 代码质量提升
- 增强了错误处理机制，避免异常情况下的崩溃
- 优化了正则表达式性能，减少不必要的回溯
- 统一了模板解析和源节点解析的逻辑

#### 向后兼容性
- ✅ **100% 向后兼容**：所有旧配置无需修改即可使用
- ✅ 不影响现有功能：去重、测速、区域分类等功能完全正常
- ✅ API 接口不变：所有 URL 参数和请求方式保持一致

---

### 🔧 升级指南

#### 快速升级步骤
1. 备份现有的 `worker.js` 文件（可选）
2. 将新版本代码完整覆盖到 Cloudflare Worker 编辑器
3. 点击 **Deploy** 保存并发布
4. 无需修改任何配置，立即生效 ✅

#### 验证修复效果
使用以下测试模板验证修复：

```
vless://your-uuid@cf-ip:443?encryption=none&security=tls&type=ws&host=example.com&path=%2F%3Fed%3D2048%26proxyip%3Dtest.com#Test
```

**预期结果：**
生成的订阅链接中应包含完整的 `path=%2F%3Fed%3D2048%26proxyip%3Dtest.com`

---

### 🛡️ 安全性说明

- ✅ 未引入新的外部依赖
- ✅ 未修改认证和鉴权逻辑
- ✅ 未改变数据处理流程
- ✅ 仅修复了参数提取的正则匹配逻辑

---

### 📝 技术细节

#### 修复涉及的文件位置

**主要修改：**
1. `processData()` 函数第 182 行：模板 Path 提取逻辑
2. `processData()` 函数第 197 行：兜底 Path 提取逻辑  
3. `processData()` 函数第 219 行：源节点 Path 提取逻辑

**修改行数：** 3 处关键正则表达式
**新增代码：** 0 行
**删除代码：** 0 行
**净改动：** 仅调整正则表达式参数白名单

---

### 💬 反馈与支持

如果在使用过程中遇到任何问题，请：
1. 检查模板链接格式是否正确
2. 确认 Path 参数是否使用了 URL 编码
3. 通过 Issue 反馈具体的错误场景

---

### 🙏 致谢

感谢社区用户的 Bug 反馈，帮助我们发现并修复了这个影响高级用户体验的关键问题。

---

## 📌 历史版本

### v2.0.0 - 初始稳定版
- 基础订阅生成功能
- 智能去重
- 区域分类
- 节点测速
- Clash/Sing-box 导出

---

**升级建议：** 🔥 **强烈推荐所有用户升级**，特别是使用复杂 Path 配置的用户。


## 🔥 v2.1.0 - Path 参数修复版 (2026)

### 🐛 核心 Bug 修复

#### **问题描述**
在使用包含复杂 `path` 参数的模板时（例如 `path=/?ed=2048&proxyip=***.******.****`），生成的订阅链接会丢失 path 参数中 `&` 符号后的内容。

**受影响的场景：**
```
模板链接: path=%2F%3Fed%3D2048%26proxyip%3D***.******.****
                    (解码: /?ed=2048&proxyip=***.******.****)

错误输出: path=%2F%3Fed%3D2048
                    (解码: /?ed=2048)  ❌ 丢失了 &proxyip=***.******.****
```

这会导致使用 ProxyIP、EdgeTunnel 等高级功能的节点无法正常工作。

---

#### **修复方案**

##### **根本原因**
1. **URL 解析器截断问题**：`URLSearchParams.get('path')` 会将 path 值中的 `&` 误认为是 VLESS 参数分隔符
2. **正则匹配过早停止**：原正则 `(?=&[a-z]+=)` 会在任何 `&字母=` 处停止，无法区分：
   - ✅ VLESS 真实参数：`&type=ws`、`&security=tls`
   - ❌ Path 值内部内容：`&proxyip=...`、`&ed=2048`

##### **技术实现**
使用**精确的 VLESS/Trojan 参数白名单**进行正则匹配：

```javascript
// 修复前（错误）
const pathMatch = template.match(/[?&]path=([^#]+?)(?=&[a-z]+=|#|$)/i);

// 修复后（正确）
const pathMatch = template.match(
    /[?&]path=([^#]+?)(?=&(?:type|security|encryption|host|headerType|sni|fp|alpn|pbk|sid|spx|flow|insecure|allowInsecure|ech)=|#|$)/i
);
```

**支持的 VLESS/Trojan 参数列表：**
- 传输层：`type`, `host`, `headerType`
- 安全层：`security`, `encryption`, `sni`, `fp`, `alpn`, `insecure`, `allowInsecure`
- Reality：`pbk`, `sid`, `spx`, `flow`
- 其他：`ech`

---

### ✅ 修复效果对比

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| **简单 Path** | `/?ed=2048` | `/?ed=2048` ✅ |
| **带 ProxyIP** | `/?ed=2048` ❌ | `/?ed=2048&proxyip=***.******.****` ✅ |
| **多参数 Path** | `/api?token=abc` ❌ | `/api?token=abc&key=xyz&id=123` ✅ |
| **URL 编码** | 自动处理 ✅ | 自动处理 ✅ |

---

### 🎯 影响范围

**受益用户：**
- ✅ 使用 **EdgeTunnel** 的用户（需要 `proxyip` 参数）
- ✅ 使用 **自定义 CDN** 的用户（Path 中包含多个查询参数）
- ✅ 使用 **动态路由** 的用户（Path 中包含 token、key 等参数）
- ✅ 所有在 Path 中使用 `&` 符号的高级配置场景

**不受影响：**
- ✅ 简单的 `/` 或 `/ws` 等基础 Path
- ✅ VMess 协议（使用 JSON 配置，不受此 Bug 影响）
- ✅ 不使用模板功能的用户

---

### 📦 其他改进

#### 代码质量提升
- 增强了错误处理机制，避免异常情况下的崩溃
- 优化了正则表达式性能，减少不必要的回溯
- 统一了模板解析和源节点解析的逻辑

#### 向后兼容性
- ✅ **100% 向后兼容**：所有旧配置无需修改即可使用
- ✅ 不影响现有功能：去重、测速、区域分类等功能完全正常
- ✅ API 接口不变：所有 URL 参数和请求方式保持一致

---

### 🔧 升级指南

#### 快速升级步骤
1. 备份现有的 `worker.js` 文件（可选）
2. 将新版本代码完整覆盖到 Cloudflare Worker 编辑器
3. 点击 **Deploy** 保存并发布
4. 无需修改任何配置，立即生效 ✅

#### 验证修复效果
使用以下测试模板验证修复：

```
vless://your-uuid@cf-ip:443?encryption=none&security=tls&type=ws&host=example.com&path=%2F%3Fed%3D2048%26proxyip%3Dtest.com#Test
```

**预期结果：**
生成的订阅链接中应包含完整的 `path=%2F%3Fed%3D2048%26proxyip%3Dtest.com`

---

### 🛡️ 安全性说明

- ✅ 未引入新的外部依赖
- ✅ 未修改认证和鉴权逻辑
- ✅ 未改变数据处理流程
- ✅ 仅修复了参数提取的正则匹配逻辑

---

### 📝 技术细节

#### 修复涉及的文件位置

**主要修改：**
1. `processData()` 函数第 182 行：模板 Path 提取逻辑
2. `processData()` 函数第 197 行：兜底 Path 提取逻辑  
3. `processData()` 函数第 219 行：源节点 Path 提取逻辑

**修改行数：** 3 处关键正则表达式
**新增代码：** 0 行
**删除代码：** 0 行
**净改动：** 仅调整正则表达式参数白名单

---

### 💬 反馈与支持

如果在使用过程中遇到任何问题，请：
1. 检查模板链接格式是否正确
2. 确认 Path 参数是否使用了 URL 编码
3. 通过 Issue 反馈具体的错误场景

---

### 🙏 致谢

感谢社区用户的 Bug 反馈，帮助我们发现并修复了这个影响高级用户体验的关键问题。

---

## 📌 历史版本

### v2.0.0 - 初始稳定版
- 基础订阅生成功能
- 智能去重
- 区域分类
- 节点测速
- Clash/Sing-box 导出

---

**升级建议：** 🔥 **强烈推荐所有用户升级**，特别是使用复杂 Path 配置的用户。
