#!/usr/bin/env python3
"""Regenerate sitemap.xml (run from anywhere):  python3 tools/generate_sitemap.py

Includes the main pages, the legal pages and one /article?id=... URL per post
found in js/posts.js. Submit https://voiceofstartup.bd/sitemap.xml in Google Search Console.
"""
import re, datetime, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
ORIGIN = "https://voiceofstartup.bd"
today = datetime.date.today().isoformat()

pages = [
    ("/", "daily", "1.0"),
    ("/news", "daily", "0.9"),
    ("/about", "monthly", "0.6"),
    ("/contact", "monthly", "0.6"),
    ("/careers", "monthly", "0.5"),
    ("/privacy-policy", "yearly", "0.3"),
    ("/terms-of-service", "yearly", "0.3"),
    ("/cookie-policy", "yearly", "0.3"),
    ("/refund-policy", "yearly", "0.3"),
    ("/usage-policy", "yearly", "0.3"),
]

posts_js = (ROOT / "js" / "posts.js").read_text(encoding="utf-8")
posts_js = re.sub(r"/\*.*?\*/", "", posts_js, flags=re.S)  # ignore the example in the comment
entries = []
for m in re.finditer(r'id:\s*"([^"]+)"\s*,.*?date:\s*"(\d{4}-\d{2}-\d{2})"', posts_js, flags=re.S):
    entries.append((f"/article?id={m.group(1)}", m.group(2)))

def url(loc, lastmod, freq=None, prio=None):
    out = f"  <url>\n    <loc>{ORIGIN}{loc}</loc>\n    <lastmod>{lastmod}</lastmod>\n"
    if freq: out += f"    <changefreq>{freq}</changefreq>\n"
    if prio: out += f"    <priority>{prio}</priority>\n"
    return out + "  </url>\n"

xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
for loc, freq, prio in pages:
    xml += url(loc, today, freq, prio)
for loc, d in entries:
    xml += url(loc.replace("&", "&amp;"), d, "weekly", "0.7")
xml += "</urlset>\n"
(ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")
print(f"sitemap.xml written: {len(pages)} pages + {len(entries)} posts")
