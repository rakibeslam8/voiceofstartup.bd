/* ------------------------------------------------------------------
   Posts data — add real, verified stories here (newest anywhere; the
   site sorts by date). Leave the array empty to show the
   "first updates coming soon" state.

   cat:    funding | founder | business | opportunity
   source: short name of the official source (BIDA, BEPZA, BEZA, BSCIC,
           ICT, BHTPA, PPPA) or VOSB for original reporting
   date:   YYYY-MM-DD

   Example entry (copy, edit, and remove the comment markers):

   {
     id: "short-url-friendly-id",
     cat: "funding",
     date: "2026-10-12",
     source: "BIDA",
     title:   { bn: "বাংলা শিরোনাম", en: "English headline" },
     excerpt: { bn: "এক-দুই লাইনের সারসংক্ষেপ", en: "One or two line summary" },
     body:    { bn: ["অনুচ্ছেদ ১", "অনুচ্ছেদ ২"], en: ["Paragraph 1", "Paragraph 2"] },
   },

   After adding posts, run:  python3 tools/generate_sitemap.py
------------------------------------------------------------------- */
window.VOSB_POSTS = [];
