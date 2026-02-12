// --- 配置区 ---
const AUTH_PASSWORD = "123456"; 
// --------------

const REGION_CONFIG = {
    "🇭🇰 香港": ["HK", "HongKong", "Hong Kong", "香港", "HKG", "🇭🇰"],
    "🇹🇼 台湾": ["TW", "Taiwan", "Taipei", "台湾", "CN_TW", "TWN", "🇹🇼"],
    "🇸🇬 新加坡": ["SG", "Singapore", "狮城", "新加坡", "SGP", "🇸🇬"],
    "🇯🇵 日本": ["JP", "Japan", "Tokyo", "Osaka", "日本", "JPN", "🇯🇵"],
    "🇺🇸 美国": ["US", "USA", "America", "United States", "LosAngeles", "SanJose", "美国", "🇺🇸"],
    "🇰🇷 韩国": ["KR", "Korea", "Seoul", "韩国", "🇰🇷"],
    "🇩🇪 德国": ["DE", "Germany", "Frankfurt", "德国", "🇩🇪"],
    "🇫🇷 法国": ["FR", "France", "Paris", "法国", "🇫🇷"],
    "🇬🇧 英国": ["UK", "Britain", "England", "London", "英国", "🇬🇧"],
    "🇨🇦 加拿大": ["CA", "Canada", "加拿大", "🇨🇦"],
    "🇷🇺 俄罗斯": ["RU", "Russia", "俄罗斯", "🇷🇺"],
    "🌏 Global": ["Anycast", "Global", "IP-", "🌏"],
    "🚀 优选": ["优选", "Cloudflare", "CF", "CDN", "🚀"]
};

// Cloudflare 非 TLS 端口 (强制 HTTP)
const CF_NON_TLS_PORTS = new Set(['80', '8080', '8880', '2052', '2082', '2086', '2095']);

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const params = url.searchParams;

        if (url.pathname === '/sub' || params.has('source')) return this.handleSub(request);
        if (url.pathname === '/test') return this.handleTest(request);

        const cookie = request.headers.get("Cookie") || "";
        if (params.get('pw') === AUTH_PASSWORD) {
            return new Response(null, {
                status: 302,
                headers: { "Location": "/", "Set-Cookie": `auth=${AUTH_PASSWORD}; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax` }
            });
        }
        if (!cookie.includes(`auth=${AUTH_PASSWORD}`)) {
            return new Response(this.getLoginHTML(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
        }

        return new Response(this.getHTML(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    },

    async getParams(request) {
        const url = new URL(request.url);
        if (request.method === 'POST') {
            try {
                const body = await request.json();
                return {
                    template: body.template || '',
                    source: body.source || '',
                    rawMode: body.raw === true,
                    jsonMode: body.format === 'json',
                    filterRegions: body.regions,
                    defaultRegion: body.default_region,
                    dedupMode: body.dedup !== false 
                };
            } catch (e) { return {}; }
        } else {
            return {
                template: decodeURIComponent(url.searchParams.get('template') || ''),
                source: decodeURIComponent(url.searchParams.get('source') || ''),
                rawMode: url.searchParams.get('raw') === 'true',
                jsonMode: url.searchParams.get('format') === 'json',
                filterRegions: url.searchParams.get('regions'),
                defaultRegion: url.searchParams.get('default_region'),
                dedupMode: url.searchParams.get('dedup') !== 'false'
            };
        }
    },

    // ⚡️ 核心修复：解决中文/Emoji导致 btoa 报错的问题
    utf8_to_b64(str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
            function(match, p1) {
                return String.fromCharCode('0x' + p1);
            }));
    },

    // 安全的 Base64 解码函数
    safeBase64Decode(str) {
        if (!str) return "";
        let safeStr = str.replace(/\s/g, '');
        safeStr = safeStr.replace(/-/g, '+').replace(/_/g, '/');
        while (safeStr.length % 4) safeStr += '=';
        try {
            return atob(safeStr);
        } catch (e) {
            return "";
        }
    },

    async handleSub(request) {
        const { template, source, rawMode, jsonMode, filterRegions, defaultRegion, dedupMode } = await this.getParams(request);

        if (!source) {
            const msg = "配置错误: 请检查来源 (Source)";
            if (jsonMode) return new Response(JSON.stringify({ error: msg }), { headers: { "Content-Type": "application/json" } });
            return new Response(rawMode ? msg : this.utf8_to_b64(msg), { status: 400 });
        }

        try {
            let nodes = await this.processData(template, source, defaultRegion);

            if (filterRegions) {
                const targetRegions = filterRegions.split(',').filter(r => r.trim());
                if (targetRegions.length > 0) {
                    nodes = nodes.filter(node => targetRegions.includes(node.region));
                }
            }

            // 去重
            if (dedupMode) {
                const uniqueNodes = [];
                const seen = new Set();
                nodes.forEach(node => {
                    const key = (node.ip && node.port) ? `${node.ip}:${node.port}` : node.link;
                    if (!seen.has(key)) {
                        seen.add(key);
                        uniqueNodes.push(node);
                    }
                });
                nodes = uniqueNodes;
            }

            if (jsonMode) {
                return new Response(JSON.stringify(nodes), { headers: { "Content-Type": "application/json;charset=UTF-8" } });
            }

            const linkList = nodes.map(n => n.link).join('\n');

            if (rawMode) {
                return new Response(linkList, { headers: { "Content-Type": "text/plain;charset=UTF-8" } });
            } else {
                // ⚡️ 修复点：使用 utf8_to_b64 替代 btoa，防止中文节点名报错
                return new Response(this.utf8_to_b64(linkList), { headers: { "Content-Type": "text/plain;charset=UTF-8" } });
            }

        } catch (err) {
            const errMsg = `Server Error: ${err.message}`;
            if (jsonMode) return new Response(JSON.stringify({ error: errMsg }), { status: 500, headers: { "Content-Type": "application/json" } });
            return new Response(rawMode ? errMsg : this.utf8_to_b64(`error://internal?#${encodeURIComponent(errMsg)}`), { status: 500 });
        }
    },

async processData(template, source, defaultRegion) {
        let urlObj = null;
        let originalProtocol = "vless";
        let useTemplate = false;
        let vmessTemplateConfig = null;
        
        // ⚡️⚡️ 策略调整：优先解析模板中的 path 值 (解码后的) ⚡️⚡️
        let templatePathValue = null; // 例如: "/?ed=2048&proxyip=..."

        // 1. 解析模板对象
        if (template && template.includes('://')) {
            useTemplate = true;
            try {
                // 尝试提取协议
                const protocolMatch = template.match(/^([a-z0-9\+\-\.]+):\/\//i);
                if (protocolMatch) originalProtocol = protocolMatch[1].toLowerCase();
                
                // 处理 VMess 模板
                if (originalProtocol === 'vmess') {
                    const b64 = template.replace(/^vmess:\/\//i, '');
                    const jsonStr = this.safeBase64Decode(b64);
                    if (jsonStr) {
                        try {
                            vmessTemplateConfig = JSON.parse(jsonStr);
                            urlObj = new URL(`http://${vmessTemplateConfig.add}:${vmessTemplateConfig.port}`);
                            // VMess 模板自带的 path
                            if (vmessTemplateConfig.path) templatePathValue = vmessTemplateConfig.path;
                        } catch(e) { useTemplate = false; }
                    } else { useTemplate = false; }
                } 
                // 处理 VLESS/Trojan 模板
                else {
                    // ⚡️ 关键修复：使用正则提取完整的 path 参数值（避免 URL 解析器截断）
                    // 匹配 VLESS 已知参数列表，path= 后面直到遇到这些参数之一
                    const pathMatch = template.match(/[?&]path=([^#]+?)(?=&(?:type|security|encryption|host|headerType|sni|fp|alpn|pbk|sid|spx|flow|insecure|allowInsecure|ech)=|#|$)/i);
                    if (pathMatch) {
                        try {
                            templatePathValue = decodeURIComponent(pathMatch[1]);
                        } catch(e) {
                            templatePathValue = pathMatch[1];
                        }
                    }
                    
                    // 继续用 URL 对象解析其他参数
                    const httpUrl = template.replace(/^[a-z0-9\+\-\.]+:\/\//i, 'http://');
                    urlObj = new URL(httpUrl);
                }
            } catch (e) {
                // 如果 URL 解析失败，尝试正则兜底提取
                const match = template.match(/[?&]path=([^#]+?)(?=&(?:type|security|encryption|host|headerType|sni|fp|alpn|pbk|sid|spx|flow|insecure|allowInsecure|ech)=|#|$)/i);
                if (match) {
                     try { templatePathValue = decodeURIComponent(match[1]); } catch(e) { templatePathValue = match[1]; }
                }
            }
        }

        const rawLines = source.split(/[\n\r,]+/).filter(l => l.trim().length > 0);
        const extractedList = await this.extractIpPortsAndNames(rawLines);
        const results = [];

        extractedList.forEach((item) => {
            const proto = (item.protocol || '').toLowerCase();
            if (proto === 'ss' || proto === 'ssr' || (item.originalLink && item.originalLink.toLowerCase().startsWith('ss://'))) {
                return; 
            }

            // 2. 提取源节点的 path 值
            let sourcePathValue = null;
            if (item.originalLink) {
                try {
                    // 使用正则提取完整的 path 参数值
                    const match = item.originalLink.match(/[?&]path=([^#]+?)(?=&(?:type|security|encryption|host|headerType|sni|fp|alpn|pbk|sid|spx|flow|insecure|allowInsecure|ech)=|#|$)/i);
                    if (match) {
                        try {
                            sourcePathValue = decodeURIComponent(match[1]);
                        } catch(e) {
                            sourcePathValue = match[1];
                        }
                    }
                } catch(e) {}
            }

            // ⚡️⚡️ 3. 确定最终 path (模板绝对优先) ⚡️⚡️
            // 如果模板里有 path，就用模板的；否则用源节点的
            let finalPathValue = templatePathValue !== null ? templatePathValue : sourcePathValue;

            let rawName = item.name;
            try { rawName = decodeURIComponent(rawName); if(rawName.includes('%')) rawName = decodeURIComponent(rawName); } catch (e) {}
            
            let region = this.identifyRegion(rawName);
            if (region === 'Others' && defaultRegion && defaultRegion.trim() !== '') region = defaultRegion.trim();
            const cleanRegion = region.replace(/[\u{1F1E0}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{2600}-\u{27BF}]/gu, '').trim();

            let finalLinkStr = "";
            let standardizedName = "";
            let host = item.host.replace(/^\[|\]$/g, '');
            let portStr = (item.port || "443").toString().trim();

            // --- 分支 A: 使用模板 ---
            if (useTemplate && urlObj) {
                const finalPort = portStr || (urlObj.port ? urlObj.port.toString() : "443");
                
                if (originalProtocol === 'vmess' && vmessTemplateConfig) {
                    // === VMess JSON ===
                    const newConfig = { ...vmessTemplateConfig }; 
                    newConfig.add = host;
                    newConfig.port = finalPort;
                    newConfig.ps = `${cleanRegion}-${finalPort}-${(newConfig.net || 'tcp').toUpperCase()}`;
                    if (CF_NON_TLS_PORTS.has(finalPort)) newConfig.tls = "";
                    
                    // VMess JSON 中的 path 直接使用字符串 (不需要 encodeURIComponent)
                    if (finalPathValue) newConfig.path = finalPathValue;

                    standardizedName = newConfig.ps;
                    finalLinkStr = "vmess://" + this.utf8_to_b64(JSON.stringify(newConfig));
                } 
                else {
                    // === VLESS / Trojan URL ===
                    const newLink = new URL(urlObj.toString());
                    newLink.hostname = host;
                    newLink.port = finalPort;

                    // ⚠️ 关键：先删除 URL 对象中的 path，防止自动编码干扰
                    newLink.searchParams.delete('path');

                    const type = newLink.searchParams.get("type") || newLink.searchParams.get("network") || "tcp";
                    
                    if (CF_NON_TLS_PORTS.has(finalPort)) {
                        newLink.searchParams.set('security', 'none');
                        ['encryption', 'sni', 'fp', 'alpn'].forEach(k => newLink.searchParams.delete(k));
                    }

                    const security = newLink.searchParams.get('security') || 'none';
                    const isTLS = (security === 'tls' || security === 'xtls' || security === 'reality' || security === 'auto');
                    const tlsTag = isTLS ? "-TLS" : "";
                    
                    standardizedName = `${cleanRegion}-${finalPort}-${type.toUpperCase()}${tlsTag}`;
                    newLink.hash = encodeURIComponent(standardizedName);
                    
                    // 生成基础链接字符串
                    let baseLink = newLink.toString().replace(/^http:\/\//, `${originalProtocol}://`);

                    // ⚡️⚡️ 4. 暴力拼接 Path (关键修复) ⚡️⚡️
                    if (finalPathValue) {
                        // VLESS URL 中的 path 必须编码 (例如 /?a=b 变成 %2F%3Fa%3Db)
                        // 否则客户端会把 & 误认为是 VLESS 参数分隔符
                        const encodedPath = encodeURIComponent(finalPathValue);
                        
                        const hashIndex = baseLink.indexOf('#');
                        const hashPart = hashIndex !== -1 ? baseLink.substring(hashIndex) : '';
                        const mainPart = hashIndex !== -1 ? baseLink.substring(0, hashIndex) : baseLink;
                        
                        const separator = mainPart.includes('?') ? '&' : '?';
                        finalLinkStr = `${mainPart}${separator}path=${encodedPath}${hashPart}`;
                    } else {
                        finalLinkStr = baseLink;
                    }
                }
            } 
            // --- 分支 B: 直连模式 (无模板) ---
            else {
                if (item.originalLink) {
                    if (item.protocol === 'vmess') {
                        try {
                            const b64 = item.originalLink.replace(/^vmess:\/\//i, '');
                            const jsonStr = this.safeBase64Decode(b64);
                            if(jsonStr) {
                                const json = JSON.parse(jsonStr);
                                const net = (json.net || 'tcp').toUpperCase();
                                const tls = json.tls ? '-TLS' : '';
                                standardizedName = `${cleanRegion}-${portStr}-${net}${tls}`;
                                json.ps = standardizedName;
                                if(finalPathValue) json.path = finalPathValue;
                                finalLinkStr = "vmess://" + this.utf8_to_b64(JSON.stringify(json));
                            } else { finalLinkStr = item.originalLink; standardizedName = item.name; }
                        } catch(e) { finalLinkStr = item.originalLink; standardizedName = item.name; }
                    } 
                    else if (item.originalLink.includes('://')) {
                        try {
                            const cleanLink = item.originalLink.replace(/\s/g, '');
                            const tempUrl = cleanLink.replace(/^[a-z0-9\+\-\.]+:\/\//i, 'http://');
                            const linkObj = new URL(tempUrl);
                            
                            linkObj.port = portStr; 
                            linkObj.hostname = host;
                            
                            // 同样清理 path
                            linkObj.searchParams.delete('path');

                            let type = "TCP";
                            const urlType = linkObj.searchParams.get("type") || linkObj.searchParams.get("network");
                            if (urlType) type = urlType.toUpperCase();
                            else if (item.protocol) type = this.detectProtocol(item.originalLink);

                            let security = linkObj.searchParams.get('security') || linkObj.searchParams.get('encryption') || "none";
                            let isTLS = false; 
                            if (CF_NON_TLS_PORTS.has(portStr)) {
                                security = 'none'; isTLS = false;
                                linkObj.searchParams.set('security', 'none');
                                ['encryption', 'sni', 'fp', 'alpn'].forEach(k => linkObj.searchParams.delete(k));
                            } else { isTLS = (security === 'tls' || security === 'xtls' || security === 'reality'); }

                            const tlsTag = isTLS ? "-TLS" : "";
                            standardizedName = `${cleanRegion}-${portStr}-${type}${tlsTag}`;
                            linkObj.hash = encodeURIComponent(standardizedName);
                            
                            const proto = item.protocol || 'vless';
                            let baseLink = linkObj.toString().replace(/^http:\/\//, `${proto}://`);

                            // 暴力拼接 Path
                            if (finalPathValue) {
                                const encodedPath = encodeURIComponent(finalPathValue);
                                const hashIndex = baseLink.indexOf('#');
                                const hashPart = hashIndex !== -1 ? baseLink.substring(hashIndex) : '';
                                const mainPart = hashIndex !== -1 ? baseLink.substring(0, hashIndex) : baseLink;
                                const separator = mainPart.includes('?') ? '&' : '?';
                                finalLinkStr = `${mainPart}${separator}path=${encodedPath}${hashPart}`;
                            } else {
                                finalLinkStr = baseLink;
                            }
                        } catch (e) { finalLinkStr = item.originalLink; }
                    } else { finalLinkStr = item.originalLink; }
                }
            }

            if (finalLinkStr) {
                results.push({
                    ip: host,
                    port: portStr,
                    name: standardizedName || item.name,
                    region: region,
                    link: finalLinkStr,
                    protocol: useTemplate ? originalProtocol : (item.protocol || 'unknown')
                });
            }
        });
        return results;
    },

    detectProtocol(link) {
        const lower = link.toLowerCase();
        if (lower.startsWith('vmess')) return 'VMESS';
        if (lower.includes('type=ws') || lower.includes('net=ws')) return 'WS';
        if (lower.includes('type=grpc') || lower.includes('net=grpc')) return 'GRPC';
        if (lower.includes('type=h2') || lower.includes('net=h2')) return 'H2';
        return 'TCP';
    },

    identifyRegion(name) {
        if (!name) return "Others";
        let decodedName = name;
        try { decodedName = decodeURIComponent(name); } catch(e){}
        const upperName = decodedName.toUpperCase();
        for (const [key, keywords] of Object.entries(REGION_CONFIG)) {
            if (keywords.some(k => upperName.includes(k.toUpperCase()))) return key;
        }
        return "Others";
    },

    async handleTest(request) {
        if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
        try {
            const { nodes } = await request.json();
            const results = await Promise.all(
                nodes.map(async (node) => {
                    try {
                        let target = node.ip;
                        if (!target || target.includes('google.com')) return { ...node, status: 'fail', latency: 0 };
                        const start = Date.now();
                        const testUrl = `http://${target}:${node.port}`;
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 1500);
                        await fetch(testUrl, { method: 'HEAD', signal: controller.signal });
                        clearTimeout(timeoutId);
                        return { ...node, status: 'ok', latency: Date.now() - start };
                    } catch (e) {
                        return { ...node, status: 'fail', latency: -1 };
                    }
                })
            );
            const sortedResults = results.sort((a, b) => {
                if (a.status === 'fail') return 1;
                if (b.status === 'fail') return -1;
                return a.latency - b.latency;
            });
            return new Response(JSON.stringify(sortedResults), { headers: { "Content-Type": "application/json" } });
        } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 500 }); }
    },

    async extractIpPortsAndNames(lines) {
        let extracted = [];
        const tasks = lines.map(async (line) => {
            const item = line.trim();
            if (!item) return [];
            if (item.startsWith('http://') || item.startsWith('https://')) {
                try {
                    const resp = await fetch(item, { headers: { 'User-Agent': 'v2rayN/6.0', 'Accept': 'text/plain' }, cf: { cacheTtl: 300, cacheEverything: true } });
                    if (!resp.ok) return [];
                    const text = await resp.text();
                    let decoded = this.safeBase64Decode(text);
                    if (!decoded) decoded = text; 
                    return this.parseNodeList(decoded.split(/[\n\r]+/).filter(l => l));
                } catch (e) { return []; }
            }
            return this.parseNodeList([item]);
        });
        const nestedResults = await Promise.all(tasks);
        nestedResults.forEach(arr => extracted.push(...arr));
        return extracted;
    },

    parseNodeList(lines) {
        const list = [];
        lines.forEach(line => {
            let host = "", port = "", name = "", protocol = "";
            let originalLink = line.trim();
            try {
                line = line.trim();
                if (!line) return;
                
                if (line.includes('://')) {
                    protocol = line.split('://')[0].toLowerCase();
                    
                    if (protocol === 'vmess') {
                         try {
                             const b64 = line.replace(/^vmess:\/\//i, '');
                             const jsonStr = this.safeBase64Decode(b64);
                             if (jsonStr) {
                                 const vConfig = JSON.parse(jsonStr);
                                 host = vConfig.add;
                                 port = vConfig.port;
                                 name = vConfig.ps;
                             }
                         } catch (e) { return; }
                    }
                    else if (protocol === 'ss') {
                        const parts = line.split('#');
                        if (parts[1]) name = decodeURIComponent(parts[1]);
                        const b64 = parts[0].replace(/ss:\/\//i, '');
                        if(b64.includes('@')) { const hp = b64.split('@')[1].split(':'); host = hp[0]; port = hp[1]; }
                    } 
                    else {
                        const tempUrl = line.replace(/^[a-z0-9\+\-\.]+:\/\//i, 'http://');
                        const u = new URL(tempUrl);
                        host = u.hostname; 
                        port = u.port || "443";
                        if (u.hash) try { name = decodeURIComponent(u.hash.slice(1)); } catch (e) { name = u.hash.slice(1); }
                    }
                } 
                else {
                    originalLink = null;
                    const hashMatch = line.match(/^(.*?)(?:[#|](.*))?$/);
                    if (hashMatch) {
                        let base = hashMatch[1].trim();
                        if (hashMatch[2]) name = hashMatch[2].trim();
                        let match = base.match(/^\[([^\]]+)\](?::(\d+))?$/);
                        if (match) { host = match[1]; port = match[2] || "443"; } 
                        else {
                            const parts = base.split(':');
                            if (parts.length === 2) { host = parts[0]; port = parts[1]; } 
                            else if (parts.length === 1) { host = parts[0]; port = "443"; }
                        }
                    }
                }
                
                if (host) {
                    if(port) port = port.toString().trim();
                    else port = "443";
                    list.push({ host, port, name, protocol, originalLink, link: originalLink });
                }
            } catch (e) { }
        });
        return list;
    },

    getLoginHTML() { return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><h2>Login Required</h2></body></html>`; },

    getHTML() {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CF-Worker-Sub-Pro</title>
    <style>
        :root { --glass-bg: rgba(255, 255, 255, 0.7); --primary: #6366f1; --accent: #8b5cf6; --success: #10b981; }
        body { font-family: -apple-system, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; min-height: 100vh; }
        .container { max-width: 900px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; color: white; }
        .card { background: var(--glass-bg); backdrop-filter: blur(20px); border-radius: 20px; padding: 25px; margin-bottom: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
        .label { font-weight: bold; margin-bottom: 8px; display: block; color: #1f2937; }
        input[type="text"], textarea { width: 100%; padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 12px; background: rgba(255,255,255,0.6); margin-bottom: 15px; box-sizing: border-box; }
        .btn { width: 100%; padding: 14px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: white; border: none; border-radius: 12px; font-weight: bold; cursor: pointer; }
        .btn:hover { opacity: 0.9; }
        .tools { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px; }
        .tool-btn { flex: 1; min-width: 120px; padding: 10px; background: rgba(255,255,255,0.6); border: 1px solid rgba(0,0,0,0.1); border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600; }
        .tool-btn:hover { background: white; }
        .region-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
        .region-item { background: rgba(255,255,255,0.5); padding: 10px; border-radius: 10px; cursor: pointer; display: flex; justify-content: space-between; font-size: 14px; }
        .region-item.active { background: var(--primary); color: white; }
        .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 12px 24px; border-radius: 30px; opacity: 0; pointer-events: none; transition: 0.3s; }
        .hint { font-size: 12px; color: #555; margin-bottom: 10px; }
        .status-bar { display:flex; gap:10px; margin-bottom:10px; font-size:14px; font-weight:bold; }
        .warning-box { background: #fff3cd; color: #856404; padding: 12px; border-radius: 8px; margin-bottom: 15px; font-size: 13px; border: 1px solid #ffeeba; line-height: 1.5; }
        
        .switch-container { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; padding: 5px 0; }
        .switch-label { font-weight: bold; color: #333; }
        .switch { position: relative; display: inline-block; width: 46px; height: 26px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: var(--success); }
        input:checked + .slider:before { transform: translateX(20px); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>CF-Worker-Sub-Pro</h1><p>全能订阅聚合 & 优选生成器</p></div>
        
        <div class="card">
            <div class="warning-box">
                ✅ <b>支持协议：</b> VLESS, Trojan, <b>VMess</b><br>
                ⚠️ <b>注意：</b> Shadowsocks (SS) 协议暂不支持，将被自动过滤。
            </div>

            <label class="label">1. 节点模板 (可选)</label>
            <div class="hint">🔸 支持 vmess:// 或 vless:// 模板 | 留空则保留源协议</div>
            <input type="text" id="template" placeholder="vmess://ey... 或 vless://..." autocomplete="off">
            
            <label class="label">2. 节点来源 (必填)</label>
            <textarea id="source" rows="5" placeholder="https://机场订阅... 或 vmess://... 或 IP:Port"></textarea>
            
            <div class="switch-container">
                <span class="switch-label">✨ 智能去重 (Deduplication)</span>
                <label class="switch">
                    <input type="checkbox" id="dedupSwitch" checked>
                    <span class="slider"></span>
                </label>
            </div>

            <button id="generateBtn" class="btn" onclick="generate()">生成 / 聚合订阅</button>
        </div>

        <div id="result" class="card" style="display:none">
            <label class="label">常用工具</label>
            <div class="tools">
                <button class="tool-btn" style="color:var(--accent)" onclick="onlineConvert()">🌐 在线转换 Clash</button>
                <button class="tool-btn" style="color:var(--accent)" onclick="testNodes()">🔍 测试连通性</button>
            </div>
            
            <label class="label">区域筛选 & 复制</label>
            <div class="tools">
                <button class="tool-btn" onclick="copyAll('sub')">复制订阅链接</button>
                <button class="tool-btn" onclick="copyAll('ip')">复制 IP 列表</button>
                <button class="tool-btn" style="color:var(--success)" onclick="copySelected()">复制选中区域</button>
            </div>
            <div id="regionList" class="region-grid"></div>
        </div>

        <div id="testResults" class="card" style="display:none">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <label class="label" style="margin:0">测试结果</label>
                <button id="removeFailedBtn" class="tool-btn" style="color:#ef4444; display:none" onclick="removeFailedNodes()">🗑️ 剔除失败节点</button>
            </div>
            <div class="status-bar" id="statusBar"></div>
            <div id="testContent" style="font-size:13px; line-height:1.6; max-height:400px; overflow-y:auto;"></div>
        </div>
    </div>
    
    <div id="toast" class="toast">已复制</div>

    <script>
        let GLOBAL_DATA = { url: '', nodes: [], regions: {}, testResults: [] };

        async function generate() {
            const template = document.getElementById('template').value.trim();
            const source = document.getElementById('source').value.trim();
            const dedup = document.getElementById('dedupSwitch').checked; 
            
            if (!source) return showToast('请填写节点来源');

            const btn = document.getElementById('generateBtn');
            btn.disabled = true; btn.innerText = '处理中...';

            try {
                const resp = await fetch('/sub', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        template: template,
                        source: source,
                        format: 'json',
                        dedup: dedup 
                    })
                });

                if (!resp.ok) {
                    const errText = await resp.text();
                    try {
                        const errJson = JSON.parse(errText);
                        throw new Error(errJson.error || '请求失败');
                    } catch(e) {
                         throw new Error(errText || '请求失败');
                    }
                }
                const data = await resp.json();
                if (data.error) throw new Error(data.error);

                GLOBAL_DATA.nodes = data;
                
                if(source.length < 2000) {
                      const apiUrl = new URL(window.location.origin + '/sub');
                      if(template) apiUrl.searchParams.set('template', template);
                      apiUrl.searchParams.set('source', source);
                      if (!dedup) apiUrl.searchParams.set('dedup', 'false'); 
                      GLOBAL_DATA.url = apiUrl.toString();
                } else {
                      GLOBAL_DATA.url = "TOO_LONG";
                }

                processRegions(data);
                document.getElementById('result').style.display = 'block';
                document.getElementById('testResults').style.display = 'none';
                window.scrollTo({ top: document.getElementById('result').offsetTop, behavior: 'smooth' });
            } catch (e) { showToast(e.message); } 
            finally { btn.disabled = false; btn.innerText = '生成 / 聚合订阅'; }
        }

        function processRegions(nodes) {
            const map = {};
            nodes.forEach(n => {
                if (!map[n.region]) map[n.region] = [];
                map[n.region].push(n);
            });
            GLOBAL_DATA.regions = map;
            
            const grid = document.getElementById('regionList');
            grid.innerHTML = '';
            Object.keys(map).sort().forEach(k => {
                const div = document.createElement('div');
                div.className = 'region-item';
                div.innerHTML = \`<span>\${k}</span><span>\${map[k].length}</span>\`;
                div.onclick = () => div.classList.toggle('active');
                grid.appendChild(div);
            });
        }

        async function testNodes() {
            if (!GLOBAL_DATA.nodes.length) return showToast('无节点数据');
            const contentDiv = document.getElementById('testContent');
            const statusBar = document.getElementById('statusBar');
            document.getElementById('testResults').style.display = 'block';
            contentDiv.innerHTML = '<div>🔄 正在测试所有节点...</div>';
            document.getElementById('removeFailedBtn').style.display = 'none';
            
            try {
                const resp = await fetch('/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nodes: GLOBAL_DATA.nodes })
                });
                const results = await resp.json();
                GLOBAL_DATA.testResults = results;
                
                let okCount = results.filter(r => r.status === 'ok').length;
                let failCount = results.filter(r => r.status === 'fail').length;
                
                statusBar.innerHTML = \`<span style="color:#333">Total: \${results.length}</span> <span style="color:#10b981">OK: \${okCount}</span> <span style="color:#ef4444">Fail: \${failCount}</span>\`;

                let html = '';
                results.forEach(r => {
                    const color = r.status === 'ok' ? '#10b981' : '#ef4444';
                    html += \`<div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:5px;">
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px;">\${r.name}</span>
                        <span style="color:\${color}">\${r.status==='ok'?r.latency+'ms':'不可用'}</span>
                    </div>\`;
                });
                contentDiv.innerHTML = html;
                
                if (failCount > 0) {
                    document.getElementById('removeFailedBtn').style.display = 'block';
                }
            } catch(e) { contentDiv.innerHTML = '测试出错: ' + e.message; }
        }

        async function removeFailedNodes() {
            const failedSet = new Set(GLOBAL_DATA.testResults.filter(r => r.status === 'fail').map(r => r.link || r.ip+':'+r.port));
            
            const validNodes = GLOBAL_DATA.nodes.filter(n => {
                const key = n.link || n.ip+':'+n.port;
                return !failedSet.has(key);
            });

            if (validNodes.length === 0) return showToast('所有节点均失效');

            const newSource = validNodes.map(n => n.link).join('\\n');
            document.getElementById('source').value = newSource;
            
            showToast(\`已剔除 \${failedSet.size} 个节点，重新生成中...\`);
            await generate();
        }

        function copyAll(type) {
            if (type === 'sub') {
                if (GLOBAL_DATA.url === 'TOO_LONG') return alert('节点来源内容过长，无法生成短链接，请使用"在线转换"');
                navigator.clipboard.writeText(GLOBAL_DATA.url).then(() => showToast('已复制订阅链接'));
            } else {
                const str = GLOBAL_DATA.nodes.map(n => \`\${n.ip}:\${n.port}#\${n.name || ''}\`).join(',');
                navigator.clipboard.writeText(str).then(() => showToast('已复制 IP 列表'));
            }
        }
        
        function copySelected() {
            const active = Array.from(document.querySelectorAll('.region-item.active span:first-child')).map(s => s.innerText);
            if (!active.length) return showToast('未选择区域');
            
            const selectedNodes = GLOBAL_DATA.nodes.filter(n => active.includes(n.region));
            const str = selectedNodes.map(n => n.link).join('\\n');
            const b64 = btoa(str);
            navigator.clipboard.writeText(b64).then(() => showToast('已复制 Base64 订阅内容'));
        }

        function onlineConvert() {
            if (GLOBAL_DATA.url === 'TOO_LONG') {
                return alert('⚠️ 警告：节点数据过多，导致 URL 超长。请尝试减少节点数量。');
            }
            if (!GLOBAL_DATA.url) return showToast('请先点击生成');

            const prefix = "https://sublink.eooce.com/clash?config=";
            const finalUrl = prefix + encodeURIComponent(GLOBAL_DATA.url);
            
            window.open(finalUrl, '_blank');
        }

        function showToast(msg) { const t = document.getElementById('toast'); t.innerText = msg; t.style.opacity = '1'; setTimeout(() => t.style.opacity = '0', 2000); }
    </script>
</body>
</html>`;
    }
};
