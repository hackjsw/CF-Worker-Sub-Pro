
// --- 配置区 ---
const AUTH_PASSWORD = "123456"; // 默认访问密码
const DEFAULT_CF_POOL_URL = "https://raw.githubusercontent.com/cmliu/CFcdnVmess2sub/main/ipv4.txt";
const DEFAULT_CF_POOL_FALLBACK = "1.1.1.1:443\n1.0.0.1:443\n104.16.0.0:443\n104.17.0.0:443";
// --------------

// 区域关键词配置 (Key 为显示名称)
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

function encodeBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

function decodeBase64(str) {
    const normalized = str.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const raw = atob(padded);
    try {
        return decodeURIComponent(escape(raw));
    } catch {
        return raw;
    }
}

function parseSSUri(ssLink) {
    const raw = ssLink.replace(/^ss:\/\//i, '');
    const [withoutHash] = raw.split('#');
    const [core] = withoutHash.split('?');

    let decoded = '';
    if (core.includes('@')) {
        decoded = core;
    } else {
        decoded = decodeBase64(core);
    }

    const [authPart = '', hostPart = ''] = decoded.split('@');
    const splitAt = authPart.indexOf(':');
    const method = splitAt >= 0 ? authPart.slice(0, splitAt) : '';
    const password = splitAt >= 0 ? authPart.slice(splitAt + 1) : '';

    return { method, password, hostPart };
}

export default {
    async fetchDefaultPoolText() {
        try {
            const resp = await fetch(DEFAULT_CF_POOL_URL, {
                headers: {
                    'User-Agent': 'CF-Worker-Sub-Pro/1.0',
                    'Accept': 'text/plain'
                },
                cf: { cacheTtl: 600, cacheEverything: true }
            });
            if (!resp.ok) return DEFAULT_CF_POOL_FALLBACK;
            const text = (await resp.text()).trim();
            return text || DEFAULT_CF_POOL_FALLBACK;
        } catch {
            return DEFAULT_CF_POOL_FALLBACK;
        }
    },

    async fetch(request, env) {
        const url = new URL(request.url);
        const params = url.searchParams;

        // 路由分发


        if (url.pathname === '/sub' || params.has('template')) return this.handleSub(params);
        if (url.pathname === '/test') return this.handleTest(request);
        if (url.pathname === '/scan') return this.handleScan(request);
        if (url.pathname === '/clash' || url.pathname === '/clash.yaml') return this.handleClash(params);
        if (url.pathname === '/singbox' || url.pathname === '/singbox.json') return this.handleSingbox(params);



        // --- 鉴权逻辑 ---
        const cookie = request.headers.get("Cookie") || "";
        if (params.get('pw') === AUTH_PASSWORD) {
            return new Response(null, {
                status: 302,
                headers: {
                    "Location": "/",
                    "Set-Cookie": `auth=${AUTH_PASSWORD}; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax`
                }
            });
        }
        if (!cookie.includes(`auth=${AUTH_PASSWORD}`)) {
            return new Response(this.getLoginHTML(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
        }
        // --------------

        return new Response(this.getHTML(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    },

    async handleSub(params) {
        const template = decodeURIComponent(params.get('template') || '');
        let source = decodeURIComponent(params.get('source') || '');
        const rawMode = params.get('raw') === 'true';
        const jsonMode = params.get('format') === 'json';
        const filterRegions = params.get('regions');
        const defaultRegion = params.get('default_region');

        if (!source) {
            source = await this.fetchDefaultPoolText();
        }

        if (!template.includes('://')) {
            const msg = "配置错误: 请检查模板和来源";
            if (jsonMode) return new Response(JSON.stringify({ error: msg }), { headers: { "Content-Type": "application/json" } });
            return new Response(rawMode ? msg : encodeBase64(msg), { status: 400 });
        }
        codex/add-ss-support-and-beautify-ui-e1oo24
        if (!source) {
            source = await this.fetchDefaultPoolText();
        }

        if (!template.includes('://')) {
            const msg = "配置错误: 请检查模板和来源";
            if (jsonMode) return new Response(JSON.stringify({ error: msg }), { headers: { "Content-Type": "application/json" } });
            return new Response(rawMode ? msg : encodeBase64(msg), { status: 400 });
        }
        
        main

        try {
            let nodes = await this.processData(template, source, defaultRegion);

            if (filterRegions) {
                const targetRegions = filterRegions.split(',').filter(r => r.trim());
                if (targetRegions.length > 0) {
                    nodes = nodes.filter(node => targetRegions.includes(node.region));
                }
            }

            // 去重
            const uniqueNodes = [];
            const seen = new Set();
            nodes.forEach(node => {
                const key = `${node.protocol}:${node.ip}:${node.port}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueNodes.push(node);
                }
            });
            nodes = uniqueNodes;

            if (jsonMode) {
                return new Response(JSON.stringify(nodes), {
                    headers: { "Content-Type": "application/json;charset=UTF-8" }
                });
            }

            if (rawMode) {
                const allIps = nodes.map(n => `${n.ip}:${n.port}#${n.name}`).join('\n');
                return new Response(allIps, { headers: { "Content-Type": "text/plain;charset=UTF-8" } });
            } else {
                const subText = nodes.map(n => n.link).join('\n');
                return new Response(encodeBase64(subText), { headers: { "Content-Type": "text/plain;charset=UTF-8" } });
            }

        } catch (err) {
            const errMsg = `Processing Error: ${err.message}`;
            return new Response(rawMode ? errMsg : encodeBase64(`error://internal?#${encodeURIComponent(errMsg)}`), {
                status: 500,
                headers: { "Content-Type": "text/plain;charset=UTF-8" }
            });
        }
    },

    async processData(template, source, defaultRegion) {
        let urlObj;
        let originalProtocol = "vless";
        let ssAuthPart = "";

        try {
            // 提取协议头
            const protocolMatch = template.match(/^([a-z0-9\+\-\.]+):\/\//i);
            if (protocolMatch) {
                originalProtocol = protocolMatch[1].toLowerCase();
            }
            if (originalProtocol === 'ss') {
                const { method, password, hostPart } = parseSSUri(template);
                ssAuthPart = `${method}:${password}`;
                if (!ssAuthPart || !ssAuthPart.includes(':')) {
                    throw new Error('SS 模板缺少 method:password 信息');
                }
                const rawTemplate = template.replace(/^ss:\/\//i, '');
                const [withoutHash] = rawTemplate.split('#');
                const query = withoutHash.includes('?') ? `?${withoutHash.split('?')[1]}` : '';
                urlObj = new URL(`http://${hostPart || '127.0.0.1:443'}${query}`);
            } else {
                // 临时替换协议头以便 URL 解析
                const httpUrl = template.replace(/^[a-z0-9\+\-\.]+:\/\//i, 'http://');
                urlObj = new URL(httpUrl);
            }
        } catch (e) {
            throw new Error("模板格式无效");
        }

        // 支持逗号和换行分隔，但保留备注中的空格（不按空格分割）
        const rawLines = source.split(/[\n\r,]+/).filter(l => l.trim().length > 0);
        const extractedList = await this.extractIpPortsAndNames(rawLines);

        const results = [];

        extractedList.forEach((item) => {
            let { host, port, name } = item;
            host = host.replace(/^\[|\]$/g, '');
            const finalPort = port || urlObj.port || "443";

            // 1. 解码备注
            let decodedName = name;
            try { decodedName = decodeURIComponent(name); } catch (e) { }

            // 2. 识别区域
            let region = this.identifyRegion(decodedName);
            if (region === 'Others' && defaultRegion && defaultRegion.trim() !== '') {
                region = defaultRegion.trim();
            }

            // 3. 构建新链接
            const newLink = new URL(urlObj.toString());
            newLink.hostname = host;
            newLink.port = finalPort;

            // 修复 search 参数
            // URL 对象在设置 hostname 后，searchParams 可能会丢失或需要重新处理，但在 worker 环境通常保留
            // 显式保留原有参数

            // --- 核心修改：生成详细命名 (地区-端口-协议-TLS) ---
            const type = newLink.searchParams.get("type") || newLink.searchParams.get("network") || "tcp";
            const security = newLink.searchParams.get("security") || newLink.searchParams.get("encryption") || "none";
            const isTLS = (security === 'tls' || security === 'xtls' || security === 'reality' || security === 'auto');
            const tlsTag = isTLS ? "-TLS" : "";

            // 拼接名称: 香港-443-WS-TLS (移除emoji，简化格式)
            // 提取纯文本地区名（去掉emoji）
            const cleanRegion = region.replace(/[\u{1F1E0}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\s]/gu, '').trim();
            const standardizedName = `${cleanRegion}-${finalPort}-${type.toUpperCase()}${tlsTag}`;

            let finalLinkStr;
            if (originalProtocol === 'ss') {
                const encodedCore = encodeBase64(`${ssAuthPart}@${host}:${finalPort}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
                const query = newLink.search ? newLink.search : '';
                finalLinkStr = `ss://${encodedCore}${query}#${encodeURIComponent(standardizedName)}`;
            } else {
                newLink.hash = encodeURIComponent(standardizedName);
                finalLinkStr = newLink.toString().replace(/^http:\/\//, `${originalProtocol}://`);
            }

            results.push({
                ip: host,
                port: finalPort,
                name: standardizedName,
                region: region,
                link: finalLinkStr,
                protocol: originalProtocol
            });
        });

        return results;
    },

    identifyRegion(name) {
        if (!name) return "Others";
        const upperName = name.toUpperCase();
        for (const [key, keywords] of Object.entries(REGION_CONFIG)) {
            if (keywords.some(k => upperName.includes(k.toUpperCase()))) {
                return key;
            }
        }
        return "Others";
    },

    async handleClash(params) {
        const template = decodeURIComponent(params.get('template') || '');
        const source = decodeURIComponent(params.get('source') || '');

        if (!source || !template.includes('://')) {
            return new Response("配置错误", { status: 400 });
        }

        try {
            const nodes = await this.processData(template, source, null);
            const clashConfig = this.convertToClash(nodes);

            return new Response(clashConfig, {
                headers: {
                    "Content-Type": "application/octet-stream",
                    "Content-Disposition": "attachment; filename=\"clash.yaml\""
                }
            });
        } catch (err) {
            return new Response(`Error: ${err.message}`, { status: 500 });
        }
    },

    async handleSingbox(params) {
        const template = decodeURIComponent(params.get('template') || '');
        const source = decodeURIComponent(params.get('source') || '');

        if (!source || !template.includes('://')) {
            return new Response("配置错误", { status: 400 });
        }

        try {
            const nodes = await this.processData(template, source, null);
            const singboxConfig = this.convertToSingbox(nodes);

            return new Response(JSON.stringify(singboxConfig, null, 2), {
                headers: {
                    "Content-Type": "application/octet-stream",
                    "Content-Disposition": "attachment; filename=\"singbox.json\""
                }
            });
        } catch (err) {
            return new Response(`Error: ${err.message}`, { status: 500 });
        }
    },

    async handleTest(request) {
        if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
        }

        try {
            const { nodes } = await request.json();
            const results = await Promise.all(
                nodes.map(async (node) => { // 测试所有节点
                    try {
                        const start = Date.now();
                        const testUrl = `http://${node.ip}:${node.port}`;

                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 3000);

                        await fetch(testUrl, {
                            method: 'HEAD',
                            signal: controller.signal
                        });

                        clearTimeout(timeoutId);
                        const latency = Date.now() - start;

                        return { ip: node.ip, port: node.port, name: node.name, status: 'ok', latency };
                    } catch (e) {
                        return { ip: node.ip, port: node.port, name: node.name, status: 'fail', latency: -1 };
                    }
                })
            );

            // 分离成功和失败的节点
            const successNodes = results.filter(r => r.status === 'ok').sort((a, b) => a.latency - b.latency);
            const failedNodes = results.filter(r => r.status === 'fail');

            // 只返回前10个最快的 + 所有失败的
            const filteredResults = [
                ...successNodes.slice(0, 10),
                ...failedNodes
            ];

            return new Response(JSON.stringify(filteredResults), {
                headers: { "Content-Type": "application/json" }
            });
        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }
    },

    async measureIpLatency(ip, port, timeoutMs = 3000) {
        const start = Date.now();
        const testUrl = `http://${ip}:${port}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            await fetch(testUrl, {
                method: 'HEAD',
                signal: controller.signal
            });
            return { ok: true, latency: Date.now() - start };
        } catch {
            return { ok: false, latency: -1 };
        } finally {
            clearTimeout(timeoutId);
        }
    },

    async handleScan(request) {
        if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
        }

        try {
            const body = await request.json();
            let rawIps = String(body.ips || '');
            const maxLatency = Math.max(1, parseInt(body.maxLatency || 300, 10));
            const maxCount = Math.max(1, parseInt(body.maxCount || 10, 10));
            const defaultPort = Math.max(1, parseInt(body.port || 443, 10));
            const timeoutMs = Math.max(500, parseInt(body.timeout || 3000, 10));

            if (!rawIps.trim()) {
                rawIps = await this.fetchDefaultPoolText();
            }

            const candidates = this.parseNodeList(rawIps.split(/[\n\r,]+/).filter(Boolean))
                .map(item => ({
                    ip: item.host,
                    port: item.port || String(defaultPort)
                }));

            if (!candidates.length) {
                return new Response(JSON.stringify({ error: '未识别到有效 IP 列表' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const scanned = await Promise.all(candidates.map(async (target) => {
                const result = await this.measureIpLatency(target.ip, target.port, timeoutMs);
                return {
                    ...target,
                    status: result.ok ? 'ok' : 'fail',
                    latency: result.latency
                };
            }));

            const fastest = scanned
                .filter(item => item.status === 'ok' && item.latency <= maxLatency)
                .sort((a, b) => a.latency - b.latency)
                .slice(0, maxCount);

            return new Response(JSON.stringify({
                total: scanned.length,
                matched: fastest.length,
                maxLatency,
                maxCount,
                fastest,
                failed: scanned.filter(item => item.status === 'fail').length
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    },

    async measureIpLatency(ip, port, timeoutMs = 3000) {
        const start = Date.now();
        const testUrl = `http://${ip}:${port}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            await fetch(testUrl, {
                method: 'HEAD',
                signal: controller.signal
            });
            return { ok: true, latency: Date.now() - start };
        } catch {
            return { ok: false, latency: -1 };
        } finally {
            clearTimeout(timeoutId);
        }
    },

    async handleScan(request) {
        if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
        }

        try {
            const body = await request.json();
        codex/add-ss-support-and-beautify-ui-e1oo24
            let rawIps = String(body.ips || '');
        main
            const maxLatency = Math.max(1, parseInt(body.maxLatency || 300, 10));
            const maxCount = Math.max(1, parseInt(body.maxCount || 10, 10));
            const defaultPort = Math.max(1, parseInt(body.port || 443, 10));
            const timeoutMs = Math.max(500, parseInt(body.timeout || 3000, 10));

        codex/add-ss-support-and-beautify-ui-e1oo24
            if (!rawIps.trim()) {
                rawIps = await this.fetchDefaultPoolText();
            }

        main
            const candidates = this.parseNodeList(rawIps.split(/[\n\r,]+/).filter(Boolean))
                .map(item => ({
                    ip: item.host,
                    port: item.port || String(defaultPort)
                }));

            if (!candidates.length) {
                return new Response(JSON.stringify({ error: '未识别到有效 IP 列表' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const scanned = await Promise.all(candidates.map(async (target) => {
                const result = await this.measureIpLatency(target.ip, target.port, timeoutMs);
                return {
                    ...target,
                    status: result.ok ? 'ok' : 'fail',
                    latency: result.latency
                };
            }));

            const fastest = scanned
                .filter(item => item.status === 'ok' && item.latency <= maxLatency)
                .sort((a, b) => a.latency - b.latency)
                .slice(0, maxCount);

            return new Response(JSON.stringify({
                total: scanned.length,
                matched: fastest.length,
                maxLatency,
                maxCount,
                fastest,
                failed: scanned.filter(item => item.status === 'fail').length
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    },



    convertToClash(nodes) {
        let yaml = `# Clash 配置文件
# 生成时间: ${new Date().toISOString()}

port: 7890
socks-port: 7891
allow-lan: false
mode: Rule
log-level: info

proxies:
`;

        nodes.forEach(node => {
            const protocol = node.protocol.toLowerCase();
            const urlObj = (protocol === 'vless' || protocol === 'trojan')
                ? new URL(node.link.replace(new RegExp(`^${protocol}://`, 'i'), 'http://'))
                : null;

            if (protocol === 'vless' || protocol === 'trojan') {
                const security = urlObj.searchParams.get('security') || 'none';
                const type = urlObj.searchParams.get('type') || 'tcp';
                const sni = urlObj.searchParams.get('sni') || urlObj.hostname;

                yaml += `  - name: "${node.name}"\n`;
                yaml += `    type: ${protocol}\n`;
                yaml += `    server: ${node.ip}\n`;
                yaml += `    port: ${node.port}\n`;

                if (protocol === 'vless') {
                    yaml += `    uuid: ${urlObj.username}\n`;
                } else {
                    yaml += `    password: ${urlObj.username}\n`;
                }

                yaml += `    network: ${type}\n`;
                yaml += `    udp: true\n`;

                if (security === 'tls') {
                    yaml += `    tls: true\n`;
                    yaml += `    sni: ${sni}\n`;
                    yaml += `    skip-cert-verify: false\n`;
                }

                yaml += '\n';
            }

            if (protocol === 'ss') {
                const { method, password } = parseSSUri(node.link);

                yaml += `  - name: "${node.name}"\n`;
                yaml += `    type: ss\n`;
                yaml += `    server: ${node.ip}\n`;
                yaml += `    port: ${node.port}\n`;
                yaml += `    cipher: ${method || 'aes-256-gcm'}\n`;
                yaml += `    password: "${password}"\n`;
                yaml += `    udp: true\n\n`;
            }
        });

        yaml += `proxy-groups:
  - name: "🚀 节点选择"
    type: select
    proxies:
`;
        nodes.forEach(node => {
            yaml += `      - "${node.name}"\n`;
        });

        yaml += `
rules:
  - MATCH,🚀 节点选择
`;

        return yaml;
    },

    convertToSingbox(nodes) {
        const outbounds = nodes.map(node => {
            const protocol = node.protocol.toLowerCase();
            const urlObj = (protocol === 'vless' || protocol === 'trojan')
                ? new URL(node.link.replace(new RegExp(`^${protocol}://`, 'i'), 'http://'))
                : null;

            const base = {
                tag: node.name,
                type: protocol,
                server: node.ip,
                server_port: parseInt(node.port)
            };

            if (protocol === 'vless') {
                const security = urlObj.searchParams.get('security') || 'none';
                base.uuid = urlObj.username;
                base.flow = urlObj.searchParams.get('flow') || '';

                if (security === 'tls') {
                    base.tls = {
                        enabled: true,
                        server_name: urlObj.searchParams.get('sni') || urlObj.hostname,
                        insecure: false
                    };
                }

                base.transport = {
                    type: urlObj.searchParams.get('type') || 'tcp'
                };
            } else if (protocol === 'trojan') {
                base.password = urlObj.username;
                base.tls = {
                    enabled: true,
                    server_name: urlObj.searchParams.get('sni') || urlObj.hostname
                };
            } else if (protocol === 'ss') {
                const { method, password } = parseSSUri(node.link);
                base.method = method || 'aes-256-gcm';
                base.password = password;
            }

            return base;
        });

        return {
            log: { level: "info" },
            inbounds: [
                {
                    type: "mixed",
                    listen: "127.0.0.1",
                    listen_port: 7890
                }
            ],
            outbounds: [
                {
                    tag: "proxy",
                    type: "selector",
                    outbounds: nodes.map(n => n.name)
                },
                ...outbounds,
                {
                    tag: "direct",
                    type: "direct"
                }
            ],
            route: {
                rules: [
                    {
                        outbound: "proxy"
                    }
                ]
            }
        };
    },

    async extractIpPortsAndNames(lines) {
        let extracted = [];
        // 并发处理所有行
        const tasks = lines.map(async (line) => {
            const item = line.trim();
            if (!item) return [];

            // 处理订阅链接 (http/https)
            if (item.startsWith('http://') || item.startsWith('https://')) {
                try {
                    const resp = await fetch(item, {
                        headers: {
                            'User-Agent': 'v2rayN/6.0',
                            'Accept': 'text/plain, application/json'
                        },
                        cf: {
                            cacheTtl: 300, // 缓存 5 分钟
                            cacheEverything: true
                        }
                    });
                    if (!resp.ok) return [];
                    const text = await resp.text();

                    // 尝试 Base64 解码
                    let decoded = text;
                    if (!text.includes('://')) {
                        try {
                            decoded = decodeBase64(text);
                        } catch (e) {
                            // 解码失败可能本身就是明文 IP 列表
                            decoded = text;
                        }
                    }

                    const subLines = decoded.split(/[\n\r]+/).filter(l => l);
                    return this.parseNodeList(subLines);
                } catch (e) {
                    console.error(`Fetch error for ${item}: ${e.message}`);
                    return [];
                }
            }
            // 处理单行节点或 IP
            return this.parseNodeList([item]);
        });

        const nestedResults = await Promise.all(tasks);
        nestedResults.forEach(arr => extracted.push(...arr));
        return extracted;
    },

    parseNodeList(lines) {
        const list = [];
        lines.forEach(line => {
            let host = "", port = "", name = "";
            try {
                line = line.trim();
                if (!line) return;

                // 1. 尝试解析标准 URL (vless://, trojan://, ss://, etc)
                if (line.includes('://')) {
                    // 特殊处理 ss:// (Base64 部分)
                    if (line.startsWith('ss://')) {
                        // 简单处理 SS，通常 ss://base64#name
                        const parts = line.split('#');
                        name = parts[1] ? decodeURIComponent(parts[1]) : "";
                        // 解析 Base64
                        const base64Part = parts[0].replace('ss://', '');
                        try {
                            let ipPortStr = "";
                            if (base64Part.includes('@')) {
                                // 新格式 user:pass@ip:port
                                ipPortStr = base64Part.split('@')[1];
                            } else {
                                // 旧格式 base64(method:password@ip:port)
                                const decoded = decodeBase64(base64Part);
                                ipPortStr = decoded.split('@')[1] || decoded; // 容错
                            }
                            if (ipPortStr) {
                                const u = new URL('http://' + ipPortStr);
                                host = u.hostname;
                                port = u.port;
                            }
                        } catch (e) { }
                    } else {
                        // 通用 URL 解析
                        const tempUrl = line.startsWith('http') ? line : line.replace(/^[a-z0-9\+\-\.]+:\/\//i, 'http://');
                        const u = new URL(tempUrl);
                        host = u.hostname;
                        port = u.port;
                        if (u.hash) {
                            try { name = decodeURIComponent(u.hash.slice(1)); } catch (e) { name = u.hash.slice(1); }
                        }
                    }
                }
                // 2. 尝试解析 IP:Port#Name 或 IP:Port
                else {
                    const hashMatch = line.match(/^(.*?)(?:[#|](.*))?$/);
                    if (hashMatch) {
                        let base = hashMatch[1].trim();
                        if (hashMatch[2]) name = hashMatch[2].trim();

                        // 支持 [IPv6]:Port
                        let match = base.match(/^\[([^\]]+)\](?::(\d+))?$/);
                        if (match) {
                            host = match[1];
                            port = match[2] || "";
                        } else {
                            // IPv4:Port
                            const parts = base.split(':');
                            if (parts.length === 2) {
                                host = parts[0];
                                port = parts[1];
                            } else if (parts.length === 1) {
                                host = parts[0]; // 仅 IP
                            }
                        }
                    }
                }

                // 简单校验 Host
                if (host) {
                    host = host.split(/[?\/]/)[0].trim().replace(/^\[|\]$/g, '');
                    // 过滤非法字符，放宽长度以支持较长域名/IPv6
                    if (host.length < 2 || host.length > 255 || /[^a-zA-Z0-9.:\-]/.test(host)) return;

                    // 如果没有端口，默认不处理? 改为保留空端口，后续逻辑处理
                    if (host) list.push({ host, port, name });
                }
            } catch (e) { }
        });
        return list;
    },

    getLoginHTML() {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>身份验证</title>
    <style>
        :root { --primary: #007AFF; --bg: #f5f5f7; --card: #ffffff; --text: #1d1d1f; }
        body { background: var(--bg); color: var(--text); display: flex; align-items: center; justify-content: center; height: 100vh; font-family: -apple-system, sans-serif; margin: 0; }
        .card { background: var(--card); padding: 2rem; border-radius: 1.5rem; box-shadow: 0 10px 40px rgba(0,0,0,0.08); text-align: center; width: 90%; max-width: 320px; }
        h3 { margin-top: 0; font-weight: 600; margin-bottom: 1.5rem; }
        input { width: 100%; padding: 12px; margin-bottom: 1rem; border: 1px solid #e5e5ea; border-radius: 12px; box-sizing: border-box; background: #f5f5f7; font-size: 16px; outline: none; transition: all 0.2s; }
        input:focus { border-color: var(--primary); background: #fff; }
        button { width: 100%; padding: 12px; border: none; background: var(--primary); color: white; border-radius: 12px; font-weight: 600; font-size: 16px; cursor: pointer; transition: opacity 0.2s; }
        button:hover { opacity: 0.9; }
    </style>
</head>
<body>
    <div class="card">
        <h3>🔒 访问受限</h3>
        <input type="password" id="p" placeholder="请输入访问密码">
        <button onclick="location.href='?pw='+document.getElementById('p').value">验证进入</button>
    </div>
</body>
</html>`;
    },

    getHTML() {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CF-Worker-Sub-Pro</title>
    <style>
        :root {
            --glass-bg: rgba(255, 255, 255, 0.7);
            --glass-border: rgba(255, 255, 255, 0.3);
            --text-main: #1a1a2e;
            --text-second: #6b7280;
            --primary: #6366f1;
            --primary-hover: #4f46e5;
            --accent: #8b5cf6;
            --success: #10b981;
            --danger: #ef4444;
            --surface-soft: rgba(255, 255, 255, 0.35);
            --shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
            --input-bg: rgba(255, 255, 255, 0.5);
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --glass-bg: rgba(30, 30, 46, 0.7);
                --glass-border: rgba(255, 255, 255, 0.1);
                --text-main: #e5e7eb;
                --text-second: #9ca3af;
                --primary: #818cf8;
                --primary-hover: #6366f1;
                --accent: #a78bfa;
                --success: #34d399;
                --danger: #f87171;
                --surface-soft: rgba(255, 255, 255, 0.08);
                --shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                --input-bg: rgba(255, 255, 255, 0.05);
            }
        }
        
        * { 
            box-sizing: border-box; 
            outline: none; 
            -webkit-tap-highlight-color: transparent; 
        }
        
        body { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: var(--text-main); 
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif; 
            margin: 0; 
            padding: 20px; 
            min-height: 100vh;
            position: relative;
            overflow-x: hidden;
        }
        
        /* 动态背景 */
        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: 
                radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3), transparent 50%),
                radial-gradient(circle at 80% 80%, rgba(255, 107, 107, 0.3), transparent 50%),
                radial-gradient(circle at 40% 20%, rgba(72, 219, 251, 0.3), transparent 50%);
            animation: gradientShift 15s ease infinite;
            z-index: -1;
        }
        
        @keyframes gradientShift {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
        }
        
        @media (prefers-color-scheme: dark) {
            body {
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            }
        }
        
        .container { 
            width: 100%; 
            max-width: 900px; 
            margin: 0 auto; 
            position: relative;
            z-index: 1;
        }
        
        .header { 
            text-align: center; 
            margin-bottom: 40px; 
            animation: fadeInDown 0.6s ease;
        }
        
        .header h1 { 
            font-size: 42px; 
            font-weight: 800; 
            margin: 0 0 12px 0; 
            letter-spacing: -1px;
            background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        
        .header p { 
            color: rgba(255,255,255,0.9); 
            font-size: 16px; 
            margin: 0;
            font-weight: 500;
            letter-spacing: 0.5px;
        }

        .quick-tips {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            margin-bottom: 20px;
        }

        .tip {
            background: var(--surface-soft);
            border: 1px solid var(--glass-border);
            border-radius: 14px;
            padding: 10px 12px;
            font-size: 12px;
            color: var(--text-second);
            font-weight: 600;
        }
        
        @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .card { 
            background: var(--glass-bg);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border-radius: 24px; 
            padding: 32px; 
            box-shadow: var(--shadow);
            border: 1px solid var(--glass-border);
            margin-bottom: 24px; 
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            animation: fadeInUp 0.6s ease;
        }
        
        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 40px rgba(31, 38, 135, 0.2);
        }
        
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .form-group { margin-bottom: 24px; }
        
        .label { 
            display: block; 
            font-size: 13px; 
            font-weight: 700; 
            color: var(--text-main); 
            margin-bottom: 10px; 
            text-transform: uppercase; 
            letter-spacing: 1px;
        }
        
        input, textarea { 
            width: 100%; 
            background: var(--input-bg);
            backdrop-filter: blur(10px);
            border: 1.5px solid var(--glass-border); 
            color: var(--text-main); 
            border-radius: 16px; 
            padding: 14px 18px; 
            font-size: 15px; 
            font-family: inherit; 
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
            resize: vertical;
        }
        
        input:focus, textarea:focus { 
            background: rgba(255, 255, 255, 0.9);
            border-color: var(--primary); 
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1),
                        0 4px 12px rgba(99, 102, 241, 0.15); 
            transform: translateY(-1px);
        }
        
        @media (prefers-color-scheme: dark) {
            input:focus, textarea:focus {
                background: rgba(255, 255, 255, 0.1);
            }
        }
        
        .btn { 
            display: block; 
            width: 100%; 
            padding: 18px; 
            border-radius: 16px; 
            border: none; 
            background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
            color: white; 
            font-size: 16px; 
            font-weight: 700; 
            cursor: pointer; 
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
            letter-spacing: 0.5px;
        }
        
        .btn:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 8px 25px rgba(99, 102, 241, 0.5);
        }
        
        .btn:active { 
            transform: translateY(0); 
        }
        
        .btn:disabled { 
            opacity: 0.6; 
            cursor: not-allowed; 
            transform: none;
        }
        
        .result-area { 
            display: none; 
            margin-top: 30px; 
            animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1); 
        }
        
        @keyframes slideUp { 
            from { opacity: 0; transform: translateY(20px); } 
            to { opacity: 1; transform: translateY(0); } 
        }
        
        .region-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); 
            gap: 12px; 
            margin-top: 15px; 
        }
        
        .region-item { 
            background: var(--input-bg);
            backdrop-filter: blur(10px);
            padding: 12px 16px; 
            border-radius: 14px; 
            cursor: pointer; 
            border: 1.5px solid var(--glass-border); 
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
            font-size: 14px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            font-weight: 600;
        }
        
        .region-item:hover { 
            background: rgba(255, 255, 255, 0.9);
            border-color: var(--primary); 
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
        }
        
        .region-item.active { 
            background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
            color: white; 
            border-color: transparent;
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
        }
        
        .region-count { 
            font-size: 11px; 
            font-weight: 700; 
            background: rgba(0,0,0,0.15); 
            padding: 3px 8px; 
            border-radius: 8px;
        }
        
        .tools { 
            display: flex; 
            gap: 10px; 
            margin-bottom: 20px; 
            flex-wrap: wrap; 
        }
        
        .tool-btn { 
            flex: 1; 
            min-width: 140px;
            padding: 12px 16px; 
            font-size: 13px; 
            background: var(--input-bg);
            backdrop-filter: blur(10px);
            color: var(--text-main); 
            border: 1.5px solid var(--glass-border); 
            border-radius: 12px; 
            cursor: pointer; 
            font-weight: 600; 
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
        }
        
        .tool-btn:hover { 
            background: rgba(255, 255, 255, 0.9);
            border-color: var(--primary);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
        }
        
        @media (prefers-color-scheme: dark) {
            .region-item:hover, .tool-btn:hover { 
                background: rgba(255, 255, 255, 0.15);
            }
        }
        
        .toast {
            position: fixed; 
            bottom: 40px; 
            left: 50%; 
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.85); 
            color: white; 
            padding: 14px 28px; 
            border-radius: 50px;
            font-size: 14px; 
            font-weight: 600;
            backdrop-filter: blur(20px); 
            opacity: 0; 
            pointer-events: none; 
            transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 1000; 
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
        }
        
        /* 响应式优化 */
        @media (max-width: 768px) {
            .header h1 { font-size: 32px; }
            .card { padding: 24px; border-radius: 20px; }
            .region-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
            .tool-btn { min-width: 100%; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>CF-Worker-Sub-Pro</h1>
            <p>🚀 极速 · 纯净 · 智能订阅聚合</p>
        </div>
        
        <div class="card">
            <div class="form-group">
                <label class="label">节点模板 (支持 VLESS / Trojan / SS)</label>
                <input type="text" id="template" placeholder="vless://uuid@domain:443?security=tls&... 或 ss://base64..." autocomplete="off">
                <div style="margin-top:6px; font-size:12px; color:var(--text-second);">说明：这是目标协议模板，系统会把来源中的 IP:端口 批量替换到这个模板里生成订阅链接。</div>
            </div>
            <div class="form-group">
                <label class="label">节点来源 (订阅链接 / IP列表 / 单节点)</label>
                <textarea id="source" rows="5" placeholder="必须包含端口，例如:&#10;192.168.1.1:443&#10;https://sub.example.com/feed"></textarea>
                <div style="margin-top:6px; font-size:12px; color:var(--text-second);">说明：可填订阅链接、IP:端口 列表、或单条节点。不填时自动使用默认 CF 公开节点池。</div>
            </div>
            <div class="quick-tips">
                <div class="tip">✨ 自动识别区域并标准化命名</div>
                <div class="tip">🧩 SS 模板可批量替换目标 IP:Port</div>
                <div class="tip">🛡️ 一键导出 Clash / Sing-box 配置</div>
            </div>
            <button id="generateBtn" class="btn" onclick="generate()">开始生成订阅</button>
        </div>

        <div class="card">
            <label class="label">IP 扫描器（筛选最快 IP）</label>
            <div class="form-group">
                <textarea id="scanSource" rows="4" placeholder="输入待扫描 IP，可带端口。示例：&#10;1.1.1.1:443&#10;8.8.8.8:443"></textarea>
                <div style="margin-top:6px; font-size:12px; color:var(--text-second);">说明：逐行输入候选 IP（可带端口）。为空时自动使用默认 CF 公开节点池。</div>
            </div>
            <div class="tools" style="margin-bottom:12px;">
                <div style="flex:1; min-width:130px;">
                    <div style="font-size:12px; color:var(--text-second); margin-bottom:6px;">最大延迟阈值（ms）</div>
                    <input id="scanLatency" type="number" min="1" value="300" placeholder="例如：300">
                </div>
                <div style="flex:1; min-width:130px;">
                    <div style="font-size:12px; color:var(--text-second); margin-bottom:6px;">保留最快数量（个）</div>
                    <input id="scanCount" type="number" min="1" value="10" placeholder="例如：10">
                </div>
                <div style="flex:1; min-width:130px;">
                    <div style="font-size:12px; color:var(--text-second); margin-bottom:6px;">默认端口</div>
                    <input id="scanPort" type="number" min="1" value="443" placeholder="例如：443">
                </div>
            </div>
            <div style="margin:-6px 0 10px; font-size:12px; color:var(--text-second);">说明：最大延迟=保留阈值（越小通常越快）；保留数量=最终输出前 N 个最快 IP；默认端口用于未显式填写端口的 IP。</div>
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
                <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-second);">
                    <input id="scanAutoApply" type="checkbox" checked>
                    扫描后自动回填到“节点来源”并立即生成订阅
                </label>
            </div>
            <button id="scanBtn" class="btn" onclick="scanIps()">⚡ 扫描并筛选最快 IP</button>
            <div id="scanResult" style="margin-top:12px; font-size:13px; color:var(--text-second);"></div>
        </div>

        <div id="result" class="result-area">
            <div class="card">
                 <label class="label">格式转换 & 节点测试</label>
                 <div class="tools">
                     <button class="tool-btn" onclick="downloadClash()">📥 下载 Clash 配置</button>
                     <button class="tool-btn" onclick="downloadSingbox()">📥 下载 Sing-box 配置</button>
                     <button class="tool-btn" style="color:var(--accent)" onclick="testNodes()">🔍 测试节点可用性</button>
                 </div>
            </div>
            
            <div class="card">
                 <label class="label">按区域筛选 (点击选择)</label>
                 <div class="tools">
                     <button class="tool-btn" onclick="copyAll('sub')">复制完整订阅</button>
                     <button class="tool-btn" onclick="copyAll('ip')">复制所有 IP</button>
                     <button class="tool-btn" style="color:var(--success)" onclick="copySelected()">复制选中区域链接</button>
                 </div>
                 <div id="regionList" class="region-grid"></div>
            </div>
            
            <div id="testResults" class="card" style="display:none">
                 <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                     <label class="label" style="margin:0">节点测试结果</label>
                     <button id="removeFailedBtn" class="tool-btn" style="color:var(--primary); display:none" onclick="removeFailedNodes()">🗑️ 剔除不可达节点并重新生成</button>
                 </div>
                 <div id="testContent" style="font-size:13px; line-height:1.8;"></div>
            </div>
        </div>
    </div>
    
    <div id="toast" class="toast">已复制到剪贴板</div>

    <script>
        const DEFAULT_POOL_URL = '${DEFAULT_CF_POOL_URL}';
        let GLOBAL_DATA = { url: '', nodes: [], regions: {}, testResults: [], scanFastest: [] };

        async function generate() {
            const template = document.getElementById('template').value.trim();
            const source = document.getElementById('source').value.trim();
            const btn = document.getElementById('generateBtn');

            if (!template) return showToast('请先填写节点模板');
            if (!template.includes('://')) return showToast('模板格式不正确');

            btn.disabled = true;
            btn.innerText = '正在处理...';

            try {
                // 构建 API 请求
                const apiUrl = new URL(window.location.origin + '/sub');
                apiUrl.searchParams.set('template', template);
                apiUrl.searchParams.set('source', source || DEFAULT_POOL_URL);
                apiUrl.searchParams.set('format', 'json');

                const resp = await fetch(apiUrl);
                if (!resp.ok) throw new Error('请求失败');
                
                const data = await resp.json();
                if (data.error) throw new Error(data.error);

                // 保存数据供前端使用
                GLOBAL_DATA.nodes = data;
                GLOBAL_DATA.url = apiUrl.toString().replace('&format=json', '');
                
                processRegions(data);
                
                document.getElementById('result').style.display = 'block';
                // 滚动到底部
                setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);

            } catch (e) {
                showToast(e.message);
            } finally {
                btn.disabled = false;
                btn.innerText = '开始生成订阅';
            }
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
            
            // 排序: 优选->地区->Others
            const keys = Object.keys(map).sort((a, b) => {
                 if(a.includes('优选')) return -1;
                 if(b.includes('优选')) return 1;
                 if(a === 'Others') return 1;
                 if(b === 'Others') return -1;
                 return a.localeCompare(b);
            });

            keys.forEach(k => {
                const div = document.createElement('div');
                div.className = 'region-item';
                div.innerHTML = \`<span>\${k}</span><span class="region-count">\${map[k].length}</span>\`;
                div.onclick = () => div.classList.toggle('active');
                grid.appendChild(div);
            });
        }

        function copyAll(type) {
             if (type === 'sub') {
                 copyText(GLOBAL_DATA.url);
             } else {
                 const ips = GLOBAL_DATA.nodes.map(n => \`\${n.ip}:\${n.port}#\${n.name}\`).join('\\n');
                 copyText(ips);
             }
        }

        function copySelected() {
            const active = Array.from(document.querySelectorAll('.region-item.active span:first-child')).map(s => s.innerText);
            if (!active.length) return showToast('请先选择区域');
            
            // 本地生成选中区域的订阅链接 (避免再次请求后端，或者直接拼接参数)
            const newUrl = GLOBAL_DATA.url + '&regions=' + encodeURIComponent(active.join(','));
            copyText(newUrl);
        }

        function copyText(str) {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(str).then(() => showToast('已复制')).catch(() => fallbackCopy(str));
                return;
            }
            fallbackCopy(str);
        }

        function fallbackCopy(str) {
            const textarea = document.createElement('textarea');
            textarea.value = str;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            try {
                document.execCommand('copy');
                showToast('已复制');
            } catch (e) {
                showToast('复制失败，请手动复制');
            } finally {
                document.body.removeChild(textarea);
            }
        }

        function showToast(msg) {
            const t = document.getElementById('toast');
            t.innerText = msg;
            t.style.opacity = '1';
            setTimeout(() => t.style.opacity = '0', 2000);
        }

        async function downloadClash() {
            if (!GLOBAL_DATA.nodes.length) return showToast('请先生成节点数据');
            
            try {
                const template = document.getElementById('template').value.trim();
                const source = document.getElementById('source').value.trim();
                
                const url = new URL(window.location.origin + '/clash.yaml');
                url.searchParams.set('template', template);
                url.searchParams.set('source', source);
                
                const link = document.createElement('a');
                link.href = url.toString();
                link.download = 'clash.yaml';
                link.click();
                
                showToast('Clash 配置下载中...');
            } catch (e) {
                showToast('下载失败: ' + e.message);
            }
        }

        async function downloadSingbox() {
            if (!GLOBAL_DATA.nodes.length) return showToast('请先生成节点数据');
            
            try {
                const template = document.getElementById('template').value.trim();
                const source = document.getElementById('source').value.trim();
                
                const url = new URL(window.location.origin + '/singbox.json');
                url.searchParams.set('template', template);
                url.searchParams.set('source', source);
                
                const link = document.createElement('a');
                link.href = url.toString();
                link.download = 'singbox.json';
                link.click();
                
                showToast('Sing-box 配置下载中...');
            } catch (e) {
                showToast('下载失败: ' + e.message);
            }
        }

        async function testNodes() {
            if (!GLOBAL_DATA.nodes.length) return showToast('请先生成节点数据');
            
            const resultsDiv = document.getElementById('testResults');
            const contentDiv = document.getElementById('testContent');
            
            resultsDiv.style.display = 'block';
            contentDiv.innerHTML = '<div style="color:var(--text-second)">🔄 正在测试所有节点可用性...</div>';
            
            try {
                const resp = await fetch('/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nodes: GLOBAL_DATA.nodes })
                });
                
                if (!resp.ok) throw new Error('测试请求失败');
                
                const results = await resp.json();
                
                let html = '<div style="display:grid; gap:8px;">';
                results.forEach(r => {
                    const statusColor = r.status === 'ok' ? 'var(--success)' : '#ff3b30';
                    const statusText = r.status === 'ok' ? '✅ ' + r.latency + 'ms' : '❌ 不可达';
                    html += '<div style="display:flex; justify-content:space-between; padding:8px; background:var(--surface-soft); border-radius:8px;">';
                    html += '<span>' + r.ip + ':' + r.port + '</span>';
                    html += '<span style="color:' + statusColor + '; font-weight:600">' + statusText + '</span>';
                    html += '</div>';
                });
                html += '</div>';
                
                // 保存测试结果
                GLOBAL_DATA.testResults = results;
                
                const header = '<div style="color:var(--text-second); font-size:12px; margin-bottom:10px;">显示前10个最快节点 + 所有不可达节点</div>';
                contentDiv.innerHTML = header + html;
                
                // 如果有不可达节点，显示剔除按钮
                const failedCount = results.filter(r => r.status === 'fail').length;
                if (failedCount > 0) {
                    document.getElementById('removeFailedBtn').style.display = 'block';
                }
                
                showToast('测试完成');
            } catch (e) {
                contentDiv.innerHTML = '<div style="color:#ff3b30">测试失败: ' + e.message + '</div>';
            }
        }

        async function scanIps() {
            const source = document.getElementById('scanSource').value.trim();
            const finalSource = source || DEFAULT_POOL_URL;

            const maxLatency = parseInt(document.getElementById('scanLatency').value || '300', 10);
            const maxCount = parseInt(document.getElementById('scanCount').value || '10', 10);
            const port = parseInt(document.getElementById('scanPort').value || '443', 10);
            const resultBox = document.getElementById('scanResult');
            const btn = document.getElementById('scanBtn');

            btn.disabled = true;
            btn.innerText = '扫描中...';
            resultBox.innerHTML = '🔄 正在扫描，请稍候...';

            try {
                const resp = await fetch('/scan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ips: finalSource, maxLatency, maxCount, port })
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || '扫描失败');

                if (!data.fastest || !data.fastest.length) {
                    resultBox.innerHTML = '<div>未找到延迟 ≤ ' + data.maxLatency + 'ms 的可用 IP。</div>';
                    return;
                }

                const lines = data.fastest.map(item => item.ip + ':' + item.port + '  (' + item.latency + 'ms)');
                const plainIps = data.fastest.map(item => item.ip + ':' + item.port).join('\\n');
                const encodedPlainIps = encodeURIComponent(plainIps);
                GLOBAL_DATA.scanFastest = data.fastest;

                resultBox.innerHTML =
                    '<div style="margin-bottom:8px;color:var(--success);font-weight:600;">命中 ' + data.matched + ' 个（总扫描 ' + data.total + '，失败 ' + data.failed + '）</div>' +
                    '<div style="display:grid;gap:6px; margin-bottom:10px;">' +
                    lines.map(function (l) { return '<div style="background:var(--surface-soft);padding:8px;border-radius:8px;">' + l + '</div>'; }).join('') +
                    '</div>' +
                    '<div class="tools" style="margin:0;">' +
                    '<button class="tool-btn" onclick="copyText(decodeURIComponent(\\\'' + encodedPlainIps + '\\\'))">复制结果 IP 列表</button>' +
                    '<button class="tool-btn" onclick="applyScannedIpsToSource(false)">仅回填来源</button>' +
                    '<button class="tool-btn" onclick="applyScannedIpsToSource(true)">回填并生成订阅</button>' +
                    '</div>';

                if (document.getElementById('scanAutoApply').checked) {
                    await applyScannedIpsToSource(true);
                }

                showToast('扫描完成');
            } catch (e) {
                resultBox.innerHTML = '<div style="color:#ff3b30;">扫描失败: ' + e.message + '</div>';
            } finally {
                btn.disabled = false;
                btn.innerText = '⚡ 扫描并筛选最快 IP';
            }
        }

        async function applyScannedIpsToSource(andGenerate) {
            if (!GLOBAL_DATA.scanFastest || !GLOBAL_DATA.scanFastest.length) {
                showToast('暂无可回填的扫描结果');
                return;
            }
            const source = GLOBAL_DATA.scanFastest.map(item => item.ip + ':' + item.port).join('\\n');
            document.getElementById('source').value = source;
            showToast('已回填到节点来源');

            if (andGenerate) {
                await generate();
            }
        }

        async function scanIps() {
            const source = document.getElementById('scanSource').value.trim();
        codex/add-ss-support-and-beautify-ui-e1oo24
            const finalSource = source || DEFAULT_POOL_URL;
        main

            const maxLatency = parseInt(document.getElementById('scanLatency').value || '300', 10);
            const maxCount = parseInt(document.getElementById('scanCount').value || '10', 10);
            const port = parseInt(document.getElementById('scanPort').value || '443', 10);
            const resultBox = document.getElementById('scanResult');
            const btn = document.getElementById('scanBtn');

            btn.disabled = true;
            btn.innerText = '扫描中...';
            resultBox.innerHTML = '🔄 正在扫描，请稍候...';

            try {
                const resp = await fetch('/scan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
        codex/add-ss-support-and-beautify-ui-e1oo24
                    body: JSON.stringify({ ips: finalSource, maxLatency, maxCount, port })
        main
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || '扫描失败');

                if (!data.fastest || !data.fastest.length) {
                    resultBox.innerHTML = '<div>未找到延迟 ≤ ' + data.maxLatency + 'ms 的可用 IP。</div>';
                    return;
                }

                const lines = data.fastest.map(item => item.ip + ':' + item.port + '  (' + item.latency + 'ms)');
                const plainIps = data.fastest.map(item => item.ip + ':' + item.port).join('\\n');
                const encodedPlainIps = encodeURIComponent(plainIps);
                GLOBAL_DATA.scanFastest = data.fastest;

                resultBox.innerHTML =
                    '<div style="margin-bottom:8px;color:var(--success);font-weight:600;">命中 ' + data.matched + ' 个（总扫描 ' + data.total + '，失败 ' + data.failed + '）</div>' +
                    '<div style="display:grid;gap:6px; margin-bottom:10px;">' +
                    lines.map(function (l) { return '<div style="background:var(--surface-soft);padding:8px;border-radius:8px;">' + l + '</div>'; }).join('') +
                    '</div>' +
                    '<div class="tools" style="margin:0;">' +
                    '<button class="tool-btn" onclick="copyText(decodeURIComponent(\\\'' + encodedPlainIps + '\\\'))">复制结果 IP 列表</button>' +
                    '<button class="tool-btn" onclick="applyScannedIpsToSource(false)">仅回填来源</button>' +
                    '<button class="tool-btn" onclick="applyScannedIpsToSource(true)">回填并生成订阅</button>' +
                    '</div>';

                if (document.getElementById('scanAutoApply').checked) {
                    await applyScannedIpsToSource(true);
                }

                showToast('扫描完成');
            } catch (e) {
                resultBox.innerHTML = '<div style="color:#ff3b30;">扫描失败: ' + e.message + '</div>';
            } finally {
                btn.disabled = false;
                btn.innerText = '⚡ 扫描并筛选最快 IP';
            }
        }

        async function applyScannedIpsToSource(andGenerate) {
            if (!GLOBAL_DATA.scanFastest || !GLOBAL_DATA.scanFastest.length) {
                showToast('暂无可回填的扫描结果');
                return;
            }
            const source = GLOBAL_DATA.scanFastest.map(item => item.ip + ':' + item.port).join('\\n');
            document.getElementById('source').value = source;
            showToast('已回填到节点来源');

            if (andGenerate) {
                await generate();
            }
        }

        async function removeFailedNodes() {
            if (!GLOBAL_DATA.testResults.length) {
                return showToast('请先测试节点');
            }
            
            // 获取所有失败节点的唯一标识 (IP:Port:Name 三重匹配)
            const failedSet = new Set(
                GLOBAL_DATA.testResults
                    .filter(r => r.status === 'fail')
                    .map(r => r.ip + ':' + r.port + ':' + r.name)
            );
            
            // 过滤掉失败的节点（使用三重匹配确保准确）
            const validNodes = GLOBAL_DATA.nodes.filter(node => {
                const key = node.ip + ':' + node.port + ':' + node.name;
                return !failedSet.has(key);
            });
            
            if (validNodes.length === 0) {
                return showToast('没有可用节点');
            }
            
            // 更新全局数据
            GLOBAL_DATA.nodes = validNodes;
            
            // 重新生成订阅链接（使用可用节点的IP列表）
            const template = document.getElementById('template').value.trim();
            const validIpList = validNodes.map(n => n.ip + ':' + n.port + '#' + n.name).join(',');
            
            try {
                const apiUrl = new URL(window.location.origin + '/sub');
                apiUrl.searchParams.set('template', template);
                apiUrl.searchParams.set('source', validIpList);
                apiUrl.searchParams.set('format', 'json');
                
                const resp = await fetch(apiUrl);
                if (!resp.ok) throw new Error('请求失败');
                
                const data = await resp.json();
                if (data.error) throw new Error(data.error);
                
                // 更新数据
                GLOBAL_DATA.nodes = data;
                GLOBAL_DATA.url = apiUrl.toString().replace('&format=json', '');
                
                processRegions(data);
                
                // 隐藏剔除按钮
                document.getElementById('removeFailedBtn').style.display = 'none';
                
                // 清空测试结果
                document.getElementById('testResults').style.display = 'none';
                GLOBAL_DATA.testResults = [];
                
                showToast('已剔除 ' + failedSet.size + ' 个不可达节点，重新生成成功！');
                
            } catch (e) {
                showToast('重新生成失败: ' + e.message);
            }
        }


    </script>
</body>
</html>`;
    }
};

