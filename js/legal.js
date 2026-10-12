/* Legal pages content — Voice of Startup Bangladesh (bilingual).
   Rendered by renderLegal() in main.js. Edit text here; the pages update everywhere. */
(function () {
  const L = (bn, en) => ({ bn, en });
  const EMAIL = "hello@voiceofstartup.bd";

  window.VOSB_LEGAL = {
    updated: "2026-10-12",

    /* ------------------------------------------------------------ */
    privacy: {
      title: L("গোপনীয়তা নীতি", "Privacy Policy"),
      intro: L(
        "Voice of Startup Bangladesh (“VOSB”, “আমরা”) আপনার গোপনীয়তাকে গুরুত্ব দেয়। এই নীতিতে ব্যাখ্যা করা হয়েছে voiceofstartup.bd ওয়েবসাইট ব্যবহার করলে আমরা কোন তথ্য সংগ্রহ করি, কেন করি এবং আপনার কী অধিকার আছে।",
        "Voice of Startup Bangladesh (“VOSB”, “we”, “us”) respects your privacy. This policy explains what information we collect when you use voiceofstartup.bd, why we collect it, and what rights you have."
      ),
      sections: [
        { h: L("আমরা কারা", "Who we are"),
          p: [L("VOSB বাংলাদেশের স্টার্টআপ, ব্যবসা ও বিনিয়োগ বিষয়ক একটি নিউজ ও মিডিয়া প্ল্যাটফর্ম। এই নীতি সংক্রান্ত যেকোনো বিষয়ে আমাদের সাথে যোগাযোগের ঠিকানা: " + EMAIL + "।", "VOSB is a news and media platform covering startups, business and investment in Bangladesh. For anything related to this policy, contact us at " + EMAIL + ".")] },
        { h: L("আমরা কোন তথ্য সংগ্রহ করি", "Information we collect"),
          p: [L("এই ওয়েবসাইটে অ্যাকাউন্ট, লগইন বা অনলাইন পেমেন্ট নেই। আমরা সীমিত পরিসরে নিচের তথ্য পেতে পারি:", "This website has no accounts, logins or online payments. We may receive limited information as follows:")],
          ul: [
            L("আপনি যে তথ্য আমাদের পাঠান: যোগাযোগ ফর্ম, নিউজলেটার সাবস্ক্রিপশন বা ইমেইলের মাধ্যমে আপনার নাম, ইমেইল ঠিকানা, বার্তা এবং (ক্যারিয়ারের ক্ষেত্রে) সিভি বা সংযুক্ত ফাইল। ফর্মগুলো আপনার নিজের ইমেইল অ্যাপ খুলে বার্তা তৈরি করে; আপনি “সেন্ড” করলেই কেবল তা আমাদের কাছে পৌঁছায়।", "Information you send us: your name, email address, message and (for careers) CV or attachments, via the contact form, newsletter sign-up or email. Our forms open your own email app with a pre-filled message; it only reaches us when you press send."),
            L("প্রযুক্তিগত তথ্য: ওয়েবসাইট হোস্টিং প্রদানকারী (GitHub Pages) সার্ভার লগ হিসেবে আইপি ঠিকানা, ব্রাউজার ও ডিভাইসের ধরন, দেখা পেজ এবং সময় রেকর্ড করতে পারে।", "Technical data: our hosting provider (GitHub Pages) may record server logs such as IP address, browser and device type, pages requested and timestamps."),
            L("পছন্দ: আপনার নির্বাচিত ভাষা (বাংলা/ইংরেজি) আপনার ব্রাউজারেই সংরক্ষিত থাকে; তা আমাদের কাছে পাঠানো হয় না।", "Preferences: your chosen language (Bangla/English) is stored in your own browser and is not sent to us."),
          ] },
        { h: L("কীভাবে ও কেন আমরা তথ্য ব্যবহার করি", "How and why we use information"),
          ul: [
            L("আপনার প্রশ্ন, নিউজ টিপস, পার্টনারশিপ বা আবেদনের উত্তর দিতে।", "To reply to your questions, news tips, partnership enquiries or job applications."),
            L("আপনি অনুরোধ করলে নিউজলেটার ও আপডেট পাঠাতে।", "To send newsletters and updates if you ask for them."),
            L("ওয়েবসাইট নিরাপদ রাখতে, অপব্যবহার প্রতিরোধ করতে এবং পারফরম্যান্স উন্নত করতে।", "To keep the website secure, prevent abuse and improve performance."),
            L("প্রযোজ্য আইনি বাধ্যবাধকতা পালন করতে।", "To comply with applicable legal obligations."),
          ],
          p2: [L("আমরা আপনার ব্যক্তিগত তথ্য বিক্রি করি না।", "We do not sell your personal information.")] },
        { h: L("আইনি ভিত্তি", "Legal basis"),
          p: [L("আমরা আপনার সম্মতি (যেমন ইমেইল পাঠানো বা নিউজলেটারে সাবস্ক্রাইব করা), আপনার অনুরোধ পূরণ এবং আমাদের বৈধ স্বার্থ (ওয়েবসাইটের নিরাপত্তা ও উন্নয়ন) এর ভিত্তিতে তথ্য প্রক্রিয়া করি।", "We process information based on your consent (for example sending us an email or subscribing to the newsletter), to fulfil your request, and on our legitimate interests (securing and improving the website).")] },
        { h: L("তথ্য শেয়ার", "Sharing of information"),
          p: [L("আমরা আপনার তথ্য কেবল প্রয়োজনীয় সেবা প্রদানকারীদের সাথে শেয়ার করি, যেমন:", "We share information only with service providers we need, such as:")],
          ul: [
            L("ওয়েব হোস্টিং: GitHub, Inc. (GitHub Pages)।", "Web hosting: GitHub, Inc. (GitHub Pages)."),
            L("ইমেইল সেবা: আমাদের ব্যবসায়িক ইমেইল (@voiceofstartup.bd) পরিচালনাকারী প্রদানকারী।", "Email services: the provider that operates our business email (@voiceofstartup.bd)."),
            L("ফন্ট সেবা: Google Fonts (আপনার ব্রাউজার থেকে সরাসরি Google-এ অনুরোধ যায়, ফলে আপনার আইপি ঠিকানা Google পেতে পারে)।", "Fonts: Google Fonts (your browser requests fonts directly from Google, which may therefore receive your IP address)."),
          ],
          p2: [L("আইনের নির্দেশে বা আমাদের অধিকার রক্ষায় প্রয়োজন হলে আমরা তথ্য প্রকাশ করতে পারি।", "We may disclose information where required by law or to protect our rights.")] },
        { h: L("তৃতীয় পক্ষের লিংক ও সোশ্যাল মিডিয়া", "Third-party links and social media"),
          p: [L("আমাদের সাইটে Facebook, Instagram, LinkedIn, YouTube ও সরকারি সংস্থাসহ অন্যান্য সাইটের লিংক থাকতে পারে। সেসব সাইটের গোপনীয়তা নীতি ও কার্যক্রমের জন্য আমরা দায়ী নই; লিংকে ক্লিক করার আগে তাদের নীতি দেখে নিন।", "Our site may link to other sites, including Facebook, Instagram, LinkedIn, YouTube and government bodies. We are not responsible for their privacy practices; please review their policies before you click.")] },
        { h: L("তথ্য সংরক্ষণের সময়", "Retention"),
          p: [L("ইমেইলে পাঠানো তথ্য আমরা যতদিন প্রয়োজন (উত্তর দেওয়া, আবেদন বিবেচনা, আইনি বা হিসাবরক্ষণ প্রয়োজন) ততদিন রাখি। নিউজলেটার সাবস্ক্রিপশন আপনি বাতিল করতে না চাওয়া পর্যন্ত থাকে। সিভি সাধারণত সর্বোচ্চ ১২ মাস রাখা হয়, আপনি আগে মুছতে বললে মুছে দেওয়া হয়।", "We keep information sent by email for as long as needed (to reply, to consider an application, or for legal and accounting reasons). Newsletter subscriptions last until you unsubscribe. CVs are generally kept for up to 12 months, or deleted sooner on request.")] },
        { h: L("নিরাপত্তা", "Security"),
          p: [L("আমরা তথ্য সুরক্ষায় যুক্তিসঙ্গত প্রযুক্তিগত ও সাংগঠনিক ব্যবস্থা নিই (যেমন HTTPS)। তবে ইন্টারনেটে কোনো ব্যবস্থাই শতভাগ নিরাপদ নয়।", "We take reasonable technical and organisational measures to protect information (such as HTTPS). However, no method of transmission over the internet is 100% secure.")] },
        { h: L("আপনার অধিকার", "Your rights"),
          p: [L("প্রযোজ্য আইন অনুযায়ী আপনি আমাদের কাছে থাকা আপনার তথ্য দেখতে, সংশোধন বা মুছে ফেলতে, সম্মতি প্রত্যাহার করতে অথবা নিউজলেটার থেকে সরে যেতে অনুরোধ করতে পারেন। অনুরোধ পাঠান: " + EMAIL + "। আমরা যুক্তিসঙ্গত সময়ের মধ্যে সাড়া দেব।", "Subject to applicable law, you may ask us to access, correct or delete the information we hold about you, withdraw your consent, or unsubscribe from the newsletter. Email " + EMAIL + " and we will respond within a reasonable time.")] },
        { h: L("শিশুদের তথ্য", "Children"),
          p: [L("আমাদের ওয়েবসাইট ১৩ বছরের কম বয়সী শিশুদের জন্য নয় এবং আমরা জেনেশুনে তাদের তথ্য সংগ্রহ করি না। এমন তথ্য পাওয়া গেলে আমরা তা মুছে দেব।", "Our website is not directed at children under 13 and we do not knowingly collect their information. If we learn that we have, we will delete it.")] },
        { h: L("আন্তর্জাতিক স্থানান্তর", "International transfers"),
          p: [L("আমাদের সেবা প্রদানকারীরা বাংলাদেশের বাইরে অবস্থিত সার্ভার ব্যবহার করতে পারে। ফলে আপনার তথ্য অন্য দেশে প্রক্রিয়া হতে পারে।", "Our service providers may use servers outside Bangladesh, so your information may be processed in other countries.")] },
        { h: L("নীতির পরিবর্তন", "Changes to this policy"),
          p: [L("আমরা সময়ে সময়ে এই নীতি হালনাগাদ করতে পারি। পরিবর্তন এই পেজে প্রকাশিত হবে এবং উপরের তারিখ বদলে যাবে।", "We may update this policy from time to time. Changes will be posted on this page and the date above will change.")] },
      ],
    },

    /* ------------------------------------------------------------ */
    terms: {
      title: L("ব্যবহারের শর্তাবলি", "Terms of Service"),
      intro: L(
        "voiceofstartup.bd ওয়েবসাইট ও আমাদের সোশ্যাল মিডিয়া পেজ ব্যবহার করে আপনি এই শর্তাবলি মেনে নিচ্ছেন। শর্তগুলো মনোযোগ দিয়ে পড়ুন।",
        "By using voiceofstartup.bd and our social media pages you agree to these Terms. Please read them carefully."
      ),
      sections: [
        { h: L("শর্ত গ্রহণ", "Acceptance of terms"),
          p: [L("আপনি এই শর্তাবলির সাথে একমত না হলে অনুগ্রহ করে ওয়েবসাইট ব্যবহার করবেন না।", "If you do not agree with these Terms, please do not use the website.")] },
        { h: L("আমাদের সেবা", "Our service"),
          p: [L("VOSB বাংলাদেশের স্টার্টআপ, ব্যবসা, বিনিয়োগ ও নীতিমালা বিষয়ক সংবাদ, বিশ্লেষণ, ফাউন্ডার স্টোরি ও সুযোগের তথ্য প্রকাশ করে। আমরা সরকারি সংস্থার প্রকাশিত তথ্যসূত্র থেকে তথ্য সংগ্রহ করি, কিন্তু এই ওয়েবসাইট কোনো সরকারি সংস্থার অফিসিয়াল সাইট নয় এবং কোনো সংস্থার প্রতিনিধিত্ব বা অনুমোদন দাবি করে না। BIDA, BEPZA, BEZA, BSCIC, ICT মন্ত্রণালয়, বাংলাদেশ হাই-টেক পার্ক কর্তৃপক্ষ ও PPP অথরিটির নাম ও লোগো তাদের নিজ নিজ মালিকের।", "VOSB publishes news, analysis, founder stories and opportunity information about startups, business, investment and policy in Bangladesh. We gather information from published government and agency sources, but this website is not an official site of any government body and does not claim to represent or be endorsed by any of them. The names and marks of BIDA, BEPZA, BEZA, BSCIC, the ICT Ministry, Bangladesh Hi-Tech Park Authority and the PPP Authority belong to their respective owners.")] },
        { h: L("তথ্যের নির্ভুলতা ও পরামর্শ নয়", "Accuracy and no advice"),
          p: [L("আমরা তথ্য যাচাই করতে যথাসাধ্য চেষ্টা করি, তবে সম্পূর্ণ নির্ভুলতা, পূর্ণতা বা সময়োপযোগিতার নিশ্চয়তা দিই না। আমাদের কনটেন্ট কেবল তথ্যের জন্য; এটি আর্থিক, বিনিয়োগ, আইনি, কর বা অন্য পেশাগত পরামর্শ নয়। কোনো সিদ্ধান্ত নেওয়ার আগে মূল সূত্র দেখুন এবং যোগ্য পেশাদারের পরামর্শ নিন।", "We work hard to verify information but do not guarantee accuracy, completeness or timeliness. Our content is for information only and is not financial, investment, legal, tax or other professional advice. Check the original source and consult a qualified professional before making decisions.")],
          p2: [L("ভুল চোখে পড়লে " + EMAIL + " ঠিকানায় জানান; আমরা দ্রুত সংশোধন করব।", "If you spot an error, email " + EMAIL + " and we will correct it promptly.")] },
        { h: L("বুদ্ধিবৃত্তিক সম্পত্তি", "Intellectual property"),
          p: [L("ওয়েবসাইটের লেখা, ডিজাইন, লোগো (voice of startupbd), গ্রাফিক্স ও কোড VOSB বা তাদের লাইসেন্সদাতাদের সম্পত্তি এবং কপিরাইট আইনে সুরক্ষিত। আমাদের লিখিত অনুমতি ছাড়া বাণিজ্যিক উদ্দেশ্যে কপি, পুনঃপ্রকাশ বা পরিবর্তন করা যাবে না। অননুমোদিত ব্যবহার বিষয়ে ব্যবহার নীতি দেখুন।", "The website's text, design, logo (voice of startupbd), graphics and code are owned by VOSB or its licensors and protected by copyright law. They may not be copied, republished or modified for commercial purposes without our written permission. See the Usage Policy for what is allowed.")] },
        { h: L("আপনার পাঠানো কনটেন্ট", "Content you submit"),
          p: [L("নিউজ টিপস, লেখা, ছবি বা তথ্য পাঠালে আপনি নিশ্চিত করছেন যে তা আপনার নিজের বা পাঠানোর অধিকার আপনার আছে, এবং এটি কারও অধিকার লঙ্ঘন করে না। আপনি VOSB-কে তা সম্পাদনা করে প্রকাশের জন্য অ-একচেটিয়া, বিশ্বব্যাপী লাইসেন্স দিচ্ছেন। আপনার নাম প্রকাশে আপত্তি থাকলে পাঠানোর সময় জানান।", "If you send us tips, articles, images or information, you confirm that it is yours or you have the right to send it and that it does not infringe anyone's rights. You grant VOSB a non-exclusive, worldwide licence to edit and publish it. Tell us when you submit if you do not want to be named.")] },
        { h: L("তৃতীয় পক্ষের লিংক", "Third-party links"),
          p: [L("ওয়েবসাইটে অন্য সাইটের লিংক থাকতে পারে। সেগুলোর কনটেন্ট, নীতি বা কার্যক্রমের ওপর আমাদের নিয়ন্ত্রণ নেই এবং তার জন্য আমরা দায়ী নই।", "The website may link to other sites. We do not control their content, policies or practices and are not responsible for them.")] },
        { h: L("বিজ্ঞাপন ও স্পনসরশিপ", "Advertising and sponsorship"),
          p: [L("স্পনসর্ড বা প্রচারমূলক কনটেন্ট স্পষ্টভাবে চিহ্নিত করা হবে। স্পনসরশিপ আমাদের সম্পাদকীয় স্বাধীনতাকে প্রভাবিত করে না। পেইড পার্টনারশিপের শর্ত আলাদা লিখিত চুক্তিতে নির্ধারিত হবে; দেখুন রিফান্ড নীতি।", "Sponsored or promotional content will be clearly labelled. Sponsorship does not influence our editorial independence. Terms of paid partnerships are set in a separate written agreement; see the Refund Policy.")] },
        { h: L("দায়ের সীমাবদ্ধতা", "Disclaimer and limitation of liability"),
          p: [L("ওয়েবসাইট ও কনটেন্ট “যেমন আছে” ও “যতটুকু পাওয়া যায়” ভিত্তিতে দেওয়া হয়। আইনে অনুমোদিত সর্বোচ্চ সীমা পর্যন্ত, এই ওয়েবসাইট ব্যবহার বা কনটেন্টের ওপর নির্ভর করার ফলে সৃষ্ট কোনো প্রত্যক্ষ, পরোক্ষ বা আনুষঙ্গিক ক্ষতির জন্য VOSB দায়ী থাকবে না। কোনো অপরিহার্য আইনি অধিকার এতে ক্ষুণ্ণ হয় না।", "The website and content are provided “as is” and “as available”. To the fullest extent permitted by law, VOSB is not liable for any direct, indirect or incidental loss arising from use of the website or reliance on its content. Nothing here limits any rights that cannot be excluded by law.")] },
        { h: L("সাইট ব্যবহারে নিষেধাজ্ঞা", "Prohibited use"),
          p: [L("ওয়েবসাইট ব্যবহারের নিয়ম ও নিষিদ্ধ কাজের তালিকা আমাদের ব্যবহার নীতিতে দেওয়া আছে, যা এই শর্তাবলির অংশ।", "The rules for using the website and the list of prohibited conduct are in our Usage Policy, which forms part of these Terms.")] },
        { h: L("শর্ত পরিবর্তন", "Changes to the terms"),
          p: [L("আমরা এই শর্তাবলি পরিবর্তন করতে পারি। পরিবর্তনের পর ওয়েবসাইট ব্যবহার চালিয়ে গেলে আপনি নতুন শর্ত মেনে নিয়েছেন বলে গণ্য হবে।", "We may change these Terms. Continued use of the website after a change means you accept the updated Terms.")] },
        { h: L("প্রযোজ্য আইন", "Governing law"),
          p: [L("এই শর্তাবলি বাংলাদেশের আইন দ্বারা পরিচালিত হবে এবং যেকোনো বিরোধ ঢাকার উপযুক্ত আদালতের এখতিয়ারভুক্ত হবে।", "These Terms are governed by the laws of Bangladesh and any dispute will be subject to the jurisdiction of the competent courts of Dhaka.")] },
      ],
    },

    /* ------------------------------------------------------------ */
    cookies: {
      title: L("কুকি নীতি", "Cookie Policy"),
      intro: L(
        "এই নীতিতে ব্যাখ্যা করা হয়েছে voiceofstartup.bd কুকি ও অনুরূপ প্রযুক্তি কীভাবে ব্যবহার করে।",
        "This policy explains how voiceofstartup.bd uses cookies and similar technologies."
      ),
      sections: [
        { h: L("কুকি কী", "What are cookies"),
          p: [L("কুকি হলো ছোট টেক্সট ফাইল যা ওয়েবসাইট আপনার ডিভাইসে সংরক্ষণ করে। ব্রাউজারের লোকাল স্টোরেজও একই ধরনের কাজ করে। এগুলো দিয়ে সাইট আপনার পছন্দ মনে রাখে এবং সঠিকভাবে চলে।", "Cookies are small text files that websites store on your device. Browser local storage works in a similar way. They help a site remember your preferences and work properly.")] },
        { h: L("আমরা বর্তমানে কী ব্যবহার করি", "What we currently use"),
          p: [L("বর্তমানে আমাদের ওয়েবসাইট নিজে কোনো ট্র্যাকিং বা বিজ্ঞাপন কুকি সেট করে না।", "Our website does not currently set any tracking or advertising cookies itself.")],
          ul: [
            L("vosb-lang (লোকাল স্টোরেজ) — আপনার নির্বাচিত ভাষা (বাংলা বা ইংরেজি) মনে রাখে। অত্যাবশ্যক পছন্দ; এটি আপনার ব্রাউজারেই থাকে এবং আমাদের কাছে পাঠানো হয় না।", "vosb-lang (local storage) — remembers your chosen language (Bangla or English). A functional preference that stays in your browser and is not sent to us."),
          ] },
        { h: L("তৃতীয় পক্ষের সেবা", "Third-party services"),
          ul: [
            L("Google Fonts — ফন্ট লোড করতে আপনার ব্রাউজার Google-এর সার্ভারে অনুরোধ পাঠায়। এতে আপনার আইপি ঠিকানা Google-এর কাছে যেতে পারে। বিস্তারিত: Google-এর গোপনীয়তা নীতি।", "Google Fonts — your browser requests fonts from Google's servers, which may receive your IP address. See Google's privacy policy for details."),
            L("GitHub Pages (হোস্টিং) — নিরাপত্তা ও পরিচালনার জন্য সার্ভার লগ রাখতে পারে।", "GitHub Pages (hosting) — may keep server logs for security and operations."),
            L("সোশ্যাল লিংক (Facebook, Instagram, LinkedIn, YouTube) — আপনি লিংকে ক্লিক করে সেসব সাইটে গেলে তাদের নিজস্ব কুকি প্রযোজ্য হবে। আমরা তাদের এমবেড কনটেন্ট লোড করি না।", "Social links (Facebook, Instagram, LinkedIn, YouTube) — if you click through, those sites' own cookies apply. We do not load their embedded content."),
          ] },
        { h: L("ভবিষ্যতে অ্যানালিটিক্স", "Future analytics"),
          p: [L("আমরা ভবিষ্যতে দর্শক সংখ্যা ও জনপ্রিয় কনটেন্ট বোঝার জন্য গোপনীয়তা-বান্ধব অ্যানালিটিক্স টুল (যেমন Google Analytics) ব্যবহার করতে পারি। তা করলে আগে এই নীতি হালনাগাদ করব এবং প্রয়োজনে আপনার সম্মতি চাইব।", "In future we may use a privacy-friendly analytics tool (such as Google Analytics) to understand audience size and popular content. If we do, we will update this policy first and ask for your consent where required.")] },
        { h: L("কুকি নিয়ন্ত্রণ", "Controlling cookies"),
          p: [L("আপনি ব্রাউজারের সেটিংস থেকে কুকি ও সাইট ডেটা দেখতে, ব্লক বা মুছতে পারেন। লোকাল স্টোরেজ মুছলে ভাষার পছন্দ ডিফল্ট (বাংলা) এ ফিরে যাবে; এতে সাইটের অন্য কাজে সমস্যা হবে না।", "You can view, block or delete cookies and site data in your browser settings. Clearing local storage resets the language to the default (Bangla); the rest of the site will keep working.")] },
        { h: L("নীতির পরিবর্তন ও যোগাযোগ", "Changes and contact"),
          p: [L("এই নীতি হালনাগাদ হলে এই পেজে প্রকাশ করা হবে। প্রশ্ন থাকলে " + EMAIL + " ঠিকানায় লিখুন।", "If we update this policy we will post it on this page. Questions? Email " + EMAIL + ".")] },
      ],
    },

    /* ------------------------------------------------------------ */
    refund: {
      title: L("রিফান্ড নীতি", "Refund Policy"),
      intro: L(
        "VOSB-এর বর্তমান ওয়েবসাইট সবার জন্য বিনামূল্যে এবং এখানে কোনো পেইড সাবস্ক্রিপশন বা অনলাইন কেনাকাটা নেই। এই নীতি প্রযোজ্য হবে আমাদের সাথে লিখিতভাবে সম্মত পেইড সেবার ক্ষেত্রে, যেমন স্পনসরশিপ, বিজ্ঞাপন, প্রচারমূলক কনটেন্ট ও ইভেন্ট পার্টনারশিপ।",
        "VOSB's website is free to everyone and has no paid subscriptions or online purchases. This policy applies to paid services agreed with us in writing, such as sponsorships, advertising, promotional content and event partnerships."
      ),
      sections: [
        { h: L("পরিধি", "Scope"),
          p: [L("সাধারণ পাঠকদের জন্য কোনো ফি নেই, তাই রিফান্ডের প্রশ্ন ওঠে না। পেইড পার্টনারদের ক্ষেত্রে লিখিত চুক্তি বা ইনভয়েসে ভিন্ন শর্ত থাকলে সেটিই প্রাধান্য পাবে।", "Readers pay nothing, so refunds do not arise. For paid partners, any different terms in a written agreement or invoice take priority over this policy.")] },
        { h: L("যেসব ক্ষেত্রে পূর্ণ রিফান্ড", "When you get a full refund"),
          ul: [
            L("আমরা সম্মত সেবা বা কনটেন্ট প্রকাশ করতে ব্যর্থ হলে এবং সম্মত সময়ের মধ্যে তা সংশোধন না করলে।", "We fail to deliver the agreed service or content and do not fix it within the agreed time."),
            L("প্রচারণা শুরুর আগে আপনি লিখিতভাবে বাতিল করলে এবং আমরা কাজ শুরু না করে থাকলে।", "You cancel in writing before the campaign starts and we have not begun work."),
            L("আমাদের ভুলে একই পেমেন্ট দুইবার নেওয়া হলে।", "A payment was taken twice because of our error."),
          ] },
        { h: L("আংশিক রিফান্ড", "Partial refunds"),
          p: [L("কাজ শুরু হয়ে যাওয়ার পর বাতিল করলে, ইতিমধ্যে সম্পন্ন বা প্রকাশিত অংশের মূল্য বাদ দিয়ে অবশিষ্ট অংশের রিফান্ড দেওয়া হতে পারে। ডিজাইন, লেখা বা ভিডিও প্রোডাকশনের মতো কাস্টম কাজের খরচ রিফান্ডযোগ্য নাও হতে পারে।", "If you cancel after work has started, we may refund the unused portion after deducting the value of work already completed or published. Costs of custom work such as design, writing or video production may be non-refundable.")] },
        { h: L("যেসব ক্ষেত্রে রিফান্ড নেই", "When refunds are not available"),
          ul: [
            L("প্রকাশিত কনটেন্টের ফলাফল (ক্লিক, বিক্রি, ফান্ডিং ইত্যাদি) আপনার প্রত্যাশা অনুযায়ী না হলে — আমরা নির্দিষ্ট ফলাফলের নিশ্চয়তা দিই না।", "Results from published content (clicks, sales, funding, etc.) fall short of your expectations — we do not guarantee specific outcomes."),
            L("আপনার দেওয়া তথ্য, ছবি বা কনটেন্ট ভুল বা অসম্পূর্ণ হওয়ার কারণে সমস্যা হলে।", "Problems caused by incorrect or incomplete information, images or content you supplied."),
            L("আপনার অনুরোধে কনটেন্ট প্রকাশের পর সরিয়ে নিলে (মুছে ফেলা যাবে, তবে রিফান্ড নয়)।", "Content removed at your request after publication (we will take it down, but the fee is not refunded)."),
          ] },
        { h: L("কীভাবে রিফান্ড চাইবেন", "How to request a refund"),
          p: [L("প্রকাশ বা পেমেন্টের ৭ দিনের মধ্যে partnerships@voiceofstartup.bd ঠিকানায় ইমেইল করুন। ইনভয়েস নম্বর, পেমেন্টের তারিখ ও কারণ উল্লেখ করুন।", "Email partnerships@voiceofstartup.bd within 7 days of publication or payment. Include the invoice number, payment date and the reason.")] },
        { h: L("প্রক্রিয়াকরণ", "Processing"),
          p: [L("অনুমোদিত রিফান্ড সাধারণত ৭–১৪ কর্মদিবসের মধ্যে মূল পেমেন্ট পদ্ধতিতে ফেরত দেওয়া হয়। ব্যাংক বা পেমেন্ট প্রদানকারীর ফি প্রযোজ্য হলে তা বাদ যেতে পারে।", "Approved refunds are usually returned to the original payment method within 7–14 business days. Bank or payment-provider fees may be deducted where applicable.")] },
        { h: L("পরিবর্তন", "Changes"),
          p: [L("আমরা এই নীতি হালনাগাদ করতে পারি; পরিবর্তন কেবল নতুন চুক্তির ক্ষেত্রে প্রযোজ্য হবে।", "We may update this policy; changes apply only to new agreements.")] },
      ],
    },

    /* ------------------------------------------------------------ */
    usage: {
      title: L("ব্যবহার নীতি", "Usage Policy"),
      intro: L(
        "এই নীতি নির্ধারণ করে voiceofstartup.bd ও আমাদের কনটেন্ট আপনি কীভাবে ব্যবহার করতে পারবেন। এটি আমাদের ব্যবহারের শর্তাবলির অংশ।",
        "This policy sets out how you may use voiceofstartup.bd and our content. It forms part of our Terms of Service."
      ),
      sections: [
        { h: L("অনুমোদিত ব্যবহার", "Permitted use"),
          ul: [
            L("ব্যক্তিগত ও অবাণিজ্যিক উদ্দেশ্যে কনটেন্ট পড়া, শেয়ার করা এবং লিংক দেওয়া।", "Reading, sharing and linking to our content for personal, non-commercial purposes."),
            L("সংবাদ আলোচনা বা সমালোচনার জন্য ছোট অংশ উদ্ধৃত করা, শর্ত থাকে যে স্পষ্টভাবে “Voice of Startup Bangladesh” কে উৎস হিসেবে উল্লেখ করা হবে এবং মূল লেখার লিংক দেওয়া হবে।", "Quoting short excerpts for discussion or criticism, provided you clearly credit “Voice of Startup Bangladesh” and link to the original."),
            L("সোশ্যাল মিডিয়ায় আমাদের পোস্ট শেয়ার ও ট্যাগ করা।", "Sharing and tagging our posts on social media."),
          ] },
        { h: L("অনুমতি ছাড়া যা করা যাবে না", "Not allowed without permission"),
          ul: [
            L("আমাদের পুরো লেখা, ছবি, গ্রাফিক্স বা ডিজাইন কপি করে নিজের বা অন্য সাইটে প্রকাশ করা।", "Copying our full articles, images, graphics or design and publishing them elsewhere."),
            L("আমাদের লোগো, নাম বা ব্র্যান্ড এমনভাবে ব্যবহার করা যাতে মনে হয় আপনি VOSB-এর অংশ বা তাদের অনুমোদিত।", "Using our logo, name or brand in a way that suggests affiliation with or endorsement by VOSB."),
            L("আমাদের কনটেন্ট বিক্রি, লাইসেন্স দেওয়া বা বাণিজ্যিক ডেটাবেসে ব্যবহার করা।", "Selling, licensing or including our content in commercial databases."),
            L("AI মডেল প্রশিক্ষণের জন্য বড় আকারে আমাদের কনটেন্ট সংগ্রহ করা।", "Bulk collection of our content to train AI models."),
          ] },
        { h: L("নিষিদ্ধ আচরণ", "Prohibited conduct"),
          p: [L("ওয়েবসাইট ব্যবহারের সময় আপনি নিচের কাজগুলো করতে পারবেন না:", "When using the website you must not:")],
          ul: [
            L("অবৈধ, প্রতারণামূলক, মানহানিকর, হয়রানিমূলক বা বিদ্বেষমূলক কিছু করা বা পাঠানো।", "Do or send anything unlawful, fraudulent, defamatory, harassing or hateful."),
            L("আমাদের হয়ে বা অন্য কোনো ব্যক্তি/সংস্থা (সরকারি সংস্থাসহ) সেজে নিজেকে পরিচয় দেওয়া।", "Impersonate us or any other person or organisation, including government bodies."),
            L("ম্যালওয়্যার, ভাইরাস বা ক্ষতিকর কোড পাঠানো; সাইটের নিরাপত্তা ভেদ করার বা সেবা ব্যাহত করার চেষ্টা করা।", "Transmit malware, viruses or harmful code, or try to breach security or disrupt the service."),
            L("স্বয়ংক্রিয় টুল (বট, স্ক্র্যাপার) দিয়ে অতিরিক্ত অনুরোধ পাঠিয়ে সাইটের ওপর চাপ সৃষ্টি করা।", "Use automated tools (bots, scrapers) in a way that places excessive load on the site."),
            L("স্প্যাম বা অযাচিত বিজ্ঞাপন পাঠানো, বিশেষত আমাদের ইমেইল ঠিকানায়।", "Send spam or unsolicited promotions, especially to our email addresses."),
          ] },
        { h: L("আপনার পাঠানো নিউজ টিপস ও লেখা", "News tips and submissions"),
          p: [L("সত্য ও যাচাইযোগ্য তথ্য পাঠান। জেনেশুনে মিথ্যা বা বিভ্রান্তিকর তথ্য, অন্যের লেখা চুরি, কিংবা কারও ব্যক্তিগত তথ্য অনুমতি ছাড়া পাঠানো নিষিদ্ধ। সম্পাদকীয় সিদ্ধান্ত VOSB-এর; পাঠানো সব লেখা প্রকাশের নিশ্চয়তা নেই এবং আমরা সম্পাদনা করার অধিকার রাখি।", "Send truthful, verifiable information. Knowingly sending false or misleading information, plagiarised work, or someone's private data without permission is prohibited. Editorial decisions are VOSB's; we do not guarantee that every submission will be published and we may edit it.")] },
        { h: L("ঘোষণা ও স্বচ্ছতা", "Disclosure and transparency"),
          p: [L("স্পনসর্ড বা প্রচারমূলক কনটেন্ট স্পষ্টভাবে চিহ্নিত থাকবে। আমাদের কনটেন্ট বিনিয়োগ বা আইনি পরামর্শ নয়; বিস্তারিত ব্যবহারের শর্তাবলিতে দেখুন।", "Sponsored or promotional content will be clearly labelled. Our content is not investment or legal advice; see the Terms of Service for details.")] },
        { h: L("লঙ্ঘন রিপোর্ট ও কপিরাইট অভিযোগ", "Reporting violations and copyright concerns"),
          p: [L("কোনো লঙ্ঘন, ভুল তথ্য বা আপনার কপিরাইটযুক্ত কনটেন্টের অননুমোদিত ব্যবহার চোখে পড়লে " + EMAIL + " ঠিকানায় লিংকসহ জানান। আমরা পর্যালোচনা করে প্রয়োজনীয় ব্যবস্থা নেব।", "If you notice a violation, an error, or unauthorised use of your copyrighted content, email " + EMAIL + " with links. We will review it and act as appropriate.")] },
        { h: L("প্রয়োগ", "Enforcement"),
          p: [L("এই নীতি লঙ্ঘিত হলে আমরা সতর্ক করতে, কনটেন্ট সরাতে, অ্যাক্সেস বন্ধ করতে বা প্রয়োজনে আইনি ব্যবস্থা নিতে পারি।", "If this policy is breached we may warn you, remove content, block access or, where necessary, take legal action.")] },
      ],
    },
  };
})();
