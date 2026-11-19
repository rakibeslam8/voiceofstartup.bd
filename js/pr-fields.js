/* Voice of Startup Bangladesh — PR / promotion: shared wording for the brief form (pr.js) and the admin order view (admin-pr.js).
   The database accepts exactly these brief keys (see pr_submit_order); everything is stored as plain text. */
(function () {
  "use strict";
  /* key: [bn label, en label, type, placeholder bn, placeholder en, options [[value, bn, en]]] */
  const F = {
    name: ["আপনার নাম", "Your name", "text"],
    phone: ["মোবাইল নম্বর", "Mobile number", "tel", "01XXXXXXXXX", "01XXXXXXXXX"],
    email: ["ইমেইল", "Email", "email", "name@company.com", "name@company.com"],
    brand: ["ব্র্যান্ড / কোম্পানির নাম", "Brand or company name", "text"],
    website: ["ওয়েবসাইট (ঐচ্ছিক)", "Website (optional)", "url", "https://", "https://"],
    social_url: ["সোশ্যাল পেজের লিংক", "Social page link", "url", "https://facebook.com/…", "https://facebook.com/…"],
    what: ["কী প্রচার করতে চান?", "What do you want to promote?", "textarea", "আপনার পণ্য, সেবা, ইভেন্ট বা গল্প সম্পর্কে লিখুন (কমপক্ষে ২০ অক্ষর)।", "Tell us about your product, service, event or story (at least 20 characters)."],
    goal: ["মূল লক্ষ্য", "Main goal", "select", "", "", [["Brand awareness", "ব্র্যান্ড পরিচিতি", "Brand awareness"], ["Leads / sales", "লিড / বিক্রি", "Leads / sales"], ["App downloads / sign-ups", "অ্যাপ ডাউনলোড / সাইন-আপ", "App downloads / sign-ups"], ["Hiring", "নিয়োগ", "Hiring"], ["Event / launch", "ইভেন্ট / লঞ্চ", "Event / launch"], ["Other", "অন্য", "Other"]]],
    audience: ["টার্গেট অডিয়েন্স", "Target audience", "text", "যেমন: ঢাকার তরুণ উদ্যোক্তা", "e.g. young founders in Dhaka"],
    lang: ["ভাষা", "Language", "select", "", "", [["bn", "বাংলা", "Bangla"], ["en", "ইংরেজি", "English"], ["both", "বাংলা ও ইংরেজি দুটোই", "Both Bangla & English"]]],
    date: ["পছন্দের প্রকাশের তারিখ", "Preferred publish date", "date"],
    key_points: ["মূল পয়েন্ট / বার্তা", "Key points / message", "textarea", "যে বিষয়গুলো অবশ্যই থাকতে হবে", "What must be included"],
    assets: ["লোগো, ছবি বা ভিডিওর লিংক", "Links to logo, images or videos", "textarea", "Google Drive বা অন্য ফোল্ডারের লিংক", "Google Drive or any folder link"],
    content_by: ["কনটেন্ট কে লিখবে?", "Who writes the content?", "select", "", "", [["vosb", "VOSB লিখবে", "VOSB writes it"], ["client", "আমি নিজে দেব", "I will provide it"]]],
    article_link: ["রেফারেন্স লিংক", "Reference link", "url", "https://", "https://"],
    keywords: ["কিওয়ার্ড (ঐচ্ছিক)", "Keywords (optional)", "text", "কমা দিয়ে লিখুন", "Separate with commas"],
    concept: ["ভিডিওর আইডিয়া / কনসেপ্ট", "Video idea / concept", "textarea", "কী দেখাতে চান, কী বলতে চান", "What to show and say"],
    footage: ["ফুটেজ", "Footage", "select", "", "", [["vosb", "VOSB শুট করবে", "VOSB shoots it"], ["client", "আমি ফুটেজ দেব", "I provide the footage"], ["mix", "দুটোই", "A mix of both"]]],
    duration: ["আনুমানিক দৈর্ঘ্য", "Approx. length", "select", "", "", [["15-30s", "১৫–৩০ সেকেন্ড", "15–30 sec"], ["30-60s", "৩০–৬০ সেকেন্ড", "30–60 sec"], ["60-90s", "৬০–৯০ সেকেন্ড", "60–90 sec"]]],
    location: ["লোকেশন", "Location", "text", "যেমন: ঢাকা, গুলশান", "e.g. Dhaka, Gulshan"],
    budget: ["আপনার বাজেট (ঐচ্ছিক)", "Your budget (optional)", "text", "যেমন: ৳২০,০০০", "e.g. ৳20,000"],
    event_date: ["ইভেন্ট / ক্যাম্পেইনের তারিখ", "Event / campaign date", "date"],
    venue: ["ভেন্যু", "Venue", "text"],
    prize: ["পুরস্কার", "Prize", "text", "কী কী দেবেন", "What you will give away"],
    handles: ["ট্যাগ করার পেজ / হ্যান্ডেল", "Pages / handles to tag", "text", "@yourpage", "@yourpage"],
    notes: ["আরও কিছু জানানোর থাকলে", "Anything else we should know", "textarea"],
  };
  const CORE = ["name", "phone", "email", "brand", "website"];
  const SETS = {
    writing: ["goal", "lang", "audience", "content_by", "key_points", "article_link", "keywords", "assets", "date"],
    post: ["goal", "lang", "key_points", "handles", "assets", "date"],
    reel: ["goal", "concept", "footage", "duration", "location", "assets", "date"],
    event: ["goal", "event_date", "venue", "key_points", "assets", "date"],
    giveaway: ["goal", "prize", "handles", "event_date", "budget", "key_points", "date"],
    hiring: ["key_points", "location", "article_link", "assets", "date"],
    top_story: ["article_link", "goal", "date"],
    media: ["goal", "lang", "assets", "date", "budget"],
    partner: ["goal", "audience", "budget", "key_points", "date"],
    other: ["goal", "budget", "key_points", "date"],
  };
  const SET_OF = { article: "writing", founder_story: "writing", press_release: "writing", research: "writing", post: "post", reel: "reel", event: "event", giveaway: "giveaway", hiring: "hiring", top_story: "top_story", newsletter: "media", banner: "media", combo: "partner", collab: "partner", other: "other" };
  /* label overrides for a few services */
  const OVR = {
    hiring: { article_link: ["চাকরির বিজ্ঞপ্তি / আবেদনের লিংক", "Job post / apply link"], key_points: ["পদ ও যোগ্যতা", "Positions and requirements"] },
    top_story: { article_link: ["কোন আর্টিকেল?", "Which article? (link)"] },
    banner: { assets: ["ব্যানারের ডিজাইন বা লিংক", "Banner design or link"] },
  };
  const CATS = [["all", "সব", "All"], ["content", "কনটেন্ট", "Content"], ["video", "ভিডিও", "Video"], ["campaign", "ক্যাম্পেইন", "Campaigns"], ["partner", "পার্টনারশিপ", "Partnerships"], ["other", "অন্যান্য", "More"]];
  const ORDER = {
    new: ["wait", "গৃহীত", "Received"], confirmed: ["ok", "নিশ্চিত", "Confirmed"], in_progress: ["wait", "কাজ চলছে", "In progress"],
    delivered: ["ok", "সম্পন্ন", "Delivered"], cancelled: ["draft", "বাতিল", "Cancelled"], rejected: ["bad", "গৃহীত হয়নি", "Not accepted"],
  };
  const PAY = { none: ["draft", "পেমেন্ট বাকি", "Payment due"], pending: ["wait", "পেমেন্ট যাচাই চলছে", "Checking payment"], verified: ["ok", "পেমেন্ট সম্পন্ন ✓", "Paid ✓"], rejected: ["bad", "পেমেন্ট গৃহীত হয়নি", "Payment not accepted"] };
  const ERR = {
    service_unavailable: ["এই সেবাটি এখন পাওয়া যাচ্ছে না।", "This service is not available right now."],
    campaign_unavailable: ["ফ্রি ক্যাম্পেইনের স্লট শেষ বা ক্যাম্পেইন শেষ হয়ে গেছে।", "The free campaign has ended or has no slots left."],
    campaign_used: ["আপনি এই ফ্রি ক্যাম্পেইনে আগেই অংশ নিয়েছেন।", "You have already joined this free campaign."],
    not_for_quote: ["এই সেবার দাম ঠিক করার পর কুপন ব্যবহার করা যাবে।", "Coupons can be used once the price of this service is set."],
    coupon_invalid: ["কুপন কোডটি সঠিক নয়।", "This coupon code is not valid."],
    coupon_not_started: ["এই কুপন এখনো চালু হয়নি।", "This coupon is not active yet."],
    coupon_expired: ["এই কুপনের মেয়াদ শেষ।", "This coupon has expired."],
    coupon_not_for_service: ["এই কুপন এই সেবায় প্রযোজ্য নয়।", "This coupon does not apply to this service."],
    coupon_min_amount: ["কুপনটির জন্য আরও বেশি অর্ডার মূল্য লাগবে।", "This coupon needs a higher order value."],
    coupon_used_up: ["এই কুপনের ব্যবহারের সীমা শেষ।", "This coupon has been fully used."],
    coupon_already_used: ["আপনি এই কুপন আগেই ব্যবহার করেছেন।", "You have already used this coupon."],
    date_full: ["এই তারিখটি এইমাত্র বুক হয়ে গেছে — অন্য তারিখ বেছে নিন।", "That date has just been booked — please pick another date."],
    date_invalid: ["তারিখটি বুক করা যাবে না — ক্যালেন্ডার থেকে একটি খালি তারিখ বেছে নিন।", "That date cannot be booked — pick a free date from the calendar."],
    dates_required: ["প্রতিটি আইটেমের জন্য একটি প্রকাশের তারিখ বেছে নিন।", "Please choose a publish date for every item."],
    field_required: ["একটি প্রয়োজনীয় তথ্য বাকি আছে।", "A required detail is missing."],
    field_invalid: ["একটি তথ্য সঠিক নয় — আবার দেখুন।", "One of the details is not valid — please check it."],
  };
  window.VOSB_PRF = { F, CORE, SETS, SET_OF, OVR, CATS, ORDER, PAY, ERR };
})();
