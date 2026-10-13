/* ------------------------------------------------------------------
   Voice of Startup Bangladesh — site configuration
   Edit this file to update emails, social links and content.
------------------------------------------------------------------- */
window.VOSB = {
  site: {
    name: "Voice of Startup Bangladesh",
    short: "VOSB",
    domain: "voiceofstartup.bd",
    origin: "https://voiceofstartup.bd",
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
    instagram: "https://www.instagram.com/voiceofstartupbd/",
    linkedin:  "https://www.linkedin.com/company/voiceofstartupbd/",
    youtube:   "https://www.youtube.com/@voiceofstartup-bd/",
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
  ],

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
