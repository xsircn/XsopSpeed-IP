import requests
import re
import os
import ipaddress
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

# ========================
# 配置
# ========================

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

HEADERS = {
    "User-Agent": "Mozilla/5.0"
}

# 正则
IPV4 = re.compile(
    r'\b(?:\d{1,3}\.){3}\d{1,3}\b'
)

IPV6 = re.compile(
    r'(?<![:\w])(?:[a-fA-F0-9]{0,4}:){2,7}[a-fA-F0-9]{0,4}(?![:\w])'
)

# ========================
# 删除旧文件
# ========================

for f in ("ipv4.txt", "ipv6.txt"):
    try:
        os.remove(f)
    except:
        pass


# ========================
# 抓取函数
# ========================

def fetch(url):

    try:
        r = requests.get(
            url,
            headers=HEADERS,
            timeout=8
        )

        r.raise_for_status()

        return r.text

    except Exception as e:
        print(f"失败: {url}")
        return ""


# ========================
# 并发抓取
# ========================

print("开始抓取...")

with ThreadPoolExecutor(max_workers=12) as pool:
    contents = list(pool.map(fetch, SOURCES))


# ========================
# 提取IP
# ========================

ipv4_set = set()
ipv6_set = set()

for text in contents:

    for ip in IPV4.findall(text):

        try:
            if ipaddress.ip_address(ip).version == 4:
                ipv4_set.add(ip)

        except:
            pass

    for ip in IPV6.findall(text):

        try:
            obj = ipaddress.ip_address(ip)

            if obj.version == 6:
                ipv6_set.add(obj.compressed)

        except:
            pass


# ========================
# 时间
# ========================

ts = (
    datetime.utcnow()
    + timedelta(hours=8)
).strftime("%Y%m%d_%H:%M")


# ========================
# 写文件
# ========================

with open(
    "ipv4.txt",
    "w",
    encoding="utf-8"
) as f:

    f.write(
        f"ipv4.list.updated.at#Upd{ts}\n"
    )

    for ip in sorted(ipv4_set):
        f.write(
            f"{ip}:{PORT}#{LABEL}\n"
        )


with open(
    "ipv6.txt",
    "w",
    encoding="utf-8"
) as f:

    f.write(
        f"ipv6.list.updated.at#Upd{ts}\n"
    )

    for ip in sorted(ipv6_set):
        f.write(
            f"[{ip}]:{PORT}#{LABEL}\n"
        )

print()
print(f"IPv4：{len(ipv4_set)}")
print(f"IPv6：{len(ipv6_set)}")
print("完成")
