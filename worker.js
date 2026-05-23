const AUTH_PASSWORD = "123456";
const KV_TTL = 604800;
const CLASH_TEMPLATE_KEY = "clash_template";

const REGION_CONFIG = {
  "HK Hong Kong": ["HK", "HongKong", "Hong Kong", "香港", "HKG"],
  "TW Taiwan": ["TW", "Taiwan", "Taipei", "台湾", "CN_TW", "TWN"],
  "SG Singapore": ["SG", "Singapore", "狮城", "新加坡", "SGP"],
  "JP Japan": ["JP", "Japan", "Tokyo", "Osaka", "日本", "JPN"],
  "US United States": ["US", "USA", "America", "United States", "LosAngeles", "SanJose", "美国"],
  "KR Korea": ["KR", "Korea", "Seoul", "韩国"],
  "DE Germany": ["DE", "Germany", "Frankfurt", "德国"],
  "FR France": ["FR", "France", "Paris", "法国"],
  "UK United Kingdom": ["UK", "Britain", "England", "London", "英国"],
  "CA Canada": ["CA", "Canada", "加拿大"],
  "RU Russia": ["RU", "Russia", "俄罗斯"],
  "Global": ["Anycast", "Global", "IP-"],
  "Preferred": ["优选", "Cloudflare", "CF", "CDN", "shopify", "ubi", "sin.fan"],
};

const CF_NON_TLS_PORTS = new Set(["80", "8080", "8880", "2052", "2082", "2086", "2095"]);
const TLS_PORTS = new Set(["443", "8443", "2053", "2083", "2087", "2096"]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const params = url.searchParams;

    if (url.pathname === "/clash") {
      return this.handleClash(request, env, ctx);
    }
    if (url.pathname === "/shorten" && request.method === "POST") {
      return this.handleShorten(request, env);
    }
    if (url.pathname === "/sub" || params.has("source") || params.has("id")) {
      return this.handleSub(request, env, ctx);
    }
    if (url.pathname === "/test") {
      return this.handleTest(request);
    }

    const cookie = request.headers.get("Cookie") || "";
    if (params.get("pw") === AUTH_PASSWORD) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/",
          "Set-Cookie": `auth=${AUTH_PASSWORD}; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax`,
        },
      });
    }
    if (!cookie.includes(`auth=${AUTH_PASSWORD}`)) {
      return new Response(this.getLoginHTML(), {
        headers: { "Content-Type": "text/html;charset=UTF-8" },
      });
    }

    return new Response(this.getHTML(), {
      headers: { "Content-Type": "text/html;charset=UTF-8" },
    });
  },

  async getParams(request) {
    const url = new URL(request.url);
    if (request.method === "POST") {
      try {
        const body = await request.json();
        return {
          id: body.id || "",
          template: body.template || "",
          source: body.source || "",
          rawMode: body.raw === true,
          jsonMode: body.format === "json",
          filterRegions: body.regions,
          defaultRegion: body.default_region,
          dedupMode: body.dedup !== false,
        };
      } catch {
        return {};
      }
    }

    return {
      id: url.searchParams.get("id") || "",
      template: decodeURIComponent(url.searchParams.get("template") || ""),
      source: decodeURIComponent(url.searchParams.get("source") || ""),
      rawMode: url.searchParams.get("raw") === "true",
      jsonMode: url.searchParams.get("format") === "json",
      filterRegions: url.searchParams.get("regions"),
      defaultRegion: url.searchParams.get("default_region"),
      dedupMode: url.searchParams.get("dedup") !== "false",
    };
  },

  utf8ToBase64(str) {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(`0x${p1}`)
      )
    );
  },

  safeBase64Decode(str) {
    if (!str) return "";
    let safeStr = str.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
    while (safeStr.length % 4) safeStr += "=";
    try {
      return atob(safeStr);
    } catch {
      return "";
    }
  },

  async handleShorten(request, env) {
    if (!env?.SUB_KV) {
      return new Response(JSON.stringify({ error: "KV未绑定" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();
      const bodyStr = JSON.stringify(body);
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(bodyStr)
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const id = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 6);

      await env.SUB_KV.put(id, bodyStr, { expirationTtl: KV_TTL });

      return new Response(
        JSON.stringify({
          shortUrl: `${new URL(request.url).origin}/sub?id=${id}`,
          id,
          ttl: KV_TTL,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  async resolveShortLinkParams(params, env, ctx) {
    let isShortLink = false;
    if (!params.id || !env?.SUB_KV) {
      return { params, isShortLink };
    }

    try {
      const kvDataStr = await env.SUB_KV.get(params.id);
      if (!kvDataStr) return { params, isShortLink };

      const kvData = JSON.parse(kvDataStr);
      params.source = kvData.source || params.source;
      params.template = kvData.template !== undefined ? kvData.template : params.template;
      params.dedupMode = kvData.dedup !== undefined ? kvData.dedup : params.dedupMode;
      isShortLink = true;

      const refresh = env.SUB_KV.put(params.id, kvDataStr, { expirationTtl: KV_TTL });
      if (ctx) ctx.waitUntil(refresh);
    } catch {}

    return { params, isShortLink };
  },

  dedupeNodes(nodes) {
    const uniqueNodes = [];
    const seen = new Set();
    for (const node of nodes) {
      const key = node.ip && node.port ? `${node.ip}:${node.port}` : node.link;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueNodes.push(node);
    }
    return uniqueNodes;
  },

  prependExpireHint(nodes) {
    if (!nodes.length) return nodes;

    const expireDate = new Date(Date.now() + KV_TTL * 1000 + 8 * 60 * 60 * 1000);
    const title = `Expiry ${expireDate.getUTCMonth() + 1}/${expireDate.getUTCDate()} ${String(
      expireDate.getUTCHours()
    ).padStart(2, "0")}:${String(expireDate.getUTCMinutes()).padStart(2, "0")}`;

    const first = nodes[0];
    let fakeLink = first.link;

    if (first.protocol === "vmess") {
      try {
        const b64 = fakeLink.replace(/^vmess:\/\//i, "");
        const jsonStr = this.safeBase64Decode(b64);
        if (jsonStr) {
          const json = JSON.parse(jsonStr);
          json.ps = title;
          json.add = "www.shopify.com";
          json.port = "443";
          fakeLink = `vmess://${this.utf8ToBase64(JSON.stringify(json))}`;
        }
      } catch {}
    } else {
      try {
        const url = new URL(fakeLink);
        url.hostname = "www.shopify.com";
        url.port = "443";
        url.hash = encodeURIComponent(title);
        fakeLink = url.toString();
      } catch {
        fakeLink = `${fakeLink.split("#")[0]}#${encodeURIComponent(title)}`;
      }
    }

    return [
      {
        ip: "www.shopify.com",
        port: "443",
        name: title,
        region: "Info",
        link: fakeLink,
        protocol: first.protocol,
      },
      ...nodes,
    ];
  },

  async handleSub(request, env, ctx) {
    let params = await this.getParams(request);
    const shortResolved = await this.resolveShortLinkParams(params, env, ctx);
    params = shortResolved.params;

    const { template, source, rawMode, jsonMode, filterRegions, defaultRegion, dedupMode } = params;
    if (!source) {
      const msg = "閰嶇疆閿欒: 璇锋鏌ユ潵婧?(Source) 鎴?鐭摼鎺?ID 澶辨晥";
      if (jsonMode) {
        return new Response(JSON.stringify({ error: msg }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(rawMode ? msg : this.utf8ToBase64(msg), { status: 400 });
    }

    try {
      let nodes = await this.processData(template, source, defaultRegion);
      if (filterRegions) {
        const regions = filterRegions.split(",").map((r) => r.trim()).filter(Boolean);
        if (regions.length) nodes = nodes.filter((node) => regions.includes(node.region));
      }
      if (dedupMode) nodes = this.dedupeNodes(nodes);
      if (shortResolved.isShortLink) nodes = this.prependExpireHint(nodes);

      if (jsonMode) {
        return new Response(JSON.stringify(nodes), {
          headers: { "Content-Type": "application/json;charset=UTF-8" },
        });
      }

      const linkList = nodes.map((n) => n.link).join("\n");
      return new Response(rawMode ? linkList : this.utf8ToBase64(linkList), {
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
      });
    } catch (err) {
      const errMsg = `Server Error: ${err.message}`;
      if (jsonMode) {
        return new Response(JSON.stringify({ error: errMsg }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        rawMode ? errMsg : this.utf8ToBase64(`error://internal?#${encodeURIComponent(errMsg)}`),
        { status: 500 }
      );
    }
  },

  async handleClash(request, env, ctx) {
    if (!env?.SUB_KV) {
      return new Response("KV鏈粦瀹氾紝鏃犳硶璇诲彇 clash_template", { status: 400 });
    }

    let params = await this.getParams(request);
    const shortResolved = await this.resolveShortLinkParams(params, env, ctx);
    params = shortResolved.params;

    const templateYaml = await env.SUB_KV.get(CLASH_TEMPLATE_KEY);
    if (!templateYaml) {
      return new Response(
        "KV 中缺少 clash_template。请先把 kv-template.yaml 上传到 SUB_KV，key 填 clash_template。",
        { status: 400 }
      );
    }

    const { template, source, filterRegions, defaultRegion, dedupMode } = params;
    if (!source) {
      return new Response("Error: missing source", { status: 400 });
    }

    try {
      let nodes = await this.processData(template, source, defaultRegion);
      if (filterRegions) {
        const regions = filterRegions.split(",").map((r) => r.trim()).filter(Boolean);
        if (regions.length) nodes = nodes.filter((node) => regions.includes(node.region));
      }
      if (dedupMode) nodes = this.dedupeNodes(nodes);

      const proxies = [];
      const proxyNames = [];
      const seenNames = new Set();

      for (const node of nodes) {
        const proxy = this.buildClashProxy(node, template);
        if (!proxy || seenNames.has(proxy.name)) continue;
        seenNames.add(proxy.name);
        proxies.push(proxy);
        proxyNames.push(proxy.name);
      }

      const proxyYaml = [
        "proxies:",
        ...proxies.map((proxy) => `  - ${JSON.stringify(proxy)}`),
        this.buildProxyGroups(proxyNames),
        templateYaml,
      ].join("\n");
      const randomName = `clash${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;

      return new Response(proxyYaml, {
        headers: {
          "Content-Type": "text/yaml;charset=UTF-8",
          "Content-Disposition": `attachment; filename=${randomName}`,
        },
      });
    } catch (err) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  },

  buildClashProxy(node, templateUrl) {
    const link = node.link;
    if (!link || !link.includes("://")) return null;

    const proto = (link.split("://")[0] || "").toLowerCase();
    const name = node.name || `${node.ip}:${node.port}`;
    const host = node.ip || "";
    const port = parseInt(node.port, 10) || 443;
    const transport = this.extractTemplateTransport(templateUrl);
    const proxy = { name, server: host, port };

    if (proto === "vmess") {
      const b64 = link.replace(/^vmess:\/\//i, "");
      const jsonStr = this.safeBase64Decode(b64);
      if (!jsonStr) return null;
      const cfg = JSON.parse(jsonStr);
      proxy.type = "vmess";
      proxy.uuid = cfg.id || "";
      proxy.alterId = cfg.aid || 0;
      proxy.cipher = cfg.scy || "auto";
      proxy.network = cfg.net || transport.network || "tcp";
      proxy.tls = cfg.tls === "tls" || cfg.tls === true;
      proxy.servername = cfg.sni || cfg.host || transport.servername || "";
      if (proxy.network === "ws") {
        proxy["ws-opts"] = { path: cfg.path || transport.wsPath || "/" };
        const wsHost = cfg.host || transport.wsHost;
        if (wsHost) proxy["ws-opts"].headers = { Host: wsHost };
      }
      if (proxy.network === "grpc") {
        proxy["grpc-opts"] = {
          "grpc-service-name": cfg.path || transport.grpcServiceName || "",
        };
      }
      return proxy;
    }

    if (proto === "vless") {
      const url = new URL(link.replace(/^vless:\/\//i, "http://"));
      proxy.type = "vless";
      proxy.uuid = url.username || "";
      proxy.network = url.searchParams.get("type") || transport.network || "tcp";
      const security = url.searchParams.get("security") || "none";
      proxy.tls = security === "tls" || security === "reality";
      proxy["skip-cert-verify"] = url.searchParams.get("allowInsecure") === "1";
      proxy.servername = url.searchParams.get("sni") || transport.servername || "";
      proxy.flow = url.searchParams.get("flow") || "";
      proxy["client-fingerprint"] = url.searchParams.get("fp") || "chrome";
      if (security === "reality") {
        proxy["reality-opts"] = { "public-key": url.searchParams.get("pbk") || "" };
        const shortId = url.searchParams.get("sid");
        if (shortId) proxy["reality-opts"]["short-id"] = shortId;
      }
      if (proxy.network === "ws") {
        proxy["ws-opts"] = { path: url.searchParams.get("path") || transport.wsPath || "/" };
        const wsHost = url.searchParams.get("host") || transport.wsHost;
        if (wsHost) proxy["ws-opts"].headers = { Host: wsHost };
      }
      if (proxy.network === "grpc") {
        proxy["grpc-opts"] = {
          "grpc-service-name": url.searchParams.get("path") || transport.grpcServiceName || "",
        };
      }
      return proxy;
    }

    if (proto === "trojan") {
      const url = new URL(link.replace(/^trojan:\/\//i, "http://"));
      proxy.type = "trojan";
      proxy.password = url.username || "";
      proxy.network = url.searchParams.get("type") || transport.network || "tcp";
      proxy.tls = true;
      proxy["skip-cert-verify"] = url.searchParams.get("allowInsecure") === "1";
      proxy.servername = url.searchParams.get("sni") || transport.servername || "";
      proxy["client-fingerprint"] = url.searchParams.get("fp") || "chrome";
      if (proxy.network === "ws") {
        proxy["ws-opts"] = { path: url.searchParams.get("path") || transport.wsPath || "/" };
        const wsHost = url.searchParams.get("host") || transport.wsHost;
        if (wsHost) proxy["ws-opts"].headers = { Host: wsHost };
      }
      if (proxy.network === "grpc") {
        proxy["grpc-opts"] = {
          "grpc-service-name": url.searchParams.get("path") || transport.grpcServiceName || "",
        };
      }
      return proxy;
    }

    return null;
  },

  extractTemplateTransport(templateUrl) {
    const result = {};
    if (!templateUrl) return result;

    try {
      const proto = (templateUrl.split("://")[0] || "").toLowerCase();
      if (proto === "vmess") {
        const b64 = templateUrl.replace(/^vmess:\/\//i, "");
        const jsonStr = this.safeBase64Decode(b64);
        if (!jsonStr) return result;
        const cfg = JSON.parse(jsonStr);
        result.network = cfg.net || "tcp";
        result.servername = cfg.sni || cfg.host || "";
        result.wsPath = cfg.path || "/";
        result.wsHost = cfg.host || "";
        result.grpcServiceName = cfg.path || "";
        return result;
      }

      const url = new URL(templateUrl.replace(/^[a-z0-9+\-.]+:\/\//i, "http://"));
      result.network = url.searchParams.get("type") || "tcp";
      result.servername = url.searchParams.get("sni") || url.hostname || "";
      result.wsPath = url.searchParams.get("path") || "/";
      result.wsHost = url.searchParams.get("host") || "";
      result.grpcServiceName = url.searchParams.get("path") || "";
    } catch {}

    return result;
  },

  buildProxyGroups(proxyNames) {
    const dynamic = proxyNames.map((name) => `      - ${JSON.stringify(name)}`).join("\n");
    return [
      "proxy-groups:",
      '  - name: "🚀 节点选择"',
      "    type: select",
      "    proxies:",
      '      - "♻️ 自动选择"',
      '      - "🔯 故障转移"',
      '      - "🔮 负载均衡"',
      '      - "🎯 全球直连"',
      "      - DIRECT",
      dynamic,
      '  - name: "♻️ 自动选择"',
      "    type: url-test",
      "    url: http://www.gstatic.com/generate_204",
      "    interval: 300",
      "    tolerance: 50",
      "    proxies:",
      dynamic,
      '  - name: "🔯 故障转移"',
      "    type: fallback",
      "    url: http://www.gstatic.com/generate_204",
      "    interval: 180",
      "    proxies:",
      dynamic,
      '  - name: "🔮 负载均衡"',
      "    type: load-balance",
      "    strategy: consistent-hashing",
      "    url: http://www.gstatic.com/generate_204",
      "    interval: 180",
      "    proxies:",
      dynamic,
      '  - name: "🎯 全球直连"',
      "    type: select",
      "    proxies:",
      "      - DIRECT",
      '  - name: "☁️ CloudFlareCDN"',
      "    type: select",
      "    proxies:",
      '      - "🚀 节点选择"',
      '      - "♻️ 自动选择"',
      '      - "🔯 故障转移"',
      '      - "🔮 负载均衡"',
      "      - DIRECT",
      dynamic,
      '  - name: "🐟 漏网之鱼"',
      "    type: select",
      "    proxies:",
      '      - "🚀 节点选择"',
      '      - "🎯 全球直连"',
      '      - "♻️ 自动选择"',
      '      - "🔯 故障转移"',
      '      - "🔮 负载均衡"',
      "      - DIRECT",
      dynamic,
      '  - name: "🛑 全球拦截"',
      "    type: select",
      "    proxies:",
      "      - REJECT",
      "      - DIRECT",
    ].join("\n");
  },

  async processData(template, source, defaultRegion) {
    let urlObj = null;
    let originalProtocol = "vless";
    let useTemplate = false;
    let vmessTemplateConfig = null;
    let templatePathValue = null;

    if (template && template.includes("://")) {
      useTemplate = true;
      try {
        const protocolMatch = template.match(/^([a-z0-9+\-.]+):\/\//i);
        if (protocolMatch) originalProtocol = protocolMatch[1].toLowerCase();

        if (originalProtocol === "vmess") {
          const b64 = template.replace(/^vmess:\/\//i, "");
          const jsonStr = this.safeBase64Decode(b64);
          if (jsonStr) {
            vmessTemplateConfig = JSON.parse(jsonStr);
            urlObj = new URL(`http://${vmessTemplateConfig.add}:${vmessTemplateConfig.port}`);
            if (vmessTemplateConfig.path) templatePathValue = vmessTemplateConfig.path;
          } else {
            useTemplate = false;
          }
        } else {
          const pathMatch = template.match(
            /[?&]path=([^#]+?)(?=&(?:type|security|encryption|host|headerType|sni|fp|alpn|pbk|sid|spx|flow|insecure|allowInsecure|ech)=|#|$)/i
          );
          if (pathMatch) {
            try {
              templatePathValue = decodeURIComponent(pathMatch[1]);
            } catch {
              templatePathValue = pathMatch[1];
            }
          }
          urlObj = new URL(template.replace(/^[a-z0-9+\-.]+:\/\//i, "http://"));
        }
      } catch {
        useTemplate = false;
      }
    }

    const rawLines = source.split(/[\n\r,]+/).filter((line) => line.trim());
    const extractedList = await this.extractIpPortsAndNames(rawLines);
    const results = [];

    for (const item of extractedList) {
      const proto = (item.protocol || "").toLowerCase();
      if (
        proto === "ss" ||
        proto === "ssr" ||
        (item.originalLink && item.originalLink.toLowerCase().startsWith("ss://"))
      ) {
        continue;
      }

      let sourcePathValue = null;
      if (item.originalLink) {
        const match = item.originalLink.match(
          /[?&]path=([^#]+?)(?=&(?:type|security|encryption|host|headerType|sni|fp|alpn|pbk|sid|spx|flow|insecure|allowInsecure|ech)=|#|$)/i
        );
        if (match) {
          try {
            sourcePathValue = decodeURIComponent(match[1]);
          } catch {
            sourcePathValue = match[1];
          }
        }
      }

      const finalPathValue = templatePathValue !== null ? templatePathValue : sourcePathValue;
      let rawName = item.name || "";
      try {
        rawName = decodeURIComponent(rawName);
      } catch {}

      const host = item.host.replace(/^\[|\]$/g, "");
      if (host.toLowerCase().endsWith(".workers.dev") || host.toLowerCase() === "workers.dev") {
        continue;
      }

      const portStr = (item.port || "443").toString().trim();
      let region = this.identifyRegion(rawName, host);
      if (
        (region === "Others" || region === "Unknown" || region === "Global CDN") &&
        defaultRegion &&
        defaultRegion.trim()
      ) {
        region = defaultRegion.trim();
      }
      const cleanRegion = region.replace(/[^\w\s-]/g, "").trim() || "Node";

      let finalLinkStr = "";
      let standardizedName = "";

      if (useTemplate && urlObj) {
        const finalPort = portStr || urlObj.port || "443";
        if (originalProtocol === "vmess" && vmessTemplateConfig) {
          const newConfig = { ...vmessTemplateConfig };
          newConfig.add = host;
          newConfig.port = finalPort;
          newConfig.ps = `${cleanRegion}-${finalPort}-${(newConfig.net || "tcp").toUpperCase()}`;
          if (CF_NON_TLS_PORTS.has(finalPort)) newConfig.tls = "";
          if (finalPathValue) newConfig.path = finalPathValue;
          standardizedName = newConfig.ps;
          finalLinkStr = `vmess://${this.utf8ToBase64(JSON.stringify(newConfig))}`;
        } else {
          const newLink = new URL(urlObj.toString());
          newLink.hostname = host;
          newLink.port = finalPort;
          newLink.searchParams.delete("path");

          const type = newLink.searchParams.get("type") || newLink.searchParams.get("network") || "tcp";
          if (CF_NON_TLS_PORTS.has(finalPort)) {
            newLink.searchParams.set("security", "none");
            ["encryption", "sni", "fp", "alpn"].forEach((key) => newLink.searchParams.delete(key));
          }

          const security = newLink.searchParams.get("security") || "none";
          const isTls = ["tls", "xtls", "reality", "auto"].includes(security);
          standardizedName = `${cleanRegion}-${finalPort}-${type.toUpperCase()}${isTls ? "-TLS" : ""}`;
          newLink.hash = encodeURIComponent(standardizedName);

          let baseLink = newLink.toString().replace(/^http:\/\//, `${originalProtocol}://`);
          if (finalPathValue) {
            const encodedPath = encodeURIComponent(finalPathValue);
            const hashIndex = baseLink.indexOf("#");
            const hashPart = hashIndex !== -1 ? baseLink.slice(hashIndex) : "";
            const mainPart = hashIndex !== -1 ? baseLink.slice(0, hashIndex) : baseLink;
            const separator = mainPart.includes("?") ? "&" : "?";
            finalLinkStr = `${mainPart}${separator}path=${encodedPath}${hashPart}`;
          } else {
            finalLinkStr = baseLink;
          }
        }
      } else if (item.originalLink) {
        finalLinkStr = item.originalLink;
        standardizedName = item.name || `${cleanRegion}-${portStr}`;
      }

      if (finalLinkStr) {
        results.push({
          ip: host,
          port: portStr,
          name: standardizedName || item.name,
          region,
          link: finalLinkStr,
          protocol: useTemplate ? originalProtocol : item.protocol || "unknown",
        });
      }
    }

    return results;
  },

  detectProtocol(link) {
    const lower = link.toLowerCase();
    if (lower.startsWith("vmess")) return "VMESS";
    if (lower.includes("type=ws") || lower.includes("net=ws")) return "WS";
    if (lower.includes("type=grpc") || lower.includes("net=grpc")) return "GRPC";
    if (lower.includes("type=h2") || lower.includes("net=h2")) return "H2";
    return "TCP";
  },

  identifyRegion(name, host = "") {
    let decodedName = name || "";
    try {
      decodedName = decodeURIComponent(name);
    } catch {}

    const upperName = decodedName.toUpperCase();
    let foundRegion = "Others";

    if (upperName && upperName !== "OTHERS") {
      for (const [key, keywords] of Object.entries(REGION_CONFIG)) {
        if (keywords.some((keyword) => upperName.includes(keyword.toUpperCase()))) {
          foundRegion = key;
          break;
        }
      }
    }

    if (foundRegion === "Others" && host) {
      const upperHost = host.toUpperCase();
      const tldMap = {
        ".HK": "HK Hong Kong",
        ".TW": "TW Taiwan",
        ".SG": "SG Singapore",
        ".JP": "JP Japan",
        ".US": "US United States",
        ".KR": "KR Korea",
        ".DE": "DE Germany",
        ".FR": "FR France",
        ".UK": "UK United Kingdom",
        ".CA": "CA Canada",
        ".RU": "RU Russia",
      };

      for (const [tld, region] of Object.entries(tldMap)) {
        if (upperHost.endsWith(tld)) {
          foundRegion = region;
          break;
        }
      }
    }

    if (foundRegion === "Others") {
      const isIp =
        /^(\d{1,3}\.){3}\d{1,3}$/.test(host) ||
        /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/.test(host);
      foundRegion = host && !isIp ? "Global CDN" : "Unknown";
    }

    return foundRegion;
  },

  async handleTest(request) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const { nodes } = await request.json();
      const results = await Promise.all(
        nodes.map(async (node) => {
          try {
            const target = node.ip;
            if (!target || target.includes("google.com")) {
              return { ...node, status: "fail", latency: 0 };
            }

            const scheme = TLS_PORTS.has(node.port.toString()) ? "https" : "http";
            const start = Date.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);

            await fetch(`${scheme}://${target}:${node.port}/`, {
              method: "GET",
              headers: {
                "User-Agent": "CF-Worker-Sub-Pro/1.0",
                Accept: "text/html,*/*",
              },
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            return { ...node, status: "ok", latency: Date.now() - start };
          } catch {
            return { ...node, status: "fail", latency: -1 };
          }
        })
      );

      results.sort((a, b) => {
        if (a.status === "fail") return 1;
        if (b.status === "fail") return -1;
        return a.latency - b.latency;
      });

      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  },

  async extractIpPortsAndNames(lines) {
    const extracted = [];
    const tasks = lines.map(async (line) => {
      const item = line.trim();
      if (!item) return [];

      if (item.startsWith("http://") || item.startsWith("https://")) {
        try {
          const resp = await fetch(item, {
            headers: { "User-Agent": "v2rayN/6.0", Accept: "text/plain" },
            cf: { cacheTtl: 300, cacheEverything: true },
          });
          if (!resp.ok) return [];
          const text = await resp.text();
          let decoded = this.safeBase64Decode(text);
          if (!decoded) decoded = text;
          return this.parseNodeList(decoded.split(/[\n\r]+/).filter(Boolean));
        } catch {
          return [];
        }
      }

      return this.parseNodeList([item]);
    });

    const nestedResults = await Promise.all(tasks);
    nestedResults.forEach((arr) => extracted.push(...arr));
    return extracted;
  },

  parseNodeList(lines) {
    const list = [];
    lines.forEach((line) => {
      let host = "";
      let port = "";
      let name = "";
      let protocol = "";
      let originalLink = line.trim();

      try {
        line = line.trim();
        if (!line) return;

        if (line.includes("://")) {
          protocol = line.split("://")[0].toLowerCase();
          if (protocol === "vmess") {
            const b64 = line.replace(/^vmess:\/\//i, "");
            const jsonStr = this.safeBase64Decode(b64);
            if (!jsonStr) return;
            const config = JSON.parse(jsonStr);
            host = config.add;
            port = config.port;
            name = config.ps;
          } else if (protocol === "ss") {
            return;
          } else {
            const tempUrl = line.replace(/^[a-z0-9+\-.]+:\/\//i, "http://");
            const url = new URL(tempUrl);
            host = url.hostname;
            port = url.port || "443";
            if (url.hash) {
              try {
                name = decodeURIComponent(url.hash.slice(1));
              } catch {
                name = url.hash.slice(1);
              }
            }
          }
        } else {
          originalLink = null;
          const hashMatch = line.match(/^(.*?)(?:[#|](.*))?$/);
          if (hashMatch) {
            const base = hashMatch[1].trim();
            if (hashMatch[2]) name = hashMatch[2].trim();
            const bracketMatch = base.match(/^\[([^\]]+)\](?::(\d+))?$/);
            if (bracketMatch) {
              host = bracketMatch[1];
              port = bracketMatch[2] || "443";
            } else {
              const parts = base.split(":");
              if (parts.length === 2) {
                host = parts[0];
                port = parts[1];
              } else if (parts.length === 1) {
                host = parts[0];
                port = "443";
              }
            }
          }
        }

        if (host) {
          list.push({
            host,
            port: (port || "443").toString().trim(),
            name,
            protocol,
            originalLink,
            link: originalLink,
          });
        }
      } catch {}
    });

    return list;
  },

  getLoginHTML() {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Login</title></head><body style="font-family:sans-serif;padding:32px"><h2>Login Required</h2><p>Open this page with <code>?pw=${AUTH_PASSWORD}</code> once, then refresh.</p></body></html>`;
  },

  legacyGetHTML() {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CF Worker Sub</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; background: linear-gradient(135deg, #f7efe5, #d8e2dc); margin: 0; padding: 24px; color: #1f2937; }
    .wrap { max-width: 920px; margin: 0 auto; }
    .card { background: rgba(255,255,255,0.86); border: 1px solid rgba(31,41,55,0.08); border-radius: 18px; box-shadow: 0 20px 50px rgba(31,41,55,0.08); padding: 20px; margin-bottom: 18px; }
    h1 { margin: 0 0 8px; font-size: 36px; }
    p { margin: 0 0 16px; }
    label { display:block; margin: 14px 0 8px; font-weight: 700; }
    input, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; font: inherit; background: #fffdf9; }
    textarea { min-height: 120px; resize: vertical; }
    .row { display:flex; gap:12px; flex-wrap:wrap; }
    .row > * { flex:1; min-width: 220px; }
    .btn { appearance:none; border:none; border-radius: 12px; padding: 12px 16px; cursor:pointer; font: inherit; font-weight:700; background:#0f766e; color:white; }
    .btn.alt { background:#7c2d12; }
    .btn.light { background:#e2e8f0; color:#0f172a; }
    .hint { font-size: 13px; color: #475569; margin-top: 8px; }
    .out { white-space: pre-wrap; word-break: break-all; background:#fff; border:1px solid #e2e8f0; border-radius: 12px; padding: 12px; min-height: 80px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>CF Worker Sub</h1>
      <p>鐩存帴鑱氬悎璁㈤槄锛岀洿鎺ョ敓鎴?Clash锛屼笉鍐嶈蛋澶栭儴杞崲銆?/p>
    </div>
    <div class="card">
      <label>妯℃澘锛堝彲閫夛級</label>
      <input id="template" placeholder="vmess://... 鎴?vless://...">
      <label>鏉ユ簮锛堝繀濉級</label>
      <textarea id="source" placeholder="https://... 鎴?vmess://... 鎴?IP:Port"></textarea>
      <div class="row" style="margin-top:16px">
        <button class="btn" onclick="generate()">鐢熸垚璁㈤槄</button>
        <button class="btn alt" onclick="downloadClash()">涓嬭浇 Clash</button>
        <button class="btn light" onclick="testNodes()">娴嬭瘯鑺傜偣</button>
      </div>
      <div class="hint">Clash 妯℃澘浠?KV 鐨?<code>clash_template</code> 璇诲彇銆?/div>
    </div>
    <div class="card">
      <label>缁撴灉</label>
      <div id="output" class="out"></div>
    </div>
  </div>
  <script>
    let state = { nodes: [], subUrl: "" };

    async function generate() {
      const template = document.getElementById("template").value.trim();
      const source = document.getElementById("source").value.trim();
      if (!source) return render("璇峰厛濉啓鏉ユ簮");
      const resp = await fetch("/sub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, source, format: "json" })
      });
      const text = await resp.text();
      if (!resp.ok) return render(text);
      const data = JSON.parse(text);
      state.nodes = data;
      const fallback = new URL("/sub", location.origin);
      if (template) fallback.searchParams.set("template", template);
      fallback.searchParams.set("source", source);
      state.subUrl = fallback.toString();
      render(JSON.stringify(data, null, 2));
    }

    function downloadClash() {
      const template = document.getElementById("template").value.trim();
      const source = document.getElementById("source").value.trim();
      if (!source) return render("璇峰厛濉啓鏉ユ簮");
      const url = new URL("/clash", location.origin);
      if (template) url.searchParams.set("template", template);
      url.searchParams.set("source", source);
      location.href = url.toString();
    }

    async function testNodes() {
      if (!state.nodes.length) {
        await generate();
        if (!state.nodes.length) return;
      }
      const resp = await fetch("/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes: state.nodes })
      });
      render(await resp.text());
    }

    function render(text) {
      document.getElementById("output").textContent = text;
    }
  </script>
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
    :root { --glass-bg: rgba(255, 255, 255, 0.7); --primary: #6366f1; --accent: #8b5cf6; --success: #10b981; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; min-height: 100vh; margin: 0; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; color: white; }
    .card { background: var(--glass-bg); backdrop-filter: blur(20px); border-radius: 20px; padding: 25px; margin-bottom: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
    .label { font-weight: bold; margin-bottom: 8px; display: block; color: #1f2937; }
    input[type="text"], textarea { width: 100%; padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 12px; background: rgba(255,255,255,0.6); margin-bottom: 15px; box-sizing: border-box; }
    .btn { width: 100%; padding: 14px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: white; border: none; border-radius: 12px; font-weight: bold; cursor: pointer; }
    .btn:hover { opacity: 0.9; }
    .btn:disabled { opacity: 0.7; cursor: not-allowed; }
    .tools { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px; }
    .tool-btn { flex: 1; min-width: 120px; padding: 10px; background: rgba(255,255,255,0.6); border: 1px solid rgba(0,0,0,0.1); border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600; }
    .tool-btn:hover { background: white; }
    .region-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
    .region-item { background: rgba(255,255,255,0.5); padding: 10px; border-radius: 10px; cursor: pointer; display: flex; justify-content: space-between; font-size: 14px; }
    .region-item.active { background: var(--primary); color: white; }
    .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 12px 24px; border-radius: 30px; opacity: 0; pointer-events: none; transition: 0.3s; }
    .hint { font-size: 12px; color: #555; margin-bottom: 10px; line-height: 1.6; }
    .status-bar { display:flex; gap:10px; margin-bottom:10px; font-size:14px; font-weight:bold; flex-wrap: wrap; }
    .warning-box { background: #fff3cd; color: #856404; padding: 12px; border-radius: 8px; margin-bottom: 15px; font-size: 13px; border: 1px solid #ffeeba; line-height: 1.5; }
    .switch-container { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; padding: 5px 0; }
    .switch-label { font-weight: bold; color: #333; }
    .switch { position: relative; display: inline-block; width: 46px; height: 26px; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
    .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
    input:checked + .slider { background-color: var(--success); }
    input:checked + .slider:before { transform: translateX(20px); }
    .result-box { background: rgba(255,255,255,0.55); border: 1px solid rgba(0,0,0,0.08); border-radius: 12px; padding: 12px; font-size: 13px; color: #374151; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
    .sub-link { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>CF-Worker-Sub-Pro</h1><p>全能订阅聚合 & 优选生成器</p></div>
    
    <div class="card">
      <div class="warning-box">
        ✅ <b>支持协议：</b> VLESS, Trojan, <b>VMess</b><br>
        ⚠️ <b>注意：</b> Shadowsocks (SS) 协议暂不支持，将被自动过滤。Clash 规则会直接使用 KV 模板。
      </div>

      <label class="label">1. 节点模板 (可选)</label>
      <div class="hint">🔸 支持 vmess:// 或 vless:// 模板 | 留空则保留源协议</div>
      <input type="text" id="template" placeholder="vmess://ey... 或 vless://..." autocomplete="off">
      
      <label class="label">2. 节点来源 (必填)</label>
      <textarea id="source" rows="5" placeholder="https://机场订阅... 或 vmess://... 或 IP/域名:Port"></textarea>
      
      <div class="switch-container">
        <span class="switch-label">✨ 智能去重 (Deduplication)</span>
        <label class="switch">
          <input type="checkbox" id="dedupSwitch" checked>
          <span class="slider"></span>
        </label>
      </div>

      <button id="generateBtn" class="btn" onclick="generate()">生成订阅链接</button>
    </div>

    <div id="result" class="card" style="display:none">
      <label class="label">常用工具</label>
      <div class="tools">
        <button class="tool-btn" style="color:var(--accent)" onclick="testNodes()">🔍 测试连通性</button>
      </div>
      
      <label class="label">通用订阅链接</label>
      <div id="subLinkBox" class="result-box sub-link"></div>
      <div class="hint">这个是普通订阅链接，可给通用订阅工具使用。</div>

      <label class="label">Clash YAML 链接</label>
      <div id="clashLinkBox" class="result-box sub-link"></div>
      <div class="hint">这个链接会直接返回 YAML，可直接导入 Clash Verge。规则模板来自 KV 的 <code>clash_template</code>。</div>
      
      <label class="label">提取 & 复制区</label>
      <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 10px;">
        <span class="hint" style="margin: 0; font-weight: bold;">分隔格式:</span>
        <select id="delimiterSelect" style="padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); background: rgba(255,255,255,0.8); font-size: 13px; outline: none; cursor: pointer;">
          <option value="newline">换行 (默认)</option>
          <option value="comma">英文逗号 (,)</option>
          <option value="pipe">竖线 (|)</option>
          <option value="space">空格 ( )</option>
        </select>
      </div>
      <div class="tools">
        <button class="tool-btn" onclick="copyAll('sub')">复制订阅</button>
        <button class="tool-btn" onclick="copyAll('clash')">复制 Clash 链接</button>
        <button class="tool-btn" onclick="copyAll('all_addr')">全部 (IP+域名)</button>
        <button class="tool-btn" onclick="copyAll('ip')">仅 IP</button>
        <button class="tool-btn" onclick="copyAll('domain')">仅域名</button>
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
      <div id="testContent" class="result-box" style="max-height:400px; overflow-y:auto;"></div>
    </div>
  </div>
  
  <div id="toast" class="toast">已复制</div>

  <script>
    let GLOBAL_DATA = { url: '', clashUrl: '', nodes: [], regions: {}, testResults: [], isShort: false };

    async function generate() {
      const template = document.getElementById('template').value.trim();
      const source = document.getElementById('source').value.trim();
      const dedup = document.getElementById('dedupSwitch').checked;
      
      if (!source) return showToast('请填写节点来源');

      const btn = document.getElementById('generateBtn');
      btn.disabled = true;
      btn.innerText = '生成中...';
      GLOBAL_DATA.isShort = false;

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
        GLOBAL_DATA.testResults = [];
        
        let fallbackUrl = '';
        let fallbackClashUrl = '';
        if (source.length < 1800) {
          const apiUrl = new URL(window.location.origin + '/sub');
          const clashUrl = new URL(window.location.origin + '/clash');
          if (template) {
            apiUrl.searchParams.set('template', template);
            clashUrl.searchParams.set('template', template);
          }
          apiUrl.searchParams.set('source', source);
          clashUrl.searchParams.set('source', source);
          if (!dedup) {
            apiUrl.searchParams.set('dedup', 'false');
            clashUrl.searchParams.set('dedup', 'false');
          }
          fallbackUrl = apiUrl.toString();
          fallbackClashUrl = clashUrl.toString();
        } else {
          fallbackUrl = 'TOO_LONG';
          fallbackClashUrl = 'TOO_LONG';
        }

        try {
          const shortResp = await fetch('/shorten', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template, source, dedup })
          });
          if (shortResp.ok) {
            const shortData = await shortResp.json();
            GLOBAL_DATA.url = shortData.shortUrl || fallbackUrl;
            GLOBAL_DATA.clashUrl = shortData.id ? (window.location.origin + '/clash?id=' + shortData.id) : fallbackClashUrl;
            if (shortData.ttl) {
              GLOBAL_DATA.isShort = true;
            }
          } else {
            GLOBAL_DATA.url = fallbackUrl;
            GLOBAL_DATA.clashUrl = fallbackClashUrl;
          }
        } catch(e) {
          GLOBAL_DATA.url = fallbackUrl;
          GLOBAL_DATA.clashUrl = fallbackClashUrl;
        }

        processRegions(data);
        document.getElementById('subLinkBox').textContent = GLOBAL_DATA.url === 'TOO_LONG' ? '来源太长，当前未生成可复制订阅短链。' : GLOBAL_DATA.url;
        document.getElementById('clashLinkBox').textContent = GLOBAL_DATA.clashUrl === 'TOO_LONG' ? '来源太长，当前未生成可复制 Clash 链接。' : GLOBAL_DATA.clashUrl;
        document.getElementById('result').style.display = 'block';
        document.getElementById('testResults').style.display = 'none';
        window.scrollTo({ top: document.getElementById('result').offsetTop, behavior: 'smooth' });
      } catch (e) { showToast(e.message); } 
      finally { btn.disabled = false; btn.innerText = '生成订阅链接'; }
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
        div.innerHTML = '<span>' + k + '</span><span>' + map[k].length + '</span>';
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
        
        statusBar.innerHTML = '<span style="color:#333">Total: ' + results.length + '</span> <span style="color:#10b981">OK: ' + okCount + '</span> <span style="color:#ef4444">Fail: ' + failCount + '</span>';

        let html = '';
        results.forEach(r => {
          const color = r.status === 'ok' ? '#10b981' : '#ef4444';
          html += '<div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:5px;">'
            + '<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px;">' + escapeHtml(r.name || '') + '</span>'
            + '<span style="color:' + color + '">' + (r.status === 'ok' ? r.latency + 'ms' : '不可用') + '</span>'
            + '</div>';
        });
        contentDiv.innerHTML = html;
        
        if (failCount > 0) {
          document.getElementById('removeFailedBtn').style.display = 'block';
        }
      } catch(e) { contentDiv.innerHTML = '测试出错: ' + (e.message || '未知错误'); }
    }

    async function removeFailedNodes() {
      const failedSet = new Set(GLOBAL_DATA.testResults.filter(r => r.status === 'fail').map(r => r.link || r.ip + ':' + r.port));
      
      const validNodes = GLOBAL_DATA.nodes.filter(n => {
        const key = n.link || n.ip + ':' + n.port;
        return !failedSet.has(key);
      });

      if (validNodes.length === 0) return showToast('所有节点均失效');

      const newSource = validNodes.map(n => n.link).join('\\n');
      document.getElementById('source').value = newSource;
      
      showToast('已剔除失败节点，重新生成中...');
      await generate();
    }

    function copyAll(type) {
      const getDelimiter = () => {
        const val = document.getElementById('delimiterSelect').value;
        if (val === 'comma') return ',';
        if (val === 'pipe') return '|';
        if (val === 'space') return ' ';
        return '\\n';
      };
      const sep = getDelimiter();

      if (type === 'sub') {
        if (GLOBAL_DATA.url === 'TOO_LONG') return alert('节点来源内容过长，当前没有可复制的订阅链接，请先启用 KV 短链或减少内容长度。');
        if (!GLOBAL_DATA.url) return showToast('请先点击生成');
        navigator.clipboard.writeText(GLOBAL_DATA.url).then(() => {
          if (GLOBAL_DATA.isShort) {
            showToast('已复制订阅短链接 (7天无访问将过期)');
          } else {
            showToast('已复制订阅链接');
          }
        });
      } else if (type === 'clash') {
        if (GLOBAL_DATA.clashUrl === 'TOO_LONG') return alert('节点来源内容过长，当前没有可复制的 Clash YAML 链接，请先启用 KV 短链或减少内容长度。');
        if (!GLOBAL_DATA.clashUrl) return showToast('请先点击生成');
        navigator.clipboard.writeText(GLOBAL_DATA.clashUrl).then(() => {
          showToast('已复制 Clash YAML 链接');
        });
      } else if (type === 'all_addr') {
        const list = GLOBAL_DATA.nodes.map(n => n.ip + ':' + n.port + '#' + (n.name || ''));
        if (!list.length) return showToast('无节点数据');
        navigator.clipboard.writeText(list.join(sep)).then(() => showToast('已复制全部 IP 和域名'));
      } else if (type === 'ip' || type === 'domain') {
        const isIP = (str) => /^(\\d{1,3}\\.){3}\\d{1,3}$/.test(str) || /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/.test(str);
        const list = GLOBAL_DATA.nodes
          .filter(n => type === 'ip' ? isIP(n.ip) : !isIP(n.ip))
          .map(n => n.ip + ':' + n.port + '#' + (n.name || ''));
        
        if (!list.length) return showToast(type === 'ip' ? '没有找到纯 IP 节点' : '没有找到域名节点');
        navigator.clipboard.writeText(list.join(sep)).then(() => showToast(type === 'ip' ? '已复制 IP 列表' : '已复制域名列表'));
      }
    }
    
    function copySelected() {
      const active = Array.from(document.querySelectorAll('.region-item.active span:first-child')).map(s => s.innerText);
      if (!active.length) return showToast('未选择区域');
      
      const selectedNodes = GLOBAL_DATA.nodes.filter(n => active.includes(n.region));
      const str = selectedNodes.map(n => n.link).join('\\n');
      const b64 = btoa(unescape(encodeURIComponent(str)));
      navigator.clipboard.writeText(b64).then(() => showToast('已复制 Base64 订阅内容'));
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.style.opacity = '1';
      setTimeout(() => t.style.opacity = '0', 2000);
    }
  </script>
</body>
</html>`;
  },
};
