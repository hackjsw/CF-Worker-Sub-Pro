## 🆕 最新更新 (v2.1.0)

### 🐛 关键 Bug 修复：Path 参数完整性问题

**问题：** 当使用包含多个参数的 `path` 时（如 `/?ed=2048&proxyip=kr.william.us.ci`），生成的订阅链接会丢失 `&` 后的内容。

**影响场景：**
- ❌ EdgeTunnel 的 ProxyIP 功能无法使用
- ❌ 自定义 CDN 路由参数丢失
- ❌ 动态 Path 中的 token、key 等参数缺失

**修复效果：**
```diff
模板: path=/?ed=2048&proxyip=kr.william.us.ci

- 修复前: path=/?ed=2048  ❌
+ 修复后: path=/?ed=2048&proxyip=kr.william.us.ci  ✅
```

**技术改进：**
- 使用精确的 VLESS/Trojan 参数白名单进行正则匹配
- 避免将 Path 值内部的 `&` 误认为参数分隔符
- 支持任意复杂度的 Path 查询字符串

**升级方式：**
1. 直接替换 `worker.js` 文件内容
2. 点击 Deploy 保存
3. 无需修改配置，立即生效 ✅

---

**📌 向后兼容：** 100% 兼容旧版本，所有现有配置无需修改。

**🔥 推荐升级：** 特别是使用复杂 Path 配置或 EdgeTunnel 的用户。
