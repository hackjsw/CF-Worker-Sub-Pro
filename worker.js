// --- 配置区 ---
const AUTH_PASSWORD = "访问密码"; 
// --------------

// 区域关键词配置 (Key 为标准英文缩写)
const REGION_CONFIG = {
    "HK": ["香港", "HK", "HongKong", "HKG", "Hong Kong"],
    "TW": ["台湾", "TW", "Taiwan", "TWN", "Taipei"],
    "SG": ["新加坡", "SG", "Singapore", "SGP", "狮城"],
    "JP": ["日本", "JP", "Japan", "JPN", "Tokyo", "Osaka"],
    "US": ["美国", "US", "USA", "America", "LosAngeles"],
    "KR": ["韩国", "KR", "Korea", "Seoul"],
    "DE": ["德国", "DE", "Germany"],
    "FR": ["法国", "FR", "France"],
    "UK": ["英国", "UK", "Britain"],
    "GLOBAL": ["Anycast", "Global", "IP-"], 
    "CDN": ["优选", "Cloudflare", "CF", "CDN"]
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const params = url.searchParams;

    // 路由分发
    if (url.pathname === '/sub' || params.has('template')) return this.handleSub(params);

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
    const source = decodeURIComponent(params.get('source') || '');
    const rawMode = params.get('raw') === 'true'; 
    const jsonMode = params.get('format') === 'json'; 
    const filterRegions = params.get('regions');
    const defaultRegion = params.get('default_region'); // 获取用户设置的默认地区
    
    if (!source || !template.includes('://')) {
        const msg = rawMode ? "Configuration Error" : "error://invalid-args?#ConfigurationError";
        return new Response(rawMode ? msg : btoa(msg), { 
            headers: { "Content-Type": "text/plain;charset=UTF-8" } 
        });
    }
    
    try {
      // 将默认地区传给处理函数
      let nodes = await this.processData(template, source, defaultRegion);

      if (filterRegions) {
          const targetRegions = filterRegions.split(',').filter(r => r.trim());
          if (targetRegions.length > 0) {
              nodes = nodes.filter(node => targetRegions.includes(node.region));
          }
      }
      
      if (jsonMode) {
          return new Response(JSON.stringify(nodes), {
              headers: { "Content-Type": "application/json;charset=UTF-8" }
          });
      }

      if (rawMode) {
          const allIps = nodes.map(n => `${n.ip}:${n.port}#${n.name}`).join('\n');
          return new Response(allIps, { headers: { "Content-Type": "text/plain;charset=UTF-8" } });
      } 
      
      else {
          const subText = nodes.map(n => n.link).join('\n');
          return new Response(btoa(subText), { headers: { "Content-Type": "text/plain;charset=UTF-8" } });
      }

    } catch (err) {
      const errMsg = `Error: ${err.message}`;
      return new Response(rawMode ? errMsg : btoa(`error://internal?#${errMsg}`), { headers: { "Content-Type": "text/plain;charset=UTF-8" } });
    }
  },

  // 修改：接收 defaultRegion 参数
  async processData(template, source, defaultRegion) {
    let urlObj;
    let originalProtocol = "vless";

    try {
        const protocolMatch = template.match(/^([a-z0-9\+\-\.]+):\/\//i);
        if (protocolMatch) {
            originalProtocol = protocolMatch[1];
        }
        const httpUrl = template.replace(new RegExp(`^${originalProtocol}://`, 'i'), 'http://');
        urlObj = new URL(httpUrl);
    } catch (e) {
        throw new Error("Invalid Template Format");
    }

    const rawLines = source.split(/[\n\r\s,]+/).filter(l => l.trim().length > 0);
    const extractedList = await this.extractIpPortsAndNames(rawLines);

    const results = [];
    const seen = new Set();
    const regionCounters = {}; 

    extractedList.forEach((item) => {
      let { host, port, name } = item;
      host = host.replace(/^\[|\]$/g, ''); 

      const finalPort = port || urlObj.port || "443";
      
      const key = `${host}:${finalPort}`;
      if (seen.has(key)) return;
      seen.add(key);

      // 1. 解码备注
      let decodedName = name;
      try { 
          if(name.includes('%')) {
              decodedName = decodeURIComponent(name); 
          }
      } catch(e) { 
          decodedName = name; 
      }

      // 2. 识别区域
      let region = this.identifyRegion(decodedName);

      // --- 关键修复：应用默认分类 ---
      // 如果识别结果是 Others，且用户提供了 defaultRegion，则强制覆盖
      if (region === 'Others' && defaultRegion && defaultRegion.trim() !== '') {
          region = defaultRegion.trim();
      }

      // 3. 生成标准化名称
      if (!regionCounters[region]) regionCounters[region] = 0;
      regionCounters[region]++;
      const standardizedName = `${region} ${regionCounters[region]}`;

      const newLink = new URL(urlObj.toString());
      newLink.hostname = host;
      newLink.port = finalPort;
      newLink.search = newLink.searchParams.toString();
      newLink.hash = encodeURIComponent(standardizedName);
      
      const finalLinkStr = newLink.toString().replace(/^http:\/\//, `${originalProtocol}://`);

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

  async extractIpPortsAndNames(lines) {
    let extracted = [];
    const tasks = lines.map(async (line) => {
        const item = line.trim();
        if (!item) return [];

        if (item.startsWith('http://') || item.startsWith('https://')) {
            try {
                const resp = await fetch(item, { headers: { 'User-Agent': 'v2rayN/6.0' } });
                if (!resp.ok) return [];
                const text = await resp.text();
                
                let decoded = text;
                try {
                    if (!text.includes('://') && /^[a-zA-Z0-9+/=]+$/.test(text.replace(/\s/g, ''))) {
                        let safeText = text.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
                        while (safeText.length % 4) safeText += '=';
                        decoded = atob(safeText);
                    }
                } catch(e) {}
                
                const subLines = decoded.split(/[\n\r]+/).filter(l => l);
                return this.parseNodeList(subLines);
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
          let host = "", port = "", name = "";
          try {
              line = line.trim();
              if (!line) return;

              if (line.includes('://')) {
                  const tempUrl = line.startsWith('http') ? line : line.replace(/^[a-z0-9\+\-\.]+:\/\//i, 'http://');
                  const u = new URL(tempUrl);
                  host = u.hostname;
                  port = u.port;
                  
                  if (u.hash) {
                      let rawHash = u.hash.slice(1);
                      try {
                          name = decodeURIComponent(rawHash);
                      } catch(e) {
                          name = rawHash;
                      }
                  }
              } else {
                  const hashMatch = line.match(/^(.*?)(?:[#|](.*))?$/);
                  if (hashMatch) {
                      let base = hashMatch[1].trim(); 
                      if (hashMatch[2]) {
                          try {
                              name = decodeURIComponent(hashMatch[2].trim());
                          } catch(e) {
                              name = hashMatch[2].trim();
                          }
                      }
                      
                      let match = base.match(/^\[([^\]]+)\](?::(\d+))?$/); 
                      if (match) {
                          host = match[1];
                          port = match[2] || "";
                      } else {
                          const colons = (base.match(/:/g) || []).length;
                          if (colons === 1) {
                              const parts = base.split(':');
                              host = parts[0];
                              port = parts[1];
                          } else {
                              host = base;
                          }
                      }
                  }
              }

              if (host) {
                  host = host.split(/[?\/]/)[0].trim();
                  host = host.replace(/^\[|\]$/g, '');
                  if (!host.includes('.') && !host.includes(':')) return;
                  if (host.length > 64 || /[^a-zA-Z0-9.:\-]/.test(host)) return;
              }
              
              if (host) list.push({ host, port, name });
          } catch (e) {}
      });
      return list;
  },

  getLoginHTML() { 
      return `<html><body style="background:#FDFBF7;color:#4A4A4A;display:flex;justify-content:center;align-items:center;height:100vh;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
      <div style="text-align:center;background:#fff;padding:30px;border-radius:10px;box-shadow:0 4px 15px rgba(212,175,55,0.15);border:1px solid #E6D28C">
      <h3 style="margin-top:0;color:#B8860B">访问验证</h3>
      <input type="password" id="p" placeholder="Password" style="padding:10px;border-radius:4px;border:1px solid #D4AF37;background:#FFFAF0;color:#555;outline:none;width:200px;display:block;margin:15px auto">
      <button onclick="location.href='?pw='+document.getElementById('p').value" style="padding:10px 30px;border-radius:20px;border:none;background:linear-gradient(135deg, #D4AF37 0%, #C5A028 100%);color:#fff;cursor:pointer;font-weight:bold;box-shadow:0 2px 5px rgba(184,134,11,0.3)">进入</button></div></body></html>`; 
  },

  getHTML() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>优选订阅生成 Pro</title>
    <style>
        body { 
            background: #FDFBF7; 
            color: #4A4A4A; 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            padding: 20px; 
            max-width: 950px; 
            margin: 0 auto; 
            line-height: 1.6;
        }
        h2 { 
            border-bottom: 2px solid #D4AF37; 
            padding-bottom: 10px; 
            display: inline-block; 
            color: #8B6508;
            margin-bottom: 20px;
        }
        p { margin: 15px 0 5px; color: #666; font-size: 14px; font-weight: 500; }
        
        textarea { 
            width: 100%; 
            height: 80px; 
            background: #FFFFFF; 
            color: #333; 
            border: 1px solid #E0E0E0; 
            border-radius: 8px; 
            padding: 12px; 
            box-sizing: border-box; 
            font-family: monospace; 
            font-size: 13px; 
            outline: none; 
            transition: all 0.2s;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
        }
        textarea:focus { 
            border-color: #D4AF37; 
            box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.2); 
        }
        
        input[type="text"] { 
            background: #FFFFFF; 
            color: #333; 
            border: 1px solid #E0E0E0; 
            border-radius: 6px; 
            padding: 8px 12px; 
            outline: none; 
            width: 220px; 
            transition: all 0.2s;
        }
        input[type="text"]:focus { 
            border-color: #D4AF37; 
            box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.2); 
        }
        
        .main-btn { 
            background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%); 
            color: white; 
            border: none; 
            padding: 14px 0; 
            width: 100%; 
            border-radius: 8px; 
            cursor: pointer; 
            font-size: 16px; 
            margin-top: 20px; 
            font-weight: bold; 
            transition: transform 0.1s, box-shadow 0.2s; 
            box-shadow: 0 4px 6px rgba(184, 134, 11, 0.2);
        }
        .main-btn:hover { 
            background: linear-gradient(135deg, #C5A028 0%, #A07406 100%);
            transform: translateY(-1px);
            box-shadow: 0 6px 10px rgba(184, 134, 11, 0.3);
        }
        .main-btn:disabled { 
            background: #E0E0E0; 
            color: #999; 
            cursor: not-allowed; 
            box-shadow: none;
        }
        
        .res-box { 
            background: #FFFFFF; 
            padding: 20px; 
            border-radius: 12px; 
            margin-top: 25px; 
            border: 1px solid #E6D28C; 
            box-shadow: 0 4px 15px rgba(212, 175, 55, 0.08);
        }
        .res-title { 
            font-weight: bold; 
            color: #8B6508; 
            margin-bottom: 15px; 
            font-size: 15px; 
            border-left: 4px solid #D4AF37; 
            padding-left: 10px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
        }
        
        .action-group { display: flex; gap: 10px; }
        
        .action-btn { 
            background: #FFF8E1; 
            color: #8B6508; 
            border: 1px solid #D4AF37; 
            font-size: 12px; 
            padding: 8px 15px; 
            cursor: pointer; 
            border-radius: 6px; 
            transition: all 0.2s; 
            font-weight: 500;
        }
        .action-btn:hover { 
            background: #D4AF37; 
            color: #FFF; 
        }
        
        .action-btn.green { 
            background: #F1F8E9; 
            color: #33691E; 
            border-color: #8BC34A; 
        }
        .action-btn.green:hover { 
            background: #7CB342; 
            color: #FFF; 
        }
        
        .action-btn.purple { 
            background: #F3E5F5; 
            color: #4A148C; 
            border-color: #BA68C8; 
        }
        .action-btn.purple:hover { 
            background: #AB47BC; 
            color: #FFF; 
        }
        
        .region-container { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
        
        .region-item { 
            background: #FFFFFF; 
            border: 1px solid #DDD; 
            border-radius: 6px; 
            padding: 8px 14px; 
            cursor: pointer; 
            display: flex; 
            align-items: center; 
            user-select: none; 
            transition: all 0.2s; 
            color: #555;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .region-item:hover { 
            border-color: #D4AF37; 
            color: #8B6508; 
            background: #FFFAF0;
        }
        .region-item.active { 
            background: #D4AF37; 
            color: white; 
            border-color: #D4AF37; 
            box-shadow: 0 2px 4px rgba(212, 175, 55, 0.4);
        }
        .region-name { margin-right: 8px; font-size: 13px; font-weight: 500; }
        .region-count { 
            font-size: 11px; 
            background: rgba(0,0,0,0.1); 
            padding: 2px 6px; 
            border-radius: 10px; 
        }
        .region-item.active .region-count { background: rgba(255,255,255,0.3); }
        
        #hiddenSubUrl { position: absolute; left: -9999px; opacity: 0; }
    </style>
</head>
<body>
    <h2>优选订阅生成 Pro</h2>
    
    <p>1. 模板链接 (支持 vless / trojan / hysteria2 / ss 等):</p>
    <textarea id="temp" placeholder="vless://uuid@domain:443?params..."></textarea>
    
    <p>2. 节点来源 (支持混合: 订阅链接 / 节点链接 / IP):</p>
    <textarea id="source" placeholder="1.2.3.4 (无备注)&#10;1.2.3.4:8443#香港01&#10;https://订阅链接"></textarea>

    <p style="display:flex; align-items:center; gap:10px;">
        <span>3. 无法识别时默认归类:</span>
        <input type="text" id="defRegion" placeholder="例如: HK (留空则归为 Others)">
    </p>
    
    <button id="genBtn" class="main-btn" onclick="convert()">⚡ 生成订阅 & 提取IP</button>

    <div id="outSub" class="res-box" style="display:none">
        <div class="res-title">
            <span>全部节点订阅链接 (Base64)</span>
            <button class="action-btn" onclick="copyId('hiddenSubUrl')">📄 复制完整订阅</button>
        </div>
        <input type="text" id="hiddenSubUrl">
    </div>

    <div id="outRegion" class="res-box" style="display:none">
        <div class="res-title">
            <span>按地区分类操作 (可多选)</span>
            <div class="action-group">
                <button class="action-btn" onclick="copySelected('ip')">📄 复制选中IP</button>
                <button class="action-btn green" onclick="copySelected('link')">🔗 复制选中节点</button>
                <button class="action-btn purple" onclick="copySelectedSub()">🌐 复制选中区域的订阅链接</button>
            </div>
        </div>
        <div style="font-size:12px;color:#888;margin-bottom:15px;padding:0 5px;">
            点击下方标签选择区域 (支持多选)，然后点击上方按钮进行复制。
            <br>
            <span style="color:#B8860B">• 紫色按钮</span> 可生成一条<b>只包含选中区域</b>的永久订阅链接。
        </div>
        <div id="regionList" class="region-container"></div>
    </div>

    <script>
        let GLOBAL_REGION_MAP = {};
        let CURRENT_BASE_URL = "";

        async function convert() {
            const t = document.getElementById('temp').value.trim();
            const s = document.getElementById('source').value.trim();
            const defReg = document.getElementById('defRegion').value.trim(); 
            const btn = document.getElementById('genBtn');
            
            if(!t.includes('://')) return alert('模板必须包含协议头');
            if(!s) return alert('来源内容不能为空');
            
            btn.disabled = true;
            btn.innerText = "正在清洗数据并分类...";
            
            try {
                CURRENT_BASE_URL = window.location.origin + '/sub?template=' + encodeURIComponent(t) + '&source=' + encodeURIComponent(s);
                
                // 关键修复：将前端输入框的值传给后端
                if (defReg) {
                    CURRENT_BASE_URL += '&default_region=' + encodeURIComponent(defReg);
                }
                
                const resp = await fetch(CURRENT_BASE_URL + '&format=json');
                if (!resp.ok) throw new Error("网络请求失败或参数过长");
                const nodes = await resp.json();

                document.getElementById('hiddenSubUrl').value = CURRENT_BASE_URL;
                
                processFrontendData(nodes);
                
                document.getElementById('outSub').style.display = 'block';
                document.getElementById('outRegion').style.display = 'block';
            } catch (e) {
                alert('提取失败: ' + e.message);
            } finally {
                btn.disabled = false;
                btn.innerText = "⚡ 生成订阅 & 提取IP";
            }
        }

        function processFrontendData(nodes) {
            GLOBAL_REGION_MAP = {}; 
            
            nodes.forEach(node => {
                let region = node.region;
                if (!GLOBAL_REGION_MAP[region]) GLOBAL_REGION_MAP[region] = [];
                GLOBAL_REGION_MAP[region].push(node);
            });

            renderRegionSelector();
        }

        function renderRegionSelector() {
            const container = document.getElementById('regionList');
            container.innerHTML = '';
            
            const sortedKeys = Object.keys(GLOBAL_REGION_MAP).sort((a,b) => {
                if (a === 'Others') return 1;
                if (b === 'Others') return -1;
                return a.localeCompare(b);
            });

            sortedKeys.forEach(region => {
                const count = GLOBAL_REGION_MAP[region].length;
                if(count === 0) return;

                const item = document.createElement('div');
                item.className = 'region-item';
                item.onclick = function() { this.classList.toggle('active'); };
                
                item.innerHTML = \`
                    <span class="region-name">\${region}</span>
                    <span class="region-count">\${count}</span>
                \`;
                container.appendChild(item);
            });
        }

        function copySelected(type) {
            const activeItems = document.querySelectorAll('.region-item.active');
            if (activeItems.length === 0) return alert('请先点击下方标签选择至少一个区域');
            
            let resultList = [];
            activeItems.forEach(item => {
                const regionName = item.querySelector('.region-name').innerText;
                const regionNodes = GLOBAL_REGION_MAP[regionName];
                if (regionNodes) {
                    if (type === 'ip') {
                        resultList.push(...regionNodes.map(n => \`\${n.ip}:\${n.port}#\${n.name}\`));
                    } else {
                        resultList.push(...regionNodes.map(n => n.link));
                    }
                }
            });

            const separator = type === 'ip' ? ',' : '\\n';
            const textToCopy = resultList.join(separator);
            const typeText = type === 'ip' ? '个 IP' : '个节点链接';
            copyText(textToCopy, \`已复制 \${activeItems.length} 个区域，共 \${resultList.length} \${typeText}\`);
        }
        
        function copySelectedSub() {
            const activeItems = document.querySelectorAll('.region-item.active');
            if (activeItems.length === 0) return alert('请先点击下方标签选择至少一个区域');
            
            const selectedRegions = Array.from(activeItems).map(item => item.querySelector('.region-name').innerText).join(',');
            
            const finalSubUrl = CURRENT_BASE_URL + '&regions=' + encodeURIComponent(selectedRegions);
            copyText(finalSubUrl, '已复制定制订阅链接！\\n此链接只包含: ' + selectedRegions);
        }

        function copyId(id) {
            const el = document.getElementById(id);
            copyText(el.value, '复制成功');
        }

        function copyText(text, msg) {
            navigator.clipboard.writeText(text).then(() => {
                if(msg.includes('已复制')) {
                    console.log(msg);
                    const prevTitle = document.title;
                    document.title = "已复制!";
                    setTimeout(() => document.title = prevTitle, 1000);
                } else {
                    alert(msg);
                }
            }).catch(() => alert('复制失败'));
        }
    </script>
</body>
</html>`;
  }
};
