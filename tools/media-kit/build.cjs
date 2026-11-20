/* Voice of Startup Bangladesh — media kit PDF builder.
   Run:  node tools/media-kit/build.cjs      (needs the Playwright that is pre-installed in the workspace)
   Output: /media-kit-en.pdf and /media-kit-bn.pdf in the site root (served at https://www.voiceofstartup.bd/media-kit-en.pdf …).
   To refresh the kit: edit the DATA block below (numbers come from Meta Page insights screenshots + the site database), then run again.
   Never invent a number here — every figure must come from a screenshot or a query, and the "as of" date must be updated. */
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "..", "..");

/* ===================== DATA (update this block each month) ===================== */
const DATA = {
  asOf: "2026-11-20",
  fb28: { views: 1200000, viewsGrowth: "11x", engagement: 47134, engagementGrowth: "631%", follows: 3666, followsGrowth: "180%" }, // Meta page insights, last 28 days vs previous 28
  // the 9 most recent posts on the page at the time (Meta "Views" per post)
  posts: [["2026-11-16", 25461], ["2026-11-15", 79870], ["2026-11-14", 87268], ["2026-11-12", 87771], ["2026-11-11", 137068], ["2026-11-09", 4348], ["2026-11-08", 73611], ["2026-11-07", 2883], ["2026-11-06", 29030]],
  examples: [ // image, date, Meta views, reactions, comments, shares
    { img: "p-nov11.jpg", date: "2026-11-11", views: 137068, react: 537, com: 21, sh: 127, en: "Started with ৳30,000 — now exporting ৳28 crore", bn: "৩০ হাজার টাকায় ব্যবসা শুরু, এখন রপ্তানিই ২৮ কোটি টাকা" },
    { img: "p-nov12.jpg", date: "2026-11-12", views: 87771, react: 419, com: 12, sh: 97, en: "Started with ৳10,000 — now earning ৳20 lakh a month", bn: "১০ হাজার টাকায় শুরু, এখন মাসে আয় ২০ লাখ টাকা" },
    { img: "p-nov14.jpg", date: "2026-11-14", views: 87268, react: 604, com: 16, sh: 132, en: "Pineapple, banana and jute-fibre products now sold in 39 countries", bn: "আনারস, কলা ও পাটের সুতায় তৈরি পণ্য যাচ্ছে ৩৯ দেশে" },
    { img: "p-nov15.jpg", date: "2026-11-15", views: 79870, react: 432, com: 18, sh: 87, en: "Handmade scented soap from Narsingdi goes to Japan", bn: "হাতে বানানো সুগন্ধি সাবান, যাচ্ছে নরসিংদী থেকে জাপানে" },
  ],
  // first-party analytics + database, last 30 days to asOf. REAL READERS ONLY: bots/crawlers and the owner's own visits are excluded (the admin dashboard totals include them, so they look higher).
  site: { visitors30: 8286, views30: 14549, reads30: 9449, newsletter: 1413, articles: 169, articles30: 126, companies: 27, shares: 269,
    members: { founder: 12, reader: 12, investor: 2, other: 2 },
    top: [ // most-read articles, real-reader reads, all time
      { en: "Started with Tk 30,000, now exports worth Tk 28 crore", bn: "৩০ হাজার টাকায় ব্যবসা শুরু, এখন রপ্তানিই ২৮ কোটি টাকা", reads: 1868 },
      { en: "Started with Tk 30 lakh, profit of Tk 2.5 crore in three years", bn: "৩০ লাখে শুরু, তিন বছরে মুনাফা আড়াই কোটি টাকা", reads: 964 },
      { en: "Abu Manzur Saif quits government job to become a successful entrepreneur", bn: "সরকারি চাকরি ছেড়ে সফল উদ্যোক্তা আবু মঞ্জুর সাঈফ", reads: 829 },
      { en: "IDLC's SME Utsav loan: up to Tk 35 lakh without collateral", bn: "আইডিএলসির এসএমই উৎসব ঋণ: জামানত ছাড়া ৩৫ লাখ টাকা পাওয়া যাবে", reads: 778 },
      { en: "Started with Tk 10,000, now earns Tk 20 lakh a month", bn: "১০ হাজার টাকায় শুরু, এখন মাসে আয় ২০ লাখ টাকা", reads: 746 },
    ] },
  prices: [3000, 4000, 2000, 5000, null, null],   // per service, same order as the service rows (owner, 20 Nov 2026); null = custom
  founderFreeUntil: "2026-12-31",                // founder story is free until this date (introductory offer) — rebuild the kit after it passes
  followersCombined: 20000,                      // approx., all social channels combined — figure given by the owner (not from a screenshot)
  whatsapp: { show: "+880 1404-792132", wa: "8801404792132" },
  // Audience of the best post (11 Nov, 137,068 views): Meta post-details screenshots. NOT page-wide.
  aud: { post: "2026-11-11", views: 137068, viewers: 82000, nonFollowers: 96, followers: 4,
    age: [["35–44", 43.8], ["25–34", 30.3], ["45–54", 13.6], ["other", 12.3]],
    gender: { men: 76, women: 8, unknown: 16 },
    country: [["bd", 92.9], ["in", 1.8], ["other", 4.2], ["unknown", 1.1]],
    source: [["suggested", 92.5], ["followerfeed", 3.8], ["unavailable", 1.7], ["search", 0.1]] },
  // companies profiled in the VOSB directory (curated listings — NOT clients). Logos cropped from the directory screenshots.
  dir: [["pathao", "Pathao"], ["grameenphone", "Grameenphone"], ["bkash", "bKash"], ["walton", "Walton Group"], ["shikho", "Shikho"], ["nagad", "Nagad"], ["pran-rfl", "PRAN-RFL Group"], ["akij", "Akij Group"], ["aci", "ACI Limited"], ["chaldal", "Chaldal"]],
  email: "partnerships@voiceofstartup.bd",
};
/* ================================================================================= */

const sum = DATA.posts.reduce((a, p) => a + p[1], 0), max = Math.max(...DATA.posts.map((p) => p[1]));
const over70 = DATA.posts.filter((p) => p[1] >= 70000).length;
const sorted = DATA.posts.map((p) => p[1]).sort((a, b) => a - b), median = sorted[(sorted.length - 1) / 2];

const L = {
  en: {
    locale: "en-US", dir: "ltr",
    n: (x) => new Intl.NumberFormat("en-US").format(x),
    compact: (x) => (x >= 1e6 ? (x / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : x >= 1e3 ? (x / 1e3).toFixed(1).replace(/\.0$/, "") + "K" : String(x)),
    growth: (g) => "↑ " + g,
    date: (d, o) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", Object.assign({ timeZone: "UTC" }, o || { day: "numeric", month: "short" })),
    title: "Media Kit", kicker: "Bangladesh Startup & Business News", sub: "Verified insights, funding updates and founder stories",
    about_h: "Who we are",
    about: "Voice of Startup Bangladesh (VOSB) is a Bangla and English news platform for Bangladesh's startup, business and investment community. We publish funding and competition updates, founder stories, business and policy news, and practical opportunities for new entrepreneurs. Information is gathered from official sources such as BIDA, BEPZA, BEZA, BSCIC, the ICT Ministry, the Bangladesh Hi-Tech Park Authority and the PPP Authority.",
    reach_h: "Reach at a glance", fb: "Facebook page", last28: "last 28 days", web: "Website", last30: "last 30 days",
    k_views: "Views", k_eng: "Engagement", k_follows: "New follows", k_vis: "Unique visitors", k_reads: "Article reads", k_pv: "Page views", k_news: "Newsletter subscribers", k_art: "Articles published", k_co: "Company profiles",
    vsprev: "vs previous 28 days",
    p2_h: "Audience & performance", fb_h: "Facebook — the last 9 posts", fb_sub: "Views per post as reported by Meta, 6–16 Nov 2026",
    fb_sum1: "Total views", fb_sum2: "Posts above 70,000 views", fb_sum3: "Best post", fb_sum4: "Median post", fb_sum5: "Average per post",
    of: "of", web_h: "Website & newsletter", art_note: (a, b) => `${a} articles published in total, ${b} in the last 30 days`, news_note: "active subscribers", co_note: "listed in the startup directory",
    who_h: "Who reads us", who: "Entrepreneurs, investors and customers across Bangladesh who follow startup, business and funding news — in Bangla and English.",
    notes_h: "How to read these numbers", notes: [
      "Facebook figures come from Meta Page insights (28 days to " + "{ASOF}" + "). “Views” is Meta’s count of times content was shown or played — one person can view more than once. “New follows” are follows gained in the period, not total followers.",
      "Website figures are first-party analytics (30 days to {ASOF}) and count real readers only — bots, crawlers and our own team’s visits are excluded. Unique visitors are counted per browser/device.",
      "All figures are a snapshot and change daily. Growth is compared with the previous period of the same length.",
    ],
    p3_h: "Example posts", p3_sub: "Founder-story posts from our page — each with the performance Meta reported for it.",
    pv: "Views", pr: "Reactions", pc: "Comments", ps: "Shares",
    p4_h: "Ways to work with us", p4_sub: "Every paid piece is clearly labelled Sponsored.",
    th_s: "Service", th_d: "What you get", th_p: "Price", th_b: "Booking",
    quote: "Quoted per brief",
    svc: [
      ["Sponsored article", "Your brand or story as an article on the VOSB website in Bangla and English, clearly labelled Sponsored.", "Up to 10 per day"],
      ["Facebook post", "A promotional post on the Voice of Startup Bangladesh Facebook page.", "1 per day"],
      ["Founder story / interview", "An in-depth feature or interview about your founder journey.", "Date from calendar"],
      ["Event / launch coverage", "Coverage and promotion for your event, product or app launch.", "On request"],
      ["Brand collaboration", "Monthly or yearly partnership with regular content and promotion.", "On request"],
      ["Something else", "Have another idea or need? Tell us and we will propose a plan.", "On request"],
    ],
    how_h: "How booking works", how: ["Choose a service", "Pick a publish date from the booking calendar (up to 60 days ahead)", "Send your brief — we review it and confirm the price", "Pay, and we publish on your date"],
    c_h: "Get in touch", c_book: "Book online (free account to order)", c_mail: "Partnerships",
    asof: "As of", page: "Page",
    also: "Also on Instagram, LinkedIn, YouTube and X.",
    top_h: "Most-read stories", reads: "reads",
    mem: (m, n, sh) => `${n} registered members — ${m.founder} founders, ${m.reader} readers, ${m.investor} investors, ${m.other} other · ${sh} article shares`,
    price_note: (a, b) => `Our packages range from ৳${a} to ৳${b}, depending on the service and format. The exact price is confirmed for each brief.`,
    cap_web: "Website: last 30 days, real readers only (bots, crawlers and our own team excluded).",
    combined: (n) => ` About ${n} followers combined across all our channels.`,
    pct: (x) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(x) + "%",
    aud_h: "Who sees our content", aud_sub: (d, v) => `Audience of our best-performing post (${d} — 137,068 views, ${v} viewers), as reported by Meta. Other posts may differ.`,
    age_h: "Age", gen_h: "Gender", cty_h: "Country", src_h: "Where the views came from",
    men: "Men", women: "Women", unknown: "Unknown", other: "Other", bd: "Bangladesh", in: "India",
    suggested: "Suggested", followerfeed: "Follower feed", unavailable: "Unavailable", search: "Search",
    disc: (nf) => `${nf}% of this post’s viewers were not yet following the page — it reached new people.`,
    dir_h: "Companies in our directory", dir_sub: "VOSB profiles Bangladesh’s leading and fast-growing companies. These are editorial listings in our company directory — not clients or partners, and inclusion is not an endorsement. Logos belong to their respective owners.",
    free_until: "Free until 31 December 2026", custom_disc: "Depends on the discussion", custom_q: "Custom quote",
    units: ["per article", "per post", "per feature", "per event"],
    price_note2: "All prices are in Bangladeshi taka (৳), per item. The exact scope is confirmed from your brief.",
    cov_h: "What we cover", cov: ["Latest news", "Funding & competitions", "Founder stories", "Business & policy", "Opportunities for new entrepreneurs", "Startup & company directory"],
    why_h: "Why partner with us",
    why: (f) => [["Proven reach", `${f} Facebook views in 28 days, up 11x on the previous 28 days.`], ["Bilingual", "Sponsored articles are published in both Bangla and English."], ["Trusted sources", "Information is gathered from official government sources, and paid content is clearly labelled."]],
  },
  bn: {
    locale: "bn-BD", dir: "ltr",
    n: (x) => new Intl.NumberFormat("bn-BD").format(x),
    compact: (x) => { const f = (v, u) => new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 1 }).format(v) + " " + u; return x >= 1e7 ? f(x / 1e7, "কোটি") : x >= 1e5 ? f(x / 1e5, "লাখ") : x >= 1e3 ? f(x / 1e3, "হাজার") : new Intl.NumberFormat("bn-BD").format(x); },
    growth: (g) => "↑ " + new Intl.NumberFormat("bn-BD").format(parseInt(g, 10)) + (g.endsWith("x") ? " গুণ" : "%"),
    date: (d, o) => new Date(d + "T00:00:00Z").toLocaleDateString("bn-BD", Object.assign({ timeZone: "UTC" }, o || { day: "numeric", month: "long" })),
    title: "মিডিয়া কিট", kicker: "বাংলাদেশের স্টার্টআপ ও ব্যবসার খবর", sub: "যাচাইকৃত তথ্য, ফান্ডিং আপডেট ও ফাউন্ডার স্টোরি",
    about_h: "আমরা কারা",
    about: "ভয়েস অব স্টার্টআপ বাংলাদেশ (VOSB) বাংলাদেশের স্টার্টআপ, ব্যবসা ও বিনিয়োগ সমাজের জন্য বাংলা ও ইংরেজি দুই ভাষার নিউজ প্ল্যাটফর্ম। আমরা ফান্ডিং ও প্রতিযোগিতার আপডেট, ফাউন্ডার স্টোরি, ব্যবসা ও নীতিমালার খবর এবং নতুন উদ্যোক্তাদের জন্য কাজের তথ্য ও সুযোগ প্রকাশ করি। তথ্য সংগ্রহ করা হয় BIDA, BEPZA, BEZA, BSCIC, আইসিটি মন্ত্রণালয়, বাংলাদেশ হাই-টেক পার্ক কর্তৃপক্ষ ও PPP অথরিটির মতো সরকারি সংস্থার সূত্র থেকে।",
    reach_h: "এক নজরে রিচ", fb: "ফেসবুক পেজ", last28: "গত ২৮ দিন", web: "ওয়েবসাইট", last30: "গত ৩০ দিন",
    k_views: "ভিউ", k_eng: "এনগেজমেন্ট", k_follows: "নতুন ফলো", k_vis: "ইউনিক ভিজিটর", k_reads: "আর্টিকেল রিড", k_pv: "পেজ ভিউ", k_news: "নিউজলেটার সাবস্ক্রাইবার", k_art: "প্রকাশিত আর্টিকেল", k_co: "কোম্পানি প্রোফাইল",
    vsprev: "আগের ২৮ দিনের তুলনায়",
    p2_h: "অডিয়েন্স ও পারফরম্যান্স", fb_h: "ফেসবুক — সর্বশেষ ৯টি পোস্ট", fb_sub: "মেটা-র দেওয়া প্রতি পোস্টের ভিউ, ৬–১৬ নভেম্বর ২০২৬",
    fb_sum1: "মোট ভিউ", fb_sum2: "৭০ হাজারের বেশি ভিউ", fb_sum3: "সেরা পোস্ট", fb_sum4: "মধ্যমান (মিডিয়ান)", fb_sum5: "গড় প্রতি পোস্টে",
    of: "/", web_h: "ওয়েবসাইট ও নিউজলেটার", art_note: (a, b) => `মোট ${new Intl.NumberFormat("bn-BD").format(a)}টি আর্টিকেল, গত ৩০ দিনে ${new Intl.NumberFormat("bn-BD").format(b)}টি`, news_note: "সক্রিয় সাবস্ক্রাইবার", co_note: "স্টার্টআপ ডিরেক্টরিতে তালিকাভুক্ত",
    who_h: "আমাদের পাঠক", who: "বাংলাদেশের উদ্যোক্তা, বিনিয়োগকারী ও গ্রাহক — যারা বাংলা ও ইংরেজিতে স্টার্টআপ, ব্যবসা ও ফান্ডিংয়ের খবর অনুসরণ করেন।",
    notes_h: "সংখ্যাগুলো কীভাবে পড়বেন", notes: [
      "ফেসবুকের তথ্য মেটা পেজ ইনসাইটস থেকে ({ASOF} পর্যন্ত ২৮ দিন)। “ভিউ” মানে মেটা যতবার কনটেন্ট দেখিয়েছে বা চালিয়েছে — একই ব্যক্তি একাধিকবার দেখতে পারেন। “নতুন ফলো” মানে ওই সময়ে যুক্ত হওয়া ফলো, মোট ফলোয়ার নয়।",
      "ওয়েবসাইটের তথ্য আমাদের নিজস্ব অ্যানালিটিক্স থেকে ({ASOF} পর্যন্ত ৩০ দিন) এবং শুধু প্রকৃত পাঠক গোনা হয় — বট, ক্রলার ও আমাদের নিজস্ব টিমের ভিজিট বাদ। ইউনিক ভিজিটর গোনা হয় ব্রাউজার/ডিভাইস অনুযায়ী।",
      "সংখ্যাগুলো একটি নির্দিষ্ট দিনের চিত্র এবং প্রতিদিন বদলায়। প্রবৃদ্ধি আগের সমান সময়ের সাথে তুলনা করা।",
    ],
    p3_h: "উদাহরণ পোস্ট", p3_sub: "আমাদের পেজের ফাউন্ডার-স্টোরি পোস্ট — প্রতিটির নিচে মেটা-র দেওয়া পারফরম্যান্স।",
    pv: "ভিউ", pr: "রিঅ্যাকশন", pc: "কমেন্ট", ps: "শেয়ার",
    p4_h: "আমাদের সাথে কাজের উপায়", p4_sub: "প্রতিটি পেইড কনটেন্টে স্পষ্টভাবে “Sponsored” লেবেল থাকে।",
    th_s: "সেবা", th_d: "যা পাবেন", th_p: "দাম", th_b: "বুকিং",
    quote: "ব্রিফ অনুযায়ী কোটেশন",
    svc: [
      ["স্পনসর্ড আর্টিকেল", "আপনার ব্র্যান্ড বা গল্প নিয়ে লেখা আর্টিকেল VOSB ওয়েবসাইটে বাংলা ও ইংরেজি দুই ভাষায় প্রকাশ হবে। “Sponsored” লেবেল সহ।", "প্রতিদিন সর্বোচ্চ ১০টি"],
      ["ফেসবুক পোস্ট", "Voice of Startup Bangladesh ফেসবুক পেজে প্রমোশনাল পোস্ট।", "প্রতিদিন ১টি"],
      ["ফাউন্ডার স্টোরি / ইন্টারভিউ", "আপনার উদ্যোক্তা-যাত্রা নিয়ে বিস্তারিত ফিচার বা ইন্টারভিউ।", "ক্যালেন্ডার থেকে তারিখ"],
      ["ইভেন্ট / লঞ্চ কভারেজ", "আপনার ইভেন্ট, প্রোডাক্ট বা অ্যাপ লঞ্চের কভারেজ ও প্রচার।", "অনুরোধে"],
      ["ব্র্যান্ড কোলাবরেশন", "মাসিক বা বার্ষিক পার্টনারশিপ — নিয়মিত কনটেন্ট ও প্রচার।", "অনুরোধে"],
      ["অন্য কোনো আইডিয়া", "আপনার আলাদা আইডিয়া বা প্রয়োজন থাকলে জানান — আমরা প্রস্তাব দেব।", "অনুরোধে"],
    ],
    how_h: "বুকিং যেভাবে কাজ করে", how: ["একটি সেবা বেছে নিন", "বুকিং ক্যালেন্ডার থেকে প্রকাশের তারিখ নিন (৬০ দিন পর্যন্ত আগাম)", "আপনার ব্রিফ পাঠান — আমরা দেখে দাম নিশ্চিত করব", "পেমেন্ট করুন, আমরা আপনার তারিখে প্রকাশ করব"],
    c_h: "যোগাযোগ", c_book: "অনলাইনে বুকিং (অর্ডারে বিনামূল্যে অ্যাকাউন্ট লাগবে)", c_mail: "পার্টনারশিপ",
    asof: "তথ্য হালনাগাদ", page: "পৃষ্ঠা",
    also: "ইনস্টাগ্রাম, লিংকডইন, ইউটিউব ও এক্স-এও আছি।",
    top_h: "সবচেয়ে বেশি পড়া আর্টিকেল", reads: "রিড",
    mem: (m, n, sh) => { const b = new Intl.NumberFormat("bn-BD").format; return `${b(n)} জন নিবন্ধিত সদস্য — ${b(m.founder)} জন ফাউন্ডার, ${b(m.reader)} জন পাঠক, ${b(m.investor)} জন বিনিয়োগকারী, ${b(m.other)} জন অন্যান্য · ${b(sh)}টি আর্টিকেল শেয়ার`; },
    price_note: (a, b) => `আমাদের প্যাকেজ ৳${a} থেকে ৳${b} টাকার মধ্যে — সেবা ও ফরম্যাট অনুযায়ী। প্রতিটি ব্রিফ দেখে সঠিক দাম নিশ্চিত করা হয়।`,
    cap_web: "ওয়েবসাইট: গত ৩০ দিন, শুধু প্রকৃত পাঠক (বট, ক্রলার ও আমাদের নিজস্ব টিমের ভিজিট বাদ)।",
    combined: (n) => ` সব চ্যানেল মিলিয়ে প্রায় ${n} ফলোয়ার।`,
    pct: (x) => new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 1 }).format(x) + "%",
    aud_h: "আমাদের কনটেন্ট কারা দেখেন", aud_sub: (d, v) => `আমাদের সবচেয়ে ভালো পারফর্ম করা পোস্টের (${d} — ১,৩৭,০৬৮ ভিউ, ${v} দর্শক) অডিয়েন্স, মেটা-র দেওয়া তথ্য অনুযায়ী। অন্য পোস্টে ভিন্ন হতে পারে।`,
    age_h: "বয়স", gen_h: "লিঙ্গ", cty_h: "দেশ", src_h: "ভিউ কোথা থেকে এসেছে",
    men: "পুরুষ", women: "নারী", unknown: "অজানা", other: "অন্যান্য", bd: "বাংলাদেশ", in: "ভারত",
    suggested: "সাজেস্টেড", followerfeed: "ফলোয়ার ফিড", unavailable: "অজানা", search: "সার্চ",
    disc: (nf) => `এই পোস্টের ${new Intl.NumberFormat("bn-BD").format(nf)}% দর্শক তখনো পেজ ফলো করতেন না — অর্থাৎ নতুন মানুষের কাছে পৌঁছেছে।`,
    dir_h: "আমাদের ডিরেক্টরির কোম্পানি", dir_sub: "VOSB বাংলাদেশের শীর্ষস্থানীয় ও দ্রুত বর্ধনশীল কোম্পানির প্রোফাইল প্রকাশ করে। এগুলো আমাদের কোম্পানি ডিরেক্টরির সম্পাদকীয় তালিকা — ক্লায়েন্ট বা পার্টনার নয়, এবং তালিকাভুক্তি কোনো সমর্থন নয়। লোগো সংশ্লিষ্ট মালিকদের।",
    free_until: "৩১ ডিসেম্বর ২০২৬ পর্যন্ত ফ্রি", custom_disc: "আলোচনা সাপেক্ষে", custom_q: "কাস্টম কোটেশন",
    units: ["প্রতি আর্টিকেল", "প্রতি পোস্ট", "প্রতি ফিচার", "প্রতি ইভেন্ট"],
    price_note2: "সব দাম বাংলাদেশি টাকায় (৳), প্রতিটির জন্য। আপনার ব্রিফ অনুযায়ী কাজের পরিধি নিশ্চিত করা হয়।",
    cov_h: "আমরা যা কভার করি", cov: ["সর্বশেষ সংবাদ", "ফান্ডিং ও প্রতিযোগিতা", "ফাউন্ডার স্টোরি", "ব্যবসা ও নীতিমালা", "নতুন উদ্যোক্তাদের জন্য সুযোগ", "স্টার্টআপ ও কোম্পানি ডিরেক্টরি"],
    why_h: "কেন আমাদের সাথে",
    why: (f) => [["প্রমাণিত রিচ", `গত ২৮ দিনে ফেসবুকে ${f} ভিউ — আগের ২৮ দিনের চেয়ে ১১ গুণ বেশি।`], ["দুই ভাষায়", "স্পনসর্ড আর্টিকেল বাংলা ও ইংরেজি দুই ভাষাতেই প্রকাশ হয়।"], ["নির্ভরযোগ্য সূত্র", "তথ্য সংগ্রহ করা হয় সরকারি সূত্র থেকে, আর পেইড কনটেন্টে স্পষ্ট লেবেল থাকে।"]],
  },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function html(lang) {
  const t = L[lang], asof = t.date(DATA.asOf, { day: "numeric", month: "long", year: "numeric" });
  const foot = (n) => `<div class="foot"><span>Voice of Startup Bangladesh · ${esc(t.title)}</span><span>${t.asof}: ${asof}</span><span>${t.page} ${t.n(n)}/${t.n(5)}</span></div>`;
  const stat = (v, k, g, sub) => `<div class="stat"><b>${v}</b><span>${k}</span>${g ? `<i>${g}${sub ? " " + esc(sub) : ""}</i>` : ""}</div>`;
  const f = DATA.fb28, s = DATA.site;
  const bars = DATA.posts.map(([d, v]) => `<div class="bar"><span class="bd">${t.date(d)}</span><div class="bt"><div class="bf${v >= 70000 ? " hi" : ""}" style="width:${Math.max(1.5, (v / max) * 100)}%"></div></div><span class="bv">${t.n(v)}</span></div>`).join("");
  const ex = DATA.examples.map((e) => `<figure class="ex"><img src="img/${e.img}" alt=""><figcaption><div class="et">${esc(lang === "bn" ? e.bn : e.en)}</div><div class="ed">${t.date(e.date, { day: "numeric", month: "long", year: "numeric" })}</div>
    <div class="em"><span><b>${t.n(e.views)}</b>${t.pv}</span><span><b>${t.n(e.react)}</b>${t.pr}</span><span><b>${t.n(e.com)}</b>${t.pc}</span><span><b>${t.n(e.sh)}</b>${t.ps}</span></div></figcaption></figure>`).join("");
  const priceCell = (i) => { const a = DATA.prices[i]; if (a == null) return `<b>${esc(i === 4 ? t.custom_disc : t.custom_q)}</b>`; return `<b>৳${t.n(a)}</b><small>${esc(t.units[i])}</small>${i === 2 ? `<em>${esc(t.free_until)}</em>` : ""}`; };
  const rows = t.svc.map((r, i) => `<tr><td class="sn">${esc(r[0])}</td><td>${esc(r[1])}</td><td class="pq">${priceCell(i)}</td><td>${esc(r[2])}</td></tr>`).join("");
  const A = DATA.aud, hb = (label, v) => `<div class="hb"><span>${esc(label)}</span><div class="bt"><div class="bf hi" style="width:${v}%"></div></div><b>${t.pct(v)}</b></div>`;
  const bnd = (x) => (lang === "bn" ? String(x).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[d]) : x);
  const lab = (k) => bnd(L[lang][k] !== undefined ? L[lang][k] : k);
  const audHtml = `<div class="cards2">
    <div class="card"><h4>${esc(t.age_h)}</h4>${A.age.map(([k, v]) => hb(lab(k), v)).join("")}</div>
    <div class="card"><h4>${esc(t.gen_h)}</h4><div class="stk"><i style="width:${A.gender.men}%;background:#0b2f66"></i><i style="width:${A.gender.women}%;background:#ff7522"></i><i style="width:${A.gender.unknown}%;background:#9ec9f2"></i></div>
      <div class="leg"><span><u style="background:#0b2f66"></u>${esc(t.men)} <b>${t.pct(A.gender.men)}</b></span><span><u style="background:#ff7522"></u>${esc(t.women)} <b>${t.pct(A.gender.women)}</b></span><span><u style="background:#9ec9f2"></u>${esc(t.unknown)} <b>${t.pct(A.gender.unknown)}</b></span></div></div>
    <div class="card"><h4>${esc(t.cty_h)}</h4>${A.country.map(([k, v]) => hb(lab(k), v)).join("")}</div>
    <div class="card"><h4>${esc(t.src_h)}</h4>${A.source.map(([k, v]) => hb(lab(k), v)).join("")}</div></div>
    <div class="ins">${esc(t.disc(A.nonFollowers))}</div>`;
  const dirHtml = `<div class="logos">${DATA.dir.map(([k, n]) => `<div class="lg"><img src="logos/${k}.png" alt=""><span>${esc(n)}</span></div>`).join("")}</div>`;
  const how = t.how.map((h, i) => `<li><b>${t.n(i + 1)}</b><span>${esc(h)}</span></li>`).join("");
  const notes = t.notes.map((n) => `<li>${esc(n.replace(/\{ASOF\}/g, asof))}</li>`).join("");
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>Voice of Startup Bangladesh — ${esc(t.title)}</title><style>
@font-face{font-family:"Hind Siliguri";font-weight:400;src:url(fonts/hind-siliguri-bengali-400-normal.woff2);unicode-range:U+0951-0952,U+0964-0965,U+0980-09FE,U+200C-200D,U+20B9,U+25CC}
@font-face{font-family:"Hind Siliguri";font-weight:600;src:url(fonts/hind-siliguri-bengali-600-normal.woff2);unicode-range:U+0951-0952,U+0964-0965,U+0980-09FE,U+200C-200D,U+20B9,U+25CC}
@font-face{font-family:"Hind Siliguri";font-weight:700;src:url(fonts/hind-siliguri-bengali-700-normal.woff2);unicode-range:U+0951-0952,U+0964-0965,U+0980-09FE,U+200C-200D,U+20B9,U+25CC}
@font-face{font-family:"Hind Siliguri";font-weight:400;src:url(fonts/hind-siliguri-latin-400-normal.woff2);unicode-range:U+0000-00FF,U+2000-206F,U+2190-2193,U+20AC}
@font-face{font-family:"Hind Siliguri";font-weight:600;src:url(fonts/hind-siliguri-latin-600-normal.woff2);unicode-range:U+0000-00FF,U+2000-206F,U+2190-2193,U+20AC}
@font-face{font-family:"Hind Siliguri";font-weight:700;src:url(fonts/hind-siliguri-latin-700-normal.woff2);unicode-range:U+0000-00FF,U+2000-206F,U+2190-2193,U+20AC}
@page{size:A4;margin:0}
:root{--o:#ff7522;--od:#e55f0f;--os:#fff1e8;--k:#0b0b0b;--t:#141414;--m:#5d5d5d;--l:#e7e7e7;--g:#0b8a4b}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{font-family:"Hind Siliguri","Noto Sans",system-ui,sans-serif;color:var(--t);font-size:10.5pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;padding:15mm 15mm 17mm}
.page:last-child{page-break-after:auto}
.foot{position:absolute;left:15mm;right:15mm;bottom:8mm;display:flex;justify-content:space-between;font-size:8pt;color:var(--m);border-top:1px solid var(--l);padding-top:2.5mm}
h2{font-size:17pt;line-height:1.25;font-weight:700;margin-bottom:1.5mm}
h3{font-size:11.5pt;font-weight:700;margin:0 0 1.5mm}
.sub{color:var(--m);font-size:9.5pt;margin-bottom:5mm}
.bar-top{height:3mm;background:var(--o);position:absolute;left:0;right:0;top:0}
/* cover */
.cover{background:linear-gradient(180deg,#fff 0,#fff 58%,var(--os) 100%)}
.cover .logo{height:24mm;margin-top:4mm}
.cover .kick{margin-top:14mm;color:var(--od);font-weight:700;font-size:11pt;letter-spacing:.04em;text-transform:uppercase}
.cover h1{font-size:34pt;line-height:1.1;font-weight:700;margin:2mm 0 3mm}
.cover .lead{font-size:14pt;color:var(--m);max-width:150mm;line-height:1.4}
.cover .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4mm;margin-top:12mm}
.stat{background:#fff;border:1px solid var(--l);border-top:3px solid var(--o);border-radius:3mm;padding:4mm 4mm 3.5mm}
.stat b{display:block;font-size:22pt;line-height:1.15;font-weight:700}
.stat span{display:block;font-size:9.5pt;color:var(--m)}
.stat i{display:block;font-style:normal;font-size:8.5pt;color:var(--g);font-weight:600;margin-top:1mm}
.cap{font-size:9pt;color:var(--m);margin:3mm 0 0}
.about{margin-top:10mm;max-width:165mm}
.about p{margin-top:1mm}
.also{margin-top:5mm;font-size:9.5pt;color:var(--m)}
/* page 2 */
.two{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
.sum{display:grid;grid-template-columns:repeat(5,1fr);gap:2.5mm;margin:3mm 0 4mm}
.sum div{background:var(--os);border-radius:2.5mm;padding:2.5mm 2.5mm}.sum b{display:block;font-size:13pt;line-height:1.2}.sum span{font-size:8.5pt;color:var(--m)}
.bar{display:grid;grid-template-columns:20mm 1fr 20mm;align-items:center;gap:2mm;margin:.8mm 0;font-size:9pt}
.bd{color:var(--m)}.bv{text-align:right;font-weight:600}
.bt{height:4.2mm;background:#f1f1f1;border-radius:1mm;overflow:hidden}.bf{height:100%;background:#f5b48a}.bf.hi{background:var(--o)}
.sec{margin-top:5mm}
.top{list-style:none;margin-top:1.5mm}.top li{display:grid;grid-template-columns:6mm 1fr auto;gap:2mm;align-items:baseline;padding:1.2mm 0;border-bottom:1px solid var(--l);font-size:9.5pt}.top b{color:var(--od)}.top em{font-style:normal;font-weight:600;color:var(--t)}
.pnote{background:var(--os);border-left:3px solid var(--o);border-radius:0 2mm 2mm 0;padding:3mm 4mm;font-size:10.5pt;font-weight:600;margin-top:1mm}
.web{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin-top:2mm}.web .stat{padding:2.5mm 4mm 2.2mm}.web .stat b{font-size:17pt}
.small{font-size:8.5pt;color:var(--m);margin-top:1mm}
.notes{margin-top:4mm;border-top:1px solid var(--l);padding-top:3mm}.notes ul{padding-left:4.5mm;font-size:8.5pt;color:var(--m)}.notes li{margin:1mm 0}
/* page 3 */
.exg{display:grid;grid-template-columns:1fr 1fr;gap:5mm 5mm;margin-top:1mm}
.ex{border:1px solid var(--l);border-radius:3mm;overflow:hidden;background:#fff}
.ex img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;object-position:50% 0}
.ex figcaption{padding:2.5mm 3.5mm 3mm}
.et{font-weight:700;font-size:10pt;line-height:1.35}.ed{font-size:8.5pt;color:var(--m);margin-bottom:2mm}
.em{display:grid;grid-template-columns:repeat(4,1fr);gap:1.5mm}.em span{font-size:7.5pt;color:var(--m);line-height:1.25}.em b{display:block;font-size:11pt;color:var(--t)}
/* page 4 */
table{width:100%;border-collapse:collapse;font-size:10pt;margin-top:2mm}
th{background:var(--k);color:#fff;text-align:left;font-weight:600;padding:2mm 2.5mm;font-size:9pt}
td{border-bottom:1px solid var(--l);padding:1.7mm 2.5mm;vertical-align:top}
td.sn{font-weight:700;width:34mm}td.pq{width:36mm;color:var(--od);font-weight:600}
td:last-child{width:28mm}
.how{list-style:none;display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-top:2mm}
.how li{background:var(--os);border-radius:2.5mm;padding:3mm}.how b{display:inline-flex;width:6mm;height:6mm;border-radius:50%;background:var(--o);color:#fff;align-items:center;justify-content:center;font-size:9pt;margin-bottom:1.5mm}.how span{display:block;font-size:9pt;line-height:1.4}
.cov{display:grid;grid-template-columns:1fr 1fr;gap:1.5mm 6mm;margin-top:2mm;list-style:none}.cov li{font-size:10.5pt;padding-left:5mm;position:relative}.cov li:before{content:"";position:absolute;left:0;top:2.6mm;width:2.2mm;height:2.2mm;border-radius:50%;background:var(--o)}
.why{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin-top:2mm}.why div{border:1px solid var(--l);border-top:3px solid var(--o);border-radius:2.5mm;padding:2.8mm 3.5mm}.why b{display:block;font-size:11pt;margin-bottom:1mm}.why span{font-size:9.5pt;color:var(--m);line-height:1.45}
.cards2{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-top:1mm}.card{border:1px solid var(--l);border-radius:3mm;padding:4mm 4.5mm}.card h4{font-size:10.5pt;margin-bottom:2mm}
.hb{display:grid;grid-template-columns:27mm 1fr 14mm;gap:2mm;align-items:center;font-size:9.5pt;margin:1.6mm 0}.hb b{text-align:right}.hb .bt{height:3.6mm}
.stk{display:flex;height:5.5mm;border-radius:1.5mm;overflow:hidden;margin:1mm 0 2mm}.stk i{display:block;height:100%}.leg{font-size:8.5pt;color:var(--m);display:flex;gap:4mm;flex-wrap:wrap}.leg b{color:var(--t)}.leg u{display:inline-block;width:2.4mm;height:2.4mm;border-radius:50%;margin-right:1mm;text-decoration:none}
.ins{margin-top:4mm;background:var(--os);border-left:3px solid var(--o);border-radius:0 2mm 2mm 0;padding:3mm 4mm;font-size:10pt;font-weight:600}
.logos{display:grid;grid-template-columns:repeat(5,1fr);gap:4mm 3mm;margin-top:2.5mm}.lg{text-align:center;font-size:8.5pt;line-height:1.25}.lg img{width:21mm;height:21mm;border-radius:14%;border:1px solid var(--l);display:block;margin:0 auto 1.5mm;object-fit:cover}
td.pq b{display:block;font-size:11pt;color:var(--t)}td.pq small{display:block;font-size:8.5pt;color:var(--m);font-weight:400}td.pq em{display:block;font-style:normal;font-size:8.5pt;color:var(--g);font-weight:700;margin-top:.5mm}
.contact{margin-top:4mm;background:var(--k);color:#fff;border-radius:3mm;padding:4mm 6mm;display:grid;grid-template-columns:1fr 1fr;gap:4mm}
.contact h3{color:#fff}.contact a{color:#ffb98c;text-decoration:none}.contact p{font-size:9.5pt;margin-top:1mm}
</style></head><body>

<section class="page cover"><div class="bar-top"></div>
  <img class="logo" src="../../assets/logo.png" alt="Voice of Startup Bangladesh">
  <div class="kick">${esc(t.kicker)}</div><h1>${esc(t.title)}</h1><div class="lead">${esc(t.sub)}</div>
  <div class="grid">
    ${stat(t.compact(f.views), `${t.k_views} · ${t.fb}`, t.growth(f.viewsGrowth), "")}
    ${stat(t.n(f.engagement), `${t.k_eng} · ${t.fb}`, t.growth(f.engagementGrowth), "")}
    ${stat(t.n(f.follows), `${t.k_follows} · ${t.fb}`, t.growth(f.followsGrowth), "")}
  </div>
  <div class="grid" style="margin-top:4mm">
    ${stat(t.n(s.visitors30), `${t.k_vis} · ${t.web}`, "", "")}
    ${stat(t.n(s.reads30), `${t.k_reads} · ${t.web}`, "", "")}
    ${stat(t.n(s.newsletter), t.k_news, "", "")}
  </div>
  <p class="cap">${esc(t.fb)}, ${esc(t.last28)} (${esc(t.vsprev)}). ${esc(t.cap_web)}</p>
  <div class="about"><h3>${esc(t.about_h)}</h3><p>${esc(t.about)}</p><p class="also">${esc(t.also)}${esc(t.combined(t.n(DATA.followersCombined)))}</p></div>
  <div class="about" style="margin-top:8mm"><h3>${esc(t.cov_h)}</h3><ul class="cov">${t.cov.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>
  ${foot(1)}</section>

<section class="page"><div class="bar-top"></div>
  <h2>${esc(t.p2_h)}</h2><p class="sub">${esc(t.who)}</p>
  <h3>${esc(t.fb_h)}</h3><p class="small" style="margin:0 0 2mm">${esc(t.fb_sub)}</p>
  <div class="sum"><div><b>${t.n(sum)}</b><span>${esc(t.fb_sum1)}</span></div><div><b>${t.n(Math.round(sum / DATA.posts.length))}</b><span>${esc(t.fb_sum5)}</span></div><div><b>${t.n(median)}</b><span>${esc(t.fb_sum4)}</span></div><div><b>${t.n(max)}</b><span>${esc(t.fb_sum3)}</span></div><div><b>${t.n(over70)} ${t.of} ${t.n(DATA.posts.length)}</b><span>${esc(t.fb_sum2)}</span></div></div>
  ${bars}
  <div class="sec"><h3>${esc(t.web_h)} <span style="font-weight:400;color:var(--m);font-size:9pt">· ${esc(t.last30)}</span></h3>
    <div class="web">${stat(t.n(s.visitors30), t.k_vis, "", "")}${stat(t.n(s.views30), t.k_pv, "", "")}${stat(t.n(s.reads30), t.k_reads, "", "")}</div>
    <div class="web">${stat(t.n(s.newsletter), t.k_news, "", "")}${stat(t.n(s.articles), t.k_art, "", "")}${stat(t.n(s.companies), t.k_co, "", "")}</div>
    <p class="small">${esc(t.art_note(s.articles, s.articles30))} · ${esc(t.news_note)} · ${esc(t.co_note)}</p></div>
  <div class="sec"><h3>${esc(t.top_h)}</h3><ol class="top">${s.top.map((x, i) => `<li><b>${t.n(i + 1)}</b><span>${esc(lang === "bn" ? x.bn : x.en)}</span><em>${t.n(x.reads)} ${esc(t.reads)}</em></li>`).join("")}</ol>
    <p class="small">${esc(t.mem(s.members, s.members.founder + s.members.reader + s.members.investor + s.members.other, s.shares))}</p></div>
  <div class="notes"><h3>${esc(t.notes_h)}</h3><ul>${notes}</ul></div>
  ${foot(2)}</section>

<section class="page"><div class="bar-top"></div>
  <h2>${esc(t.aud_h)}</h2><p class="sub">${esc(t.aud_sub(t.date(A.post, { day: "numeric", month: "long", year: "numeric" }), t.compact(A.viewers)))}</p>
  ${audHtml}
  <div class="sec" style="margin-top:7mm"><h3>${esc(t.dir_h)}</h3><p class="small" style="margin:0 0 1mm">${esc(t.dir_sub)}</p>${dirHtml}</div>
  ${foot(3)}</section>

<section class="page"><div class="bar-top"></div>
  <h2>${esc(t.p3_h)}</h2><p class="sub">${esc(t.p3_sub)}</p>
  <div class="exg">${ex}</div>
  ${foot(4)}</section>

<section class="page"><div class="bar-top"></div>
  <h2>${esc(t.p4_h)}</h2><p class="sub">${esc(t.p4_sub)}</p>
  <div class="pnote">${esc(t.price_note2)}</div>
  <table><thead><tr><th>${esc(t.th_s)}</th><th>${esc(t.th_d)}</th><th>${esc(t.th_p)}</th><th>${esc(t.th_b)}</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="sec"><h3>${esc(t.how_h)}</h3><ol class="how">${how}</ol></div>
  <div class="sec"><h3>${esc(t.why_h)}</h3><div class="why">${t.why(t.compact(f.views)).map((w) => `<div><b>${esc(w[0])}</b><span>${esc(w[1])}</span></div>`).join("")}</div></div>
  <div class="contact"><div><h3>${esc(t.c_h)}</h3><p>${esc(t.c_mail)}: <a href="mailto:${DATA.email}">${DATA.email}</a></p><p>WhatsApp: <a href="https://wa.me/${DATA.whatsapp.wa}">${DATA.whatsapp.show}</a></p><p>www.voiceofstartup.bd</p></div>
    <div><h3>${esc(t.c_book)}</h3><p><a href="https://www.voiceofstartup.bd/pr">www.voiceofstartup.bd/pr</a></p><p>facebook.com/voiceofstartupbd</p></div></div>
  ${foot(5)}</section>
</body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  for (const lang of ["en", "bn"]) {
    const tmp = path.join(__dirname, `_tmp-${lang}.html`);
    fs.writeFileSync(tmp, html(lang));
    const page = await browser.newPage();
    await page.goto("file://" + tmp); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
    const out = path.join(ROOT, `media-kit-${lang}.pdf`);
    await page.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
    await page.close(); fs.unlinkSync(tmp);
    console.log("wrote", out, (fs.statSync(out).size / 1024).toFixed(0) + " KB");
  }
  await browser.close();
})();
