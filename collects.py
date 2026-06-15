import requests
import re
import ipaddress
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

# ==========================
# 配置
# ==========================
SOURCES = [
    # 列出所有 IP 提供源 URL（仅示例）
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
HEADERS = {"User-Agent": "Mozilla/5.0"}

# 正则匹配
IPV4_PATTERN = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
IPV6_PATTERN = re.compile(r"[A-Fa-f0-9:]{2,39}")  # 简单匹配可能含:的字符串

# 最大并发线程数
MAX_WORKERS = 5

# 抓取单个 URL 的函数
def fetch_content(url, timeout=10):
    try:
        res = requests.get(url, headers=HEADERS, timeout=timeout)
        res.raise_for_status()
        return res.text
    except Exception as e:
        print(f"[Warning] 获取 {url} 失败：{e}")
        return ""

def main():
    ipv4_set = set()
    ipv6_set = set()

    # 并发抓取所有源
    contents = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(fetch_content, url): url for url in SOURCES}
        for fut in as_completed(futures):
            text = fut.result()
            if text:
                contents.append(text)

    # 从每个内容中提取 IP
    for text in contents:
        # 提取所有 IPv4
        for ip in IPV4_PATTERN.findall(text):
            try:
                addr = ipaddress.ip_address(ip)
                if addr.version == 4:
                    ipv4_set.add(addr.compressed)
            except ValueError:
                continue

        # 提取可能的 IPv6 段（简单筛选后再验证）
        for candidate in IPV6_PATTERN.findall(text):
            try:
                addr = ipaddress.ip_address(candidate)
                if addr.version == 6:
                    ipv6_set.add(addr.compressed)
            except ValueError:
                continue

    # 排序输出
    ipv4_list = sorted(ipv4_set, key=lambda ip: ipaddress.ip_address(ip))
    ipv6_list = sorted(ipv6_set, key=lambda ip: ipaddress.ip_address(ip))

    # 写入 ipv4.txt
    with open("ipv4.txt", "w", encoding="utf-8") as f4:
        # 不写入任何文件头（用户要求去掉时间头）
        for ip in ipv4_list:
            f4.write(f"{ip}:{PORT}#{LABEL}\n")

    # 写入 ipv6.txt
    with open("ipv6.txt", "w", encoding="utf-8") as f6:
        for ip in ipv6_list:
            f6.write(f"[{ip}]:{PORT}#{LABEL}\n")

    print(f"✅ IPv4: {len(ipv4_list)} 个")
    print(f"✅ IPv6: {len(ipv6_list)} 个")

if __name__ == "__main__":
    main()
