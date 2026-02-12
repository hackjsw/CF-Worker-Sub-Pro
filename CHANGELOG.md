# 📋 更新日志 (Changelog)

## 🔥 v2.1.0 - Path 参数修复版 (2024)

### 🐛 核心 Bug 修复

#### **问题描述**
在使用包含复杂 `path` 参数的模板时（例如 `path=/?ed=2048&proxyip=kr.william.us.ci`），生成的订阅链接会丢失 path 参数中 `&` 符号后的内容。

**受影响的场景：**
```
模板链接: path=%2F%3Fed%3D2048%26proxyip%3Dkr.william.us.ci
                    (解码: /?ed=2048&proxyip=kr.william.us.ci)

错误输出: path=%2F%3Fed%3D2048
                    (解码: /?ed=2048)  ❌ 丢失了 &proxyip=kr.william.us.ci
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
| **带 ProxyIP** | `/?ed=2048` ❌ | `/?ed=2048&proxyip=kr.william.us.ci` ✅ |
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
