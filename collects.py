import requests
import re
import ipaddress
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

# 来源列表
SOURCES = [
    "https://api.uouin.com/cloudflare.html",
    "https://ip.164746.xyz",
    "https://ipdb.api.030101.xyz/?type=bestcf",
    "https://www.wetest.vip/page/cloudflare/address_v6.html",
    "https://ipdb.api.030101.xyz/?type=bestcfv6",
    "https://cf.090227.xyz/CloudFlareYes",
    "https://ip.haogege.xyz",
    "https://vps789.com/openApi/cfIpApi",
    "https://www.wetest.vip/page/cloudflare/address_v4.html",
    "https://addressesapi.090227.xyz/ct",
    "https://addressesapi.090227.xyz/cmcc-ipv6",
    "https://raw.githubusercontent.com/xingpingcn/enhanced-FaaS-in-China/refs/heads/main/Cf.json"
]

PORT = "443"
LABEL = "官方优选"
TIMEOUT = 8
RETRIES = 3
MAX_WORKERS = 8

# 正则表达式：IPv4 精确匹配，IPv6 使用宽泛匹配再通过 ipaddress 校验
ipv4_regex = re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b')
ipv6_regex = re.compile(r'[0-9A-Fa-f:]{2,}')

def fetch_url(url):
    """尝试多次获取 URL 内容，失败时返回空串。"""
    for attempt in range(1, RETRIES + 1):
        try:
            r = requests.get(url, timeout=TIMEOUT)
            r.raise_for_status()
            return r.text
        except Exception as e:
            print(f"第 {attempt} 次尝试失败：{url} -> {e}")
    print(f"错误: 无法获取 {url} ({RETRIES} 次尝试后)")
    return ""

print("开始并发抓取源...")

contents = []
with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
    futures = {executor.submit(fetch_url, url): url for url in SOURCES}
    for future in as_completed(futures):
        data = future.result()
        if data:
            contents.append(data)

ipv4_set = set()
ipv6_set = set()

for text in contents:
    # 提取 IPv4
    for ip in ipv4_regex.findall(text):
        try:
            addr = ipaddress.ip_address(ip)
            if addr.version == 4:
                ipv4_set.add(addr.exploded)
        except:
            continue
    # 提取 IPv6
    for cand in ipv6_regex.findall(text):
        if ':' not in cand or cand == '::':
            continue
        try:
            addr = ipaddress.ip_address(cand)
            if addr.version == 6:
                ipv6_set.add(addr.compressed)
        except:
            continue

# 排序和写入
ts = (datetime.utcnow() + timedelta(hours=8)).strftime("%Y%m%d_%H:%M")
with open("ipv4.txt", "w", encoding="utf-8") as f4:
    f4.write(f"ipv4.list.updated.at#Upd{ts}\n")
    for ip in sorted(ipv4_set, key=lambda x: tuple(map(int, x.split('.')))):
        f4.write(f"{ip}:{PORT}#{LABEL}\n")

with open("ipv6.txt", "w", encoding="utf-8") as f6:
    f6.write(f"ipv6.list.updated.at#Upd{ts}\n")
    for ip in sorted(ipv6_set):
        f6.write(f"[{ip}]:{PORT}#{LABEL}\n")

print(f"完成。IPv4 共 {len(ipv4_set)} 条；IPv6 共 {len(ipv6_set)} 条。")
if not ipv4_set and not ipv6_set:
    print("错误：未提取到任何 IP，退出。")
    exit(1)
