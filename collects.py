import requests, re, ipaddress
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

# IP 源列表
SOURCES = [
    'https://api.uouin.com/cloudflare.html',
    'https://ip.164746.xyz',
    'https://ipdb.api.030101.xyz/?type=bestcf',
    'https://www.wetest.vip/page/cloudflare/address_v6.html',
    'https://ipdb.api.030101.xyz/?type=bestcfv6',
    'https://cf.090227.xyz/CloudFlareYes',
    'https://ip.haogege.xyz',
    'https://vps789.com/openApi/cfIpApi',
    'https://www.wetest.vip/page/cloudflare/address_v4.html',
    'https://addressesapi.090227.xyz/ct',
    'https://addressesapi.090227.xyz/cmcc-ipv6',
    'https://raw.githubusercontent.com/xingpingcn/enhanced-FaaS-in-China/refs/heads/main/Cf.json'
]

PORT = "443"
LABEL = "官方优选"

ipv4_pattern = re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b')
ipv6_pattern = re.compile(r'[0-9A-Fa-f:]{2,39}')

# 获取内容函数
def fetch(url):
    try:
        res = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=8)
        res.raise_for_status()
        return res.text
    except Exception as e:
        print(f"[Warning] Failed to fetch {url}: {e}")
        return ""

# 并发获取所有源内容
with ThreadPoolExecutor(max_workers=len(SOURCES)) as executor:
    contents = list(executor.map(fetch, SOURCES))

ipv4_set = set()
ipv6_set = set()

# 提取 IP
for text in contents:
    # IPv4
    for ip in ipv4_pattern.findall(text):
        try:
            obj = ipaddress.ip_address(ip)
            if obj.version == 4:
                ipv4_set.add(str(obj))
        except ValueError:
            continue
    # IPv6
    for cand in ipv6_pattern.findall(text):
        try:
            obj = ipaddress.ip_address(cand)
            if obj.version == 6:
                ipv6_set.add(obj.compressed)
        except ValueError:
            continue

# 当前时间，使用 Asia/Singapore 时区（UTC+8）
ts = (datetime.utcnow() + timedelta(hours=8)).strftime("%Y%m%d_%H:%M")

# 写入 ipv4.txt
with open('ipv4.txt', 'w', encoding='utf-8') as f:
    f.write(f"ipv4.list.updated.at#Upd{ts}\n")
    for ip in sorted(ipv4_set):
        f.write(f"{ip}:{PORT}#{LABEL}\n")

# 写入 ipv6.txt
with open('ipv6.txt', 'w', encoding='utf-8') as f:
    f.write(f"ipv6.list.updated.at#Upd{ts}\n")
    for ip in sorted(ipv6_set):
        f.write(f"[{ip}]:{PORT}#{LABEL}\n")

print(f"IPv4 地址数量：{len(ipv4_set)}")
print(f"IPv6 地址数量：{len(ipv6_set)}")
print("采集完成。")
