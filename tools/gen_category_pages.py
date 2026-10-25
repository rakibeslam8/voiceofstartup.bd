#!/usr/bin/env python3
"""Generate one landing page per news category (SEO-friendly, bilingual).
Run:  python3 tools/gen_category_pages.py
Categories here must match js/config.js -> categories."""
import json, pathlib, html

ROOT = pathlib.Path(__file__).resolve().parent.parent
V = "20261014a"
ORIGIN = "https://www.voiceofstartup.bd"

CATS = [
 dict(id="funding", slug="funding", bn="ফান্ডিং ও প্রতিযোগিতা", en="Funding & Competitions",
      title="Startup Funding News Bangladesh — ফান্ডিং ও প্রতিযোগিতা",
      desc="Latest startup funding rounds, grants, VC investment and startup competition updates in Bangladesh. ফান্ডিং ও স্টার্টআপ প্রতিযোগিতার সর্বশেষ আপডেট।",
      h1bn="ফান্ডিং ও <span class='o'>প্রতিযোগিতা</span>", h1en="Funding &amp; <span class='o'>competitions</span>",
      pbn="বাংলাদেশের স্টার্টআপ ফান্ডিং রাউন্ড, গ্রান্ট, ভিসি বিনিয়োগ ও পিচ প্রতিযোগিতার সর্বশেষ যাচাইকৃত আপডেট।",
      pen="The latest verified updates on startup funding rounds, grants, VC investment and pitch competitions in Bangladesh."),
 dict(id="founder", slug="founder-stories", bn="ফাউন্ডার স্টোরি", en="Founder Stories",
      title="Bangladeshi Founder Stories — ফাউন্ডার স্টোরি | Voice of Startup Bangladesh",
      desc="Inspiring founder stories from Bangladesh's startup ecosystem — journeys, lessons and growth stories. সফল উদ্যোক্তাদের অনুপ্রেরণামূলক ফাউন্ডার স্টোরি।",
      h1bn="ফাউন্ডার <span class='g'>স্টোরি</span>", h1en="Founder <span class='g'>stories</span>",
      pbn="সফল উদ্যোক্তাদের যাত্রা, ব্যর্থতা থেকে শেখা ও সাফল্যের অনুপ্রেরণামূলক গল্প।",
      pen="Inspiring journeys of Bangladeshi founders — the struggles, lessons and breakthroughs behind their startups."),
 dict(id="business", slug="business-policy", bn="ব্যবসা, বিনিয়োগ ও নীতিমালা", en="Business, Investment & Policy",
      title="Bangladesh Business, Investment & Policy News — ব্যবসা ও নীতিমালা",
      desc="Business, investment and policy news for Bangladesh — BIDA, BEPZA, BEZA, BSCIC, ICT Division and PPP updates. ব্যবসা, বিনিয়োগ ও নীতিমালার গুরুত্বপূর্ণ খবর।",
      h1bn="ব্যবসা, বিনিয়োগ ও <span class='r'>নীতিমালা</span>", h1en="Business, investment &amp; <span class='r'>policy</span>",
      pbn="BIDA, BEPZA, BEZA, BSCIC, ICT মন্ত্রণালয় ও PPP অথরিটির সূত্রে ব্যবসা-বিনিয়োগ ও নীতিমালার খবর।",
      pen="Business, investment and policy news sourced from BIDA, BEPZA, BEZA, BSCIC, the ICT Division and the PPP Authority."),
 dict(id="opportunity", slug="opportunities", bn="সুযোগ ও কাজের তথ্য", en="Opportunities & Resources",
      title="Startup Opportunities in Bangladesh — grants, programs, jobs | VOSB",
      desc="Opportunities for new entrepreneurs in Bangladesh — grants, accelerators, fellowships, jobs and resources. নতুন উদ্যোক্তাদের জন্য কাজের তথ্য ও সুযোগ।",
      h1bn="সুযোগ ও <span class='g'>কাজের তথ্য</span>", h1en="Opportunities &amp; <span class='g'>resources</span>",
      pbn="নতুন উদ্যোক্তাদের জন্য গ্রান্ট, অ্যাক্সেলারেটর, ফেলোশিপ, চাকরি ও প্রয়োজনীয় রিসোর্স।",
      pen="Grants, accelerators, fellowships, jobs and practical resources for new entrepreneurs."),
 dict(id="tech", slug="technology-ai", bn="প্রযুক্তি ও এআই", en="Technology & AI",
      title="Bangladesh Tech & AI Startup News — প্রযুক্তি ও এআই | VOSB",
      desc="Technology and AI startup news from Bangladesh — fintech, edtech, agritech, SaaS and artificial intelligence. প্রযুক্তি ও এআই স্টার্টআপের সর্বশেষ খবর।",
      h1bn="প্রযুক্তি ও <span class='o'>এআই</span>", h1en="Technology &amp; <span class='o'>AI</span>",
      pbn="ফিনটেক, এডটেক, এগ্রিটেক, SaaS ও কৃত্রিম বুদ্ধিমত্তা — বাংলাদেশের প্রযুক্তি স্টার্টআপের খবর ও বিশ্লেষণ।",
      pen="Fintech, edtech, agritech, SaaS and artificial intelligence — news and analysis from Bangladesh's tech startups."),
 dict(id="market", slug="market-insights", bn="মার্কেট ইনসাইট", en="Market Insights",
      title="Bangladesh Startup Market Insights & Analysis — মার্কেট ইনসাইট | VOSB",
      desc="Data-driven market insights on Bangladesh's startup and business landscape — trends, reports and analysis. মার্কেট ইনসাইট ও বিশ্লেষণ।",
      h1bn="মার্কেট <span class='g'>ইনসাইট</span>", h1en="Market <span class='g'>insights</span>",
      pbn="বাংলাদেশের স্টার্টআপ ও ব্যবসার বাজারের ট্রেন্ড, রিপোর্ট ও তথ্যভিত্তিক বিশ্লেষণ।",
      pen="Trends, reports and data-backed analysis of Bangladesh's startup and business market."),
 dict(id="events", slug="events-workshops", bn="ইভেন্ট ও ওয়ার্কশপ", en="Events & Workshops",
      title="Startup Events & Workshops in Bangladesh — ইভেন্ট ও ওয়ার্কশপ | VOSB",
      desc="Upcoming startup events, summits, bootcamps, pitch days and workshops in Bangladesh. স্টার্টআপ ইভেন্ট ও ওয়ার্কশপের আপডেট।",
      h1bn="ইভেন্ট ও <span class='r'>ওয়ার্কশপ</span>", h1en="Events &amp; <span class='r'>workshops</span>",
      pbn="বাংলাদেশের স্টার্টআপ সামিট, বুটক্যাম্প, পিচ ডে ও ওয়ার্কশপের তারিখ, স্থান ও রেজিস্ট্রেশন তথ্য।",
      pen="Dates, venues and registration info for startup summits, bootcamps, pitch days and workshops in Bangladesh."),
 dict(id="guide", slug="entrepreneur-guides", bn="উদ্যোক্তাদের গাইড", en="Entrepreneur Guides",
      title="Entrepreneur Guides Bangladesh — how to start & grow a business | VOSB",
      desc="Practical guides for Bangladeshi entrepreneurs — business registration, funding, tax, hiring and growth. উদ্যোক্তাদের জন্য ধাপে ধাপে গাইড।",
      h1bn="উদ্যোক্তাদের <span class='o'>গাইড</span>", h1en="Entrepreneur <span class='o'>guides</span>",
      pbn="ব্যবসা নিবন্ধন, ফান্ডরেইজিং, ট্যাক্স, নিয়োগ ও গ্রোথ — ধাপে ধাপে ব্যবহারিক গাইড।",
      pen="Step-by-step practical guides on registration, fundraising, tax, hiring and growth."),
 dict(id="international", slug="international-startups", bn="আন্তর্জাতিক স্টার্টআপ", en="International Startups",
      title="International Startup News — আন্তর্জাতিক স্টার্টআপ | VOSB",
      desc="Global startup news and lessons for Bangladeshi founders — funding, unicorns, markets and trends worldwide. আন্তর্জাতিক স্টার্টআপের খবর।",
      h1bn="আন্তর্জাতিক <span class='g'>স্টার্টআপ</span>", h1en="International <span class='g'>startups</span>",
      pbn="বিশ্বের স্টার্টআপ জগতের খবর, ফান্ডিং ও ট্রেন্ড — বাংলাদেশি উদ্যোক্তাদের জন্য শেখার বিষয়সহ।",
      pen="Global startup news, funding and trends — with lessons that matter to Bangladeshi founders."),
 dict(id="interview", slug="interviews-opinion", bn="সাক্ষাৎকার ও মতামত", en="Interviews & Opinion",
      title="Founder Interviews & Opinion — সাক্ষাৎকার ও মতামত | VOSB",
      desc="Interviews with founders, investors and policymakers plus expert opinion on Bangladesh's startup ecosystem. সাক্ষাৎকার ও মতামত।",
      h1bn="সাক্ষাৎকার ও <span class='r'>মতামত</span>", h1en="Interviews &amp; <span class='r'>opinion</span>",
      pbn="ফাউন্ডার, বিনিয়োগকারী ও নীতিনির্ধারকদের সাক্ষাৎকার এবং স্টার্টআপ ইকোসিস্টেম নিয়ে বিশেষজ্ঞ মতামত।",
      pen="Interviews with founders, investors and policymakers, plus expert opinion on the startup ecosystem."),
]

TEMPLATE = """<!doctype html>
<html lang="bn">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <meta name="theme-color" content="#ff7522">
  <link rel="canonical" href="{origin}/{slug}">
  <meta property="og:site_name" content="Voice of Startup Bangladesh">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="bn_BD">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="{origin}/{slug}">
  <meta property="og:image" content="{origin}/assets/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@vostartupbd">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="{origin}/assets/og-image.png">
  <link rel="icon" href="/assets/favicon.png">
  <script type="application/ld+json">{ld}</script>
  <script src="/js/splash.js?v=20261025b"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Baloo+Da+2:wght@600;800&family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css?v={v}">
</head>
<body data-cat="{id}">
  <div id="site-top"></div>
  <noscript><div class="noscript-bar">Voice of Startup Bangladesh — please enable JavaScript. <a href="/">Home</a> · <a href="/news">News</a> · <a href="/about">About</a> · <a href="/contact">Contact</a> · <a href="/careers">Careers</a> · <a href="/privacy-policy">Privacy</a> · <a href="/terms-of-service">Terms</a></div></noscript>
  <main>
    <section class="page-hero"><div class="container">
      <p class="eyebrow">{icon} <span data-bn="সংবাদ বিভাগ" data-en="News section"></span></p>
      <h1 data-bn="{h1bn}" data-en="{h1en}">{h1en}</h1>
      <p data-bn="{pbn}" data-en="{pen}">{pen}</p>
    </div></section>
    <section class="section"><div class="container">
      <div class="filters" id="filters"></div>
      <div class="post-grid" id="news-list"></div>
      <p class="load-more-wrap"><button class="btn btn-outline" id="load-more" type="button" hidden>আরও দেখুন</button></p>
    </div></section>
  </main>
  <div id="site-bottom"></div>
  <script src="/js/config.js?v={v}"></script>
  <script src="/js/md.js?v={v}"></script>
  <script src="/js/api.js?v={v}"></script>
  <script src="/js/main.js?v={v}"></script>
</body>
</html>
"""

ICONS = {"funding":"🏆","founder":"💡","business":"📈","opportunity":"🚀","tech":"🤖","market":"📊","events":"🎤","guide":"📘","international":"🌍","interview":"🎙️"}

for c in CATS:
    ld = json.dumps({
        "@context": "https://schema.org", "@graph": [
            {"@type": "CollectionPage", "@id": f"{ORIGIN}/{c['slug']}#page", "url": f"{ORIGIN}/{c['slug']}",
             "name": c["title"], "description": c["desc"], "inLanguage": ["bn", "en"],
             "isPartOf": {"@id": f"{ORIGIN}/#site"}, "about": c["en"]},
            {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{ORIGIN}/"},
                {"@type": "ListItem", "position": 2, "name": "News", "item": f"{ORIGIN}/news"},
                {"@type": "ListItem", "position": 3, "name": c["en"], "item": f"{ORIGIN}/{c['slug']}"}]}
        ]}, ensure_ascii=False, separators=(",", ":"))
    q = lambda t: t.replace('"', "&quot;")
    out = TEMPLATE.format(
        title=html.escape(c["title"]), desc=html.escape(c["desc"]), origin=ORIGIN, slug=c["slug"], id=c["id"], v=V,
        icon=ICONS[c["id"]], ld=ld,
        h1bn=q(c["h1bn"]), h1en=q(c["h1en"]), pbn=q(c["pbn"]), pen=q(c["pen"]))
    # visible fallback text inside the tags must be real HTML (crawlers / no-JS)
    out = out.replace('data-en="%s">%s</h1>' % (q(c["h1en"]), q(c["h1en"])), 'data-en="%s">%s</h1>' % (q(c["h1en"]), c["h1en"]))
    out = out.replace('data-en="%s">%s</p>' % (q(c["pen"]), q(c["pen"])), 'data-en="%s">%s</p>' % (q(c["pen"]), c["pen"]))
    (ROOT / f"{c['slug']}.html").write_text(out, encoding="utf-8")
    print("wrote", c["slug"] + ".html")
