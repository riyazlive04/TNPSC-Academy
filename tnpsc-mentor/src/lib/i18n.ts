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
  back: { en: 'Back', ta: 'பின்செல்' },
  loading: { en: 'Loading…', ta: 'ஏற்றுகிறது…' },
  correctMark: { en: 'Correct', ta: 'சரியானது' },
  deleteQuestionTitle: { en: 'Delete this question?', ta: 'இந்த வினாவை நீக்கவா?' },
  deleteQuestionMsg: {
    en: 'This permanently removes the question. This cannot be undone.',
    ta: 'இது வினாவை நிரந்தரமாக நீக்கும். இதைச் செயல்தவிர்க்க முடியாது.',
  },
  delete: { en: 'Delete', ta: 'நீக்கு' },
  cancel: { en: 'Cancel', ta: 'ரத்து' },

  // Language screen
  chooseLanguage: { en: 'Choose Your Language', ta: 'உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்' },
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
    en: 'Pick a category to browse, edit and export its questions — answers are shown.',
    ta: 'ஒரு பிரிவைத் தேர்ந்தெடுத்து வினாக்களைப் பார்க்க, திருத்த, ஏற்றுமதி செய்ய — விடைகள் காட்டப்படும்.',
  },
  browseEditBank: { en: 'Browse & edit · answers shown', ta: 'பார்க்க & திருத்த · விடைகளுடன்' },
  outerQuestionsSub: { en: 'Subject-wise bank · view & download PDF', ta: 'பாட வாரியான தொகுப்பு · PDF பதிவிறக்கம்' },

  // Category titles
  pyqTitle: { en: 'PREVIOUS YEAR QUESTION PAPERS', ta: 'முந்தைய ஆண்டு வினாத்தாள்கள்' },
  samacheerTitle: { en: 'SAMACHEER BASED', ta: 'சமச்சீர் அடிப்படையில்' },
  currentAffairsTitle: { en: 'CURRENT AFFAIRS', ta: 'நடப்பு நிகழ்வுகள்' },
  aptitudeTitle: { en: 'APTITUDE TOPIC WISE', ta: 'திறன் தலைப்பு வாரியாக' },

  // Section badges
  pyqBadge: { en: 'Previous Year Question Paper', ta: 'முந்தைய ஆண்டு வினாத்தாள்' },
  samacheerBadge: { en: 'Samacheer Based', ta: 'சமச்சீர் அடிப்படையில்' },
  currentAffairsBadge: { en: 'Current Affairs', ta: 'நடப்பு நிகழ்வுகள்' },
  aptitudeBadge: { en: 'Aptitude', ta: 'திறன் அறிவு' },
  questionBank: { en: 'Question Bank', ta: 'வினாத் தொகுப்பு' },

  // Subject Practice (rewritten bank: subject -> topic -> question type)
  subjectPracticeTitle: { en: 'SUBJECT PRACTICE', ta: 'பாடப் பயிற்சி' },
  subjectPracticeBadge: { en: 'Subject Practice', ta: 'பாடப் பயிற்சி' },
  step3Type: { en: 'Step 3 — Select Question Type', ta: 'படி 3 — வினா வகையைத் தேர்ந்தெடுக்கவும்' },
  typeMixed: { en: 'Mixed (All Types)', ta: 'கலப்பு (அனைத்து வகைகள்)' },
  typeChronological: { en: 'Chronological', ta: 'காலவரிசை' },
  typeMatch: { en: 'Match the Following', ta: 'பொருத்துக' },
  typeAssertionReason: { en: 'Assertion & Reason', ta: 'கூற்று – காரணம்' },
  typeStatements: { en: 'Statements', ta: 'கூற்றுகள்' },
  typeDirect: { en: 'Direct', ta: 'நேரடி' },

  // History period selector (PYQ History → Ancient / Medieval / Modern)
  historyPeriodBadge: { en: 'History — Previous Year Questions', ta: 'வரலாறு — முந்தைய ஆண்டு வினாக்கள்' },
  historyPickPeriod: { en: 'Select a Period', ta: 'காலகட்டத்தைத் தேர்ந்தெடுக்கவும்' },
  historyPickPeriodSub: {
    en: 'Pick a period to begin a History test (Group 1 Prelims, 2019–2025).',
    ta: 'வரலாறு தேர்வைத் தொடங்க ஒரு காலகட்டத்தைத் தேர்ந்தெடுக்கவும் (குரூப் 1 முதனிலை, 2019–2025).',
  },
  periodAncient: { en: 'Ancient History', ta: 'பண்டைய வரலாறு' },
  periodMedieval: { en: 'Medieval History', ta: 'இடைக்கால வரலாறு' },
  periodModern: { en: 'Modern History & INM', ta: 'நவீன வரலாறு மற்றும் இந்திய தேசிய இயக்கம்' },
  periodAncientSub: { en: 'Prehistory · Indus Valley · Sangam · Mauryas · Guptas', ta: 'தொல்பழங்காலம் · சிந்து சமவெளி · சங்கம் · மௌரியர் · குப்தர்' },
  periodMedievalSub: { en: 'Delhi Sultanate · Mughals · Vijayanagara · Bhakti', ta: 'டெல்லி சுல்தானியம் · முகலாயர் · விஜயநகரம் · பக்தி' },
  periodModernSub: { en: 'Europeans · British Raj · Freedom Struggle', ta: 'ஐரோப்பியர் · பிரிட்டிஷ் ஆட்சி · சுதந்திரப் போராட்டம்' },
  questionsCount: { en: 'questions', ta: 'வினாக்கள்' },

  // Steps / selectors
  step1Group: { en: 'Step 1 — Select Group', ta: 'படி 1 — குழுவைத் தேர்ந்தெடுக்கவும்' },
  step2Subject: { en: 'Step 2 — Select Subject', ta: 'படி 2 — பாடத்தைத் தேர்ந்தெடுக்கவும்' },
  step1Subject: { en: 'Step 1 — Select Subject', ta: 'படி 1 — பாடத்தைத் தேர்ந்தெடுக்கவும்' },
  step2Standard: { en: 'Step 2 — Select Standard', ta: 'படி 2 — வகுப்பைத் தேர்ந்தெடுக்கவும்' },
  step3Topic: { en: 'Step 3 — Select Topic', ta: 'படி 3 — தலைப்பைத் தேர்ந்தெடுக்கவும்' },
  allTopics: { en: 'All Topics', ta: 'அனைத்து தலைப்புகள்' },
  solGiven: { en: 'Given', ta: 'தரவுகள்' },
  solWorking: { en: 'From question', ta: 'வினாவிலிருந்து' },
  solAsked: { en: 'Asked', ta: 'கேட்டது' },
  solAnswer: { en: 'Answer', ta: 'விடை' },
  explanationLabel: { en: 'Explanation', ta: 'விளக்கம்' },
  step1Category: { en: 'Step 1 — Select Category', ta: 'படி 1 — பிரிவைத் தேர்ந்தெடுக்கவும்' },
  step2Topic: { en: 'Step 2 — Select Topic', ta: 'படி 2 — தலைப்பைத் தேர்ந்தெடுக்கவும்' },
  selectMonth: { en: 'Select Month', ta: 'மாதத்தைத் தேர்ந்தெடுக்கவும்' },
  topicWise: { en: 'Topic Wise', ta: 'தலைப்பு வாரியாக' },
  monthWise: { en: 'Month Wise', ta: 'மாத வாரியாக' },
  numerics: { en: 'Numerics', ta: 'எண் கணிதம்' },
  reasoning: { en: 'Reasoning', ta: 'பகுத்தறிவு' },

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
  explanation: { en: 'Explanation', ta: 'விளக்கம்' },
  preparingTest: { en: 'Preparing your test…', ta: 'உங்கள் தேர்வு தயாராகிறது…' },
  min15: {
    en: 'Please spend at least 15 seconds on this question.',
    ta: 'இந்த வினாவில் குறைந்தது 15 வினாடிகள் செலவிடவும்.',
  },

  // Result
  testComplete: { en: 'Test Complete', ta: 'தேர்வு முடிந்தது' },
  accuracy: { en: 'Accuracy', ta: 'துல்லியம்' },
  attended: { en: 'Attended', ta: 'முயற்சித்தவை' },
  timeTaken: { en: 'Time Taken', ta: 'எடுத்த நேரம்' },
  questionBreakdown: { en: 'Question Breakdown', ta: 'வினா விவரம்' },
  retryTest: { en: 'Retry Test', ta: 'மீண்டும் முயற்சி' },
  downloadPdf: { en: 'Download Explanation PDF', ta: 'விளக்க PDF பதிவிறக்கம்' },
  pdfLockedMsg: {
    en: 'Attempt at least 80% of questions to unlock explanations.',
    ta: 'விளக்கங்களைத் திறக்க குறைந்தது 80% வினாக்களை முயற்சிக்கவும்.',
  },

  // Empty / errors
  noQuestions: {
    en: 'No questions are available for this selection yet.',
    ta: 'இந்தத் தேர்வுக்கு இன்னும் வினாக்கள் இல்லை.',
  },

  // Insights / analytics
  insights: { en: 'My Insights', ta: 'என் பகுப்பாய்வு' },
  insightsTitle: { en: 'Performance Insights', ta: 'செயல்திறன் பகுப்பாய்வு' },
  testsTaken: { en: 'Tests Taken', ta: 'எடுத்த தேர்வுகள்' },
  avgAccuracy: { en: 'Avg Accuracy', ta: 'சராசரி துல்லியம்' },
  bestScore: { en: 'Best Score', ta: 'சிறந்த மதிப்பெண்' },
  studyTime: { en: 'Study Time', ta: 'படிப்பு நேரம்' },
  focusAreas: { en: 'Focus Areas', ta: 'கவனம் தேவைப்படும் பகுதிகள்' },
  focusHint: {
    en: 'These topics need work — revise and re-attempt them next.',
    ta: 'இந்தத் தலைப்புகளில் கவனம் தேவை — மீள்பார்வை செய்து மீண்டும் முயற்சிக்கவும்.',
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
  resources: { en: 'Free resources', ta: 'இலவச வளங்கள்' },

  // Revision
  revision: { en: 'Revision', ta: 'மீள்பார்வை' },
  revisionTitle: { en: 'Smart Revision', ta: 'திறன்மிகு மீள்பார்வை' },
  dueToday: { en: 'Due today', ta: 'இன்று செய்ய வேண்டியவை' },
  startRevision: { en: 'Start Revision', ta: 'மீள்பார்வையைத் தொடங்கு' },
  practiceMistakes: { en: 'Practice your mistakes', ta: 'தவறுகளைப் பயிற்சி செய்' },
  revisionEmpty: {
    en: 'Nothing due. Finish a test — wrong & flagged questions come here for spaced revision.',
    ta: 'எதுவும் இல்லை. ஒரு தேர்வை முடியுங்கள் — தவறான & குறித்த வினாக்கள் மீள்பார்வைக்கு இங்கே வரும்.',
  },
  allCaughtUp: { en: 'All caught up', ta: 'அனைத்தும் முடிந்தது' },

  // Mock tests
  mockTest: { en: 'Mock Test', ta: 'மாதிரித் தேர்வு' },
  mockTests: { en: 'Mock Tests', ta: 'மாதிரித் தேர்வுகள்' },
  fullLength: { en: 'Full-length exam simulation', ta: 'முழு நீள தேர்வு உருவகப்படுத்துதல்' },
  negMarking: { en: 'Negative marking', ta: 'எதிர்மறை மதிப்பெண்' },
  startMock: { en: 'Start Mock', ta: 'மாதிரித் தேர்வைத் தொடங்கு' },

  // Mock test — group exam vs subject/topic
  mockGroupExam: { en: 'Group Exam', ta: 'குரூப் தேர்வு' },
  mockSubjectExam: { en: 'Subject / Topic', ta: 'பாடம் / தலைப்பு' },
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
  instrConfirm: {
    en: 'I have read the instructions and agree to take this test under exam conditions.',
    ta: 'வழிமுறைகளைப் படித்து, தேர்வு நிலைமைகளின் கீழ் இந்தத் தேர்வை எடுக்க ஒப்புக்கொள்கிறேன்.',
  },
  beginTest: { en: 'Begin Test', ta: 'தேர்வைத் தொடங்கு' },
  enterFullscreen: { en: 'Enter full-screen & begin', ta: 'முழுத் திரைக்குச் சென்று தொடங்கு' },

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
  daily: { en: 'Daily Current Affairs', ta: 'தினசரி நடப்பு நிகழ்வுகள்' },
  dailyCta: { en: "Today's 10-question current-affairs drill", ta: 'இன்றைய 10-வினா நடப்பு நிகழ்வுப் பயிற்சி' },

  // Weekly revision (Current Affairs)
  weeklyRevision: { en: 'Weekly Revision', ta: 'வாராந்திர மீள்பார்வை' },
  weeklyRevisionCta: {
    en: 'Consolidate the week — a 20-question current-affairs mixed drill.',
    ta: 'வாரத்தை ஒருங்கிணைக்கவும் — 20-வினா நடப்பு நிகழ்வுக் கலப்புப் பயிற்சி.',
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
  rewardReady: { en: 'Reward ready — finish today’s drill', ta: 'வெகுமதி தயார் — இன்றைய பயிற்சியை முடியுங்கள்' },
  totalRewards: { en: 'Total reward points', ta: 'மொத்த வெகுமதிப் புள்ளிகள்' },
  // Short labels for the compact bottom tab bar (full labels overflow on phones).
  navDaily: { en: 'Daily', ta: 'தினசரி' },
  navInsights: { en: 'Insights', ta: 'பகுப்பாய்வு' },

  // Setup / onboarding
  setupTitle: { en: 'Set Your Target', ta: 'உங்கள் இலக்கை அமைக்கவும்' },
  targetGroup: { en: 'Target Group', ta: 'இலக்கு குழு' },
  examDate: { en: 'Exam Date', ta: 'தேர்வு தேதி' },
  dailyGoalQ: { en: 'Daily question goal', ta: 'தினசரி வினா இலக்கு' },
  saveContinue: { en: 'Save & Continue', ta: 'சேமித்துத் தொடரவும்' },
  skip: { en: 'Skip', ta: 'தவிர்' },

  // Gamification — level, XP, achievements
  achievements: { en: 'Awards', ta: 'விருதுகள்' },
  achievementsTitle: { en: 'Achievements', ta: 'சாதனைகள்' },
  level: { en: 'Level', ta: 'நிலை' },
  xp: { en: 'XP', ta: 'புள்ளிகள்' },
  toNextLevel: { en: 'XP to next level', ta: 'அடுத்த நிலைக்கு புள்ளிகள்' },
  badgesEarned: { en: 'badges earned', ta: 'பேட்ஜ்கள் பெற்றது' },
  locked: { en: 'Locked', ta: 'பூட்டப்பட்டது' },
  keepGoing: { en: 'Keep going — you’re doing great!', ta: 'தொடருங்கள் — அருமை!' },

  // Percentile + syllabus
  yourRank: { en: 'Your Standing', ta: 'உங்கள் நிலை' },
  aheadOf: { en: 'ahead of', ta: 'முந்தியுள்ளீர்கள்' },
  ofAspirants: { en: 'of aspirants', ta: 'விண்ணப்பதாரர்களில்' },
  syllabusCoverage: { en: 'Syllabus Coverage', ta: 'பாடத்திட்ட பரப்பளவு' },
  covered: { en: 'covered', ta: 'முடிந்தது' },
  notStarted: { en: 'Not started', ta: 'தொடங்கவில்லை' },

  // ─── Auth (login / register / forgot) ─────────────────────────────────────
  welcomeBack: { en: 'Welcome back', ta: 'மீண்டும் வரவேற்கிறோம்' },
  signInToContinue: { en: 'Sign in to continue.', ta: 'தொடர உள்நுழையவும்.' },
  signIn: { en: 'Sign In', ta: 'உள்நுழை' },
  signingIn: { en: 'Signing in…', ta: 'உள்நுழைகிறது…' },
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
  confirmEmailSent: {
    en: 'Account created! Please check your email to confirm, then sign in.',
    ta: 'கணக்கு உருவாக்கப்பட்டது! உறுதிப்படுத்த உங்கள் மின்னஞ்சலைப் பார்த்து, பிறகு உள்நுழையவும்.',
  },
  resetPasswordTitle: { en: 'Reset your password', ta: 'கடவுச்சொல்லை மீட்டமைக்கவும்' },
  resetPasswordHint: {
    en: "Enter your email and we'll send a reset link.",
    ta: 'உங்கள் மின்னஞ்சலை உள்ளிடுங்கள் — மீட்டமைப்பு இணைப்பை அனுப்புவோம்.',
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
  errPasswordShort: { en: 'Password must be at least 6 characters.', ta: 'கடவுச்சொல் குறைந்தது 6 எழுத்துகள் இருக்க வேண்டும்.' },
  errPasswordMismatch: { en: 'Passwords do not match.', ta: 'கடவுச்சொற்கள் பொருந்தவில்லை.' },
  errNameRequired: { en: 'Please enter your full name.', ta: 'உங்கள் முழுப் பெயரை உள்ளிடவும்.' },
  errPhoneRequired: { en: 'Please enter your phone number.', ta: 'உங்கள் தொலைபேசி எண்ணை உள்ளிடவும்.' },
  errServerUnreachable: {
    en: "Couldn't reach the server. Please try again in a moment.",
    ta: 'சேவையகத்தை அணுக முடியவில்லை. சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.',
  },
  pwStrengthWeak: { en: 'Weak', ta: 'பலவீனம்' },
  pwStrengthFair: { en: 'Fair', ta: 'சுமார்' },
  pwStrengthGood: { en: 'Good', ta: 'நன்று' },
  pwStrengthStrong: { en: 'Strong', ta: 'வலிமை' },

  // ─── Feedback ─────────────────────────────────────────────────────────────
  sendFeedback: { en: 'Send feedback', ta: 'கருத்தைச் சமர்ப்பி' },
  feedbackTitle: { en: 'How are we doing?', ta: 'நாங்கள் எப்படிச் செயல்படுகிறோம்?' },
  feedbackHint: {
    en: 'Your rating helps us improve TNPSC Mentor.',
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
  testsTakenCol: { en: 'Tests', ta: 'தேர்வுகள்' },
  joinedCol: { en: 'Joined', ta: 'சேர்ந்தது' },
  noUsers: { en: 'No users match your search.', ta: 'உங்கள் தேடலுக்கு பயனர் இல்லை.' },
  noFeedback: { en: 'No feedback yet.', ta: 'இன்னும் கருத்துகள் இல்லை.' },
  couldNotLoad: { en: "Couldn't load this data. Try again.", ta: 'இந்தத் தரவை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' },
  retry: { en: 'Retry', ta: 'மீண்டும் முயற்சி' },
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
