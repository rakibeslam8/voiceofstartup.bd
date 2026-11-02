/* ------------------------------------------------------------------
   Voice of Startup Bangladesh — site configuration
   Edit this file to update emails, social links and content.
------------------------------------------------------------------- */
window.VOSB = {
  site: {
    name: "Voice of Startup Bangladesh",
    short: "VOSB",
    domain: "www.voiceofstartup.bd",
    origin: "https://www.voiceofstartup.bd",
  },

  // Business emails
  emails: [
    { key: "editor",       icon: "📰", address: "editor@voiceofstartup.bd",
      bn: "সম্পাদকীয় ও নিউজ টিপস", en: "Editorial & news tips",
      useBn: "নিউজ টিপস, প্রেস রিলিজ, ফাউন্ডার স্টোরি ও লেখা পাঠানো", useEn: "News tips, press releases, founder stories and article submissions" },
    { key: "partnerships", icon: "🤝", address: "partnerships@voiceofstartup.bd",
      bn: "পার্টনারশিপ ও স্পনসরশিপ", en: "Partnerships & sponsorship",
      useBn: "বিজ্ঞাপন, স্পনসরশিপ, ইভেন্ট ও মিডিয়া পার্টনারশিপ", useEn: "Advertising, sponsorship, event and media partnerships" },
    { key: "rakib",        icon: "👤", address: "rakib@voiceofstartup.bd",
      bn: "রাকিব ইসলাম — সরাসরি যোগাযোগ", en: "Rakib Eslam — direct contact",
      useBn: "জরুরি বা ব্যক্তিগত বিষয়ে সরাসরি যোগাযোগ", useEn: "Urgent or personal matters, direct contact" },
    { key: "hello",        icon: "💬", address: "hello@voiceofstartup.bd",
      bn: "সাধারণ জিজ্ঞাসা", en: "General enquiries",
      useBn: "সাধারণ প্রশ্ন, মতামত ও সাপোর্ট", useEn: "General questions, feedback and support" },
    { key: "careers",      icon: "💼", address: "careers@voiceofstartup.bd",
      bn: "ক্যারিয়ার ও ভলান্টিয়ার", en: "Careers & volunteering",
      useBn: "জব, ইন্টার্নশিপ, ভলান্টিয়ার ও CV জমা", useEn: "Jobs, internships, volunteering and CV submissions" },
  ],

  social: {
    facebook:  "https://www.facebook.com/voiceofstartupbd",
    linkedin:  "https://www.linkedin.com/company/voiceofstartupbd/",
    youtube:   "https://www.youtube.com/@voiceofstartup-bd/",
    x:         "https://x.com/vostartupbd",
    instagram: "https://www.instagram.com/voiceofstartupbd/",
  },


  // Verified information sources (shown as text, no logos used)
  sources: [
    { short: "BIDA",   bn: "বাংলাদেশ বিনিয়োগ উন্নয়ন কর্তৃপক্ষ", en: "Bangladesh Investment Development Authority" },
    { short: "BEZA",   bn: "বাংলাদেশ অর্থনৈতিক অঞ্চল কর্তৃপক্ষ", en: "Bangladesh Economic Zones Authority" },
    { short: "BEPZA",  bn: "বাংলাদেশ রপ্তানি প্রক্রিয়াকরণ অঞ্চল কর্তৃপক্ষ", en: "Bangladesh Export Processing Zones Authority" },
    { short: "BSCIC",  bn: "বিসিক — ক্ষুদ্র ও কুটির শিল্প করপোরেশন", en: "Bangladesh Small & Cottage Industries Corporation" },
    { short: "ICT",    bn: "তথ্য ও যোগাযোগ প্রযুক্তি মন্ত্রণালয়", en: "ICT Division / Ministry" },
    { short: "BHTPA",  bn: "বাংলাদেশ হাই-টেক পার্ক কর্তৃপক্ষ", en: "Bangladesh Hi-Tech Park Authority" },
    { short: "PPPA",   bn: "পাবলিক প্রাইভেট পার্টনারশিপ অথরিটি", en: "Public Private Partnership Authority" },
  ],

  categories: [
    { id: "funding",     slug: "funding",         icon: "🏆", bn: "ফান্ডিং ও প্রতিযোগিতা", en: "Funding & Competitions" },
    { id: "founder",     slug: "founder-stories", icon: "💡", bn: "ফাউন্ডার স্টোরি",       en: "Founder Stories" },
    { id: "business",    slug: "business-policy", icon: "📈", bn: "ব্যবসা, বিনিয়োগ ও নীতিমালা", en: "Business, Investment & Policy" },
    { id: "opportunity", slug: "opportunities",   icon: "🚀", bn: "সুযোগ ও কাজের তথ্য",    en: "Opportunities & Resources" },
    { id: "tech",          slug: "technology-ai",          icon: "🤖", bn: "প্রযুক্তি ও এআই",        en: "Technology & AI" },
    { id: "market",        slug: "market-insights",        icon: "📊", bn: "মার্কেট ইনসাইট",         en: "Market Insights" },
    { id: "events",        slug: "events-workshops",       icon: "🎤", bn: "ইভেন্ট ও ওয়ার্কশপ",      en: "Events & Workshops" },
    { id: "guide",         slug: "entrepreneur-guides",    icon: "📘", bn: "উদ্যোক্তাদের গাইড",      en: "Entrepreneur Guides" },
    { id: "international", slug: "international-startups", icon: "🌍", bn: "আন্তর্জাতিক স্টার্টআপ",   en: "International Startups" },
    { id: "interview",     slug: "interviews-opinion",     icon: "🎙️", bn: "সাক্ষাৎকার ও মতামত",     en: "Interviews & Opinion" },
  ],

  // ---- Company Directory (listing, reviews, investor interest) ----
  companies: {
    fee: 1000,   // one-time listing fee in BDT (the live value is kept in the database: site_settings.listing_fee)
    industries: [
      { id: "fintech", bn: "ফিনটেক", en: "Fintech" }, { id: "ecommerce", bn: "ই-কমার্স", en: "E-commerce" },
      { id: "saas", bn: "সফটওয়্যার ও SaaS", en: "Software & SaaS" }, { id: "ai", bn: "এআই ও ডেটা", en: "AI & Data" },
      { id: "edtech", bn: "এডটেক", en: "Edtech" }, { id: "healthtech", bn: "হেলথটেক", en: "Healthtech" },
      { id: "agritech", bn: "এগ্রিটেক", en: "Agritech" }, { id: "logistics", bn: "লজিস্টিকস", en: "Logistics" },
      { id: "food", bn: "খাদ্য ও পানীয়", en: "Food & Beverage" }, { id: "fashion", bn: "ফ্যাশন ও লাইফস্টাইল", en: "Fashion & Lifestyle" },
      { id: "manufacturing", bn: "ম্যানুফ্যাকচারিং", en: "Manufacturing" }, { id: "energy", bn: "এনার্জি ও ক্লিনটেক", en: "Energy & Cleantech" },
      { id: "realestate", bn: "রিয়েল এস্টেট ও কনস্ট্রাকশন", en: "Real estate & Construction" }, { id: "media", bn: "মিডিয়া ও এন্টারটেইনমেন্ট", en: "Media & Entertainment" },
      { id: "travel", bn: "ট্রাভেল ও হসপিটালিটি", en: "Travel & Hospitality" }, { id: "services", bn: "সার্ভিস ও কনসাল্টিং", en: "Services & Consulting" },
      { id: "other", bn: "অন্যান্য", en: "Other" },
    ],
    stages: [
      { id: "idea", bn: "আইডিয়া", en: "Idea" }, { id: "prototype", bn: "প্রোটোটাইপ / MVP", en: "Prototype / MVP" },
      { id: "early_revenue", bn: "প্রাথমিক আয়", en: "Early revenue" }, { id: "growth", bn: "গ্রোথ", en: "Growth" },
      { id: "scale", bn: "স্কেল", en: "Scale-up" }, { id: "established", bn: "প্রতিষ্ঠিত ব্যবসা", en: "Established business" },
    ],
    revenueRanges: [
      { id: "none", bn: "এখনও আয় নেই", en: "No revenue yet" }, { id: "lt5", bn: "মাসে ৫ লাখ টাকার কম", en: "Under ৳5 lakh / month" },
      { id: "5to25", bn: "মাসে ৫–২৫ লাখ টাকা", en: "৳5–25 lakh / month" }, { id: "25to100", bn: "মাসে ২৫ লাখ – ১ কোটি টাকা", en: "৳25 lakh – 1 crore / month" },
      { id: "gt100", bn: "মাসে ১ কোটি টাকার বেশি", en: "Over ৳1 crore / month" },
    ],
    teamSizes: ["1-3", "4-10", "11-25", "26-50", "51-200", "200+"],
    divisions: {
      "Dhaka": ["Dhaka", "Gazipur", "Narayanganj", "Narsingdi", "Manikganj", "Munshiganj", "Tangail", "Kishoreganj", "Faridpur", "Gopalganj", "Madaripur", "Rajbari", "Shariatpur"],
      "Chattogram": ["Chattogram", "Cox's Bazar", "Cumilla", "Brahmanbaria", "Chandpur", "Feni", "Lakshmipur", "Noakhali", "Khagrachhari", "Rangamati", "Bandarban"],
      "Rajshahi": ["Rajshahi", "Bogura", "Pabna", "Sirajganj", "Natore", "Naogaon", "Chapainawabganj", "Joypurhat"],
      "Khulna": ["Khulna", "Jashore", "Satkhira", "Bagerhat", "Kushtia", "Chuadanga", "Jhenaidah", "Magura", "Meherpur", "Narail"],
      "Barishal": ["Barishal", "Bhola", "Patuakhali", "Pirojpur", "Barguna", "Jhalokati"],
      "Sylhet": ["Sylhet", "Moulvibazar", "Habiganj", "Sunamganj"],
      "Rangpur": ["Rangpur", "Dinajpur", "Kurigram", "Gaibandha", "Lalmonirhat", "Nilphamari", "Panchagarh", "Thakurgaon"],
      "Mymensingh": ["Mymensingh", "Jamalpur", "Netrokona", "Sherpur"],
    },
    docTypes: [
      { id: "trade_license", required: true,  bn: "ট্রেড লাইসেন্স", en: "Trade licence" },
      { id: "tin",           required: true,  bn: "টিআইএন সনদ", en: "TIN certificate" },
      { id: "incorporation", required: false, bn: "ইনকর্পোরেশন / পার্টনারশিপ ডিড (RJSC)", en: "Incorporation / partnership deed (RJSC)" },
      { id: "financials",    required: false, bn: "আর্থিক বিবরণী / ব্যাংক স্টেটমেন্ট", en: "Financial statements / bank statement" },
      { id: "pitch_deck",    required: false, bn: "পিচ ডেক", en: "Pitch deck" },
      { id: "other",         required: false, bn: "অন্যান্য প্রমাণপত্র", en: "Other supporting document" },
    ],
    investorTypes: [
      { id: "individual", bn: "ব্যক্তিগত বিনিয়োগকারী", en: "Individual investor" }, { id: "angel", bn: "এঞ্জেল ইনভেস্টর", en: "Angel investor" },
      { id: "vc", bn: "ভেঞ্চার ক্যাপিটাল", en: "Venture capital" }, { id: "institution", bn: "প্রতিষ্ঠান / ব্যাংক", en: "Institution / bank" },
      { id: "other", bn: "অন্যান্য", en: "Other" },
    ],
    deletionReasons: [
      { id: "not_useful", bn: "সাইটটি আমার কাজে লাগছে না", en: "The site is not useful to me" },
      { id: "privacy", bn: "গোপনীয়তা নিয়ে উদ্বেগ", en: "Privacy concerns" },
      { id: "duplicate", bn: "আমার আরেকটি অ্যাকাউন্ট আছে", en: "I have another account" },
      { id: "too_many_emails", bn: "অনেক বেশি ইমেইল/নোটিফিকেশন", en: "Too many emails / notifications" },
      { id: "found_alternative", bn: "অন্য প্ল্যাটফর্ম পেয়েছি", en: "I found another platform" },
      { id: "bad_experience", bn: "খারাপ অভিজ্ঞতা হয়েছে", en: "I had a bad experience" },
      { id: "other", bn: "অন্য কারণ", en: "Other reason" },
    ],
    // payment methods shown on the listing payment screen (the live on/off switch and numbers are in the database)
    payMethods: [
      { id: "bkash", name: "bKash", color: "#e2136e" }, { id: "nagad", name: "Nagad", color: "#f6921e" },
      { id: "rocket", name: "Rocket", color: "#8c3494" }, { id: "upay", name: "Upay", color: "#0a8f3c" },
      { id: "cellfin", name: "Cellfin", color: "#0b7a3b" }, { id: "tap", name: "Tap", color: "#d9232d" },
    ],
  },

  // ---- Backend (Supabase). Fill these two values after following ADMIN-SETUP.md ----
  // Both are PUBLIC by design (the database is protected by Row Level Security).
  // NEVER put the "service_role" key or any password here.
  supabase: {
    url: "https://hpanuojuazdqolgkafqg.supabase.co",
    anonKey: "sb_publishable_mlE074b-dObobvXT22c1SA_UChZPnJN",   // public publishable key
  },

  // Admin login: User ID "rakib" becomes rakib@<loginDomain>.
  // The same email must be created in Supabase and listed in supabase/setup.sql (is_admin).
  admin: {
    userId: "rakib",
    loginDomain: "voiceofstartup.bd",
  },
};
