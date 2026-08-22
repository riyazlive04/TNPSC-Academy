import { useLanguageStore, type Lang } from '../store/languageStore'

// ─── UI string catalogue ────────────────────────────────────────────────────
// Each key maps to an English + Tamil label. For the bilingual ('both') mode we
// show "English / தமிழ்". Question CONTENT stays in English until a Tamil
// question source is added; this catalogue covers interface chrome only.

type Entry = { en: string; ta: string }

const STRINGS = {
  // Brand / common
  appName: { en: 'TNPSC MENTOR', ta: 'TNPSC வழிகாட்டி' },
  signOut: { en: 'Sign out', ta: 'வெளியேறு' },
  home: { en: 'Home', ta: 'முகப்பு' },
  admin: { en: 'Admin', ta: 'நிர்வாகி' },
  studentView: { en: 'Student view', ta: 'மாணவர் காட்சி' },
  adminView: { en: 'Admin view', ta: 'நிர்வாகி காட்சி' },
  viewingAsStudent: {
    en: "You're previewing the app as a student",
    ta: 'நீங்கள் மாணவராக செயலியை முன்னோட்டமிடுகிறீர்கள்',
  },
  exitStudentView: { en: 'Exit student view', ta: 'மாணவர் காட்சியிலிருந்து வெளியேறு' },
  back: { en: 'Back', ta: 'பின்செல்' },
  darkMode: { en: 'Dark mode', ta: 'இருண்ட பயன்முறை' },
  lightMode: { en: 'Light mode', ta: 'ஒளி பயன்முறை' },
  viewLanguage: { en: 'Question language', ta: 'வினா மொழி' },
  timeLeft: { en: 'Time left', ta: 'மீதமுள்ள நேரம்' },
  // Auth split-screen hero (login / register / forgot)
  authHeroTitle: {
    en: 'Your fast track to the TNPSC exam hall.',
    ta: 'TNPSC தேர்வு அரங்கிற்கான உங்கள் விரைவுப் பாதை.',
  },
  authHeroSub: {
    en: '12,000+ bilingual questions, timed mock tests, smart revision and progress insights - all in one focused workspace.',
    ta: '12,000+ இருமொழி வினாக்கள், நேரத் தேர்வுகள், திறன்மிகு மீள்பார்வை மற்றும் முன்னேற்றப் பகுப்பாய்வு - அனைத்தும் ஒரே இடத்தில்.',
  },
  authFooter: {
    en: 'Aspirant Portal',
    ta: 'மாணவர் வாயில்',
  },
  chipPyq: { en: 'Previous Year', ta: 'முந்தைய ஆண்டு' },
  chipSamacheer: { en: 'Samacheer', ta: 'சமச்சீர்' },
  chipCa: { en: 'Current Affairs', ta: 'நடப்பு நிகழ்வுகள்' },
  chipAptitude: { en: 'Aptitude', ta: 'திறனாய்வு' },
  chipSubject: { en: 'Subject Wise', ta: 'பாடம் வாரியாக' },
  downloadExplanations: { en: 'Download explanations (PDF)', ta: 'விளக்கங்களைப் பதிவிறக்கு (PDF)' },
  preparingPdf: { en: 'Preparing PDF…', ta: 'PDF தயாராகிறது…' },
  pdfWhenComplete: {
    en: 'Attempt at least 80% of the questions to unlock the explanation PDF.',
    ta: 'விளக்க PDF-ஐப் பெற குறைந்தது 80% வினாக்களுக்குப் பதிலளிக்கவும்.',
  },
  // Free users can download a limited number of explanation PDFs; premium is
  // unlimited. {n} is rendered separately before this label in the UI.
  freeDownloadsLeft: { en: 'free PDF downloads left', ta: 'இலவச PDF பதிவிறக்கங்கள் மீதம்' },
  pdfFreeLimitReached: {
    en: "You've used all your free PDF downloads. Upgrade to Premium for unlimited downloads.",
    ta: 'உங்கள் இலவச PDF பதிவிறக்கங்கள் அனைத்தையும் பயன்படுத்திவிட்டீர்கள். வரம்பற்ற பதிவிறக்கங்களுக்கு பிரீமியத்திற்கு மேம்படுத்தவும்.',
  },
  pdfUpgradeForMore: {
    en: 'Upgrade to Premium for unlimited PDFs',
    ta: 'வரம்பற்ற PDF-களுக்கு பிரீமியத்திற்கு மேம்படுத்தவும்',
  },
  loading: { en: 'Loading…', ta: 'ஏற்றுகிறது…' },
  correctMark: { en: 'Correct', ta: 'சரியானது' },
  deleteQuestionTitle: { en: 'Delete this question?', ta: 'இந்த வினாவை நீக்கவா?' },
  deleteQuestionMsg: {
    en: 'This permanently removes the question. This cannot be undone.',
    ta: 'இது வினாவை நிரந்தரமாக நீக்கும். இதைச் செயல்தவிர்க்க முடியாது.',
  },
  delete: { en: 'Delete', ta: 'நீக்கு' },
  cancel: { en: 'Cancel', ta: 'ரத்து' },
  dismiss: { en: 'Dismiss', ta: 'மூடு' },
  alertAnnouncement: { en: 'Announcement', ta: 'அறிவிப்பு' },
  // Popup announcement types (icon/colour/label per kind).
  alertKindInfo: { en: 'Information', ta: 'தகவல்' },
  alertKindAlert: { en: 'Alert', ta: 'எச்சரிக்கை' },
  alertKindUpdate: { en: 'Update', ta: 'புதுப்பிப்பு' },
  alertKindSuccess: { en: 'Good news', ta: 'நற்செய்தி' },
  alertViewLink: { en: 'View', ta: 'பார்க்க' },

  // Language screen
  chooseLanguage: { en: 'Choose Your Language', ta: 'உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்' },
  language: { en: 'Language', ta: 'மொழி' },
  languageHint: {
    en: 'You can change this anytime from the top bar.',
    ta: 'மேல் பட்டியில் இருந்து இதை எப்போது வேண்டுமானாலும் மாற்றலாம்.',
  },
  langEnglish: { en: 'English', ta: 'ஆங்கிலம்' },
  langTamil: { en: 'Tamil', ta: 'தமிழ்' },
  langBoth: { en: 'English + Tamil', ta: 'ஆங்கிலம் + தமிழ்' },
  langEnglishDesc: { en: 'Interface in English', ta: 'இடைமுகம் ஆங்கிலத்தில்' },
  langTamilDesc: { en: 'Interface in Tamil', ta: 'இடைமுகம் தமிழில்' },
  langBothDesc: { en: 'Bilingual interface', ta: 'இருமொழி இடைமுகம்' },
  continueBtn: { en: 'Continue', ta: 'தொடரவும்' },

  // ─── Onboarding tour (first-run guided walkthrough, new accounts only) ─────
  onbNext: { en: 'Next', ta: 'அடுத்து' },
  onbSkip: { en: 'Skip tour', ta: 'சுற்றுப்பயணத்தைத் தவிர்' },
  onbGetStarted: { en: 'Get started', ta: 'தொடங்குவோம்' },
  onbStepOf: { en: 'of', ta: '/' },
  onbStartExploring: { en: 'Explore on my own', ta: 'நானே ஆராய்கிறேன்' },
  onbWelcomeTitle: { en: 'Welcome to TNPSC Mentors', ta: 'TNPSC வழிகாட்டிக்கு வரவேற்கிறோம்' },
  onbWelcomeBody: {
    en: "Let's take a quick 30-second tour of how to prepare here. Tap Next to begin.",
    ta: "இங்கே எப்படித் தயாராவது என்பதை விரைவான 30 வினாடிச் சுற்றுப்பயணத்தில் பார்ப்போம். தொடங்க 'அடுத்து' என்பதைத் தட்டவும்.",
  },
  onbMockTitle: { en: 'Start with a mock test', ta: 'மாதிரித் தேர்வுடன் தொடங்குங்கள்' },
  onbMockBody: {
    en: 'This is your mock test - a full-length, timed Group exam with negative marking, just like the real hall. Tap it anytime to begin.',
    ta: 'இது உங்கள் மாதிரித் தேர்வு - எதிர்மறை மதிப்பெண்களுடன் கூடிய முழு நீள, நேரக் குரூப் தேர்வு, உண்மையான தேர்வரங்கம் போலவே. தொடங்க எப்போது வேண்டுமானாலும் தட்டவும்.',
  },
  onbPracticeTitle: { en: 'Practice your way', ta: 'உங்கள் வழியில் பயிற்சி செய்யுங்கள்' },
  onbPracticeBody: {
    en: 'Here you drill by subject and topic, revisit previous-year papers, sharpen aptitude and follow current affairs.',
    ta: 'இங்கே பாடம் மற்றும் தலைப்பு வாரியாகப் பயிற்சி செய்யலாம், முந்தைய ஆண்டு வினாத்தாள்களைப் பார்க்கலாம், திறனாய்வை மேம்படுத்தலாம், நடப்பு நிகழ்வுகளைப் பின்தொடரலாம்.',
  },
  onbProgressTitle: { en: 'Revise & track progress', ta: 'மீள்பார்வை & முன்னேற்றம்' },
  onbProgressBody: {
    en: 'Weak topics are saved as smart revisions, and Insights show your accuracy, strengths and focus areas.',
    ta: 'பலவீனமான தலைப்புகள் திறன்மிகு மீள்பார்வைகளாகச் சேமிக்கப்படும், மேலும் பகுப்பாய்வு உங்கள் துல்லியம், பலங்கள் மற்றும் கவனப் பகுதிகளைக் காட்டும்.',
  },
  // Test Marathon schedule flyer (static PDF in public/).
  downloadSchedule: { en: 'Download the schedule (PDF)', ta: 'தேர்வு அட்டவணையை பதிவிறக்கு (PDF)' },
  onbCreditsTitle: { en: 'Your test credits', ta: 'உங்கள் தேர்வு கிரெடிட்கள்' },
  onbCreditsBody: {
    en: 'Each question uses 1 credit — a 20-question test costs 20 credits. You get +10 free credits every day you log in, but unused daily credits expire at the end of the day (midnight) — so practise every day! Premium / Vettri Nichayam plans are unlimited.',
    ta: 'ஒவ்வொரு கேள்விக்கும் 1 கிரெடிட் செலவாகும் — 20 கேள்வித் தேர்வுக்கு 20 கிரெடிட்கள். உள்நுழையும் ஒவ்வொரு நாளும் +10 இலவச கிரெடிட்கள் கிடைக்கும்; ஆனால் பயன்படுத்தாத தினசரி கிரெடிட்கள் அன்றைய நாள் முடிவில் (நள்ளிரவில்) காலாவதியாகும் — எனவே தினமும் பயிற்சி செய்யுங்கள்! பிரீமியம் / வெற்றி நிச்சயம் திட்டங்களில் வரம்பே இல்லை.',
  },
  onbLangTitle: { en: 'Tamil, English or both', ta: 'தமிழ், ஆங்கிலம் அல்லது இரண்டும்' },
  onbLangBody: {
    en: 'Tap here to switch language anytime - and the icon beside it toggles light and dark mode.',
    ta: 'மொழியை எப்போது வேண்டுமானாலும் மாற்ற இங்கே தட்டவும் - அதன் அருகிலுள்ள ஐகான் ஒளி/இருண்ட பயன்முறையை மாற்றும்.',
  },
  onbFirstTestTitle: { en: 'Ready for your first test?', ta: 'உங்கள் முதல் தேர்வுக்குத் தயாரா?' },
  onbFirstTestBody: {
    en: 'The Starter Challenge: 18 hard questions mixing every style - statements, match, assertion-reason, chronology, direct and aptitude. Finish it and earn +25 bonus credits. The best way to see where you stand!',
    ta: 'தொடக்க சவால்: எல்லா வகைகளும் கலந்த 18 கடின கேள்விகள் - கூற்றுகள், பொருத்துக, உறுதி-காரணம், காலவரிசை, நேரடி மற்றும் திறனாய்வு. முடித்தால் +25 போனஸ் கிரெடிட்கள். நீங்கள் எந்த நிலையில் இருக்கிறீர்கள் என்று அறிய இதுவே சிறந்த வழி!',
  },
  onbFirstTestCta: { en: 'Experience the free test now!', ta: 'இப்போதே இலவசத் தேர்வை அனுபவியுங்கள்!' },

  // ─── Push notification primer (native app, shown once before the OS asks) ──
  pushPrimerTitle: { en: "Don't miss your streak", ta: 'உங்கள் தொடர்ச்சியை தவறவிடாதீர்கள்' },
  pushPrimerBody: {
    en: 'Turn on notifications for daily current-affairs digests, streak reminders and exam updates. You can change this anytime in Profile.',
    ta: 'தினசரி நடப்பு நிகழ்வுத் தொகுப்பு, தொடர்ச்சி நினைவூட்டல்கள் மற்றும் தேர்வு புதுப்பிப்புகளுக்கு அறிவிப்புகளை இயக்குங்கள். இதை எப்போது வேண்டுமானாலும் சுயவிவரத்தில் மாற்றலாம்.',
  },
  pushPrimerEnable: { en: 'Enable notifications', ta: 'அறிவிப்புகளை இயக்கு' },
  pushPrimerDismiss: { en: 'Not now', ta: 'இப்போது வேண்டாம்' },

  // First-login prompt (StarterTestPrompt): the test leads, the tour follows.
  startPromptSkip: {
    en: 'Not now - show me around first',
    ta: 'இப்போது வேண்டாம் - முதலில் செயலியை சுற்றிக் காட்டுங்கள்',
  },
  // New-signup promo alert (MarathonFreeAlert): Test Series Test 1 is free.
  marathonFreeBadge: { en: 'Free', ta: 'இலவசம்' },
  marathonFreeTitle: {
    en: 'Test Series: Test 1 is FREE!',
    ta: 'தேர்வுத் தொடர்: தேர்வு 1 இலவசம்!',
  },
  marathonFreeBody: {
    en: 'In the 13-test Group 1 Test Series, the first test (100 questions, Units I & II) is completely free for every aspirant. Try it before you enroll!',
    ta: '13-தேர்வு குரூப் 1 தேர்வுத் தொடரில், முதல் தேர்வு (100 வினாக்கள், அலகு I & II) அனைவருக்கும் முற்றிலும் இலவசம். சேருவதற்கு முன் முயற்சித்துப் பாருங்கள்!',
  },
  marathonFreeCta: {
    en: 'Take Test 1 free',
    ta: 'தேர்வு 1-ஐ இலவசமாக எழுத',
  },
  marathonFreeLater: { en: 'Later', ta: 'பிறகு' },
  // Tour final step when the Starter Challenge is already done (test-first flow).
  onbAllSetTitle: { en: "You're all set!", ta: 'நீங்கள் தயார்!' },
  onbAllSetBody: {
    en: 'Great job finishing your first test. Practise a little every day to keep your credits and your streak growing - your exam hall seat is earned one question at a time.',
    ta: 'உங்கள் முதல் தேர்வை முடித்தது அருமை! கிரெடிட்களும் தொடர்ச்சியும் வளர தினமும் சிறிது பயிற்சி செய்யுங்கள் - தேர்வரங்க இடம் ஒவ்வொரு வினாவாகத்தான் வெல்லப்படுகிறது.',
  },
  // First-test funnel (dashboard hero + Starter Challenge + result bonus).
  starterTestLabel: { en: 'Starter Challenge', ta: 'தொடக்க சவால்' },
  firstTestBadge: { en: 'Your first test', ta: 'உங்கள் முதல் தேர்வு' },
  firstTestHeroTitle: {
    en: 'Take the Starter Challenge',
    ta: 'தொடக்க சவாலை எடுங்கள்',
  },
  firstTestHeroSub: {
    en: '18 hard questions · every question style + aptitude · finish and earn +25 bonus credits',
    ta: '18 கடின கேள்விகள் · எல்லா கேள்வி வகைகளும் + திறனாய்வு · முடித்தால் +25 போனஸ் கிரெடிட்கள்',
  },
  firstTestHeroCta: { en: 'Start now', ta: 'இப்போதே தொடங்கு' },
  firstTestBonusTitle: {
    en: 'First test complete - bonus earned!',
    ta: 'முதல் தேர்வு நிறைவு - போனஸ் வென்றீர்கள்!',
  },
  firstTestBonusBody1: {
    en: 'Well done on your first test!',
    ta: 'உங்கள் முதல் தேர்வுக்கு வாழ்த்துக்கள்!',
  },
  firstTestBonusBody2: {
    en: 'bonus credits were added to your balance.',
    ta: 'போனஸ் கிரெடிட்கள் உங்கள் இருப்பில் சேர்க்கப்பட்டன.',
  },

  // ─── Forced upsell (UpsellModal: out of credits / locked feature) ──────────
  upsellCreditsTitle: { en: 'Out of credits', ta: 'கிரெடிட்கள் தீர்ந்துவிட்டன' },
  upsellCreditsBody: {
    en: 'Your credit balance can’t cover this test. Go unlimited with a plan below and never count credits again.',
    ta: 'உங்கள் கிரெடிட் இருப்பு இந்தத் தேர்வுக்குப் போதவில்லை. கீழே உள்ள திட்டத்துடன் வரம்பில்லாப் பயிற்சிக்கு மாறுங்கள் - இனி கிரெடிட் கணக்கே தேவையில்லை.',
  },
  upsellCreditsNeed: {
    en: 'This test needs {n} credits - you have {b}.',
    ta: 'இந்தத் தேர்வுக்கு {n} கிரெடிட்கள் தேவை - உங்களிடம் {b} உள்ளன.',
  },
  upsellCreditsTomorrow: {
    en: 'Or come back tomorrow: you get +10 free credits every day you log in.',
    ta: 'அல்லது நாளை வாருங்கள்: உள்நுழையும் ஒவ்வொரு நாளும் +10 இலவச கிரெடிட்கள் கிடைக்கும்.',
  },
  upsellPremiumTitle: { en: 'This is a Premium feature', ta: 'இது பிரீமியம் அம்சம்' },
  upsellPremiumBody: {
    en: 'Full mock exams beyond your one free paper are part of the Premium plan. Upgrade to open every exam, unlimited.',
    ta: 'உங்கள் ஒரு இலவசத் தாளுக்கு அப்பாற்பட்ட முழு மாதிரித் தேர்வுகள் பிரீமியம் திட்டத்தின் ஒரு பகுதி. எல்லா தேர்வுகளையும் வரம்பின்றி திறக்க மேம்படுத்துங்கள்.',
  },
  upsellBundleTitle: { en: 'Unlock with a plan', ta: 'திட்டத்துடன் திறக்கவும்' },
  upsellBundleBody: {
    en: 'This section opens with any paid plan - Vettri Nichayam or Premium. Pick the one that fits you below.',
    ta: 'இந்தப் பிரிவு எந்தக் கட்டணத் திட்டத்திலும் திறக்கும் - வெற்றி நிச்சயம் அல்லது பிரீமியம். உங்களுக்கு ஏற்றதைக் கீழே தேர்ந்தெடுங்கள்.',
  },
  upsellRankBoosterTitle: {
    en: 'Unlock Group II/ IIA- Rank Booster',
    ta: 'குரூப் II/ IIA - Rank Booster-ஐத் திறக்கவும்',
  },
  upsellRankBoosterBody: {
    en: 'The Group II/ IIA- Rank Booster series opens with its own plan, or with Premium. Vettri Nichayam does not include it.',
    ta: 'குரூப் II/ IIA - Rank Booster தொடர் அதன் சொந்தத் திட்டத்துடன் அல்லது பிரீமியத்துடன் திறக்கும். வெற்றி நிச்சயம் இதைச் சேர்க்காது.',
  },
  upsellLater: { en: 'Maybe later', ta: 'பிறகு பார்க்கலாம்' },
  howItWorks: { en: 'How it works', ta: 'இது எவ்வாறு செயல்படுகிறது' },
  howItWorksSub: { en: 'Replay the app tour', ta: 'செயலி சுற்றுப்பயணத்தை மீண்டும் பார்க்க' },

  // Test Arena
  testArena: { en: 'Test Arena', ta: 'தேர்வு அரங்கம்' },
  welcome: { en: 'Welcome', ta: 'வரவேற்கிறோம்' },
  chooseCategory: { en: 'Choose a category to begin.', ta: 'தொடங்க ஒரு பிரிவைத் தேர்ந்தெடுக்கவும்.' },
  hoverPreview: {
    en: "Hover a category to preview what's inside",
    ta: 'உள்ளே என்ன இருக்கிறது என்பதைக் காண பிரிவின் மீது நகர்த்தவும்',
  },
  insideSection: { en: 'Inside this section', ta: 'இந்தப் பிரிவில்' },
  adminModeNote: {
    en: 'Admin mode: picking any category shows the full question bank (with answers) instead of a timed test.',
    ta: 'நிர்வாக முறை: எந்தப் பிரிவையும் தேர்ந்தெடுத்தால் நேரத் தேர்வுக்குப் பதிலாக முழு வினாத் தொகுப்பு (விடைகளுடன்) காட்டப்படும்.',
  },
  adminHomeSub: {
    en: 'Manage the question bank and platform content.',
    ta: 'வினாத் தொகுப்பு மற்றும் தள உள்ளடக்கத்தை நிர்வகிக்கவும்.',
  },
  manageBank: { en: 'Manage Question Bank', ta: 'வினாத் தொகுப்பை நிர்வகி' },
  pickCategoryAdmin: {
    en: 'Pick a category to browse, edit and export its questions - answers are shown.',
    ta: 'ஒரு பிரிவைத் தேர்ந்தெடுத்து வினாக்களைப் பார்க்க, திருத்த, ஏற்றுமதி செய்ய - விடைகள் காட்டப்படும்.',
  },
  browseEditBank: { en: 'Browse & edit · answers shown', ta: 'பார்க்க & திருத்த · விடைகளுடன்' },
  outerQuestionsSub: { en: 'Subject-wise bank · view & download PDF', ta: 'பாட வாரியான தொகுப்பு · PDF பதிவிறக்கம்' },

  // Category titles - Title Case throughout, matching every other dashboard row
  // (Daily CA Test, CA Questions, Thirukkural Quiz…) rather than shouting caps.
  pyqTitle: { en: 'Previous Year Question Papers', ta: 'முந்தைய ஆண்டு வினாத்தாள்கள்' },
  samacheerTitle: { en: 'SAMACHEER BASED', ta: 'சமச்சீர் அடிப்படையில்' },
  currentAffairsTitle: { en: 'Current Affairs', ta: 'நடப்பு நிகழ்வுகள்' },
  aptitudeTitle: { en: 'Aptitude Topic Wise', ta: 'திறனாய்வு மற்றும் மனக்கணக்கு' },
  // The consolidated Current Affairs dashboard card - opens a picker over the
  // three CA entry points that used to be separate rows (Daily CA Test,
  // month/topic practice, CA Questions PDFs).
  currentAffairsHubSub: { en: 'Daily test · monthly practice · PDFs', ta: 'தினசரி தேர்வு · மாதாந்திர பயிற்சி · PDF' },
  caTopicPracticeTitle: { en: 'Month & Topic Practice', ta: 'மாதம் & தலைப்பு வாரியான பயிற்சி' },
  caTopicPracticeSub: { en: 'Browse by month or topic', ta: 'மாதம் அல்லது தலைப்பு வாரியாகப் பார்வையிடவும்' },

  // Section badges
  pyqBadge: { en: 'Previous Year Question Paper', ta: 'முந்தைய ஆண்டு வினாத்தாள்' },

  // PYQ group chooser (Group 1 / Group 2 / 2A / Group 4) + the section flow the
  // Group 2 and Group 4 banks share (see PYQ_GROUPS in lib/constants).
  pyqChooseGroup: { en: 'Choose a Group', ta: 'குழுவைத் தேர்ந்தெடுக்கவும்' },
  pyqChooseGroupHint: {
    en: 'Pick which exam’s previous-year questions to practise.',
    ta: 'எந்தத் தேர்வின் முந்தைய ஆண்டு வினாக்களைப் பயிற்சி செய்வது எனத் தேர்ந்தெடுக்கவும்.',
  },
  group1Pyq: { en: 'Group 1 PYQ', ta: 'குரூப் 1 முந்தைய ஆண்டு வினாக்கள்' },
  group1PyqSub: { en: 'General Studies, subject-wise (2019–2025)', ta: 'பொதுப் படிப்பு, பாட வாரியாக (2019–2025)' },
  group2Pyq: { en: 'Group 2 / 2A Prelims PYQ', ta: 'குரூப் 2 / 2A முதனிலை வினாக்கள்' },
  group2PyqSub: { en: 'Prelims · Aptitude, English, Tamil & GS', ta: 'முதனிலை · திறனாய்வு, ஆங்கிலம், தமிழ் & பொது அறிவு' },
  group4Pyq: { en: 'Group 4 / VAO PYQ', ta: 'குரூப் 4 / VAO முந்தைய ஆண்டு வினாக்கள்' },
  group4PyqSub: {
    en: 'General Tamil, GS & Aptitude (2018–2025)',
    ta: 'பொதுத் தமிழ், பொது அறிவு & திறனாய்வு (2018–2025)',
  },
  pyq1Badge: {
    en: 'Group 1 Prelims - Previous Year Question Paper',
    ta: 'குரூப் 1 முதனிலை - முந்தைய ஆண்டு வினாத்தாள்',
  },
  pyq2Badge: { en: 'Group 2 / 2A Prelims - Previous Year Questions', ta: 'குரூப் 2 / 2A முதனிலை - முந்தைய ஆண்டு வினாக்கள்' },
  pyq2SectionHint: {
    en: 'Choose a paper to begin a Group 2 / 2A test.',
    ta: 'குரூப் 2 / 2A தேர்வைத் தொடங்க ஒரு தாளைத் தேர்ந்தெடுக்கவும்.',
  },
  pyq4Badge: {
    en: 'Group 4 / VAO - Previous Year Questions',
    ta: 'குரூப் 4 / VAO - முந்தைய ஆண்டு வினாக்கள்',
  },
  pyq4SectionHint: {
    en: 'Choose a paper to begin a Group 4 / VAO test.',
    ta: 'குரூப் 4 / VAO தேர்வைத் தொடங்க ஒரு தாளைத் தேர்ந்தெடுக்கவும்.',
  },
  pyqPickSection: { en: 'Pick a Section', ta: 'ஒரு பிரிவைத் தேர்ந்தெடுக்கவும்' },
  pyqAllQuestions: { en: 'All Questions', ta: 'அனைத்து வினாக்கள்' },
  pyqAllQuestionsSub: { en: 'Mix every sub-type', ta: 'அனைத்து உட்பிரிவுகளையும் கலந்து' },
  allYears: { en: 'All Years', ta: 'அனைத்து ஆண்டுகள்' },
  filterByYear: { en: 'Exam Year', ta: 'தேர்வு ஆண்டு' },
  samacheerBadge: { en: 'Samacheer Based', ta: 'சமச்சீர் அடிப்படையில்' },
  currentAffairsBadge: { en: 'Current Affairs', ta: 'நடப்பு நிகழ்வுகள்' },
  aptitudeBadge: { en: 'Aptitude', ta: 'திறனாய்வு மற்றும் மனக்கணக்கு' },
  questionBank: { en: 'Question Bank', ta: 'வினாத் தொகுப்பு' },

  // Subject Practice (rewritten bank: subject -> topic -> question type)
  subjectPracticeTitle: { en: 'Subject Practice', ta: 'பாடப் பயிற்சி' },
  subjectPracticeBadge: { en: 'Subject Practice', ta: 'பாடப் பயிற்சி' },
  step3Type: { en: 'Step 3 - Select Question Type', ta: 'படி 3 - வினா வகையைத் தேர்ந்தெடுக்கவும்' },
  typeMixed: { en: 'Mixed (All Types)', ta: 'கலப்பு (அனைத்து வகைகள்)' },
  typeChronological: { en: 'Chronological', ta: 'காலவரிசை' },
  typeMatch: { en: 'Match the Following', ta: 'பொருத்துக' },
  typeAssertionReason: { en: 'Assertion & Reason', ta: 'கூற்று - காரணம்' },
  typeStatements: { en: 'Statements', ta: 'கூற்றுகள்' },
  typeDirect: { en: 'Direct', ta: 'நேரடி' },
  // Subject Practice wizard (3 full-screen steps)
  pickSubject: { en: 'Pick a Subject', ta: 'ஒரு பாடத்தைத் தேர்ந்தெடுக்கவும்' },
  pickTopic: { en: 'Pick a Topic', ta: 'ஒரு தலைப்பைத் தேர்ந்தெடுக்கவும்' },
  pickType: { en: 'Question Type', ta: 'வினா வகை' },
  subjectStepHint: { en: 'Choose a subject to practise', ta: 'பயிற்சி செய்ய ஒரு பாடத்தைத் தேர்ந்தெடுக்கவும்' },
  topicStepHint: { en: 'Choose a topic, or mix them all', ta: 'ஒரு தலைப்பைத் தேர்ந்தெடுக்கவும், அல்லது அனைத்தையும் கலக்கவும்' },
  typeStepHint: { en: 'Pick a style to start the test', ta: 'தேர்வைத் தொடங்க ஒரு வகையைத் தேர்ந்தெடுக்கவும்' },
  allTopicsSub: { en: 'Mix questions from every topic', ta: 'அனைத்து தலைப்புகளிலிருந்தும் கலந்து' },
  byPeriod: { en: 'by period', ta: 'காலகட்ட வாரியாக' },
  byType: { en: 'by type', ta: 'வகை வாரியாக' },

  // History period selector (PYQ History → Ancient / Medieval / Modern)
  historyPeriodBadge: { en: 'History - Previous Year Questions', ta: 'வரலாறு - முந்தைய ஆண்டு வினாக்கள்' },
  historyPickPeriod: { en: 'Select a Period', ta: 'காலகட்டத்தைத் தேர்ந்தெடுக்கவும்' },
  historyPickPeriodSub: {
    en: 'Pick a period to begin a History test (Group 1 Prelims, 2019-2025).',
    ta: 'வரலாறு தேர்வைத் தொடங்க ஒரு காலகட்டத்தைத் தேர்ந்தெடுக்கவும் (குரூப் 1 முதனிலை, 2019-2025).',
  },
  periodAncient: { en: 'Ancient History', ta: 'பண்டைய வரலாறு' },
  periodMedieval: { en: 'Medieval History', ta: 'இடைக்கால வரலாறு' },
  periodModern: { en: 'Modern History & INM', ta: 'நவீன வரலாறு மற்றும் இந்திய தேசிய இயக்கம்' },
  periodAncientSub: { en: 'Prehistory · Indus Valley · Sangam · Mauryas · Guptas', ta: 'தொல்பழங்காலம் · சிந்து சமவெளி · சங்கம் · மௌரியர் · குப்தர்' },
  periodMedievalSub: { en: 'Delhi Sultanate · Mughals · Vijayanagara · Bhakti', ta: 'டெல்லி சுல்தானியம் · முகலாயர் · விஜயநகரம் · பக்தி' },
  periodModernSub: { en: 'Europeans · British Raj · Freedom Struggle', ta: 'ஐரோப்பியர் · பிரிட்டிஷ் ஆட்சி · சுதந்திரப் போராட்டம்' },
  subjectPeriodHint: {
    en: 'Pick a period, then choose a topic within it.',
    ta: 'ஒரு காலகட்டத்தைத் தேர்ந்தெடுத்து, அதில் உள்ள ஒரு தலைப்பைத் தேர்வு செய்யவும்.',
  },
  questionsCount: { en: 'questions', ta: 'வினாக்கள்' },

  // Steps / selectors
  step1Group: { en: 'Step 1 - Select Group', ta: 'படி 1 - குழுவைத் தேர்ந்தெடுக்கவும்' },
  step2Subject: { en: 'Step 2 - Select Subject', ta: 'படி 2 - பாடத்தைத் தேர்ந்தெடுக்கவும்' },
  step1Subject: { en: 'Step 1 - Select Subject', ta: 'படி 1 - பாடத்தைத் தேர்ந்தெடுக்கவும்' },
  step2Standard: { en: 'Step 2 - Select Standard', ta: 'படி 2 - வகுப்பைத் தேர்ந்தெடுக்கவும்' },
  step3Topic: { en: 'Step 3 - Select Topic', ta: 'படி 3 - தலைப்பைத் தேர்ந்தெடுக்கவும்' },
  allTopics: { en: 'All Topics', ta: 'அனைத்து தலைப்புகள்' },
  solGiven: { en: 'Given', ta: 'தரவுகள்' },
  solWorking: { en: 'From question', ta: 'வினாவிலிருந்து' },
  solAsked: { en: 'Asked', ta: 'கேட்டது' },
  solAnswer: { en: 'Answer', ta: 'விடை' },
  explanationLabel: { en: 'Explanation', ta: 'விளக்கம்' },
  step1Category: { en: 'Step 1 - Select Category', ta: 'படி 1 - பிரிவைத் தேர்ந்தெடுக்கவும்' },
  step2Topic: { en: 'Step 2 - Select Topic', ta: 'படி 2 - தலைப்பைத் தேர்ந்தெடுக்கவும்' },
  selectMonth: { en: 'Select Month', ta: 'மாதத்தைத் தேர்ந்தெடுக்கவும்' },
  selectTopic: { en: 'Select Topic', ta: 'தலைப்பைத் தேர்ந்தெடுக்கவும்' },
  topicWise: { en: 'Topic Wise', ta: 'தலைப்பு வாரியாக' },
  monthWise: { en: 'Month Wise', ta: 'மாத வாரியாக' },
  numerics: { en: 'Numerics', ta: 'எண் கணிதம்' },
  reasoning: { en: 'Reasoning', ta: 'பகுத்தறிவு' },

  // PYQ Aptitude type selector (PYQ Aptitude → Numerics / Reasoning)
  pyqAptitudeBadge: { en: 'Aptitude - Previous Year Questions', ta: 'திறனாய்வு - முந்தைய ஆண்டு வினாக்கள்' },
  pyqAptitudePickType: { en: 'Select a Type', ta: 'ஒரு வகையைத் தேர்ந்தெடுக்கவும்' },
  pyqAptitudePickTopic: { en: 'Select a Topic', ta: 'ஒரு தலைப்பைத் தேர்ந்தெடுக்கவும்' },
  pyqAptitudePickTypeSub: {
    en: 'Numerics or reasoning? Pick a style to begin an Aptitude test.',
    ta: 'எண் கணிதமா அல்லது பகுத்தறிவா? திறனாய்வுத் தேர்வைத் தொடங்க ஒரு வகையைத் தேர்ந்தெடுக்கவும்.',
  },
  numericsSub: { en: 'Arithmetic, numbers & calculations', ta: 'எண்கணிதம், எண்கள் மற்றும் கணக்கீடுகள்' },
  reasoningSub: { en: 'Logical & analytical reasoning', ta: 'தர்க்க மற்றும் பகுப்பாய்வு பகுத்தறிவு' },

  // Quiz
  question: { en: 'Question', ta: 'வினா' },
  of: { en: 'of', ta: '/' },
  attempted: { en: 'Attempted', ta: 'முயற்சித்தவை' },
  flagged: { en: 'Flagged', ta: 'குறிக்கப்பட்டவை' },
  prev: { en: 'Prev', ta: 'முந்தைய' },
  next: { en: 'Next', ta: 'அடுத்து' },
  flag: { en: 'Flag', ta: 'குறி' },
  submitTest: { en: 'Submit Test', ta: 'தேர்வைச் சமர்ப்பி' },
  quit: { en: 'Quit', ta: 'வெளியேறு' },
  leaveAppTitle: { en: 'Leave the app?', ta: 'ஆப்-ஐ விட்டு வெளியேறவா?' },
  leaveAppBody: {
    en: 'Are you sure you want to exit TNPSC Mentors?',
    ta: 'TNPSC Mentors-ல் இருந்து வெளியேற விரும்புகிறீர்களா?',
  },
  leaveAppConfirm: { en: 'Yes, exit', ta: 'ஆம், வெளியேறு' },
  stay: { en: 'Stay', ta: 'இரு' },
  abandonTestTitle: { en: 'Leave this test?', ta: 'இந்த தேர்வை விட்டு வெளியேறவா?' },
  abandonTestBody: {
    en: "Your progress will be lost and the test won't be graded.",
    ta: 'உங்கள் முன்னேற்றம் இழக்கப்படும், தேர்வு மதிப்பிடப்படாது.',
  },
  abandonTestConfirm: { en: 'Yes, leave', ta: 'ஆம், வெளியேறு' },
  explanation: { en: 'Explanation', ta: 'விளக்கம்' },
  videoExplanation: { en: 'Video explanation', ta: 'காணொளி விளக்கம்' },
  preparingTest: { en: 'Preparing your test…', ta: 'உங்கள் தேர்வு தயாராகிறது…' },
  min15: {
    en: 'Hold on - please read the question before moving on.',
    ta: 'பொறுங்கள் - தொடரும் முன் வினாவை வாசியுங்கள்.',
  },
  readCarefully: {
    en: 'This is a long question - read it carefully before answering.',
    ta: 'இது நீளமான வினா - பதிலளிக்கும் முன் கவனமாக வாசியுங்கள்.',
  },
  waitSeconds: {
    en: 'You can continue in',
    ta: 'தொடர முடியும்',
  },
  exitTest: { en: 'Exit test', ta: 'தேர்வை விட்டு வெளியேறு' },
  flagForReview: { en: 'Flag this question for review', ta: 'மதிப்பாய்வுக்காக இந்த வினாவைக் குறி' },
  unflagQuestion: { en: 'Unflag this question', ta: 'இந்த வினாவின் குறியை அகற்று' },
  attemptedLabel: { en: 'Attempted', ta: 'முயற்சித்தவை' },
  loadQuestionsError: {
    en: 'Could not load questions. Check your connection and try again.',
    ta: 'வினாக்களை ஏற்ற முடியவில்லை. உங்கள் இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
  },
  backToTestArena: { en: 'Back to Test Arena', ta: 'தேர்வு அரங்கத்திற்குத் திரும்பு' },
  premiumLockLabel: { en: 'Premium', ta: 'பிரீமியம்' },
  subjectFreeUsed: {
    en: 'Your free test for this subject is used up. Go Premium for unlimited subject tests.',
    ta: 'இந்தப் பாடத்திற்கான உங்கள் இலவசத் தேர்வு முடிந்துவிட்டது. வரம்பற்ற பாடத் தேர்வுகளுக்கு பிரீமியம் பெறுங்கள்.',
  },
  noQuestionsLong: {
    en: 'No questions are available for this selection yet. Please choose another topic.',
    ta: 'இந்தத் தேர்வுக்கு இன்னும் வினாக்கள் இல்லை. வேறு தலைப்பைத் தேர்ந்தெடுக்கவும்.',
  },
  // ── Credits (free-tier test balance) ──
  creditsTitle: { en: 'Your credits', ta: 'உங்கள் கிரெடிட்கள்' },
  creditsWord: { en: 'credits', ta: 'கிரெடிட்கள்' },
  creditsPerTest: { en: 'Each question costs 1 credit.', ta: 'ஒவ்வொரு கேள்விக்கும் 1 கிரெடிட்.' },
  creditsDaily: {
    en: 'You get +10 free credits each day you log in — unused daily credits expire at the end of the day.',
    ta: 'நீங்கள் உள்நுழையும் ஒவ்வொரு நாளும் +10 இலவச கிரெடிட்கள் கிடைக்கும் — பயன்படுத்தாத தினசரி கிரெடிட்கள் அன்றைய நாள் முடிவில் காலாவதியாகும்.',
  },
  // Pre-test credit popup (instructions screens, free users only). {n} is
  // replaced with the actual question count (= cost at 1 credit/question).
  creditConfirmTitle: { en: 'Use {n} credits?', ta: '{n} கிரெடிட்கள் பயன்படுத்தவா?' },
  creditConfirmStart: { en: 'OK, start test', ta: 'சரி, தேர்வைத் தொடங்கு' },
  creditDebitNotice: {
    en: '{n} credits will be debited from your balance for this test (1 credit per question).',
    ta: 'இந்தத் தேர்வுக்கு உங்கள் இருப்பிலிருந்து {n} கிரெடிட்கள் கழிக்கப்படும் (ஒரு கேள்விக்கு 1 கிரெடிட்).',
  },
  outOfCredits: {
    en: "You're out of credits. You'll get 10 more free credits tomorrow, or go Premium / Vettri Nichayam for unlimited tests.",
    ta: 'உங்கள் கிரெடிட்கள் தீர்ந்துவிட்டன. நாளை மேலும் 10 இலவச கிரெடிட்கள் கிடைக்கும், அல்லது வரம்பற்ற தேர்வுகளுக்கு பிரீமியம் / வெற்றி நிச்சயம் பெறுங்கள்.',
  },
  mockFreeUsed: {
    en: "You've used your one free mock exam. Go Premium / Vettri Nichayam for all mock exams.",
    ta: 'உங்கள் ஒரு இலவச மாதிரித் தேர்வைப் பயன்படுத்திவிட்டீர்கள். அனைத்து மாதிரித் தேர்வுகளுக்கும் பிரீமியம் / வெற்றி நிச்சயம் பெறுங்கள்.',
  },
  // Dashboard credit wall - the payment banner shown ONLY once credits run out.
  // {b} is replaced with the live balance.
  creditWallTitle: {
    en: 'Your practice is paused - not your exam date.',
    ta: 'உங்கள் பயிற்சி நின்றுவிட்டது - ஆனால் தேர்வுத் தேதி நிற்கவில்லை.',
  },
  creditWallBody: {
    en: 'You have 0 credits left, so no new test can start right now. Aspirants who go unlimited practise every single day - no counting, no waiting. Pick a plan and get straight back to work.',
    ta: 'உங்களிடம் 0 கிரெடிட்கள் உள்ளன, எனவே இப்போது புதிய தேர்வைத் தொடங்க முடியாது. வரம்பற்ற திட்டம் வாங்கிய மாணவர்கள் ஒவ்வொரு நாளும் தடையின்றிப் பயிற்சி செய்கிறார்கள். ஒரு திட்டத்தைத் தேர்ந்தெடுத்து உடனே பயிற்சியைத் தொடருங்கள்.',
  },
  creditsLowTitle: {
    en: 'Only {b} credits left',
    ta: 'இன்னும் {b} கிரெடிட்கள் மட்டுமே',
  },
  creditsLowBody: {
    en: "That's not enough for one full test. Go unlimited before your preparation stops mid-way.",
    ta: 'இது ஒரு முழுத் தேர்வுக்குக் கூடப் போதாது. உங்கள் தயாரிப்பு இடையில் நின்றுவிடும் முன் வரம்பற்ற திட்டத்தைப் பெறுங்கள்.',
  },

  // Profile: role badge, footer, and "last active" relative time.
  aspirant: { en: 'Aspirant', ta: 'விண்ணப்பதாரர்' },
  developedBy: { en: 'Developed by', ta: 'உருவாக்கியவர்' },
  contactSupport: { en: 'Contact support', ta: 'ஆதரவைத் தொடர்புகொள்ளுங்கள்' },
  privacyPolicy: { en: 'Privacy Policy', ta: 'தனியுரிமைக் கொள்கை' },
  termsOfUse: { en: 'Terms of Use', ta: 'பயன்பாட்டு விதிமுறைகள்' },
  refundPolicyLink: { en: 'Refunds', ta: 'பணத்திரும்பப்பெறுதல்' },
  // ─── Signup consent (DPDP: consent by clear affirmative action; a child is
  // anyone under 18, so the age affirmation rides along with it) ─────────────
  // ─── Cookie consent (website only) ────────────────────────────────────────
  cookieTitle: { en: 'Cookies', ta: 'குக்கீகள்' },
  cookieBody: {
    en: 'We use analytics and advertising cookies on this website to understand how it is used. They are optional — the site works fully without them, and the mobile apps use none at all. Details in our',
    ta: 'இந்த இணையதளம் எவ்வாறு பயன்படுத்தப்படுகிறது என்பதைப் புரிந்துகொள்ள பகுப்பாய்வு மற்றும் விளம்பரக் குக்கீகளைப் பயன்படுத்துகிறோம். இவை விருப்பத்தேர்வு — இவை இல்லாமலும் தளம் முழுமையாகச் செயல்படும்; மொபைல் செயலிகளில் இவை எதுவும் இல்லை. விவரங்கள்:',
  },
  cookieAccept: { en: 'Accept', ta: 'ஏற்கிறேன்' },
  cookieReject: { en: 'Reject', ta: 'வேண்டாம்' },
  consentIntro: {
    en: 'I am 18 years or older and I agree to the',
    ta: 'எனக்கு 18 வயது அல்லது அதற்கு மேல் ஆகிறது; நான் ஏற்றுக்கொள்கிறேன்:',
  },
  consentAnd: { en: 'and the', ta: 'மற்றும்' },
  consentAgeSuffix: {
    en: ', including the collection and use of my data as described there.',
    ta: '. அதில் விவரிக்கப்பட்டுள்ளபடி எனது தரவைச் சேகரித்துப் பயன்படுத்துவதற்கும் சம்மதிக்கிறேன்.',
  },
  errConsentRequired: {
    en: 'Please confirm you are 18 or older and accept the Terms and Privacy Policy.',
    ta: 'உங்களுக்கு 18 வயது நிரம்பியுள்ளது என்பதையும், விதிமுறைகள் மற்றும் தனியுரிமைக் கொள்கையை ஏற்கிறீர்கள் என்பதையும் உறுதிப்படுத்தவும்.',
  },
  allRightsReserved: { en: 'All rights reserved.', ta: 'அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.' },
  // Independence notice. Required reading for Play's Impersonation policy and
  // Apple 5.2: an app named after a government exam body must not imply it is
  // run or endorsed by one. The landing page carries this too, but the landing
  // page is web-only — app users are routed straight to /login and would
  // otherwise never see it.
  notAffiliated: {
    en: 'An independent preparation app. Not affiliated with, endorsed by, or connected to the Tamil Nadu Public Service Commission.',
    ta: 'இது ஒரு சுயாதீனமான தயாரிப்பு செயலி. தமிழ்நாடு அரசுப் பணியாளர் தேர்வாணையத்துடன் (TNPSC) எந்தத் தொடர்பும் இல்லை; அதன் அங்கீகாரமும் இல்லை.',
  },
  relJustNow: { en: 'just now', ta: 'இப்போது' },
  relAgo: { en: 'ago', ta: 'முன்' },

  // Quiz dialogs (modals)
  attendanceBelow25: { en: 'Attendance below 25%', ta: 'வருகை 25%க்குக் கீழே' },
  attendanceGateMsg: {
    en: 'You must attempt at least 25% of the questions to unlock the explanations. You can still submit now to see your score only.',
    ta: 'விளக்கங்களைத் திறக்க குறைந்தது 25% வினாக்களை முயற்சிக்க வேண்டும். மதிப்பெண்ணை மட்டும் காண இப்போதே சமர்ப்பிக்கலாம்.',
  },
  attendanceAttemptedLine: { en: 'You have attempted', ta: 'நீங்கள் முயற்சித்துள்ளீர்கள்' },
  submitAnywayScore: { en: 'Submit Anyway (Score Only)', ta: 'எப்படியும் சமர்ப்பி (மதிப்பெண் மட்டும்)' },
  continueTest: { en: 'Continue Test', ta: 'தேர்வைத் தொடரவும்' },
  exitTestTitle: { en: 'Exit Test?', ta: 'தேர்வை விட்டு வெளியேறவா?' },
  exitTestMsg: {
    en: 'What would you like to do with your progress so far?',
    ta: 'இதுவரையிலான உங்கள் முன்னேற்றத்தை என்ன செய்ய விரும்புகிறீர்கள்?',
  },
  submitSeeResults: { en: 'Submit & See Results', ta: 'சமர்ப்பித்து முடிவுகளைக் காண்க' },
  exitWithoutSaving: { en: 'Exit Without Saving', ta: 'சேமிக்காமல் வெளியேறு' },
  keepGoingBtn: { en: 'Keep Going', ta: 'தொடரவும்' },
  submitFailed: { en: 'Submit failed', ta: 'சமர்ப்பிப்பு தோல்வியடைந்தது' },
  retrySubmit: { en: 'Retry Submit', ta: 'மீண்டும் சமர்ப்பி' },
  submitFailedBody: {
    en: 'Could not submit your test — grading happens on the server. Check your connection and retry.',
    ta: 'உங்கள் தேர்வைச் சமர்ப்பிக்க முடியவில்லை — மதிப்பீடு சேவையகத்தில் நடைபெறுகிறது. உங்கள் இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
  },
  submitSessionExpired: {
    en: 'Your session expired. Please sign in again to submit.',
    ta: 'உங்கள் அமர்வு காலாவதியானது. சமர்ப்பிக்க மீண்டும் உள்நுழையவும்.',
  },
  signInAgain: { en: 'Sign In Again', ta: 'மீண்டும் உள்நுழை' },

  // Result page labels
  testCompleteLabel: { en: 'Test complete', ta: 'தேர்வு முடிந்தது' },
  explanationsUnlockedMsg: {
    en: 'explanations are unlocked in the review below.',
    ta: 'கீழே உள்ள மதிப்பாய்வில் விளக்கங்கள் திறக்கப்பட்டுள்ளன.',
  },
  youAttended: { en: 'You attended', ta: 'நீங்கள் முயற்சித்தது' },
  unlockExplanationsMsg: {
    en: 'Attempt at least 25% of questions to unlock explanations.',
    ta: 'விளக்கங்களைத் திறக்க குறைந்தது 25% வினாக்களை முயற்சிக்கவும்.',
  },
  filterAll: { en: 'All', ta: 'அனைத்தும்' },
  filterWrong: { en: 'Wrong', ta: 'தவறு' },
  filterCorrect: { en: 'Correct', ta: 'சரி' },
  filterFlagged: { en: 'Flagged', ta: 'குறிக்கப்பட்டவை' },
  noFilterQuestions: { en: 'No questions in this test.', ta: 'இந்தத் தேர்வில் வினாக்கள் இல்லை.' },

  // Result card (per-question review)
  statusSkipped: { en: 'Skipped', ta: 'தவிர்க்கப்பட்டது' },
  statusCorrect: { en: 'Correct', ta: 'சரி' },
  statusWrong: { en: 'Wrong', ta: 'தவறு' },
  removeBookmark: { en: 'Remove bookmark', ta: 'புத்தகக்குறியை அகற்று' },
  saveQuestion: { en: 'Save question', ta: 'வினாவைச் சேமி' },
  savedTapRemove: { en: 'Saved - tap to remove', ta: 'சேமிக்கப்பட்டது - அகற்ற தட்டவும்' },
  saveForLater: { en: 'Save for later', ta: 'பின்னர் பார்க்கச் சேமி' },
  yourAnswerLabel: { en: 'Your answer', ta: 'உங்கள் பதில்' },
  yourAnswerSuffix: { en: '(your answer)', ta: '(உங்கள் பதில்)' },
  whyAnswerWrong: { en: 'Why your answer', ta: 'உங்கள் பதில் ஏன்' },
  isWrong: { en: 'is wrong:', ta: 'தவறு:' },
  explanationColon: { en: 'Explanation:', ta: 'விளக்கம்:' },
  notAttempted: { en: 'Not attempted', ta: 'முயற்சிக்கப்படவில்லை' },

  // Result
  testComplete: { en: 'Test Complete', ta: 'தேர்வு முடிந்தது' },
  scoreLabel: { en: 'Score', ta: 'மதிப்பெண்' },
  verdictGreat: { en: 'Excellent work!', ta: 'அருமையான செயல்பாடு!' },
  verdictGood: { en: 'Well done - keep it up', ta: 'நன்று - தொடருங்கள்' },
  verdictKeepGoing: { en: 'Keep practising', ta: 'பயிற்சியைத் தொடருங்கள்' },
  accuracy: { en: 'Accuracy', ta: 'துல்லியம்' },
  // Home dashboard stat strip + section labels
  solved: { en: 'Solved', ta: 'தீர்த்தவை' },
  tests: { en: 'Tests', ta: 'தேர்வுகள்' },
  practice: { en: 'Practice', ta: 'பயிற்சி' },
  keepGoingShort: { en: 'Keep going', ta: 'தொடருங்கள்' },
  attended: { en: 'Attended', ta: 'முயற்சித்தவை' },
  timeTaken: { en: 'Time Taken', ta: 'எடுத்த நேரம்' },
  questionBreakdown: { en: 'Question Breakdown', ta: 'வினா விவரம்' },
  retryTest: { en: 'Retry Test', ta: 'மீண்டும் முயற்சி' },
  downloadPdf: { en: 'Download Explanation PDF', ta: 'விளக்க PDF பதிவிறக்கம்' },
  pdfLockedMsg: {
    en: 'Attempt at least 25% of questions to unlock explanations.',
    ta: 'விளக்கங்களைத் திறக்க குறைந்தது 25% வினாக்களை முயற்சிக்கவும்.',
  },

  // Empty / errors
  noQuestions: {
    en: 'No questions are available for this selection yet.',
    ta: 'இந்தத் தேர்வுக்கு இன்னும் வினாக்கள் இல்லை.',
  },

  // Insights / analytics
  insights: { en: 'Mentor Insights', ta: 'வழிகாட்டி பகுப்பாய்வு' },
  insightsTitle: { en: 'Mentor Insights', ta: 'செயல்திறன் பகுப்பாய்வு' },
  testsTaken: { en: 'Tests Taken', ta: 'எடுத்த தேர்வுகள்' },
  avgAccuracy: { en: 'Avg Accuracy', ta: 'சராசரி துல்லியம்' },
  bestScore: { en: 'Best Score', ta: 'சிறந்த மதிப்பெண்' },
  studyTime: { en: 'Study Time', ta: 'படிப்பு நேரம்' },
  focusAreas: { en: 'Focus Areas', ta: 'கவனம் தேவைப்படும் பகுதிகள்' },
  focusHint: {
    en: 'These topics need work - revise and re-attempt them next.',
    ta: 'இந்தத் தலைப்புகளில் கவனம் தேவை - மீள்பார்வை செய்து மீண்டும் முயற்சிக்கவும்.',
  },
  strengths: { en: 'Your Strengths', ta: 'உங்கள் பலங்கள்' },
  bySubject: { en: 'By Subject', ta: 'பாடம் வாரியாக' },
  accuracyTrend: { en: 'Accuracy Trend', ta: 'துல்லிய போக்கு' },
  noData: {
    en: 'Take a few tests and your insights will appear here.',
    ta: 'சில தேர்வுகளை எடுத்தால் உங்கள் பகுப்பாய்வு இங்கே தோன்றும்.',
  },
  learnThis: { en: 'Learn this', ta: 'இதைக் கற்க' },
  studyTip: { en: 'Study Tip', ta: 'படிப்புக் குறிப்பு' },
  resources: { en: 'Study resources', ta: 'படிப்பு வளங்கள்' },
  overallAccuracy: { en: 'Overall Accuracy', ta: 'ஒட்டுமொத்த துல்லியம்' },
  performanceTrend: { en: 'Performance Trend', ta: 'செயல்திறன் போக்கு' },
  recentTests: { en: 'Recent tests', ta: 'சமீபத்திய தேர்வுகள்' },
  questionsAnswered: { en: 'Questions', ta: 'வினாக்கள்' },
  avgScoreLabel: { en: 'Avg Score', ta: 'சராசரி மதிப்பெண்' },
  takeATest: { en: 'Take a test', ta: 'ஒரு தேர்வு எடுக்கவும்' },
  sortAccuracy: { en: 'Accuracy', ta: 'துல்லியம்' },
  sortVolume: { en: 'Most practised', ta: 'அதிகம் பயிற்சி' },
  correctLabel: { en: 'correct', ta: 'சரி' },
  notAttemptedYet: { en: 'Not attempted', ta: 'முயற்சிக்கப்படவில்லை' },

  // Revision
  revision: { en: 'Revision', ta: 'மீள்பார்வை' },
  revisionTitle: { en: 'Smart Revision', ta: 'திறன்மிகு மீள்பார்வை' },
  dueToday: { en: 'Due today', ta: 'இன்று செய்ய வேண்டியவை' },
  startRevision: { en: 'Start Revision', ta: 'மீள்பார்வையைத் தொடங்கு' },
  practiceMistakes: { en: 'Practice your mistakes', ta: 'தவறுகளைப் பயிற்சி செய்' },
  revisionEmpty: {
    en: 'Nothing due. Finish a test - wrong & flagged questions come here for spaced revision.',
    ta: 'எதுவும் இல்லை. ஒரு தேர்வை முடியுங்கள் - தவறான & குறித்த வினாக்கள் மீள்பார்வைக்கு இங்கே வரும்.',
  },
  allCaughtUp: { en: 'All caught up', ta: 'அனைத்தும் முடிந்தது' },

  // ── Topic revision (study-gate + similar-question re-tests) ──
  topicRevisionTitle: { en: 'Topics to revise', ta: 'மீள்பார்க்க வேண்டிய தலைப்புகள்' },
  revReadyTitle: { en: 'Ready to attempt', ta: 'தேர்வுக்குத் தயார்' },
  revStudyingTitle: { en: 'Still studying', ta: 'இன்னும் படிக்க வேண்டியவை' },
  revClearedTitle: { en: 'Cleared', ta: 'முடிக்கப்பட்டது' },
  revTakeTest: { en: 'Take revision test', ta: 'மீள்பார்வைத் தேர்வு எடு' },
  revUnlocksIn: { en: 'Unlocks in', ta: 'திறக்க' },
  revUnlocksAt: { en: 'Unlocks', ta: 'திறக்கும்' },
  revStudyHint: {
    en: 'Revise this topic before re-testing. Sleep hours (11pm-7am) are not counted.',
    ta: 'மீண்டும் தேர்வு எழுதும் முன் இந்தத் தலைப்பை மீள்பார்க்கவும். தூக்க நேரம் (இரவு 11 - காலை 7) கணக்கிடப்படாது.',
  },
  revDismiss: { en: 'Remove', ta: 'அகற்று' },
  revDismissTitle: { en: 'Remove this revision?', ta: 'இந்த மீள்பார்வையை அகற்றவா?' },
  revDismissMsg: {
    en: "This removes the topic from your revisions. It won't come back unless you score 40% or below on it again.",
    ta: 'இது தலைப்பை உங்கள் மீள்பார்வையிலிருந்து அகற்றும். மீண்டும் 40% அல்லது அதற்குக் கீழ் பெற்றால் தவிர இது திரும்பி வராது.',
  },
  revAttempts: { en: 'attempts', ta: 'முயற்சிகள்' },
  revBest: { en: 'Best', ta: 'சிறந்தது' },
  revLast: { en: 'Last', ta: 'கடைசி' },
  revTopicEmpty: {
    en: 'No topics to revise yet. Score 40% or below on a topic test and it lands here - study first, then retry with fresh questions.',
    ta: 'மீள்பார்க்க தலைப்புகள் இல்லை. ஒரு தலைப்புத் தேர்வில் 40% அல்லது அதற்குக் கீழ் பெற்றால் அது இங்கே வரும் - முதலில் படியுங்கள், பிறகு புதிய வினாக்களுடன் மீண்டும் முயற்சிக்கவும்.',
  },
  revStudyFirstToast: {
    en: 'Study this topic first - the test is still locked.',
    ta: 'முதலில் இந்தத் தலைப்பைப் படியுங்கள் - தேர்வு இன்னும் பூட்டப்பட்டுள்ளது.',
  },
  // Analytics
  revAnalyticsTitle: { en: 'Your revision progress', ta: 'உங்கள் மீள்பார்வை முன்னேற்றம்' },
  revStatCleared: { en: 'Cleared', ta: 'முடிந்தது' },
  revStatPending: { en: 'To revise', ta: 'மீள்பார்க்க' },
  revStatReady: { en: 'Ready now', ta: 'இப்போது தயார்' },
  revStatImprovement: { en: 'Improvement', ta: 'முன்னேற்றம்' },
  revStatAvgScore: { en: 'Avg score', ta: 'சராசரி மதிப்பெண்' },
  revStatAttempts: { en: 'Attempts', ta: 'முயற்சிகள்' },
  revFocusSubjects: { en: 'Focus subjects', ta: 'கவனம் தேவை பாடங்கள்' },
  revNeedsWork: { en: 'Needs the most work', ta: 'அதிக கவனம் தேவை' },
  // Result-page notice
  revSavedTitle: { en: 'Saved to Revisions', ta: 'மீள்பார்வைக்குச் சேமிக்கப்பட்டது' },
  revSavedBody: {
    en: 'Revise this topic to improve. Your re-test unlocks after study time',
    ta: 'மேம்பட இந்தத் தலைப்பை மீள்பார்க்கவும். படிப்பு நேரத்திற்குப் பிறகு உங்கள் மீள்தேர்வு திறக்கும்',
  },
  revSavedSleep: {
    en: 'sleep hours (11pm-7am) are not counted.',
    ta: 'தூக்க நேரம் (இரவு 11 - காலை 7) கணக்கிடப்படாது.',
  },
  revGoToRevision: { en: 'Go to Revisions', ta: 'மீள்பார்வைக்குச் செல்' },
  revClearedNoticeTitle: { en: 'Revision cleared!', ta: 'மீள்பார்வை முடிந்தது!' },
  revClearedNoticeBody: {
    en: "Great - you passed this topic's re-test. It has been removed from your revisions.",
    ta: 'அருமை - இந்தத் தலைப்பின் மீள்தேர்வில் வெற்றி பெற்றீர்கள். இது உங்கள் மீள்பார்வையிலிருந்து அகற்றப்பட்டது.',
  },
  // Relative-time units (compact)
  revDays: { en: 'd', ta: 'நா' },
  revHours: { en: 'h', ta: 'ம' },
  revMinutes: { en: 'm', ta: 'நி' },

  // Mock tests
  mockTest: { en: 'Mock Test', ta: 'மாதிரித் தேர்வு' },
  mockTests: { en: 'Mock Tests', ta: 'மாதிரித் தேர்வுகள்' },
  // Dashboard hero tile only (TestArenaPage) - deliberately separate from
  // mockTests, which is also read as a breadcrumb/back-button label on the
  // mock quiz/instructions pages and shouldn't carry this longer marketing copy.
  mockHeroTitle: {
    en: 'Practice Group 1 Mock Test for Free',
    ta: 'குரூப் 1 மாதிரித் தேர்வை இலவசமாகப் பயிற்சி செய்யுங்கள்',
  },
  fullLength: { en: 'Full-length exam simulation', ta: 'முழு நீள தேர்வு உருவகப்படுத்துதல்' },
  negMarking: { en: 'Negative marking', ta: 'எதிர்மறை மதிப்பெண்' },
  startMock: { en: 'Start Mock', ta: 'மாதிரித் தேர்வைத் தொடங்கு' },

  // Mock test - group exam vs subject/topic vs full mock exams
  mockGroupExam: { en: 'Group Exam', ta: 'குரூப் தேர்வு' },
  mockSubjectExam: { en: 'Subject / Topic', ta: 'பாடம் / தலைப்பு' },
  mockFullExams: { en: 'Mock Exams', ta: 'மாதிரித் தேர்வுகள்' },
  mockFullSub: {
    en: 'Full-length 200-question mock papers. Each can be attempted twice.',
    ta: '200 வினாக்கள் கொண்ட முழு நீள மாதிரித் தேர்வுகள். ஒவ்வொன்றையும் இருமுறை எழுதலாம்.',
  },
  mockExamsEmpty: { en: 'No mock exams are available yet.', ta: 'இன்னும் மாதிரித் தேர்வுகள் எதுவும் இல்லை.' },

  // Test Series - the scheduled-series hub (nav tab, Practice-section card,
  // page header). Fans out into per-product tabs (Vettri Nichayam / Rank
  // Booster / Overall) via TestSeriesPage's HubTab switcher.
  testSeries: { en: 'Test Series', ta: 'தேர்வுத் தொடர்' },
  testSeriesTitle: { en: 'Test Series', ta: 'தேர்வுத் தொடர்' },
  // Neutral hub title for tabs that aren't the Group 1 series itself (Rank
  // Booster / Overall) — kept as its own key since testSeriesTitle is also
  // read as the offer-sheet title for the Group 1 (Vettri) tab specifically.
  testSeriesHubTitle: { en: 'Test Series', ta: 'தேர்வுத் தொடர்' },
  // Hub tab-pill labels ONLY (TestSeriesPage's tab capsule) — deliberately
  // separate from vettriTitle/rankBoosterTab, which are also read by
  // VettriCard, TestArenaPage tiles and the SuperAdmin series switcher; the
  // pill wants a shorter, product-agnostic "Group N Test Series" label
  // without touching those other surfaces.
  testSeriesTabG1: { en: 'Group 1 Test Series', ta: 'குரூப் 1 தேர்வுத் தொடர்' },
  testSeriesTabG2: { en: 'Group II/IIA Test Series', ta: 'குரூப் II/IIA தேர்வுத் தொடர்' },
  testSeriesArenaSub: { en: 'Scheduled test series', ta: 'திட்டமிடப்பட்ட தேர்வுத் தொடர்கள்' },
  testSeriesSub: {
    en: 'A scheduled marathon of full-length papers. Each unlocks on its date and can be attempted twice.',
    ta: 'திட்டமிடப்பட்ட முழு நீளத் தேர்வு மாரத்தான். ஒவ்வொன்றும் அதன் தேதியில் திறக்கும்; இருமுறை எழுதலாம்.',
  },
  testSeriesHubSub: {
    en: 'Pick a series below — each unlocks on its own schedule and can be attempted twice.',
    ta: 'கீழே ஒரு தொடரைத் தேர்ந்தெடுக்கவும் — ஒவ்வொன்றும் அதன் சொந்த அட்டவணையில் திறக்கும்; இருமுறை எழுதலாம்.',
  },
  tsOverallTab: { en: 'Analytics', ta: 'பகுப்பாய்வு' },
  testSeriesEmpty: {
    en: 'No tests have been scheduled yet.',
    ta: 'இன்னும் எந்தத் தேர்வும் திட்டமிடப்படவில்லை.',
  },
  testSeriesLockedPremium: {
    en: 'Unlock the full Test Series with Vettri Nichayam or Premium',
    ta: 'முழுத் தேர்வுத் தொடரை வெற்றி நிச்சயம் அல்லது பிரீமியம் மூலம் திறக்கலாம்',
  },
  unlocksOn: { en: 'Unlocks', ta: 'திறக்கும்' },
  availableNow: { en: 'Available now', ta: 'இப்போது கிடைக்கிறது' },
  scheduledOn: { en: 'Scheduled', ta: 'திட்டமிடப்பட்டது' },
  // Test Series promo strip — rendered as the VettriCard's header. The price
  // sits right below in the card, so it carries an "included" pill, not ₹899.
  marathonBannerTitle: { en: 'Test Series 2026', ta: 'தேர்வுத் தொடர் 2026' },
  marathonBannerSub: {
    en: '13 Group 1 papers on a fixed schedule: 10 sectional + 3 full mocks',
    ta: 'திட்டமிட்ட அட்டவணையில் 13 குரூப் 1 தேர்வுத் தாள்கள்: 10 பிரிவு வாரியான + 3 முழு மாதிரி',
  },
  marathonIncluded: { en: 'Included in this plan', ta: 'இந்தத் திட்டத்தில் அடங்கும்' },

  // Group II/ IIA- Rank Booster — a second, independent scheduled test series.
  // Every surface (including the hub tab pill) spells out the full name,
  // matching how VettriCard/PremiumCard always spell out "Vettri Nichayam" in
  // full — the tab bar wraps a two-line label rather than truncate it.
  rankBoosterPageTitle: { en: 'Group II/ IIA- Rank Booster', ta: 'குரூப் II/ IIA - Rank Booster' },
  rankBoosterPageSub: {
    en: 'Group II/IIA prelims practice: 23 full-length papers, each unlocking on its date. Attempt each up to twice.',
    ta: 'குரூப் II/IIA முதல்நிலைத் தேர்வுப் பயிற்சி: 23 முழு நீளத் தேர்வுத் தாள்கள், ஒவ்வொன்றும் அதன் தேதியில் திறக்கும். ஒவ்வொன்றையும் இருமுறை வரை எழுதலாம்.',
  },
  rankBoosterArenaTitle: { en: 'Group II/ IIA- Rank Booster', ta: 'குரூப் II/ IIA - Rank Booster' },
  rankBoosterArenaSub: { en: 'Group II/IIA scheduled series', ta: 'குரூப் II/IIA திட்டமிட்ட தொடர்' },
  /** Superadmin series switcher only — the hub tab pill now uses the full name. */
  rankBoosterTab: { en: 'Group II/ IIA- Rank Booster', ta: 'குரூப் II/ IIA - Rank Booster' },
  rankBoosterBadge: { en: 'Group II/ IIA- Rank Booster', ta: 'குரூப் II/ IIA - Rank Booster' },
  rankBoosterTitle: { en: 'Group II/ IIA- Rank Booster', ta: 'குரூப் II/ IIA - Rank Booster' },
  rankBoosterValidity: { en: '90-day access', ta: '90 நாள் அணுகல்' },
  // Independence Day Month Offer — orange badge, matches the marketing flyer.
  rankBoosterOfferBadge: {
    en: 'Independence Day Offer',
    ta: 'சுதந்திர தின சலுகை',
  },
  rankBoosterOfferNote: {
    en: 'Independence Day Month Offer price of ₹1,249 (MRP ₹1,800) is valid till 31 August 2026 only.',
    ta: 'சுதந்திர தின மாத சலுகை விலை ₹1,249 (MRP ₹1,800) 31 ஆகஸ்ட் 2026 வரை மட்டுமே செல்லுபடியாகும்.',
  },
  rankBoosterPerk1: {
    en: '23 full-length Group II/IIA prelims papers, each attempted up to twice',
    ta: '23 முழு நீள குரூப் II/IIA முதல்நிலைத் தேர்வுத் தாள்கள், ஒவ்வொன்றும் இருமுறை வரை',
  },
  // Same bonus mechanism as VettriCard's vettriBonus1-3 (the credit gate's
  // creditsUnlimited flag covers Rank Booster too) — reworded to this plan's
  // own 90-day window instead of Vettri's 2-month one.
  rankBoosterBonus1: {
    en: 'Unlimited PYQ tests (Premium feature · 90-day access)',
    ta: 'வரம்பற்ற முந்தைய ஆண்டு (PYQ) தேர்வுகள் (பிரீமியம் அம்சம் · 90 நாள் அணுகல்)',
  },
  rankBoosterBonus2: {
    en: 'Unlimited Current Affairs tests (Premium feature · 90-day access)',
    ta: 'வரம்பற்ற நடப்பு நிகழ்வுத் தேர்வுகள் (பிரீமியம் அம்சம் · 90 நாள் அணுகல்)',
  },
  rankBoosterBonus3: {
    en: 'Subject-wise test questions (3000+), unlimited · 90-day access and much more',
    ta: 'பாட வாரியான தேர்வு வினாக்கள் (3000+), வரம்பற்றது · 90 நாள் அணுகல் மற்றும் இன்னும் பல',
  },
  rankBoosterBonus4: {
    en: 'Bilingual questions with full explanations',
    ta: 'இருமொழி வினாக்கள் முழு விளக்கங்களுடன்',
  },
  rankBoosterBonus5: {
    en: 'Test 1 is free for everyone — try before you enroll',
    ta: 'தேர்வு 1 அனைவருக்கும் இலவசம் — சேருமுன் முயற்சிக்கவும்',
  },
  rankBoosterGet: {
    en: 'Get Group II/ IIA- Rank Booster',
    ta: 'குரூப் II/ IIA - Rank Booster பெறுங்கள்',
  },
  // Promo strip — mirrors marathonBannerTitle/Sub/Included (VettriCard's Test
  // Marathon header) — used inside PremiumCard and the Test Marathon hub page.
  rankBoosterBannerTitle: { en: 'Group II/ IIA- Rank Booster', ta: 'குரூப் II/ IIA - Rank Booster' },
  rankBoosterBannerSub: {
    en: '23 full-length Group II/IIA prelims papers on a fixed schedule',
    ta: 'திட்டமிட்ட அட்டவணையில் 23 முழு நீள குரூப் II/IIA முதல்நிலைத் தேர்வுத் தாள்கள்',
  },
  // Group 1 Mock Test Pack banner (Test Marathon hub) - mirrors PricingCards'
  // Landing-page copy for the same pack (mockTitle/MOCK_ITEMS[0]).
  mockPackBannerTitle: { en: 'Group 1 Mock Test Pack', ta: 'குரூப் 1 மாதிரித் தேர்வு தொகுப்பு' },
  mockPackBannerSub: {
    en: '6 full-length Group 1 mock tests, server-graded',
    ta: '6 முழு நீள குரூப் 1 மாதிரித் தேர்வுகள் (Server-graded)',
  },
  mockPackValidity: { en: '80-day access', ta: '80 நாள் அணுகல்' },
  mockPackPerk2: {
    en: 'Explanation PDF to download for the 6 mock tests',
    ta: '6 மாதிரித் தேர்வுகளுக்கான விளக்கங்கள் PDF ஆக பதிவிறக்கம்',
  },
  // The differentiator this plan actually grants server-side (see
  // DAILY_CREDIT_GRANT_BOOSTED in server/src/lib/credits.ts) - same
  // use-it-or-lose-it daily rule as the free tier's 10, just a bigger number
  // while this plan is active.
  mockPackPerk3: {
    en: '50 credits every day (instead of the usual 10) while this plan is active',
    ta: 'இந்த திட்டம் செயலில் இருக்கும் வரை தினமும் 50 கிரெடிட்கள் (வழக்கமான 10 க்கு பதிலாக)',
  },
  mockPackGet: { en: 'Get Mock Tests', ta: 'மாதிரி தேர்வுகள் பெறு' },
  rankBoosterIncluded: { en: 'Included in this plan', ta: 'இந்தத் திட்டத்தில் அடங்கும்' },
  // Dashboard discovery banner (Test Arena).
  rankBoosterDashBadge: { en: 'New', ta: 'புதியது' },
  rankBoosterDashTitle: { en: 'Group II/ IIA- Rank Booster', ta: 'குரூப் II/ IIA - Rank Booster' },
  rankBoosterDashSub: {
    en: '23 full-length Group II/IIA prelims papers — Test 1 free',
    ta: '23 முழு நீள குரூப் II/IIA முதல்நிலைத் தேர்வுத் தாள்கள் — தேர்வு 1 இலவசம்',
  },
  rankBoosterDashCta: { en: 'Explore', ta: 'பார்க்க' },

  // Test Marathon — Analytics tab
  tsTabPapers: { en: 'Papers', ta: 'தேர்வுகள்' },
  tsTabAnalytics: { en: 'Analytics', ta: 'பகுப்பாய்வு' },
  tsAnalyticsEmpty: {
    en: 'Attempt a paper to unlock your analytics — your scores, weak subjects and the question types to train on.',
    ta: 'உங்கள் பகுப்பாய்வைத் திறக்க ஒரு தேர்வை எழுதுங்கள் — உங்கள் மதிப்பெண்கள், பலவீனமான பாடங்கள் மற்றும் பயிற்சி செய்ய வேண்டிய வினா வகைகள்.',
  },
  tsAttempts: { en: 'Attempts', ta: 'முயற்சிகள்' },
  tsAvgScore: { en: 'Avg score', ta: 'சராசரி' },
  tsBestScore: { en: 'Best', ta: 'சிறந்தது' },
  tsYourAttempts: { en: 'Your attempts', ta: 'உங்கள் முயற்சிகள்' },
  tsFocusTitle: { en: 'What to focus on', ta: 'எதில் கவனம் செலுத்த வேண்டும்' },
  tsFocusHint: {
    en: 'Your weakest subjects across all attempts — tap Practice to revise them.',
    ta: 'அனைத்து முயற்சிகளிலும் உங்கள் பலவீனமான பாடங்கள் — திருத்த பயிற்சியைத் தட்டவும்.',
  },
  tsProgress: { en: 'Your progress', ta: 'உங்கள் முன்னேற்றம்' },
  tsSubjectPerf: { en: 'Subject performance', ta: 'பாட வாரியான செயல்திறன்' },
  tsQuestions: { en: 'Questions', ta: 'வினாக்கள்' },
  tsAverage: { en: 'avg', ta: 'சராசரி' },
  tsLatest: { en: 'Latest', ta: 'சமீபத்தியது' },
  tsAccuracy: { en: 'accuracy', ta: 'திறன்' },
  tsTypeMix: { en: 'Question mix', ta: 'வினா வகைக் கலவை' },
  tsTypeAccuracy: { en: 'Accuracy by type', ta: 'வகை வாரியான திறன்' },
  // Study plan (advice) — {delta}/{last}/{subject}/{acc}/{type} are filled in code
  tsAdviceTitle: { en: 'Your study plan', ta: 'உங்கள் படிப்புத் திட்டம்' },
  tsAdviceSub: {
    en: 'Built from your attempts — what to revise before the next paper.',
    ta: 'உங்கள் முயற்சிகளிலிருந்து உருவாக்கப்பட்டது — அடுத்த தேர்வுக்கு முன் எதைத் திருத்த வேண்டும்.',
  },
  tsAdviceTrendUp: {
    en: 'Your scores are climbing — up {delta}% since your first paper. Keep the momentum.',
    ta: 'உங்கள் மதிப்பெண்கள் உயர்கின்றன — முதல் தேர்விலிருந்து {delta}% அதிகரிப்பு. இந்த வேகத்தைத் தொடருங்கள்.',
  },
  tsAdviceTrendDown: {
    en: 'Scores have dipped {delta}% — revisit the fundamentals before your next paper.',
    ta: 'மதிப்பெண்கள் {delta}% குறைந்துள்ளன — அடுத்த தேர்வுக்கு முன் அடிப்படைகளை மீண்டும் பாருங்கள்.',
  },
  tsAdviceTrendFlat: {
    en: 'Scores are steady around {last}% — push into your weak areas to break through.',
    ta: 'மதிப்பெண்கள் {last}% ஐ சுற்றி நிலையாக உள்ளன — முன்னேற பலவீனமான பகுதிகளில் கவனம் செலுத்துங்கள்.',
  },
  tsAdviceFocus: {
    en: 'Prioritise {subject} — you are at {acc}%. Revise it before the next attempt.',
    ta: '{subject} பாடத்திற்கு முன்னுரிமை கொடுங்கள் — நீங்கள் {acc}% இல் உள்ளீர்கள். அடுத்த முயற்சிக்கு முன் திருத்துங்கள்.',
  },
  tsAdviceType: {
    en: 'You lose the most marks on {type} questions ({acc}%). Drill these for easy gains.',
    ta: '{type} வினாக்களில் நீங்கள் அதிக மதிப்பெண்களை இழக்கிறீர்கள் ({acc}%). எளிதாக மதிப்பெண் பெற இவற்றைப் பயிற்சி செய்யுங்கள்.',
  },
  tsAdviceStrength: {
    en: 'Strongest area: {subject} ({acc}%). Keep it warm with quick revisions.',
    ta: 'வலிமையான பகுதி: {subject} ({acc}%). விரைவான திருத்தங்களால் அதைத் தக்கவைத்துக் கொள்ளுங்கள்.',
  },
  tsByType: { en: 'By question type', ta: 'வினா வகை வாரியாக' },
  tsPractice: { en: 'Practice', ta: 'பயிற்சி' },
  tsOfAttempted: { en: 'correct', ta: 'சரி' },
  tsNoWeak: {
    en: "No weak areas yet — you're scoring well across the board. Keep it up!",
    ta: 'இதுவரை பலவீனமான பகுதிகள் இல்லை — எல்லாப் பாடங்களிலும் நன்றாக மதிப்பெண் பெறுகிறீர்கள். தொடருங்கள்!',
  },
  tsFocusBanner: { en: 'Before your next test, strengthen these areas', ta: 'அடுத்த தேர்வுக்கு முன், இந்தப் பகுதிகளை வலுப்படுத்துங்கள்' },
  tsSeeAnalytics: { en: 'See analytics', ta: 'பகுப்பாய்வைப் பார்' },
  qtypeMatch: { en: 'Match the following', ta: 'பொருத்துக' },
  qtypeAssertion: { en: 'Assertion & Reason', ta: 'கூற்று & காரணம்' },
  qtypeStatement: { en: 'Statement-based', ta: 'கூற்று அடிப்படையிலான' },
  qtypeAptitude: { en: 'Aptitude & Reasoning', ta: 'திறனறிவு & பகுத்தறிவு' },
  qtypeFactual: { en: 'Direct / Factual', ta: 'நேரடி / உண்மை' },
  // Superadmin
  testSeriesTab: { en: 'Test Series', ta: 'தேர்வுத் தொடர்' },
  // Shared by both scheduled test-series tabs (Test Marathon / Rank Booster) —
  // the specific series name shows separately right below in the toggle row.
  testSeriesShowTitle: { en: 'Series visibility', ta: 'தொடர் காட்சி' },
  testSeriesShowSub: {
    en: 'Show or hide this series’ tab and Test Arena tile for all students.',
    ta: 'அனைத்து மாணவர்களுக்கும் இந்தத் தொடரின் தாவல் மற்றும் டைலைக் காட்டு அல்லது மறை.',
  },
  testSeriesTierFree: { en: 'Free trial', ta: 'இலவச முயற்சி' },
  testSeriesTierPaid: { en: 'Paid (bundle)', ta: 'கட்டணம் (திட்டம்)' },
  availabilityAuto: { en: 'Auto (by date)', ta: 'தானியங்கி (தேதிப்படி)' },
  availabilityOpen: { en: 'Force open', ta: 'கட்டாயம் திற' },
  availabilityClosed: { en: 'Force closed', ta: 'கட்டாயம் மூடு' },

  // ─── Vettri Nichayam bundle (₹999: 13 mock exams + unlimited PYQ & CA) ─────
  vettriNav: { en: 'Vettri', ta: 'வெற்றி' },
  vettriBadge: { en: 'Vettri Nichayam', ta: 'வெற்றி நிச்சயம்' },
  vettriTitle: { en: 'Vettri Nichayam', ta: 'வெற்றி நிச்சயம்' },
  vettriArenaSub: {
    en: '13 mock exams · unlimited PYQ & CA · 2 months',
    ta: '13 மாதிரித் தேர்வுகள் · வரம்பற்ற PYQ & CA · 2 மாதம்',
  },
  vettriSub: {
    en: 'A two-month program: 13 full-length mock exams with unlimited attempts, plus unlimited PYQ and Current Affairs tests.',
    ta: 'இரண்டு மாத திட்டம்: 13 முழு நீள மாதிரித் தேர்வுகள் - வரம்பற்ற முயற்சிகள்; மேலும் வரம்பற்ற PYQ மற்றும் நடப்பு நிகழ்வுத் தேர்வுகள்.',
  },
  vettriValidity: { en: 'Valid for two months', ta: 'இரண்டு மாதங்களுக்கு செல்லுபடியாகும்' },
  vettriMonthValidity: { en: 'One month (first half)', ta: 'ஒரு மாதம் (முதல் பாதி)' },
  vettriMonthNote: {
    en: '₹499 covers only the first month of this two-month program. Pay ₹499 again for the second month, or you won’t be able to access the second half.',
    ta: '₹499 இந்த இரண்டு மாத திட்டத்தின் முதல் மாதத்தை மட்டுமே உள்ளடக்கும். இரண்டாவது மாதத்திற்கு ₹499 மீண்டும் செலுத்துங்கள், இல்லையெனில் இரண்டாவது பாதியை அணுக முடியாது.',
  },
  vettriFullNote: {
    en: 'Test series questions will be available for 12 months. You get Premium access for 2 months with this plan.',
    ta: 'தேர்வுத் தொடர் வினாக்கள் 12 மாதங்களுக்குக் கிடைக்கும். இந்தத் திட்டத்துடன் 2 மாதங்களுக்கு பிரீமியம் அணுகல் கிடைக்கும்.',
  },
  vettriPlanFull: { en: 'One-time', ta: 'ஒருமுறை' },
  vettriPlanMonth: { en: 'Installment', ta: 'தவணை' },
  vettriFullSuffix: { en: 'for 2 months', ta: '2 மாதங்களுக்கு' },
  vettriMonthSuffix: { en: 'per month', ta: 'மாதத்திற்கு' },
  // The perk sentence is split so "download the schedule" renders as an INLINE
  // link to the flyer PDF (VettriCard appends vettriPerk1Link as the anchor).
  vettriPerk1: {
    en: '13 mock tests (10 sectional / 3 full mock)',
    ta: '13 மாதிரித் தேர்வுகள் (10 பிரிவு வாரியான / 3 முழு மாதிரி)',
  },
  vettriPerk1Link: {
    en: 'download the schedule (PDF)',
    ta: 'அட்டவணையை பதிவிறக்க (PDF)',
  },
  // "Bonus" extras box under the core perk.
  vettriBonusTitle: { en: 'Bonus', ta: 'போனஸ்' },
  vettriBonus1: {
    en: 'Unlimited PYQ tests (Premium feature · 2-month access)',
    ta: 'வரம்பற்ற முந்தைய ஆண்டு (PYQ) தேர்வுகள் (பிரீமியம் அம்சம் · 2 மாத அணுகல்)',
  },
  vettriBonus2: {
    en: 'Unlimited Current Affairs tests (Premium feature · 2-month access)',
    ta: 'வரம்பற்ற நடப்பு நிகழ்வுத் தேர்வுகள் (பிரீமியம் அம்சம் · 2 மாத அணுகல்)',
  },
  vettriBonus3: {
    en: 'Subject-wise test questions (3000+), unlimited · 2-month access and much more',
    ta: 'பாட வாரியான தேர்வு வினாக்கள் (3000+), வரம்பற்றது · 2 மாத அணுகல் மற்றும் இன்னும் பல',
  },
  vettriGet: { en: 'Get Vettri Nichayam', ta: 'வெற்றி நிச்சயம் பெறுங்கள்' },
  // Vettri-first suggestion shown before a paid Premium checkout.
  vettriSuggestTitle: { en: 'Before you buy Premium…', ta: 'பிரீமியம் வாங்கும் முன்…' },
  vettriSuggestBody: {
    en: 'Vettri Nichayam gives you the 13-exam marathon plus unlimited PYQ, Current Affairs and subject tests - much better value for money.',
    ta: 'வெற்றி நிச்சயத்தில் 13 மாதிரித் தேர்வுகளுடன் வரம்பற்ற PYQ, நடப்பு நிகழ்வுகள் & பாடத் தேர்வுகளும் கிடைக்கும் - பணத்திற்கு மிகச் சிறந்த மதிப்பு.',
  },
  vettriSuggestMonths: { en: '2 months', ta: '2 மாதங்கள்' },
  vettriSuggestPremiumMonths: { en: '6 months', ta: '6 மாதங்கள்' },
  vettriSuggestGo: { en: 'View Vettri Nichayam', ta: 'வெற்றி நிச்சயம் பார்க்க' },
  vettriSuggestStay: { en: 'Continue with Premium', ta: 'பிரீமியத்துடன் தொடர' },
  vettriThanks: {
    en: 'Welcome to Vettri Nichayam! Everything is unlocked.',
    ta: 'வெற்றி நிச்சயத்திற்கு வரவேற்கிறோம்! அனைத்தும் திறக்கப்பட்டது.',
  },
  vettriEmpty: { en: 'No exams are available yet.', ta: 'இன்னும் தேர்வுகள் எதுவும் கிடைக்கவில்லை.' },
  // Offer sheet — the paywall popup raised for non-paid learners (Test Marathon).
  offerSheetHint: {
    en: 'Swipe down or close to see the tests',
    ta: 'தேர்வுகளைப் பார்க்க கீழே இழுக்கவும் அல்லது மூடவும்',
  },
  offerSheetSkip: { en: 'Skip and see the tests', ta: 'தவிர்த்து தேர்வுகளைப் பார்க்க' },
  vettriOnly: { en: 'Vettri', ta: 'வெற்றி' },
  vettriUnlimited: { en: 'Unlimited attempts', ta: 'வரம்பற்ற முயற்சிகள்' },
  vettriLocked: {
    en: 'Unlock Vettri Nichayam to take these exams',
    ta: 'இந்தத் தேர்வுகளை எழுத வெற்றி நிச்சயத்தைத் திறங்கள்',
  },
  lockedLabel: { en: 'Locked', ta: 'பூட்டப்பட்டது' },
  topicFreeUsed: {
    en: "You've used your free test for this topic. Get unlimited tests with Vettri Nichayam or Premium.",
    ta: 'இந்தத் தலைப்பிற்கான உங்கள் இலவசத் தேர்வைப் பயன்படுத்திவிட்டீர்கள். வெற்றி நிச்சயம் அல்லது பிரீமியத்துடன் வரம்பற்ற தேர்வுகளைப் பெறுங்கள்.',
  },
  // Superadmin — Vettri tab
  vettriTab: { en: 'Vettri', ta: 'வெற்றி' },
  vettriShowTitle: { en: 'Vettri Nichayam visibility', ta: 'வெற்றி நிச்சயம் காட்சி' },
  vettriShowSub: {
    en: 'Show or hide the Vettri Nichayam tab and Test Arena tile for all students.',
    ta: 'அனைத்து மாணவர்களுக்கும் வெற்றி நிச்சயம் தாவல் மற்றும் டைலைக் காட்டு அல்லது மறை.',
  },

  premiumOnly: { en: 'Premium', ta: 'பிரீமியம்' },
  examLocked: {
    en: 'Upgrade to Premium to unlock this exam',
    ta: 'இந்தத் தேர்வைத் திறக்க பிரீமியத்திற்கு மேம்படுத்துங்கள்',
  },
  examCompleted: { en: 'Completed', ta: 'முடிந்தது' },
  attemptWord: { en: 'Attempt', ta: 'முயற்சி' },
  mockGroupSub: {
    en: 'Full-length exam following the 2024/2025 TNPSC pattern',
    ta: '2024/2025 TNPSC முறையைப் பின்பற்றும் முழு நீளத் தேர்வு',
  },
  mockSubjectSub: {
    en: 'Practice a single subject or topic at your chosen difficulty',
    ta: 'நீங்கள் தேர்ந்தெடுத்த சிரமத்தில் ஒரு பாடம் அல்லது தலைப்பைப் பயிற்சி செய்யுங்கள்',
  },
  diffLevel: { en: 'Difficulty', ta: 'சிரமம்' },
  diffEasy: { en: 'Easy', ta: 'எளிது' },
  diffMedium: { en: 'Medium', ta: 'நடுத்தரம்' },
  diffHard: { en: 'Hard', ta: 'கடினம்' },
  diffMixed: { en: 'Mixed', ta: 'கலந்தது' },
  questionDistribution: { en: 'Question distribution', ta: 'வினா பகிர்வு' },
  startExam: { en: 'Start Exam', ta: 'தேர்வைத் தொடங்கு' },
  examSetup: { en: 'Questions & time', ta: 'வினாக்கள் & நேரம்' },
  timeLimit: { en: 'Time limit', ta: 'நேர வரம்பு' },
  minutesUnit: { en: 'min', ta: 'நிமி' },

  // Mock instructions
  examInstructions: { en: 'Exam Instructions', ta: 'தேர்வு வழிமுறைகள்' },
  instrFullscreen: {
    en: 'The test runs in full-screen. Exiting full-screen or switching tabs is recorded as a violation.',
    ta: 'தேர்வு முழுத் திரையில் இயங்கும். முழுத் திரையிலிருந்து வெளியேறுவது அல்லது தாவல்களை மாற்றுவது மீறலாகப் பதிவு செய்யப்படும்.',
  },
  instrTimer: {
    en: 'A fixed countdown timer runs throughout. The test auto-submits when time expires.',
    ta: 'நிலையான எண்ணிக்கை நேரம் இயங்கும். நேரம் முடிந்ததும் தேர்வு தானாகச் சமர்ப்பிக்கப்படும்.',
  },
  instrPalette: {
    en: 'Use the question palette to navigate, mark questions for review, and track your progress.',
    ta: 'வழிசெலுத்த, மதிப்பாய்வுக்காக வினாக்களைக் குறிக்க, முன்னேற்றத்தைக் கண்காணிக்க வினாப் பலகத்தைப் பயன்படுத்தவும்.',
  },
  instrNoCopy: {
    en: 'Copy, paste, and right-click are disabled during the test.',
    ta: 'தேர்வின் போது நகலெடுத்தல், ஒட்டுதல் மற்றும் வலது-கிளிக் முடக்கப்படும்.',
  },
  instrExplanations: {
    en: 'Correct answers and detailed explanations appear in the review only after you attempt at least 25% of the test (or submit it at the end). Answer more questions to unlock them.',
    ta: 'சரியான விடைகளும் விரிவான விளக்கங்களும், நீங்கள் தேர்வில் குறைந்தது 25% வினாக்களுக்குப் பதிலளித்த பிறகே (அல்லது இறுதியில் சமர்ப்பித்த பிறகே) மதிப்பாய்வில் தோன்றும். அவற்றைத் திறக்க மேலும் வினாக்களுக்குப் பதிலளிக்கவும்.',
  },
  instrConfirm: {
    en: 'I have read the instructions and agree to take this test under exam conditions.',
    ta: 'வழிமுறைகளைப் படித்து, தேர்வு நிலைமைகளின் கீழ் இந்தத் தேர்வை எடுக்க ஒப்புக்கொள்கிறேன்.',
  },
  beginTest: { en: 'Begin Test', ta: 'தேர்வைத் தொடங்கு' },
  enterFullscreen: { en: 'Enter full-screen & begin', ta: 'முழுத் திரைக்குச் சென்று தொடங்கு' },
  instrQuizNav: {
    en: 'Use Prev / Next to move between questions, and Flag to mark one for review.',
    ta: 'வினாக்களுக்கு இடையே நகர முந்தைய / அடுத்து பொத்தான்களையும், மதிப்பாய்வுக்காகக் குறிக்க Flag-ஐயும் பயன்படுத்தவும்.',
  },
  instrViolations: {
    en: 'Leaving the test screen is recorded. Repeated violations auto-submit your test.',
    ta: 'தேர்வுத் திரையை விட்டு வெளியேறுவது பதிவு செய்யப்படுகிறது. மீண்டும் மீண்டும் மீறல்கள் தேர்வைத் தானாகச் சமர்ப்பிக்கும்.',
  },
  // OMR colour / flag guide (shown on the mock instructions screen)
  omrColourGuide: { en: 'Answer-sheet colour guide', ta: 'விடைத்தாள் வண்ண வழிகாட்டி' },
  descNotVisited: {
    en: 'Question not opened yet.',
    ta: 'வினா இன்னும் திறக்கப்படவில்லை.',
  },
  descVisited: {
    en: 'Opened, but left without choosing an answer.',
    ta: 'திறக்கப்பட்டது, ஆனால் பதில் தேர்ந்தெடுக்காமல் விடப்பட்டது.',
  },
  descAnswered: {
    en: 'An answer has been selected.',
    ta: 'ஒரு பதில் தேர்ந்தெடுக்கப்பட்டுள்ளது.',
  },
  descMarkedReview: {
    en: 'Flagged to revisit later; no answer chosen yet.',
    ta: 'பின்னர் மீண்டும் பார்க்கக் குறிக்கப்பட்டது; இன்னும் பதில் இல்லை.',
  },
  descAnsweredMarked: {
    en: 'Answered and also flagged for review.',
    ta: 'பதிலளிக்கப்பட்டு, மதிப்பாய்வுக்கும் குறிக்கப்பட்டது.',
  },
  flagMeaning: {
    en: 'Tap the flag on any question to mark it for review - its palette tile turns violet (amber if you have also answered it). Flagged questions are still graded normally; the flag is just a personal reminder to come back to them before submitting.',
    ta: 'எந்த வினாவையும் மதிப்பாய்வுக்குக் குறிக்க அதன் கொடியைத் தட்டவும் - அதன் பலகக் கட்டம் ஊதா நிறமாகும் (பதிலளித்திருந்தால் அம்பர் நிறம்). குறிக்கப்பட்ட வினாக்கள் வழக்கம் போலவே மதிப்பிடப்படும்; சமர்ப்பிக்கும் முன் மீண்டும் பார்ப்பதற்கான தனிப்பட்ட நினைவூட்டல் மட்டுமே இந்தக் கொடி.',
  },
  // Mark-a-question-for-correction (report) - student-facing
  reportError: { en: 'Report error', ta: 'பிழையைப் புகாரளி' },
  reportedLabel: { en: 'Reported', ta: 'புகாரளிக்கப்பட்டது' },
  reportQuestionAria: {
    en: 'Mark this question for correction',
    ta: 'இந்த வினாவைத் திருத்தத்திற்குக் குறிக்கவும்',
  },
  reportQuestionDone: {
    en: 'Thanks - flagged for our team to review. This does not affect your score.',
    ta: 'நன்றி - எங்கள் குழு பரிசீலிக்கக் குறிக்கப்பட்டது. இது உங்கள் மதிப்பெண்ணைப் பாதிக்காது.',
  },
  reportQuestionUndone: { en: 'Report removed.', ta: 'புகார் அகற்றப்பட்டது.' },
  reportModalTitle: { en: 'Report a problem with this question', ta: 'இந்த வினாவில் உள்ள சிக்கலைப் புகாரளி' },
  reportModalHint: {
    en: 'Tell us what looks wrong - a bad answer key, a typo, a broken option. The exam timer is paused while this box is open.',
    ta: 'என்ன தவறாகத் தெரிகிறது என்று கூறுங்கள் - தவறான விடை, எழுத்துப் பிழை, குறையுள்ள விருப்பம். இந்தப் பெட்டி திறந்திருக்கும்போது தேர்வு நேரம் இடைநிறுத்தப்படும்.',
  },
  reportReasonPlaceholder: {
    en: "e.g. The answer key looks wrong, or option C has a typo (optional)",
    ta: 'எ.கா. விடை தவறாக உள்ளது, அல்லது விருப்பம் C-இல் எழுத்துப் பிழை (விருப்பத்திற்குரியது)',
  },
  submitReport: { en: 'Submit report', ta: 'புகாரைச் சமர்ப்பி' },
  timerPaused: { en: 'Timer paused', ta: 'நேரம் இடைநிறுத்தப்பட்டது' },
  instrReport: {
    en: 'Spot a wrong answer key, a typo, or a broken question? Tap "Report error" on it and our team will review and fix it. Reporting never affects your score.',
    ta: 'தவறான விடை, எழுத்துப் பிழை, அல்லது குறையுள்ள வினாவைக் கண்டால் அதில் "பிழையைப் புகாரளி" என்பதைத் தட்டவும் - எங்கள் குழு அதைப் பரிசீலித்துத் திருத்தும். புகாரளிப்பது உங்கள் மதிப்பெண்ணை ஒருபோதும் பாதிக்காது.',
  },
  // Pre-quiz setup (practice quizzes)
  numQuestions: { en: 'Number of Questions', ta: 'வினாக்களின் எண்ணிக்கை' },
  timeLimitMin: { en: 'Time Limit (minutes)', ta: 'கால அளவு (நிமிடங்கள்)' },
  questionsAvailable: { en: 'available', ta: 'வினாக்கள் உள்ளன' },
  minutesShort: { en: 'min', ta: 'நிமி.' },
  countingQuestions: { en: 'Counting available questions…', ta: 'உள்ள வினாக்கள் கணக்கிடப்படுகிறது…' },
  recommendedTime: { en: 'Recommended', ta: 'பரிந்துரைக்கப்பட்டது' },
  recommendedTimeHint: { en: '≈1 minute per question', ta: 'ஒரு வினாவுக்கு ≈1 நிமிடம்' },
  applyRecommended: { en: 'Use', ta: 'பயன்படுத்து' },
  // In-test low-time warning banner (shown visibly in the final minute)
  timeWarn60: { en: 'Less than 1 minute left - wrap up your answers.', ta: '1 நிமிடத்திற்கும் குறைவே - உங்கள் பதில்களை முடிக்கவும்.' },
  timeWarn30: { en: 'Only 30 seconds left!', ta: '30 வினாடிகள் மட்டுமே!' },
  timeWarn10: { en: 'Time is almost up - submitting soon!', ta: 'நேரம் முடிய உள்ளது - விரைவில் சமர்ப்பிக்கப்படும்!' },

  // OMR interface
  notVisited: { en: 'Not Visited', ta: 'பார்க்கப்படவில்லை' },
  visited: { en: 'Visited', ta: 'பார்க்கப்பட்டது' },
  answered: { en: 'Answered', ta: 'பதிலளிக்கப்பட்டது' },
  markedReview: { en: 'Marked for Review', ta: 'மதிப்பாய்வுக்குக் குறிக்கப்பட்டது' },
  answeredMarked: { en: 'Answered & Marked', ta: 'பதிலளித்து குறிக்கப்பட்டது' },
  saveNext: { en: 'Save & Next', ta: 'சேமித்து அடுத்து' },
  clearResponse: { en: 'Clear Response', ta: 'பதிலை அழி' },
  markReviewNext: { en: 'Mark for Review & Next', ta: 'மதிப்பாய்வுக்குக் குறித்து அடுத்து' },
  questionPalette: { en: 'Question Palette', ta: 'வினாப் பலகம்' },
  violationWarning: {
    en: 'Warning: leaving the test screen is recorded. Repeated violations auto-submit your test.',
    ta: 'எச்சரிக்கை: தேர்வுத் திரையை விட்டு வெளியேறுவது பதிவு செய்யப்படுகிறது. மீண்டும் மீண்டும் மீறல்கள் தேர்வைத் தானாகச் சமர்ப்பிக்கும்.',
  },
  screenProtected: {
    en: 'Screen protected - capture is blocked during the test.',
    ta: 'திரை பாதுகாக்கப்பட்டது - தேர்வின் போது ஸ்கிரீன்ஷாட் தடுக்கப்படுகிறது.',
  },
  openPalette: { en: 'Question palette', ta: 'வினாப் பலகம்' },
  showAll: { en: 'Show all', ta: 'அனைத்தையும் காட்டு' },
  noFlagged: {
    en: 'No flagged questions yet. Tap the flag on any question to add it here.',
    ta: 'இன்னும் குறிக்கப்பட்ட வினாக்கள் இல்லை. எந்த வினாவிலும் கொடியைத் தட்டி இங்கே சேர்க்கவும்.',
  },
  done: { en: 'Done', ta: 'முடிந்தது' },
  edit: { en: 'Edit', ta: 'திருத்து' },
  timeWarning30: { en: '30 minutes remaining', ta: '30 நிமிடங்கள் மீதம்' },
  timeWarning10: { en: '10 minutes remaining', ta: '10 நிமிடங்கள் மீதம்' },
  timeWarning5: { en: '5 minutes remaining', ta: '5 நிமிடங்கள் மீதம்' },

  // Habit layer
  dayStreak: { en: 'Day Streak', ta: 'நாள் தொடர்ச்சி' },
  dailyGoal: { en: 'Daily Goal', ta: 'தினசரி இலக்கு' },
  goalDone: { en: "Today's goal complete", ta: 'இன்றைய இலக்கு முடிந்தது' },
  questionsToday: { en: 'questions today', ta: 'இன்று வினாக்கள்' },
  daysToExam: { en: 'days to exam', ta: 'தேர்வுக்கு நாட்கள்' },
  setExamDate: { en: 'Set your exam date & goal', ta: 'உங்கள் தேர்வு தேதி & இலக்கை அமைக்கவும்' },
  questionsToGo: { en: 'questions to go', ta: 'வினாக்கள் இன்னும் தேவை' },
  goodMorning: { en: 'Good morning', ta: 'காலை வணக்கம்' },
  goodAfternoon: { en: 'Good afternoon', ta: 'மதிய வணக்கம்' },
  goodEvening: { en: 'Good evening', ta: 'மாலை வணக்கம்' },
  thisWeek: { en: 'This week', ta: 'இந்த வாரம்' },
  nextMilestone: { en: 'next milestone', ta: 'அடுத்த மைல்கல்' },
  adjustGoal: { en: 'Adjust daily goal', ta: 'தினசரி இலக்கை மாற்றவும்' },
  goalSaved: { en: 'Daily goal updated', ta: 'தினசரி இலக்கு புதுப்பிக்கப்பட்டது' },
  streakAtRisk: {
    en: 'Keep your streak alive — practice today!',
    ta: 'தொடர்ச்சியைக் காக்க இன்றே பயிற்சி செய்யுங்கள்!',
  },
  startStreak: { en: 'Start your streak', ta: 'உங்கள் தொடர்ச்சியைத் தொடங்குங்கள்' },
  bestStreak: { en: 'Best streak', ta: 'சிறந்த தொடர்ச்சி' },
  consistency: { en: 'Consistency', ta: 'தொடர் பயிற்சி' },
  daysStudied30: { en: 'Days studied (30d)', ta: 'படித்த நாட்கள் (30 நாளில்)' },
  daily: { en: 'Daily Current Affairs', ta: 'தினசரி நடப்பு நிகழ்வுகள்' },
  dailyCta: { en: "Today's 10-question current-affairs drill", ta: 'இன்றைய 10-வினா நடப்பு நிகழ்வுப் பயிற்சி' },

  // Weekly revision (Current Affairs)
  weeklyRevision: { en: 'Weekly Revision', ta: 'வாராந்திர மீள்பார்வை' },
  weeklyRevisionCta: {
    en: 'Consolidate the week - a 20-question current-affairs mixed drill.',
    ta: 'வாரத்தை ஒருங்கிணைக்கவும் - 20-வினா நடப்பு நிகழ்வுக் கலப்புப் பயிற்சி.',
  },
  startRevisionDrill: { en: 'Start Weekly Revision', ta: 'வாராந்திர மீள்பார்வையைத் தொடங்கு' },

  // Daily rewards
  dailyReward: { en: 'Daily Reward', ta: 'தினசரி வெகுமதி' },
  dailyChallengeComplete: { en: 'Daily Challenge Complete!', ta: 'தினசரி சவால் முடிந்தது!' },
  rewardPoints: { en: 'reward points', ta: 'வெகுமதிப் புள்ளிகள்' },
  rewardEarnedToday: { en: 'earned today', ta: 'இன்று பெற்றது' },
  comeBackTomorrow: {
    en: 'Come back tomorrow to keep your streak alive.',
    ta: 'உங்கள் தொடர்ச்சியைத் தக்கவைக்க நாளை மீண்டும் வாருங்கள்.',
  },
  claimedToday: { en: "Today's reward claimed", ta: 'இன்றைய வெகுமதி பெறப்பட்டது' },
  rewardReady: { en: 'Reward ready - finish today’s drill', ta: 'வெகுமதி தயார் - இன்றைய பயிற்சியை முடியுங்கள்' },
  totalRewards: { en: 'Total reward points', ta: 'மொத்த வெகுமதிப் புள்ளிகள்' },
  // Short labels for the compact bottom tab bar (full labels overflow on phones).
  navDaily: { en: 'Daily', ta: 'தினசரி' },
  navInsights: { en: 'Insights', ta: 'பகுப்பாய்வு' },

  // Setup / onboarding
  setupTitle: { en: 'Set Your Target', ta: 'உங்கள் இலக்கை அமைக்கவும்' },
  targetGroup: { en: 'Target Group', ta: 'இலக்கு குழு' },
  gender: { en: 'Gender', ta: 'பாலினம்' },
  genderSelect: { en: 'Select…', ta: 'தேர்ந்தெடுக்கவும்…' },
  genderMale: { en: 'Male', ta: 'ஆண்' },
  genderFemale: { en: 'Female', ta: 'பெண்' },
  genderOther: { en: 'Do not prefer', ta: 'தெரிவிக்க விரும்பவில்லை' },
  genderSaveFailed: { en: 'Could not save gender. Please try again.', ta: 'பாலினத்தை சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' },
  saveFailed: { en: 'Could not save. Please try again.', ta: 'சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' },
  askedInYear: { en: 'Asked in', ta: 'கேட்கப்பட்ட ஆண்டு' },
  pdfPremiumOnly: { en: 'Download PDF - upgrade to Premium', ta: 'PDF பதிவிறக்க - பிரீமியத்திற்கு மேம்படுத்தவும்' },
  pdfPremiumPrompt: {
    en: 'Downloading the explanation PDF is a Premium feature. Upgrade to unlock it.',
    ta: 'விளக்க PDF பதிவிறக்கம் ஒரு பிரீமியம் வசதி. திறக்க மேம்படுத்தவும்.',
  },
  explHelpful: { en: 'Was this explanation helpful?', ta: 'இந்த விளக்கம் பயனுள்ளதாக இருந்ததா?' },
  explThanks: { en: 'Thanks for your feedback!', ta: 'உங்கள் கருத்துக்கு நன்றி!' },
  explFlagged: {
    en: 'Thanks - we’ll improve this explanation.',
    ta: 'நன்றி - இந்த விளக்கத்தை மேம்படுத்துவோம்.',
  },

  // Premium banner
  premiumBadge: { en: 'Premium', ta: 'பிரீமியம்' },
  premiumTitle: {
    en: 'Go Premium - prepare faster',
    ta: 'பிரீமியம் பெறுங்கள் - வேகமாக தயாராகுங்கள்',
  },
  premiumValidity: { en: '6-month plan', ta: '6-மாத திட்டம்' },
  premiumPerk1: { en: 'Unlimited practice tests', ta: 'வரம்பற்ற பயிற்சித் தேர்வுகள்' },
  premiumPerk2: {
    en: '6 mock exams',
    ta: '6 மாதிரித் தேர்வுகள்',
  },
  premiumPerk3: {
    en: 'Previous-year papers - last 5 years',
    ta: 'முந்தைய ஆண்டு வினாத்தாள்கள் - கடந்த 5 ஆண்டுகள்',
  },
  premiumPerk4: {
    en: 'Current Affairs',
    ta: 'நடப்பு நிகழ்வுகள்',
  },
  // Premium is a superset of Vettri Nichayam, so it includes the full Test
  // Series (all 13 scheduled papers) plus every future content update.
  premiumPerk5: {
    en: 'Test Series (Vettri Nichayam) - all 13 papers',
    ta: 'தேர்வுத் தொடர் (வெற்றி நிச்சயம்) - அனைத்து 13 தாள்களும்',
  },
  premiumPerk6: {
    en: 'All future updates included for your plan duration',
    ta: 'உங்கள் திட்டக் காலம் வரை அனைத்து எதிர்கால புதுப்பிப்புகளும் அடங்கும்',
  },
  // Rank Booster is a standalone ₹1,249/90-day plan; Premium includes it free.
  premiumPerk7: {
    en: 'Group II/ IIA- Rank Booster series - all 23 papers',
    ta: 'குரூப் II/ IIA - Rank Booster தொடர் - அனைத்து 23 தாள்களும்',
  },
  // Bonus benefits, shown as a separate "extras" block on the premium banner.
  premiumBonusTitle: { en: 'Bonus with Premium', ta: 'பிரீமியத்துடன் போனஸ்' },
  premiumBonus1: {
    en: 'Aptitude & other-subject short notes',
    ta: 'அப்டிட்யூட் & பிற பாடச் சுருக்கக் குறிப்புகள்',
  },
  premiumBonus2: { en: 'PYQ trend report', ta: 'PYQ போக்கு அறிக்கை' },
  premiumBonus3: { en: '45-day revision plan', ta: '45-நாள் திருப்புதல் திட்டம்' },
  premiumBonus4: {
    en: 'Face the exam with confidence',
    ta: 'தேர்வை நம்பிக்கையுடன் எதிர்கொள்ளுங்கள்',
  },
  premiumPerYear: { en: 'for 6 months', ta: '6 மாதங்களுக்கு' },
  premiumSecureNote: {
    en: 'Secure payment via Razorpay · one-time, no auto-renewal',
    ta: 'Razorpay மூலம் பாதுகாப்பான கட்டணம் · ஒருமுறை மட்டும், தானாக புதுப்பிக்காது',
  },
  premiumFlatSave: { en: 'Flat save', ta: 'சேமிப்பு' },
  premiumYouSave: { en: 'You save', ta: 'நீங்கள் சேமிக்கிறீர்கள்' },
  premiumApplied: { en: 'applied', ta: 'பயன்படுத்தப்பட்டது' },
  premiumCouponPlaceholder: { en: 'Coupon code', ta: 'கூப்பன் குறியீடு' },
  premiumApply: { en: 'Apply', ta: 'பயன்படுத்து' },
  premiumRemoveCoupon: { en: 'Remove coupon', ta: 'கூப்பனை அகற்று' },
  premiumGet: { en: 'Get Premium', ta: 'பிரீமியம் பெறு' },
  premiumGetFree: { en: 'Unlock Premium - ₹0', ta: 'பிரீமியத்தை ₹0-க்கு திற' },
  premiumFree: { en: '₹0', ta: '₹0' },
  premiumThanks: {
    en: 'Welcome to Premium - thank you!',
    ta: 'பிரீமியத்திற்கு வரவேற்கிறோம் - நன்றி!',
  },
  // Pre-payment confirmation popup (Premium + Vettri): recaps exactly what the
  // buyer gets and the amount, before the Razorpay checkout opens.
  buyConfirmTitle: {
    en: 'Confirm your plan',
    ta: 'உங்கள் திட்டத்தை உறுதிப்படுத்துங்கள்',
  },
  buyConfirmWhatYouGet: { en: 'What you get', ta: 'நீங்கள் பெறுவது' },
  buyConfirmValidity: { en: 'Validity', ta: 'செல்லுபடி காலம்' },
  buyConfirmTotal: { en: 'You pay', ta: 'நீங்கள் செலுத்தும் தொகை' },
  buyConfirmOk: { en: 'OK, proceed to pay', ta: 'சரி, பணம் செலுத்த தொடரவும்' },
  buyConfirmOkFree: { en: 'OK, unlock free', ta: 'சரி, இலவசமாகத் திற' },
  // Payment failure toasts (client-side checkout errors; server/Razorpay messages
  // pass through verbatim). Keyed by the CheckoutResult.code from lib/razorpay.ts.
  payErrStart: {
    en: 'Could not start the payment. Please try again.',
    ta: 'பணம் செலுத்துவதைத் தொடங்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
  },
  payErrSdk: {
    en: 'Could not load the payment screen. Check your connection.',
    ta: 'பணம் செலுத்தும் திரையை ஏற்ற முடியவில்லை. உங்கள் இணைப்பைச் சரிபார்க்கவும்.',
  },
  payErrVerify: {
    en: 'Payment could not be verified. If money was deducted, it will be refunded.',
    ta: 'பணம் செலுத்தியதை உறுதிப்படுத்த முடியவில்லை. பணம் கழிக்கப்பட்டிருந்தால், அது திரும்ப வழங்கப்படும்.',
  },
  payErrPay: {
    en: 'Payment failed. Please try again.',
    ta: 'பணம் செலுத்துதல் தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.',
  },
  // In-app purchase (App Store / Play) specific failures.
  payErrUnavailable: {
    en: 'In-app purchases are unavailable on this device. Please sign in to the store and try again.',
    ta: 'இந்தச் சாதனத்தில் ஆப்-உள் கொள்முதல் கிடைக்கவில்லை. ஸ்டோரில் உள்நுழைந்து மீண்டும் முயற்சிக்கவும்.',
  },
  payErrUnsupported: {
    en: 'Purchases are not supported here. Please buy on tnpscmentors.in instead.',
    ta: 'இங்கு கொள்முதல் ஆதரிக்கப்படவில்லை. tnpscmentors.in இல் வாங்கவும்.',
  },
  // Restore purchases (Apple requires a way to recover a paid plan).
  restorePurchases: {
    en: 'Restore purchases',
    ta: 'கொள்முதல்களை மீட்டெடுக்கவும்',
  },
  restoreRunning: {
    en: 'Checking the store…',
    ta: 'ஸ்டோரைச் சரிபார்க்கிறது…',
  },
  restoreFound: {
    en: 'Your purchase was restored.',
    ta: 'உங்கள் கொள்முதல் மீட்டெடுக்கப்பட்டது.',
  },
  restoreNone: {
    en: 'No purchases to restore on this account.',
    ta: 'இந்தக் கணக்கில் மீட்டெடுக்க கொள்முதல் எதுவும் இல்லை.',
  },
  // ─── Store offer codes (the native stand-in for promoter coupons) ─────────
  haveACode: {
    en: 'Have a code?',
    ta: 'கோடு உள்ளதா?',
  },
  offerCodeRedeemed: {
    en: 'Code applied — your plan is active.',
    ta: 'கோடு பயன்படுத்தப்பட்டது — உங்கள் திட்டம் செயலில் உள்ளது.',
  },
  offerCodeUnsupported: {
    en: 'Redeeming codes needs iOS 16 or later. Update iOS, or redeem on tnpscmentors.in.',
    ta: 'கோடுகளைப் பயன்படுத்த iOS 16 அல்லது அதற்கு மேல் தேவை. iOS-ஐப் புதுப்பிக்கவும், அல்லது tnpscmentors.in இல் பயன்படுத்தவும்.',
  },
  playRedeemHint: {
    en: 'Have a code? Tap "Redeem code" in the Google Play payment screen when you check out.',
    ta: 'கோடு உள்ளதா? பணம் செலுத்தும்போது Google Play திரையில் "Redeem code" என்பதைத் தட்டவும்.',
  },
  offlineBanner: {
    en: "You're offline — questions and results need a connection.",
    ta: 'நீங்கள் ஆஃப்லைனில் உள்ளீர்கள் — கேள்விகளுக்கும் முடிவுகளுக்கும் இணைப்பு தேவை.',
  },
  restorePurchasesSub: {
    en: 'Recover a plan you already bought on another device.',
    ta: 'வேறு சாதனத்தில் ஏற்கனவே வாங்கிய திட்டத்தை மீட்டெடுக்கவும்.',
  },
  // ─── Account controls (Apple 5.1.1(v) + Play User Data policy) ─────────────
  accountTitle: {
    en: 'Account',
    ta: 'கணக்கு',
  },
  accountSub: {
    en: 'Manage your purchases and your account data.',
    ta: 'உங்கள் கொள்முதல்கள் மற்றும் கணக்குத் தரவை நிர்வகிக்கவும்.',
  },
  deleteAccount: {
    en: 'Delete account',
    ta: 'கணக்கை நீக்கு',
  },
  deleteAccountSub: {
    en: 'Permanently remove your account and all your data.',
    ta: 'உங்கள் கணக்கையும் அனைத்துத் தரவையும் நிரந்தரமாக நீக்கும்.',
  },
  deleteAccountTitle: {
    en: 'Delete your account permanently?',
    ta: 'உங்கள் கணக்கை நிரந்தரமாக நீக்கவா?',
  },
  deleteAccountWarning: {
    en: 'This cannot be undone. Your test history, scores, bookmarks, revision decks, credits and any active paid plan will be deleted immediately and cannot be recovered. Refunds are not automatic — contact support first if you have an active plan.',
    ta: 'இதைத் திரும்பப் பெற முடியாது. உங்கள் தேர்வு வரலாறு, மதிப்பெண்கள், புக்மார்க்குகள், திருப்புதல் பட்டியல்கள், கிரெடிட்கள் மற்றும் செயலில் உள்ள கட்டணத் திட்டம் அனைத்தும் உடனடியாக நீக்கப்படும்; மீட்டெடுக்க முடியாது. பணத்திரும்பப்பெறுதல் தானாக நடக்காது — செயலில் திட்டம் இருந்தால் முதலில் ஆதரவைத் தொடர்பு கொள்ளவும்.',
  },
  deleteAccountConfirmWord: {
    en: 'DELETE',
    ta: 'DELETE',
  },
  deleteAccountConfirmLabel: {
    en: 'Type DELETE to confirm',
    ta: 'உறுதிப்படுத்த DELETE எனத் தட்டச்சு செய்யவும்',
  },
  deleteAccountConfirm: {
    en: 'Delete',
    ta: 'நீக்கு',
  },
  deleteAccountDone: {
    en: 'Your account has been deleted.',
    ta: 'உங்கள் கணக்கு நீக்கப்பட்டது.',
  },
  deleteAccountError: {
    en: 'Could not delete the account. Please try again or contact support.',
    ta: 'கணக்கை நீக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும் அல்லது ஆதரவைத் தொடர்பு கொள்ளவும்.',
  },
  couponCheckError: {
    en: 'Could not check that coupon. Please try again.',
    ta: 'அந்தக் கூப்பனைச் சரிபார்க்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
  },
  couponInvalid: {
    en: 'Invalid coupon code.',
    ta: 'தவறான கூப்பன் குறியீடு.',
  },
  // Post-payment success page (/payment-success) — shown right after a verified
  // Premium / Vettri Nichayam purchase.
  paySuccessTitle: {
    en: 'Payment successful!',
    ta: 'கட்டணம் வெற்றிகரமாகச் செலுத்தப்பட்டது!',
  },
  paySuccessSub: {
    en: 'Your plan is active and everything is unlocked. Happy learning!',
    ta: 'உங்கள் திட்டம் செயலில் உள்ளது, அனைத்தும் திறக்கப்பட்டுவிட்டன. மகிழ்ச்சியான கற்றல்!',
  },
  paySuccessConfirming: {
    en: 'Confirming your payment...',
    ta: 'உங்கள் கட்டணம் உறுதிப்படுத்தப்படுகிறது...',
  },
  paySuccessPlanLabel: { en: 'Your plan', ta: 'உங்கள் திட்டம்' },
  paySuccessUnlocked: { en: "What's unlocked", ta: 'திறக்கப்பட்டவை' },
  paySuccessStart: { en: 'Start practising', ta: 'பயிற்சியைத் தொடங்குங்கள்' },
  paySuccessProfile: { en: 'View my profile', ta: 'என் சுயவிவரத்தைப் பார்க்க' },
  examDate: { en: 'Exam Date', ta: 'தேர்வு தேதி' },
  dailyGoalQ: { en: 'Daily question goal', ta: 'தினசரி வினா இலக்கு' },
  saveContinue: { en: 'Save & Continue', ta: 'சேமித்துத் தொடரவும்' },
  skip: { en: 'Skip', ta: 'தவிர்' },

  // Gamification - level, XP, achievements
  achievements: { en: 'Awards', ta: 'விருதுகள்' },
  profile: { en: 'Profile', ta: 'சுயவிவரம்' },
  accountDetails: { en: 'Account Details', ta: 'கணக்கு விவரங்கள்' },
  statsOverview: { en: 'Your Stats', ta: 'உங்கள் புள்ளிவிவரம்' },
  notSet: { en: 'Not set', ta: 'அமைக்கப்படவில்லை' },
  timeSpent: { en: 'Time Spent', ta: 'செலவழித்த நேரம்' },
  achievementsTitle: { en: 'Achievements', ta: 'சாதனைகள்' },
  level: { en: 'Level', ta: 'நிலை' },
  xp: { en: 'XP', ta: 'புள்ளிகள்' },
  toNextLevel: { en: 'XP to next level', ta: 'அடுத்த நிலைக்கு புள்ளிகள்' },
  badgesEarned: { en: 'badges earned', ta: 'பேட்ஜ்கள் பெற்றது' },
  locked: { en: 'Locked', ta: 'பூட்டப்பட்டது' },
  keepGoing: { en: 'Keep going - you’re doing great!', ta: 'தொடருங்கள் - அருமை!' },

  // Profile page - section tabs (Profile & Gamification / Security)
  securityTab: { en: 'Security', ta: 'பாதுகாப்பு' },
  moreStats: { en: 'More Stats', ta: 'மேலும் புள்ளிவிவரங்கள்' },
  quickLinks: { en: 'Quick Links', ta: 'விரைவு இணைப்புகள்' },

  // Percentile + syllabus
  yourRank: { en: 'Your Standing', ta: 'உங்கள் நிலை' },
  stateLevelAnalytics: { en: 'State Level Analytics', ta: 'மாநில அளவு பகுப்பாய்வு' },
  aheadOf: { en: 'ahead of', ta: 'முந்தியுள்ளீர்கள்' },
  ofAspirants: { en: 'of aspirants', ta: 'விண்ணப்பதாரர்களில்' },
  syllabusCoverage: { en: 'Syllabus Coverage', ta: 'பாடத்திட்ட பரப்பளவு' },
  covered: { en: 'covered', ta: 'முடிந்தது' },
  notStarted: { en: 'Not started', ta: 'தொடங்கவில்லை' },

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  dashboardSub: {
    en: 'Pick a bank and start practising.',
    ta: 'ஒரு தொகுப்பைத் தேர்ந்தெடுத்துப் பயிற்சியைத் தொடங்குங்கள்.',
  },
  start: { en: 'Start', ta: 'தொடங்கு' },

  // ─── Direct messages (student ↔ admin team thread) ─────────────────────────
  messagesNav: { en: 'Messages', ta: 'செய்திகள்' },
  messagesTitle: { en: 'Messages', ta: 'செய்திகள்' },
  messagesSubtitle: {
    en: 'A direct line to the TNPSC Mentors team.',
    ta: 'TNPSC Mentors குழுவுடன் நேரடித் தொடர்பு.',
  },
  messagesEmpty: {
    en: 'No messages yet - send one if you need help.',
    ta: 'இன்னும் செய்திகள் இல்லை - உதவி தேவைப்பட்டால் அனுப்புங்கள்.',
  },
  messagesPlaceholder: { en: 'Type a message…', ta: 'செய்தியை உள்ளிடவும்…' },
  messagesSend: { en: 'Send', ta: 'அனுப்பு' },
  messagesSendError: {
    en: 'Could not send that. Check your connection and try again.',
    ta: 'அனுப்ப முடியவில்லை. இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
  },

  // ─── Notifications ────────────────────────────────────────────────────────
  notifications: { en: 'Notifications', ta: 'அறிவிப்புகள்' },
  unread: { en: 'unread', ta: 'படிக்காதவை' },
  noNotifications: { en: 'No notifications yet.', ta: 'இன்னும் அறிவிப்புகள் இல்லை.' },
  markAllRead: { en: 'Mark all as read', ta: 'அனைத்தையும் படித்ததாகக் குறி' },
  enableDeviceNotifications: {
    en: 'Enable device notifications',
    ta: 'சாதன அறிவிப்புகளை இயக்கு',
  },
  pushEnabled: { en: 'Device notifications enabled.', ta: 'சாதன அறிவிப்புகள் இயக்கப்பட்டன.' },
  pushDenied: {
    en: 'Notifications blocked. Allow them in your browser settings.',
    ta: 'அறிவிப்புகள் தடுக்கப்பட்டன. உலாவி அமைப்புகளில் அனுமதிக்கவும்.',
  },
  pushUnsupported: {
    en: 'This browser does not support push notifications.',
    ta: 'இந்த உலாவி புஷ் அறிவிப்புகளை ஆதரிக்கவில்லை.',
  },
  pushUnavailable: {
    en: 'Push notifications are not available right now.',
    ta: 'புஷ் அறிவிப்புகள் தற்போது கிடைக்கவில்லை.',
  },
  pushFailed: { en: 'Could not enable notifications.', ta: 'அறிவிப்புகளை இயக்க முடியவில்லை.' },
  pushNudgeTitle: {
    en: 'Turn on device notifications',
    ta: 'சாதன அறிவிப்புகளை இயக்குங்கள்',
  },
  pushNudgeBody: {
    en: 'Get test reminders, current affairs and offers — even when the app is closed.',
    ta: 'தேர்வு நினைவூட்டல்கள், நடப்பு நிகழ்வுகள் மற்றும் சலுகைகளை — ஆப் மூடியிருந்தாலும் — பெறுங்கள்.',
  },
  notNow: { en: 'Not now', ta: 'இப்போது வேண்டாம்' },
  // Profile → Notifications enable/disable toggle
  pushSettingTitle: { en: 'Device notifications', ta: 'சாதன அறிவிப்புகள்' },
  pushSettingSub: {
    en: 'Get test reminders, current affairs and offers on this device.',
    ta: 'தேர்வு நினைவூட்டல்கள், நடப்பு நிகழ்வுகள் மற்றும் சலுகைகளை இந்த சாதனத்தில் பெறுங்கள்.',
  },
  pushSettingOn: { en: 'On', ta: 'இயக்கத்தில்' },
  pushSettingOff: { en: 'Off', ta: 'அணைந்துள்ளது' },
  pushSettingBlocked: {
    en: 'Blocked in your browser settings. Allow notifications for this site to turn them on.',
    ta: 'உலாவி அமைப்புகளில் தடுக்கப்பட்டுள்ளது. இயக்க இந்த தளத்திற்கு அறிவிப்புகளை அனுமதிக்கவும்.',
  },
  pushDisabled: { en: 'Device notifications turned off.', ta: 'சாதன அறிவிப்புகள் அணைக்கப்பட்டன.' },
  notificationsTab: { en: 'Notify', ta: 'அறிவிப்பு' },

  // ─── Auth (login / register / forgot) ─────────────────────────────────────
  welcomeBack: { en: 'Welcome back', ta: 'மீண்டும் வரவேற்கிறோம்' },
  signInToContinue: { en: 'Sign in to continue.', ta: 'தொடர உள்நுழையவும்.' },
  signIn: { en: 'Sign In', ta: 'உள்நுழை' },
  signingIn: { en: 'Signing in…', ta: 'உள்நுழைகிறது…' },
  continueWithGoogle: { en: 'Continue with Google', ta: 'Google மூலம் தொடரவும்' },
  signInWithGoogle: { en: 'Sign in with Google', ta: 'Google மூலம் உள்நுழையவும்' },
  signUpWithGoogle: { en: 'Sign up with Google', ta: 'Google மூலம் பதிவு செய்யவும்' },
  email: { en: 'Email', ta: 'மின்னஞ்சல்' },
  password: { en: 'Password', ta: 'கடவுச்சொல்' },
  confirmPassword: { en: 'Confirm Password', ta: 'கடவுச்சொல்லை உறுதிப்படுத்து' },
  fullName: { en: 'Full Name', ta: 'முழுப் பெயர்' },
  phone: { en: 'Phone', ta: 'தொலைபேசி' },
  forgotPassword: { en: 'Forgot password?', ta: 'கடவுச்சொல் மறந்துவிட்டதா?' },
  newHere: { en: 'New here?', ta: 'புதியவரா?' },
  createAccount: { en: 'Create an account', ta: 'கணக்கை உருவாக்கு' },
  createYourAccount: { en: 'Create your account', ta: 'உங்கள் கணக்கை உருவாக்கவும்' },
  startPreparing: { en: 'Start preparing today.', ta: 'இன்றே தயாராகத் தொடங்குங்கள்.' },
  creatingAccount: { en: 'Creating account…', ta: 'கணக்கை உருவாக்குகிறது…' },
  alreadyRegistered: { en: 'Already registered?', ta: 'ஏற்கனவே பதிவு செய்துள்ளீர்களா?' },
  orDivider: { en: 'or', ta: 'அல்லது' },
  fastestWayToEnroll: { en: 'Fastest way to enroll', ta: 'Enroll ஆக வேகமான வழி' },
  orSignUpWithEmail: { en: 'or sign up with email', ta: 'அல்லது மின்னஞ்சல் மூலம் பதிவு செய்யவும்' },
  // Phone-OTP login (alternate sign-in)
  tabPassword: { en: 'Password', ta: 'கடவுச்சொல்' },
  tabPhone: { en: 'Phone OTP', ta: 'தொலைபேசி OTP' },
  mobileNumber: { en: 'Mobile number', ta: 'கைபேசி எண்' },
  sendOtp: { en: 'Send OTP', ta: 'OTP அனுப்பு' },
  sendingOtp: { en: 'Sending…', ta: 'அனுப்புகிறது…' },
  enterOtp: { en: 'Enter the 6-digit code', ta: '6-இலக்க குறியீட்டை உள்ளிடவும்' },
  otpSentTo: { en: 'We sent a code to', ta: 'குறியீட்டை அனுப்பியுள்ளோம்:' },
  verifyAndSignIn: { en: 'Verify & sign in', ta: 'சரிபார்த்து உள்நுழை' },
  verifyingOtp: { en: 'Verifying…', ta: 'சரிபார்க்கிறது…' },
  resendOtp: { en: 'Resend code', ta: 'மீண்டும் அனுப்பு' },
  changeNumber: { en: 'Change number', ta: 'எண்ணை மாற்று' },
  otpResent: { en: 'A new code has been sent.', ta: 'புதிய குறியீடு அனுப்பப்பட்டது.' },
  errMobileInvalid: {
    en: 'Please enter a valid 10-digit mobile number.',
    ta: 'சரியான 10-இலக்க கைபேசி எண்ணை உள்ளிடவும்.',
  },
  errOtpRequired: { en: 'Please enter the code.', ta: 'குறியீட்டை உள்ளிடவும்.' },
  otpNotRegistered: {
    en: 'No account found with this number. Please sign up, or sign in with email.',
    ta: 'இந்த எண்ணுடன் கணக்கு இல்லை. பதிவு செய்யவும் அல்லது மின்னஞ்சல் மூலம் உள்நுழையவும்.',
  },
  // Signup phone verification (WhatsApp OTP)
  waOtpSentTo: {
    en: 'We sent a code on WhatsApp to',
    ta: 'WhatsApp-இல் குறியீட்டை அனுப்பியுள்ளோம்:',
  },
  verifyAndCreate: { en: 'Verify & create account', ta: 'சரிபார்த்து கணக்கை உருவாக்கு' },
  // Complete-profile (Google signup) variant of the same verification step.
  verifyAndContinue: { en: 'Verify & Continue', ta: 'சரிபார்த்துத் தொடரவும்' },
  phoneVerifyExpired: {
    en: 'Phone verification expired. Please verify your number again.',
    ta: 'தொலைபேசி சரிபார்ப்பு காலாவதியானது. உங்கள் எண்ணை மீண்டும் சரிபார்க்கவும்.',
  },
  waOtpNoWhatsApp: {
    en: "This number doesn't seem to be on WhatsApp. Please use a mobile number that has WhatsApp.",
    ta: 'இந்த எண்ணில் WhatsApp இல்லை போல் தெரிகிறது. WhatsApp உள்ள கைபேசி எண்ணைப் பயன்படுத்தவும்.',
  },
  waOtpInvalid: {
    en: 'Incorrect code. Please check and try again.',
    ta: 'தவறான குறியீடு. சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
  },
  waOtpDead: {
    en: 'This code is no longer valid. Please request a new one.',
    ta: 'இந்த குறியீடு இனி செல்லாது. புதிய குறியீட்டைக் கோரவும்.',
  },
  waOtpCooldown: {
    en: 'Please wait a moment before requesting another code.',
    ta: 'மற்றொரு குறியீட்டைக் கோரும் முன் சிறிது காத்திருக்கவும்.',
  },
  errPhoneRegistered: {
    en: 'This mobile number is already registered to another account. Please sign in, or use a different number.',
    ta: 'இந்த கைபேசி எண் ஏற்கனவே வேறு கணக்கில் பதிவாகியுள்ளது. உள்நுழையவும் அல்லது வேறு எண்ணைப் பயன்படுத்தவும்.',
  },
  // Telegram fallback for signup phone verification (no WhatsApp on the number)
  tgOfferBtn: { en: 'Verify via Telegram instead', ta: 'மாற்றாக Telegram மூலம் சரிபார்க்கவும்' },
  tgInstructions: {
    en: 'We opened our Telegram bot. Tap “Start”, then “Share my phone number” — this page will continue automatically.',
    ta: 'எங்கள் Telegram bot திறக்கப்பட்டது. “Start” அழுத்தி, பின் “Share my phone number” பொத்தானை அழுத்தவும் — இந்தப் பக்கம் தானாகத் தொடரும்.',
  },
  tgWaiting: { en: 'Waiting for verification…', ta: 'சரிபார்ப்புக்காக காத்திருக்கிறது…' },
  tgOpen: { en: 'Open Telegram', ta: 'Telegram-ஐத் திற' },
  tgMismatch: {
    en: 'Your Telegram account is linked to a different mobile number. Please sign up with that number, or use a number that has WhatsApp.',
    ta: 'உங்கள் Telegram கணக்கு வேறு கைபேசி எண்ணுடன் இணைக்கப்பட்டுள்ளது. அந்த எண்ணுடன் பதிவு செய்யவும் அல்லது WhatsApp உள்ள எண்ணைப் பயன்படுத்தவும்.',
  },
  tgExpired: {
    en: 'Telegram verification timed out. Please try again.',
    ta: 'Telegram சரிபார்ப்பு காலாவதியானது. மீண்டும் முயற்சிக்கவும்.',
  },
  tgHelpTitle: {
    en: 'How Telegram verification works',
    ta: 'Telegram சரிபார்ப்பு எப்படி வேலை செய்கிறது',
  },
  tgHelpStep1: {
    en: 'Tap “Verify via Telegram” — our bot opens in your Telegram app. Tap START.',
    ta: '"Verify via Telegram" அழுத்தவும் — உங்கள் Telegram-இல் எங்கள் bot திறக்கும். START அழுத்தவும்.',
  },
  tgHelpStep2: {
    en: 'Tap “📱 Share my phone number”, then confirm with Share.',
    ta: '"📱 Share my phone number" பொத்தானை அழுத்தி, Share-ஐ உறுதிப்படுத்தவும்.',
  },
  tgHelpStep3: {
    en: 'Done! When you see “Number verified”, come back here — your account continues automatically.',
    ta: 'முடிந்தது! "Number verified" வந்ததும் இங்கு திரும்பவும் — உங்கள் கணக்கு தானாகத் தொடரும்.',
  },
  tgHelpMockIntro: {
    en: 'Welcome to TNPSC Mentor! To verify your mobile number, tap the button below…',
    ta: 'Welcome to TNPSC Mentor! உங்கள் எண்ணைச் சரிபார்க்க கீழே உள்ள பொத்தானை அழுத்தவும்…',
  },
  tgHelpMockAsk: {
    en: 'Tap the button below and allow Telegram to share your number.',
    ta: 'கீழே உள்ள பொத்தானை அழுத்தி எண்ணைப் பகிர அனுமதிக்கவும்.',
  },
  tgHelpMockDone: {
    en: 'Number verified! Return to the TNPSC Mentor app.',
    ta: 'Number verified! TNPSC Mentor செயலிக்குத் திரும்பவும்.',
  },
  tgHelpNote: {
    en: 'Note: this works only if your Telegram account uses the same mobile number you entered on the form.',
    ta: 'குறிப்பு: படிவத்தில் உள்ளிட்ட அதே எண்ணில் உங்கள் Telegram கணக்கு இருந்தால் மட்டுமே இது செயல்படும்.',
  },
  gotIt: { en: 'Got it', ta: 'புரிந்தது' },
  googleSignInFailed: {
    en: "Couldn't sign in with Google. Please try again.",
    ta: 'Google மூலம் உள்நுழைய முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
  },

  // ─── Two-factor authentication (TOTP, admin/superadmin) ────────────────────
  totpChallengeTitle: { en: 'Two-step verification', ta: 'இரு-கட்ட சரிபார்ப்பு' },
  totpChallengeHint: {
    en: 'Enter the 6-digit code from your authenticator app.',
    ta: 'உங்கள் authenticator ஆப்பில் உள்ள 6-இலக்க குறியீட்டை உள்ளிடவும்.',
  },
  totpUseBackupCode: { en: 'Use a backup code instead', ta: 'மாற்றாக backup குறியீட்டைப் பயன்படுத்தவும்' },
  totpUseAppCodeInstead: { en: 'Use your app code instead', ta: 'மாற்றாக ஆப் குறியீட்டைப் பயன்படுத்தவும்' },
  totpBackupCodeLabel: { en: 'Backup code', ta: 'Backup குறியீடு' },
  totpBackToSignIn: { en: 'Back to sign in', ta: 'உள்நுழைவுக்குத் திரும்பு' },

  securityTitle: { en: 'Security', ta: 'பாதுகாப்பு' },
  totpSectionTitle: { en: 'Two-factor authentication', ta: 'இரு-கட்ட அங்கீகாரம்' },
  totpSectionDesc: {
    en: 'Adds an extra step at sign-in using an authenticator app, on top of your password.',
    ta: 'கடவுச்சொல்லுடன், authenticator ஆப் மூலம் ஒரு கூடுதல் பாதுகாப்பு படி சேர்க்கிறது.',
  },
  totpStatusOn: { en: 'On', ta: 'இயக்கத்தில்' },
  totpStatusOff: { en: 'Off', ta: 'அணைக்கப்பட்டது' },
  totpTurnOn: { en: 'Turn on', ta: 'இயக்கு' },
  totpTurnOff: { en: 'Turn off', ta: 'அணை' },
  totpEnrollIntro: {
    en: 'Scan this QR code with an authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code it shows.',
    ta: 'ஒரு authenticator ஆப்பில் (Google Authenticator, Authy போன்றவை) இந்த QR குறியீட்டை ஸ்கேன் செய்து, அது காட்டும் 6-இலக்க குறியீட்டை உள்ளிடவும்.',
  },
  totpManualKeyLabel: {
    en: "Can't scan? Enter this key manually:",
    ta: 'ஸ்கேன் செய்ய முடியவில்லையா? இந்த key-ஐ கைமுறையாக உள்ளிடவும்:',
  },
  totpActivate: { en: 'Activate', ta: 'செயல்படுத்து' },
  totpBackupCodesTitle: { en: 'Save your backup codes', ta: 'உங்கள் backup குறியீடுகளைச் சேமிக்கவும்' },
  totpBackupCodesIntro: {
    en: "If you lose access to your authenticator app, use one of these to sign in. Each works once — store them somewhere safe.",
    ta: 'உங்கள் authenticator ஆப்பை அணுக முடியாவிட்டால், இவற்றில் ஒன்றைப் பயன்படுத்தி உள்நுழையலாம். ஒவ்வொன்றும் ஒருமுறை மட்டுமே செயல்படும் — பாதுகாப்பாகச் சேமிக்கவும்.',
  },
  totpBackupCodesDone: { en: "I've saved these codes", ta: 'இந்தக் குறியீடுகளைச் சேமித்துவிட்டேன்' },
  totpDisableConfirmTitle: {
    en: 'Turn off two-factor authentication?',
    ta: 'இரு-கட்ட அங்கீகாரத்தை அணைக்கவா?',
  },
  totpDisablePasswordLabel: {
    en: 'Enter your password to confirm',
    ta: 'உறுதிப்படுத்த உங்கள் கடவுச்சொல்லை உள்ளிடவும்',
  },
  totpAlreadyEnabled: {
    en: 'Two-factor authentication is already enabled.',
    ta: 'இரு-கட்ட அங்கீகாரம் ஏற்கனவே இயக்கத்தில் உள்ளது.',
  },
  totpEnabledToast: {
    en: 'Two-factor authentication is now on.',
    ta: 'இரு-கட்ட அங்கீகாரம் இப்போது இயக்கத்தில் உள்ளது.',
  },
  totpDisabledToast: {
    en: 'Two-factor authentication is now off.',
    ta: 'இரு-கட்ட அங்கீகாரம் அணைக்கப்பட்டது.',
  },

  // Complete-profile onboarding (Google signups land here to add the details
  // Google doesn't provide - phone + target group).
  completeProfileTitle: { en: 'Almost there', ta: 'கிட்டத்தட்ட முடிந்தது' },
  completeProfileSub: {
    en: 'Just a couple more details to set up your preparation.',
    ta: 'உங்கள் தயாரிப்பை அமைக்க இன்னும் சில விவரங்கள்.',
  },
  confirmEmailSent: {
    en: 'Account created! Please check your email to confirm, then sign in.',
    ta: 'கணக்கு உருவாக்கப்பட்டது! உறுதிப்படுத்த உங்கள் மின்னஞ்சலைப் பார்த்து, பிறகு உள்நுழையவும்.',
  },
  resetPasswordTitle: { en: 'Reset your password', ta: 'கடவுச்சொல்லை மீட்டமைக்கவும்' },
  resetPasswordHint: {
    en: "Enter your email and we'll send a reset link.",
    ta: 'உங்கள் மின்னஞ்சலை உள்ளிடுங்கள் - மீட்டமைப்பு இணைப்பை அனுப்புவோம்.',
  },
  sendResetLink: { en: 'Send reset link', ta: 'மீட்டமைப்பு இணைப்பை அனுப்பு' },
  sending: { en: 'Sending…', ta: 'அனுப்புகிறது…' },
  resetLinkSent: {
    en: 'Check your inbox for a password reset link.',
    ta: 'கடவுச்சொல் மீட்டமைப்பு இணைப்புக்கு உங்கள் அஞ்சல் பெட்டியைப் பார்க்கவும்.',
  },
  backToSignIn: { en: 'Back to Sign In', ta: 'உள்நுழைவுக்குத் திரும்பு' },
  showPassword: { en: 'Show password', ta: 'கடவுச்சொல்லைக் காட்டு' },
  hidePassword: { en: 'Hide password', ta: 'கடவுச்சொல்லை மறை' },
  // Validation / errors (friendly, no infra leaks)
  errEmailRequired: { en: 'Please enter your email.', ta: 'உங்கள் மின்னஞ்சலை உள்ளிடவும்.' },
  errEmailInvalid: { en: 'Please enter a valid email address.', ta: 'சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்.' },
  errPasswordRequired: { en: 'Please enter your password.', ta: 'உங்கள் கடவுச்சொல்லை உள்ளிடவும்.' },
  errPasswordShort: { en: 'Password must be at least 8 characters.', ta: 'கடவுச்சொல் குறைந்தது 8 எழுத்துகள் இருக்க வேண்டும்.' },
  errPasswordMismatch: { en: 'Passwords do not match.', ta: 'கடவுச்சொற்கள் பொருந்தவில்லை.' },
  errNameRequired: { en: 'Please enter your full name.', ta: 'உங்கள் முழுப் பெயரை உள்ளிடவும்.' },
  errPhoneRequired: { en: 'Please enter your phone number.', ta: 'உங்கள் தொலைபேசி எண்ணை உள்ளிடவும்.' },
  phoneAlreadyRegistered: {
    en: 'This mobile number is already registered to another account. Please use a different number.',
    ta: 'இந்த மொபைல் எண் ஏற்கனவே வேறு கணக்கில் பதிவு செய்யப்பட்டுள்ளது. வேறு எண்ணைப் பயன்படுத்தவும்.',
  },
  errServerUnreachable: {
    en: "Couldn't reach the server. Please try again in a moment.",
    ta: 'சேவையகத்தை அணுக முடியவில்லை. சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.',
  },
  errDeviceLimit: {
    en: "You're already signed in on 2 devices. Sign out on one of them first, then try again.",
    ta: 'நீங்கள் ஏற்கனவே 2 சாதனங்களில் உள்நுழைந்துள்ளீர்கள். அவற்றில் ஒன்றிலிருந்து வெளியேறிய பிறகு மீண்டும் முயற்சிக்கவும்.',
  },
  // ── Devices / sessions (manage-devices screen) ──
  devicesTitle: { en: 'Devices', ta: 'சாதனங்கள்' },
  devicesSub: {
    en: 'Your account can be used on up to 2 devices at a time.',
    ta: 'உங்கள் கணக்கை ஒரே நேரத்தில் 2 சாதனங்களில் பயன்படுத்தலாம்.',
  },
  devicesThis: { en: 'This device', ta: 'இந்தச் சாதனம்' },
  devicesActive: { en: 'active', ta: 'செயலில்' },
  devicesLastActive: { en: 'Last active', ta: 'கடைசியாக செயலில்' },
  devicesSignOut: { en: 'Sign out', ta: 'வெளியேறு' },
  devicesEmpty: { en: 'No other active devices.', ta: 'வேறு செயலில் உள்ள சாதனங்கள் இல்லை.' },
  devicesSignedOut: { en: 'Device signed out.', ta: 'சாதனம் வெளியேற்றப்பட்டது.' },
  devicesUnknown: { en: 'Unknown device', ta: 'அறியப்படாத சாதனம்' },
  pwStrengthWeak: { en: 'Weak', ta: 'பலவீனம்' },
  pwStrengthFair: { en: 'Fair', ta: 'சுமார்' },
  pwStrengthGood: { en: 'Good', ta: 'நன்று' },
  pwStrengthStrong: { en: 'Strong', ta: 'வலிமை' },

  // ─── Feedback ─────────────────────────────────────────────────────────────
  sendFeedback: { en: 'Send feedback', ta: 'கருத்தைச் சமர்ப்பி' },
  feedbackTitle: { en: 'How are we doing?', ta: 'நாங்கள் எப்படிச் செயல்படுகிறோம்?' },
  feedbackHint: {
    en: 'Your rating helps us improve TNPSC Mentors.',
    ta: 'உங்கள் மதிப்பீடு TNPSC வழிகாட்டியை மேம்படுத்த உதவுகிறது.',
  },
  feedbackPlaceholder: {
    en: 'Tell us what you love or what we can improve (optional)…',
    ta: 'நீங்கள் விரும்புவதை அல்லது மேம்படுத்த வேண்டியதைக் கூறுங்கள் (விருப்பத்திற்கு)…',
  },
  submit: { en: 'Submit', ta: 'சமர்ப்பி' },
  submitting: { en: 'Submitting…', ta: 'சமர்ப்பிக்கிறது…' },
  feedbackThanks: { en: 'Thank you for your feedback!', ta: 'உங்கள் கருத்துக்கு நன்றி!' },
  feedbackRatingRequired: { en: 'Please pick a rating first.', ta: 'முதலில் ஒரு மதிப்பீட்டைத் தேர்ந்தெடுக்கவும்.' },
  feedbackError: { en: "Couldn't send feedback. Please try again.", ta: 'கருத்தை அனுப்ப முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' },
  feedbackRateLimited: {
    en: 'Thanks! You can share feedback again once every 3 months.',
    ta: 'நன்றி! ஒவ்வொரு 3 மாதங்களுக்கு ஒருமுறை மீண்டும் கருத்து தெரிவிக்கலாம்.',
  },

  backToTop: { en: 'Back to top', ta: 'மேலே செல்ல' },
  // ─── Superadmin console ───────────────────────────────────────────────────
  superadmin: { en: 'Super Admin', ta: 'மேலாண்மை நிர்வாகி' },
  superadminConsole: { en: 'Super Admin Console', ta: 'மேலாண்மை நிர்வாகக் கட்டுப்பாடு' },
  platformMetricsSub: {
    en: 'Metrics · users · feedback inbox',
    ta: 'மெட்ரிக்குகள் · பயனர்கள் · கருத்துகள்',
  },
  overview: { en: 'Overview', ta: 'மேலோட்டம்' },
  users: { en: 'Users', ta: 'பயனர்கள்' },
  feedbackTab: { en: 'Feedback', ta: 'கருத்துகள்' },
  reportsTab: { en: 'Reports', ta: 'புகார்கள்' },
  notesTab: { en: 'Notes', ta: 'குறிப்புகள்' },
  reports: { en: 'Reports', ta: 'புகார்கள்' },
  reportedQuestions: { en: 'Reported Questions', ta: 'புகாரளிக்கப்பட்ட வினாக்கள்' },
  reportedQuestionsSub: {
    en: 'Questions students flagged for correction',
    ta: 'மாணவர்கள் திருத்தத்திற்காகக் குறித்த வினாக்கள்',
  },
  couponsTab: { en: 'Coupons', ta: 'கூப்பன்கள்' },
  appTab: { en: 'App', ta: 'ஆப்' },
  materialsTab: { en: 'Materials', ta: 'பொருட்கள்' },
  caMagazineTab: { en: 'CA Magazine', ta: 'CA இதழ்' },
  caSlidesTab: { en: 'CA Slides', ta: 'CA ஸ்லைடுகள்' },
  caQuestionsTab: { en: 'CA Questions', ta: 'CA வினாக்கள்' },
  caMagazineNoItems: {
    en: 'No items in this issue yet.',
    ta: 'இந்த இதழில் இதுவரை உள்ளடக்கம் எதுவும் இல்லை.',
  },
  // ─── Dashboard CA-magazine carousel ─────────────────────────────────────
  caCarouselTitle: { en: 'Current Affairs', ta: 'நடப்பு நிகழ்வுகள்' },
  // ─── Daily CA test (dashboard card + its day-picker popup) ──────────────
  caDailyTitle: { en: 'Daily CA Test', ta: 'தினசரி நடப்பு தேர்வு' },
  caDailyCardSub: { en: "Today's news · new every day", ta: 'இன்றைய செய்திகள் · தினமும் புதியது' },
  caDailyToday: { en: 'Today', ta: 'இன்று' },
  caDailySub: { en: "from today's paper", ta: 'இன்றைய செய்தித்தாளிலிருந்து' },
  caDailyEmpty: {
    en: "Today's test isn't out yet. It arrives each morning with the magazine.",
    ta: 'இன்றைய தேர்வு இன்னும் வெளியாகவில்லை. ஒவ்வொரு காலையிலும் இதழுடன் வரும்.',
  },
  // ─── Student CA-Questions section (own dashboard row + page) ─────────────
  caQuestionsTitle: { en: 'CA Questions', ta: 'நடப்பு நிகழ்வு வினாக்கள்' },
  caQuestionsArenaSub: { en: 'Take as a test · or get the PDF', ta: 'தேர்வாக எழுது · அல்லது PDF பெறு' },
  caQuestionsPageSub: {
    en: 'Practice sets with answers and explanations — download as PDF',
    ta: 'விடைகள் மற்றும் விளக்கங்களுடன் கூடிய தொகுப்புகள் — PDF ஆகப் பதிவிறக்கவும்',
  },
  caQuestionsQuizSub: {
    en: 'Take a set as a timed test — scored, with explanations after',
    ta: 'ஒரு தொகுப்பை நேரத் தேர்வாக எழுதுங்கள் — மதிப்பெண் + விளக்கங்களுடன்',
  },
  caTabQuiz: { en: 'Quiz', ta: 'தேர்வு' },
  caTabPdf: { en: 'PDF', ta: 'PDF' },
  caQuestionsDaily: { en: 'Daily sets', ta: 'தினசரி தொகுப்புகள்' },
  caQuestionsMonthly: { en: 'Monthly banks', ta: 'மாதாந்திரத் தொகுப்புகள்' },
  caQuestionsEmpty: {
    en: 'No question sets published yet. Check back soon!',
    ta: 'இதுவரை வினாத் தொகுப்புகள் எதுவும் வெளியிடப்படவில்லை. விரைவில் மீண்டும் பாருங்கள்!',
  },
  caQuestionsCount: { en: 'questions', ta: 'வினாக்கள்' },
  close: { en: 'Close', ta: 'மூடு' },
  // ─── Materials / Infographics hub ───────────────────────────────────────
  materials: { en: 'Materials', ta: 'பாடக்கோப்புகள்' },
  materialsTitle: { en: 'Study Materials', ta: 'கல்விப் பொருட்கள்' },
  materialsSubtitle: {
    en: 'Videos, infographics, notes and documents shared by your mentors',
    ta: 'உங்கள் வழிகாட்டிகள் பகிர்ந்த வீடியோக்கள், விளக்கப்படங்கள், குறிப்புகள் மற்றும் ஆவணங்கள்',
  },
  materialsEmpty: {
    en: 'No materials shared yet. Check back soon!',
    ta: 'இதுவரை பொருட்கள் எதுவும் பகிரப்படவில்லை. விரைவில் மீண்டும் பாருங்கள்!',
  },
  materialsAllTypes: { en: 'All', ta: 'அனைத்தும்' },
  typeMagazine: { en: 'CA Magazine', ta: 'நடப்பு நிகழ்வுகள் இதழ்' },
  typeQuestions: { en: 'CA Questions', ta: 'நடப்பு நிகழ்வு வினாக்கள்' },
  typeVideo: { en: 'Videos', ta: 'வீடியோக்கள்' },
  typeImage: { en: 'Images', ta: 'படங்கள்' },
  typePdf: { en: 'PDFs', ta: 'PDF கோப்புகள்' },
  typeDocument: { en: 'Documents', ta: 'ஆவணங்கள்' },
  videoLessons: { en: 'Video Lessons', ta: 'வீடியோ பாடங்கள்' },
  videoLessonsSub: {
    en: 'Short videos handpicked by your mentors',
    ta: 'உங்கள் வழிகாட்டிகள் தேர்ந்தெடுத்த குறும் வீடியோக்கள்',
  },
  materialOpen: { en: 'Open', ta: 'திற' },
  materialOpenYoutube: { en: 'Open on YouTube', ta: 'YouTube-இல் திற' },
  materialDownload: { en: 'Download', ta: 'பதிவிறக்கு' },
  downloadMagazinePdf: { en: 'Download PDF', ta: 'PDF பதிவிறக்கு' },
  materialDocHint: {
    en: 'Preview is not available for this file type — open or download it instead.',
    ta: 'இந்தக் கோப்பு வகைக்கு முன்னோட்டம் இல்லை — அதைத் திறக்கவும் அல்லது பதிவிறக்கவும்.',
  },
  materialOpenFailed: { en: 'Could not open this material.', ta: 'இந்தப் பொருளைத் திறக்க முடியவில்லை.' },
  materialDownloadFailed: { en: 'Could not download this material.', ta: 'இந்தப் பொருளைப் பதிவிறக்க முடியவில்லை.' },
  revenueTab: { en: 'Revenue', ta: 'வருவாய்' },
  mockExamsTab: { en: 'Mock Exams', ta: 'மாதிரித் தேர்வுகள்' },
  mockSectionsTitle: { en: 'Mock Test sections', ta: 'மாதிரித் தேர்வு பிரிவுகள்' },
  mockSectionsSub: {
    en: 'Show or hide the Group Exam and Subject/Topic tabs for all students.',
    ta: 'அனைத்து மாணவர்களுக்கும் குரூப் தேர்வு மற்றும் பாடம்/தலைப்பு தாவல்களைக் காட்டு அல்லது மறை.',
  },
  totalUsers: { en: 'Total Users', ta: 'மொத்த பயனர்கள்' },
  activeToday: { en: 'Active Today', ta: 'இன்று செயலில்' },
  active7d: { en: 'Active (7 days)', ta: 'செயலில் (7 நாட்கள்)' },
  testsCompleted: { en: 'Tests Completed', ta: 'முடிக்கப்பட்ட தேர்வுகள்' },
  testsAbandoned: { en: 'Tests Abandoned', ta: 'விட்டுச்சென்ற தேர்வுகள்' },
  totalQuestions: { en: 'Total Questions', ta: 'மொத்த வினாக்கள்' },
  avgRating: { en: 'Avg Rating', ta: 'சராசரி மதிப்பீடு' },
  totalFeedback: { en: 'Feedback Received', ta: 'பெறப்பட்ட கருத்துகள்' },
  signups14d: { en: 'Sign-ups · last 14 days', ta: 'பதிவுகள் · கடந்த 14 நாட்கள்' },
  roleBreakdown: { en: 'Role Breakdown', ta: 'பங்கு பகுப்பு' },
  searchUsers: { en: 'Search by name or email…', ta: 'பெயர் அல்லது மின்னஞ்சல் மூலம் தேடுங்கள்…' },
  role: { en: 'Role', ta: 'பங்கு' },
  roleUser: { en: 'Student', ta: 'மாணவர்' },
  roleAdmin: { en: 'Admin', ta: 'நிர்வாகி' },
  roleSuperadmin: { en: 'Super Admin', ta: 'மேலாண்மை நிர்வாகி' },
  roleUpdated: { en: 'Role updated.', ta: 'பங்கு புதுப்பிக்கப்பட்டது.' },
  roleUpdateFailed: { en: "Couldn't update role.", ta: 'பங்கை புதுப்பிக்க முடியவில்லை.' },
  changeRoleTitle: { en: 'Change user role?', ta: 'பயனர் பங்கை மாற்றவா?' },
  changeRoleMsg: {
    en: 'This changes what this user can access across the platform.',
    ta: 'இது தளம் முழுவதும் இந்தப் பயனர் அணுகக்கூடியதை மாற்றும்.',
  },
  // ─── Premium / payment revoke (superadmin) ────────────────────────────────
  revokePremium: { en: 'Revoke premium', ta: 'பிரீமியத்தை திரும்பப் பெறு' },
  revokePremiumTitle: { en: 'Revoke premium?', ta: 'பிரீமியத்தை திரும்பப் பெறவா?' },
  revokePremiumMsg: {
    en: "This withdraws the user's paid access immediately.",
    ta: 'இது பயனரின் கட்டண அணுகலை உடனடியாக நீக்கும்.',
  },
  premiumRevoked: { en: 'Premium revoked.', ta: 'பிரீமியம் திரும்பப் பெறப்பட்டது.' },
  revokeFailed: { en: "Couldn't revoke premium.", ta: 'பிரீமியத்தை திரும்பப் பெற முடியவில்லை.' },
  revoke: { en: 'Revoke', ta: 'திரும்பப் பெறு' },
  // ─── Delete user (superadmin) ─────────────────────────────────────────────
  deleteUser: { en: 'Delete user', ta: 'பயனரை நீக்கு' },
  deleteUserTitle: { en: 'Delete this user?', ta: 'இந்தப் பயனரை நீக்கவா?' },
  deleteUserMsg: {
    en: 'This permanently removes the account and all their data. This cannot be undone.',
    ta: 'இது கணக்கையும் அவர்களின் அனைத்து தரவையும் நிரந்தரமாக நீக்கும். இதை மீட்டெடுக்க முடியாது.',
  },
  userDeleted: { en: 'User deleted.', ta: 'பயனர் நீக்கப்பட்டார்.' },
  deleteUserFailed: { en: "Couldn't delete user.", ta: 'பயனரை நீக்க முடியவில்லை.' },
  // ─── Device limit (login) ─────────────────────────────────────────────────
  deviceLimitTitle: { en: 'Device limit reached', ta: 'சாதன வரம்பை அடைந்தது' },
  deviceLimitMsg: {
    en: 'This account is already signed in on 2 devices. Sign out of one to continue here.',
    ta: 'இந்தக் கணக்கு ஏற்கனவே 2 சாதனங்களில் உள்நுழைந்துள்ளது. இங்கே தொடர ஒன்றிலிருந்து வெளியேறவும்.',
  },
  signOutThisDevice: { en: 'Sign out & continue here', ta: 'வெளியேறி இங்கே தொடரவும்' },
  lastActive: { en: 'Last active', ta: 'கடைசி செயல்பாடு' },
  firstSignedIn: { en: 'Signed in', ta: 'உள்நுழைந்தது' },
  unknownDevice: { en: 'Unknown device', ta: 'அறியப்படாத சாதனம்' },
  activeNow: { en: 'Active now', ta: 'இப்போது செயலில்' },
  justNow: { en: 'just now', ta: 'சற்று முன்' },
  minutesAgo: { en: 'min ago', ta: 'நிமிடங்களுக்கு முன்' },
  hoursAgo: { en: 'hr ago', ta: 'மணி நேரத்திற்கு முன்' },
  daysAgo: { en: 'days ago', ta: 'நாட்களுக்கு முன்' },

  // ─── Thirukural ───────────────────────────────────────────────────────────
  thirukuralTitle: { en: 'Thirukkural', ta: 'திருக்குறள்' },
  thirukuralSub: { en: '1330 couplets · 133 chapters', ta: '1330 குறட்பாக்கள் · 133 அதிகாரம்' },
  thirukuralBadge: { en: 'Thirukkural', ta: 'திருக்குறள்' },
  kuralOfTheDay: { en: 'Kural of the day', ta: 'இன்றைய திருக்குறள்' },
  thirukuralIntro: {
    en: 'Browse all 1330 kurals with transliteration, translation and explanations.',
    ta: 'அனைத்து 1330 குறட்பாக்களையும் ஒலிபெயர்ப்பு, மொழிபெயர்ப்பு மற்றும் விளக்கங்களுடன் பார்க்கவும்.',
  },
  thirukuralSearch: {
    en: 'Search by kural no, word or chapter…',
    ta: 'குறள் எண், சொல் அல்லது அதிகாரம் மூலம் தேடுங்கள்…',
  },
  thirukuralNoResults: { en: 'No kurals match your search.', ta: 'உங்கள் தேடலுக்கு குறள் இல்லை.' },
  paalAll: { en: 'All', ta: 'அனைத்தும்' },
  kuralLabel: { en: 'Kural', ta: 'குறள்' },
  chapterLabel: { en: 'Chapter', ta: 'அதிகாரம்' },
  transliterationLabel: { en: 'Transliteration', ta: 'ஒலிபெயர்ப்பு' },
  translationLabel: { en: 'Translation', ta: 'மொழிபெயர்ப்பு' },
  coupletLabel: { en: 'Couplet (English)', ta: 'குறட்பா (ஆங்கிலம்)' },
  explanationEnLabel: { en: 'Explanation', ta: 'விளக்கம்' },
  uraiVaradarajan: { en: 'மு. வரதராசனார் உரை', ta: 'மு. வரதராசனார் உரை' },
  uraiPappaiya: { en: 'சாலமன் பாப்பையா உரை', ta: 'சாலமன் பாப்பையா உரை' },
  uraiKarunanidhi: { en: 'மு. கருணாநிதி உரை', ta: 'மு. கருணாநிதி உரை' },
  tamilExplanations: { en: 'Tamil Explanations', ta: 'தமிழ் உரைகள்' },
  prevKural: { en: 'Previous', ta: 'முந்தைய' },
  nextKural: { en: 'Next', ta: 'அடுத்த' },
  kuralNotFound: { en: 'Kural not found.', ta: 'குறள் கிடைக்கவில்லை.' },

  // Thirukkural Quiz (dashboard section)
  tkQuizTitle: { en: 'Thirukkural Quiz', ta: 'திருக்குறள் வினா' },
  tkQuizSub: { en: 'Bilingual practice · 288 questions', ta: 'இருமொழிப் பயிற்சி · 288 வினாக்கள்' },
  tkChooseFormat: { en: 'Question type', ta: 'வினா வகை' },
  tkChooseChapter: { en: 'Choose a chapter (adhigaram)', ta: 'அதிகாரத்தைத் தேர்ந்தெடு' },
  tkByChapter: { en: 'By chapter', ta: 'அதிகாரம் வாரியாக' },
  tkChapterHint: { en: 'Pick a chapter to begin', ta: 'தொடங்க ஒரு அதிகாரத்தைத் தேர்ந்தெடுக்கவும்' },
  tkAllChapters: { en: 'All chapters', ta: 'அனைத்து அதிகாரங்கள்' },
  tkAllChaptersSub: { en: 'Mix questions from every chapter', ta: 'அனைத்து அதிகாரங்களிலிருந்தும் கலந்து' },
  tkReady: { en: 'Ready to start', ta: 'தொடங்கத் தயார்' },
  tkGuidelines: { en: 'Guidelines', ta: 'வழிமுறைகள்' },
  tkGuideNav: {
    en: 'Use Prev / Next to move between questions - you can change an answer anytime before submitting.',
    ta: 'வினாக்களுக்கு இடையே நகர முந்தைய / அடுத்து பயன்படுத்தவும் - சமர்ப்பிக்கும் முன் எப்போது வேண்டுமானாலும் விடையை மாற்றலாம்.',
  },
  tkGuideReview: {
    en: 'Your score and the correct answers are shown right after you submit.',
    ta: 'நீங்கள் சமர்ப்பித்தவுடன் உங்கள் மதிப்பெண்ணும் சரியான விடைகளும் காட்டப்படும்.',
  },
  tkMixed: { en: 'Mixed (all types)', ta: 'கலப்பு (அனைத்து வகை)' },
  tkHowMany: { en: 'Number of questions', ta: 'வினாக்களின் எண்ணிக்கை' },
  tkAll: { en: 'All', ta: 'அனைத்தும்' },
  tkFmtMeaning: { en: 'Meaning', ta: 'பொருள்' },
  tkFmtFill: { en: 'Fill in the blank', ta: 'கோடிட்ட இடம் நிரப்புக' },
  tkFmtQuote: { en: 'Identify chapter', ta: 'அதிகாரம் கண்டறி' },
  tkFmtSynthesis: { en: 'Two-verse theme', ta: 'இரு குறள் கருத்து' },
  tkFmtMatch: { en: 'Match the following', ta: 'பொருத்துக' },
  tkStart: { en: 'Start quiz', ta: 'வினாவைத் தொடங்கு' },
  tkNoQuestions: { en: 'No questions for this selection.', ta: 'இந்தத் தேர்வுக்கு வினாக்கள் இல்லை.' },
  tkVerse: { en: 'Thirukkural', ta: 'திருக்குறள்' },
  tkListVerses: { en: 'Thirukkurals', ta: 'திருக்குறள்கள்' },
  tkListChapters: { en: 'Chapters', ta: 'அதிகாரங்கள்' },
  tkResult: { en: 'Quiz complete', ta: 'வினா முடிந்தது' },
  tkScoreLabel: { en: 'Your score', ta: 'உங்கள் மதிப்பெண்' },
  tkReview: { en: 'Review answers', ta: 'விடைகளைப் பார்' },
  tkRetake: { en: 'New quiz', ta: 'புதிய வினா' },
  tkYourAnswer: { en: 'Your answer', ta: 'உங்கள் விடை' },
  tkCorrectAnswer: { en: 'Correct answer', ta: 'சரியான விடை' },
  tkSkipped: { en: 'Skipped', ta: 'விடப்பட்டது' },
  tkExit: { en: 'Exit quiz', ta: 'வினாவிலிருந்து வெளியேறு' },
  tkAvailable: { en: 'available', ta: 'கிடைக்கும்' },

  testsTakenCol: { en: 'Tests', ta: 'தேர்வுகள்' },
  joinedCol: { en: 'Joined', ta: 'சேர்ந்தது' },
  noUsers: { en: 'No users match your search.', ta: 'உங்கள் தேடலுக்கு பயனர் இல்லை.' },
  noFeedback: { en: 'No feedback yet.', ta: 'இன்னும் கருத்துகள் இல்லை.' },
  couldNotLoad: { en: "Couldn't load this data. Try again.", ta: 'இந்தத் தரவை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' },
  retry: { en: 'Retry', ta: 'மீண்டும் முயற்சி' },
  // Shown in place of a server message that turned out to be a database
  // internal rather than copy meant for a user — see ApiError in lib/api.ts.
  unexpectedError: {
    en: 'Something went wrong. Please try again.',
    ta: 'ஏதோ தவறாகிவிட்டது. மீண்டும் முயற்சிக்கவும்.',
  },
  // Setting a new password from the emailed reset link (ResetPasswordPage).
  newPasswordTitle: { en: 'Set a new password', ta: 'புதிய கடவுச்சொல்லை அமைக்கவும்' },
  newPasswordHint: {
    en: 'Choose a new password for your account.',
    ta: 'உங்கள் கணக்கிற்கு புதிய கடவுச்சொல்லைத் தேர்ந்தெடுக்கவும்.',
  },
  newPassword: { en: 'New password', ta: 'புதிய கடவுச்சொல்' },
  savePassword: { en: 'Save new password', ta: 'புதிய கடவுச்சொல்லைச் சேமி' },
  saving: { en: 'Saving…', ta: 'சேமிக்கிறது…' },
  passwordChanged: {
    en: 'Your password has been changed. You can sign in with it now.',
    ta: 'உங்கள் கடவுச்சொல் மாற்றப்பட்டது. இப்போது அதைக் கொண்டு உள்நுழையலாம்.',
  },
  resetLinkInvalid: {
    en: 'This reset link is invalid or has expired. Request a new one.',
    ta: 'இந்த இணைப்பு தவறானது அல்லது காலாவதியாகிவிட்டது. புதிய ஒன்றைக் கோரவும்.',
  },
  requestNewLink: { en: 'Request a new link', ta: 'புதிய இணைப்பைக் கோரவும்' },
} as const

export type StringKey = keyof typeof STRINGS

/** Translate a key for a given language. 'both' shows "EN / TA". */
export function translate(key: StringKey, lang: Lang | null): string {
  const entry: Entry = STRINGS[key]
  const l = lang ?? 'en'
  if (l === 'ta') return entry.ta
  if (l === 'both') return entry.en === entry.ta ? entry.en : `${entry.en} / ${entry.ta}`
  return entry.en
}

/** Hook returning a `t()` bound to the current language + the raw lang. */
export function useT() {
  const lang = useLanguageStore((s) => s.lang)
  const t = (key: StringKey) => translate(key, lang)
  return { t, lang: lang ?? 'en' }
}
