export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 1. 从 KV 中读取 GitHub Actions 写入的测速数据
    // 这里的 SPEEDTEST_KV 必须和你在设置里绑定的变量名一致
    const rawData = await env.SPEEDTEST_KV.get("cf_top10_ips");
    
    if (!rawData) {
      return new Response("未在 KV 库中找到测速数据，请检查 GitHub Actions 是否成功运行并写入 cf_top10_ips 键名。", { 
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    // 2. 解析数据行
    const lines = rawData.trim().split("\n");
    const ipList = lines.map(line => {
      // 兼容格式解析。标准格式如：192.168.1.1:443 | 延迟:25.4ms
      const parts = line.split(" | 延迟:");
      const ipPort = parts[0] ? parts[0].trim() : "";
      const latency = parts[1] ? parts[1].replace("ms", "").trim() : "未知";
      const [ip, port] = ipPort.split(":");
      return { ip, port, latency, ipPort };
    });

    // 3. 路由分支：API 接口 (访问 域名/api)
    if (url.pathname === "/api") {
      // 按照要求输出格式：IP:端口#优选-延迟ms （加上延迟后缀方便你在客户端识别哪个节点更快）
      const apiOutput = ipList.map((item, index) => `${item.ipPort}#优选-${item.latency}ms`).join("\n");
      
      // 如果你不需要延迟后缀，只要纯粹的 #优选，可以解开下面这行的注释并注释掉上面那行：
      // const apiOutput = ipList.map(item => `${item.ipPort}#优选`).join("\n");

      // 如果客户端请求 ?b64=1，则输出 Base64 编码后的内容（部分订阅工具需要）
      if (url.searchParams.get("b64") === "1") {
        return new Response(btoa(unescape(encodeURIComponent(apiOutput))), {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" }
        });
      }

      return new Response(apiOutput, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" }
      });
    }

    // 4. 路由分支：前端 HTML 展示 (访问主页)
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
        <title>Cloudflare 优选 IP 监控面板</title>
        <style>
            :root { --bg: #0f172a; --panel: #1e293b; --text: #f8fafc; --accent: #38bdf8; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; display: flex; justify-content: center; }
            .container { width: 100%; max-width: 800px; margin-top: 40px; }
            h2 { font-weight: 600; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
            .card { background: var(--panel); border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); padding: 24px; margin-bottom: 20px; }
            .api-box { display: flex; align-items: center; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; font-size: 14px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.05); }
            .api-label { background: var(--accent); color: var(--bg); font-weight: bold; padding: 2px 6px; border-radius: 4px; margin-right: 12px; font-size: 12px; }
            .api-url { font-family: monospace; flex-grow: 1; overflow-x: auto; white-space: nowrap; }
            .btn { background: rgba(255,255,255,0.1); border: none; color: white; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; }
            .btn:hover { background: rgba(255,255,255,0.2); }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; text-align: left; }
            th, td { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
            th { color: #94a3b8; font-size: 14px; font-weight: 500; }
            .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
            .text-gray { color: #94a3b8; }
            .text-light-gray { color: #64748b; }
            .rank-badge { display: inline-block; width: 24px; height: 24px; line-height: 24px; text-align: center; background: rgba(255,255,255,0.05); border-radius: 50%; font-size: 12px; font-weight: bold; }
            .top-three .rank-badge { background: #eab308; color: #0f172a; }
            .latency-badge { background: rgba(34, 197, 94, 0.15); color: #4ade80; padding: 4px 8px; border-radius: 6px; font-size: 13px; font-weight: 600; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>⚡ Cloudflare 优选 IP 面板</h2>
            
            <div class="card">
                <div class="api-box">
                    <span class="api-label">PLAIN API</span>
                    <div class="api-url" id="apiUrl">${url.origin}/api</div>
                    <button class="btn" onclick="copyText('apiUrl')">复制</button>
                </div>
                <div class="api-box">
                    <span class="api-label">BASE64 API</span>
                    <div class="api-url" id="apiB64Url">${url.origin}/api?b64=1</div>
                    <button class="btn" onclick="copyText('apiB64Url')">复制</button>
                </div>
            </div>

            <div class="card" style="padding: 12px 0;">
                <table>
                    <thead>
                        <tr>
                            <th width="80">排名</th>
                            <th>IP 地址</th>
                            <th>端口</th>
                            <th>平均延迟</th>
                            <th>API 预览样式</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        </div>
        <script>
            function copyText(id) {
                const text = document.getElementById(id).innerText;
                navigator.clipboard.writeText(text).then(() => {
                    alert('链接已成功复制到剪贴板！');
                });
            }
        </script>
    </body>
    </html>
    `;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
};
