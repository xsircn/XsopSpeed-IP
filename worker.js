// =================================================================
// 🛡️ CLOUDFLARE 优选 IP 智能安全管家 (DDNS 联动 + 全面防二开版)
// =================================================================
// 提示：你可以在 Worker 的 Settings -> Variables 中配置以下环境变量
// 如果不配置，代码中将使用下方默认值。
// =================================================================

export default {
  // 触发场景 1：定时任务（每小时自动运行，同步 KV 到域名解析）
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleDnsSync(env));
  },

  // 触发场景 2：Web 访问请求
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 从环境变量读取配置，若无则使用默认安全值
    const SECURE_TOKEN = env.SECURE_TOKEN || "MyPrivateToken2026"; 
    const SUBDOMAIN = env.SUBDOMAIN || "cf.yourdomain.com";
    const userToken = url.searchParams.get("token");

    // =================【路由分支 1：手动强制同步 DNS】=================
    if (url.pathname === "/sync") {
      if (userToken !== SECURE_TOKEN) {
        return new Response("🔒 403 Forbidden: 认证失败", { status: 403 });
      }
      const result = await handleDnsSync(env);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // =================【路由分支 2：安全的后端 API 接口】=================
    if (url.pathname === "/api") {
      const ua = request.headers.get("user-agent") || "";
      const allowedUAs = /clash|shadowrocket|quantumult|v2ray|sing-box|surfboard|loon|trojan/i;
      
      // 严格风控：Token 错误 或 不是代理软件客户端访问 -> 触发蜜罐，返回假数据
      if (userToken !== SECURE_TOKEN || !allowedUAs.test(ua)) {
        const fakeOutput = [
          "127.0.0.1:443#⚡优选-专线接入-1.02ms",
          "10.0.0.1:8080#⚡优选-核心骨干-2.11ms",
          "114.114.114.114:443#警告:检测到非授权抓包-节点已锁定"
        ].join("\n");
        return new Response(fakeOutput, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }

      // 验证通过，读取真实数据
      const rawData = await env.SPEEDTEST_KV.get("cf_top10_ips");
      if (!rawData) return new Response("Data not ready.", { status: 404 });

      const lines = rawData.trim().split("\n");
      const apiOutput = lines.map(line => {
        const parts = line.split(" | 延迟:");
        const ipPort = parts[0] ? parts[0].trim() : "";
        const latency = parts[1] ? parts[1].replace("ms", "").trim() : "未知";
        return `${ipPort}#优选-${latency}ms`;
      }).join("\n");

      if (url.searchParams.get("b64") === "1") {
        return new Response(btoa(unescape(encodeURIComponent(apiOutput))), {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" }
        });
      }
      return new Response(apiOutput, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" }
      });
    }

    // =================【路由分支 3：私有前端监控面板 (带 Token 验证)】=================
    if (userToken !== SECURE_TOKEN) {
      // 如果没有密码，直接伪装成 403 页面或无权访问，防扫描
      return new Response("🔒 403 Forbidden: 拒绝访问。未获授权的监控请求。", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    // 读取 KV 渲染前端
    const rawData = await env.SPEEDTEST_KV.get("cf_top10_ips");
    if (!rawData) return new Response("KV Data Empty.", { status: 404 });

    const lines = rawData.trim().split("\n");
    const ipList = lines.map(line => {
      const parts = line.split(" | 延迟:");
      const ipPort = parts[0] ? parts[0].trim() : "";
      const latency = parts[1] ? parts[1].replace("ms", "").trim() : "未知";
      const [ip, port] = ipPort.split(":");
      return { ip, port, latency, ipPort };
    });

    const lastSync = await env.SPEEDTEST_KV.get("last_dns_sync_time") || "未同步";

    const tableRows = ipList.map((item, index) => `
      <tr class="${index < 3 ? 'top-three' : ''}">
        <td><span class="rank-badge">${index + 1}</span></td>
        <td class="font-mono">${item.ip}</td>
        <td class="font-mono text-gray">${item.port}</td>
        <td><span class="latency-badge">${item.latency} ms</span></td>
        <td class="font-mono text-xs text-light-gray">${item.ipPort}#优选-${item.latency}ms</td>
      </tr>
    `).join("");

    const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🔒 私有优选 IP 智能监控面板</title>
        <style>
            :root { --bg: #0f172a; --panel: #1e293b; --text: #f8fafc; --accent: #38bdf8; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
              background: var(--bg); color: var(--text); margin: 0; padding: 20px; 
              display: flex; justify-content: center;
              /* 极致防复制 */
              -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;
            }
            .container { width: 100%; max-width: 850px; margin-top: 40px; position: relative; z-index: 10; }
            h2 { font-weight: 600; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
            .card { background: var(--panel); border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); padding: 24px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.05); }
            .status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 5px; }
            .status-item { background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; font-size: 14px; border: 1px solid rgba(255,255,255,0.03); }
            .status-label { color: #64748b; font-size: 12px; block; margin-bottom: 4px; }
            .status-value { font-family: monospace; font-size: 15px; color: var(--accent); font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; text-align: left; }
            th, td { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
            th { color: #94a3b8; font-size: 14px; font-weight: 500; }
            .font-mono { font-family: ui-monospace, SFMono-Regular, monospace; }
            .text-gray { color: #94a3b8; }
            .text-light-gray { color: #475569; }
            .rank-badge { display: inline-block; width: 24px; height: 24px; line-height: 24px; text-align: center; background: rgba(255,255,255,0.05); border-radius: 50%; font-size: 12px; font-weight: bold; }
            .top-three .rank-badge { background: #eab308; color: #0f172a; }
            .latency-badge { background: rgba(34, 197, 94, 0.15); color: #4ade80; padding: 4px 8px; border-radius: 6px; font-size: 13px; font-weight: 600; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>🔒 私有优选 DNS 面板</h2>
            
            <div class="card">
                <div class="status-grid">
                    <div class="status-item">
                        <div class="status-label">联动目标子域名 (A 记录轮询)</div>
                        <div class="status-value">${SUBDOMAIN}</div>
                    </div>
                    <div class="status-item">
                        <div class="status-label">DNS 上次同步时间 (1小时/次)</div>
                        <div class="status-value" style="color: #4ade80;">${lastSync}</div>
                    </div>
                </div>
            </div>

            <div class="card" style="padding: 12px 0; overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            <th width="70">排名</th>
                            <th>IP 地址</th>
                            <th>端口</th>
                            <th>测速延迟</th>
                            <th>系统样式预览 (外部已锁死)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        </div>

        <script>
            // 1. 动态安全防伪水印生成
            function initWatermark() {
                const canvas = document.createElement('canvas');
                canvas.width = 380; canvas.height = 240;
                const ctx = canvas.getContext('2d');
                ctx.rotate(-22 * Math.PI / 180);
                ctx.font = '13px sans-serif';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.025)'; // 极其隐蔽的半透明
                
                const timeStr = new Date().toLocaleString('zh-CN');
                ctx.fillText("私有数据 严禁截屏分享", 30, 80);
                ctx.fillText("鉴权口令: " + "${SECURE_TOKEN}".substring(0,4) + "****", 30, 105);
                ctx.fillText("当前查阅时间: " + timeStr, 30, 130);

                const bgDiv = document.createElement('div');
                bgDiv.style.pointerEvents = 'none'; bgDiv.style.top = '0'; bgDiv.style.left = '0';
                bgDiv.style.position = 'fixed'; bgDiv.style.zIndex = '99999';
                bgDiv.style.width = '100%'; bgDiv.style.height = '100%';
                bgDiv.style.backgroundImage = 'url(' + canvas.toDataURL('image/png') + ')';
                document.body.appendChild(bgDiv);
            }
            window.addEventListener('DOMContentLoaded', initWatermark);

            // 2. 锁死右键、文本选中
            document.oncontextmenu = () => false;
            document.onselectstart = () => false;

            // 3. 锁死控制台 F12、全套审查、保存、复制快捷键
            document.onkeydown = (e) => {
                // 禁用 F12
                if (e.keyCode === 123) return false;
                // 禁用 Ctrl+C, Ctrl+S, Ctrl+U(看源码), Ctrl+Shift+I
                if (e.ctrlKey && (e.keyCode === 67 || e.keyCode === 83 || e.keyCode === 85 || e.shiftKey && e.keyCode === 73)) return false;
                // 兼容 Mac Command 键
                if (e.metaKey && (e.keyCode === 67 || e.keyCode === 83 || e.keyCode === 85)) return false;
            };
        </script>
    </body>
    </html>
    `;

    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
};

// =================【核心：Cloudflare DNS A记录 轮询 DDNS 同步逻辑】=================
async function handleDnsSync(env) {
  const zoneId = env.CF_ZONE_ID;
  const apiToken = env.CF_API_TOKEN;
  const subdomain = env.SUBDOMAIN || "cf.yourdomain.com";

  if (!zoneId || !apiToken) {
    return { success: false, msg: "未配置 CF_ZONE_ID 或 CF_API_TOKEN 环境变量" };
  }

  // 1. 获取本地 KV 里的优选 IP 结果
  const rawData = await env.SPEEDTEST_KV.get("cf_top10_ips");
  if (!rawData) return { success: false, msg: "KV 中未找到测速数据" };

  const lines = rawData.trim().split("\n");
  const topIps = lines.map(line => {
    const parts = line.split(" | 延迟:");
    const ipPort = parts[0] ? parts[0].trim() : "";
    return ipPort.split(":")[0]; // 提取纯 IP
  }).filter(ip => ip);

  if (topIps.length === 0) return { success: false, msg: "未解析到有效 IP" };

  try {
    const headers = { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" };

    // 2. 查出当前子域名所有的旧 A 记录
    const dnsUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${subdomain}&type=A`;
    const getRes = await fetch(dnsUrl, { method: "GET", headers });
    const getData = await getRes.json();
    
    if (!getData.success) return { success: false, msg: "拉取 CF DNS 记录失败", errors: getData.errors };

    // 3. 清理掉该子域名的历史解析
    for (const record of getData.result) {
      const delUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${record.id}`;
      await fetch(delUrl, { method: "DELETE", headers });
    }

    // 4. 将最新的 Top IP 批量写入该子域名的 A 记录中（实现多IP轮询）
    const syncStatus = [];
    for (const ip of topIps) {
      const addUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
      const body = {
        type: "A",
        name: subdomain,
        content: ip,
        ttl: 60,        // 60秒短缓存
        proxied: false  // 必须为灰色云朵（不经过CF代理直连）
      };
      const addRes = await fetch(addUrl, { method: "POST", headers, body: JSON.stringify(body) });
      const addData = await addRes.json();
      syncStatus.push({ ip, success: addData.success });
    }

    // 5. 刷新本地同步时间记录
    const shanghaiTime = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    await env.SPEEDTEST_KV.put("last_dns_sync_time", shanghaiTime);

    return {
      success: true,
      subdomain,
      sync_count: topIps.length,
      updated_at: shanghaiTime,
      results: syncStatus
    };

  } catch (err) {
    return { success: false, msg: "DNS同步时发生异常", error: err.message };
  }
}
