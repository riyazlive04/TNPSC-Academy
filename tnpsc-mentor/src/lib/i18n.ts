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
    en: 'Tamil Nadu Public Service Commission · Aspirant Portal',
    ta: 'தமிழ்நாடு அரசுப் பணியாளர் தேர்வாணையம் · மாணவர் வாயில்',
  },
  chipPyq: { en: 'Previous Year', ta: 'முந்தைய ஆண்டு' },
  chipSamacheer: { en: 'Samacheer', ta: 'சமச்சீர்' },
  chipCa: { en: 'Current Affairs', ta: 'நடப்பு நிகழ்வுகள்' },
  chipAptitude: { en: 'Aptitude', ta: 'திறனாய்வு' },
  downloadExplanations: { en: 'Download explanations (PDF)', ta: 'விளக்கங்களைப் பதிவிறக்கு (PDF)' },
  preparingPdf: { en: 'Preparing PDF…', ta: 'PDF தயாராகிறது…' },
  pdfWhenComplete: {
    en: 'Attempt all the questions to unlock the full explanation PDF.',
    ta: 'முழு விளக்க PDF-ஐப் பெற அனைத்து வினாக்களுக்கும் பதிலளிக்கவும்.',
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

  // Category titles
  pyqTitle: { en: 'PREVIOUS YEAR QUESTION PAPERS', ta: 'முந்தைய ஆண்டு வினாத்தாள்கள்' },
  samacheerTitle: { en: 'SAMACHEER BASED', ta: 'சமச்சீர் அடிப்படையில்' },
  currentAffairsTitle: { en: 'CURRENT AFFAIRS', ta: 'நடப்பு நிகழ்வுகள்' },
  aptitudeTitle: { en: 'APTITUDE TOPIC WISE', ta: 'திறனாய்வு மற்றும் மனக்கணக்கு' },

  // Section badges
  pyqBadge: { en: 'Previous Year Question Paper', ta: 'முந்தைய ஆண்டு வினாத்தாள்' },
  samacheerBadge: { en: 'Samacheer Based', ta: 'சமச்சீர் அடிப்படையில்' },
  currentAffairsBadge: { en: 'Current Affairs', ta: 'நடப்பு நிகழ்வுகள்' },
  aptitudeBadge: { en: 'Aptitude', ta: 'திறனாய்வு மற்றும் மனக்கணக்கு' },
  questionBank: { en: 'Question Bank', ta: 'வினாத் தொகுப்பு' },

  // Subject Practice (rewritten bank: subject -> topic -> question type)
  subjectPracticeTitle: { en: 'SUBJECT PRACTICE', ta: 'பாடப் பயிற்சி' },
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
    en: 'Hold on — please read the question before moving on.',
    ta: 'பொறுங்கள் — தொடரும் முன் வினாவை வாசியுங்கள்.',
  },
  readCarefully: {
    en: 'This is a long question — read it carefully before answering.',
    ta: 'இது நீளமான வினா — பதிலளிக்கும் முன் கவனமாக வாசியுங்கள்.',
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
  noQuestionsLong: {
    en: 'No questions are available for this selection yet. Please choose another topic.',
    ta: 'இந்தத் தேர்வுக்கு இன்னும் வினாக்கள் இல்லை. வேறு தலைப்பைத் தேர்ந்தெடுக்கவும்.',
  },

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
  accuracy: { en: 'Accuracy', ta: 'துல்லியம்' },
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
  resources: { en: 'Free resources', ta: 'இலவச வளங்கள்' },
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

  // Mock tests
  mockTest: { en: 'Mock Test', ta: 'மாதிரித் தேர்வு' },
  mockTests: { en: 'Mock Tests', ta: 'மாதிரித் தேர்வுகள்' },
  fullLength: { en: 'Full-length exam simulation', ta: 'முழு நீள தேர்வு உருவகப்படுத்துதல்' },
  negMarking: { en: 'Negative marking', ta: 'எதிர்மறை மதிப்பெண்' },
  startMock: { en: 'Start Mock', ta: 'மாதிரித் தேர்வைத் தொடங்கு' },

  // Mock test - group exam vs subject/topic
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
    en: 'Tap the flag on any question to mark it for review — its palette tile turns violet (amber if you have also answered it). Flagged questions are still graded normally; the flag is just a personal reminder to come back to them before submitting.',
    ta: 'எந்த வினாவையும் மதிப்பாய்வுக்குக் குறிக்க அதன் கொடியைத் தட்டவும் — அதன் பலகக் கட்டம் ஊதா நிறமாகும் (பதிலளித்திருந்தால் அம்பர் நிறம்). குறிக்கப்பட்ட வினாக்கள் வழக்கம் போலவே மதிப்பிடப்படும்; சமர்ப்பிக்கும் முன் மீண்டும் பார்ப்பதற்கான தனிப்பட்ட நினைவூட்டல் மட்டுமே இந்தக் கொடி.',
  },
  // Mark-a-question-for-correction (report) — student-facing
  reportError: { en: 'Report error', ta: 'பிழையைப் புகாரளி' },
  reportedLabel: { en: 'Reported', ta: 'புகாரளிக்கப்பட்டது' },
  reportQuestionAria: {
    en: 'Mark this question for correction',
    ta: 'இந்த வினாவைத் திருத்தத்திற்குக் குறிக்கவும்',
  },
  reportQuestionDone: {
    en: 'Thanks — flagged for our team to review. This does not affect your score.',
    ta: 'நன்றி — எங்கள் குழு பரிசீலிக்கக் குறிக்கப்பட்டது. இது உங்கள் மதிப்பெண்ணைப் பாதிக்காது.',
  },
  reportQuestionUndone: { en: 'Report removed.', ta: 'புகார் அகற்றப்பட்டது.' },
  reportModalTitle: { en: 'Report a problem with this question', ta: 'இந்த வினாவில் உள்ள சிக்கலைப் புகாரளி' },
  reportModalHint: {
    en: 'Tell us what looks wrong — a bad answer key, a typo, a broken option. The exam timer is paused while this box is open.',
    ta: 'என்ன தவறாகத் தெரிகிறது என்று கூறுங்கள் — தவறான விடை, எழுத்துப் பிழை, குறையுள்ள விருப்பம். இந்தப் பெட்டி திறந்திருக்கும்போது தேர்வு நேரம் இடைநிறுத்தப்படும்.',
  },
  reportReasonPlaceholder: {
    en: "e.g. The answer key looks wrong, or option C has a typo (optional)",
    ta: 'எ.கா. விடை தவறாக உள்ளது, அல்லது விருப்பம் C-இல் எழுத்துப் பிழை (விருப்பத்திற்குரியது)',
  },
  submitReport: { en: 'Submit report', ta: 'புகாரைச் சமர்ப்பி' },
  timerPaused: { en: 'Timer paused', ta: 'நேரம் இடைநிறுத்தப்பட்டது' },
  instrReport: {
    en: 'Spot a wrong answer key, a typo, or a broken question? Tap "Report error" on it and our team will review and fix it. Reporting never affects your score.',
    ta: 'தவறான விடை, எழுத்துப் பிழை, அல்லது குறையுள்ள வினாவைக் கண்டால் அதில் "பிழையைப் புகாரளி" என்பதைத் தட்டவும் — எங்கள் குழு அதைப் பரிசீலித்துத் திருத்தும். புகாரளிப்பது உங்கள் மதிப்பெண்ணை ஒருபோதும் பாதிக்காது.',
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
  timeWarn60: { en: 'Less than 1 minute left — wrap up your answers.', ta: '1 நிமிடத்திற்கும் குறைவே — உங்கள் பதில்களை முடிக்கவும்.' },
  timeWarn30: { en: 'Only 30 seconds left!', ta: '30 வினாடிகள் மட்டுமே!' },
  timeWarn10: { en: 'Time is almost up — submitting soon!', ta: 'நேரம் முடிய உள்ளது — விரைவில் சமர்ப்பிக்கப்படும்!' },

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
  genderOther: { en: 'Other', ta: 'மற்றவை' },
  askedInYear: { en: 'Asked in', ta: 'கேட்கப்பட்ட ஆண்டு' },
  pdfPremiumOnly: { en: 'Download PDF — upgrade to Premium', ta: 'PDF பதிவிறக்க — பிரீமியத்திற்கு மேம்படுத்தவும்' },
  pdfPremiumPrompt: {
    en: 'Downloading the explanation PDF is a Premium feature. Upgrade to unlock it.',
    ta: 'விளக்க PDF பதிவிறக்கம் ஒரு பிரீமியம் வசதி. திறக்க மேம்படுத்தவும்.',
  },
  explHelpful: { en: 'Was this explanation helpful?', ta: 'இந்த விளக்கம் பயனுள்ளதாக இருந்ததா?' },
  explThanks: { en: 'Thanks for your feedback!', ta: 'உங்கள் கருத்துக்கு நன்றி!' },
  explFlagged: {
    en: 'Thanks — we’ll improve this explanation.',
    ta: 'நன்றி — இந்த விளக்கத்தை மேம்படுத்துவோம்.',
  },

  // Premium banner
  premiumBadge: { en: 'Premium', ta: 'பிரீமியம்' },
  premiumTitle: {
    en: 'Go Premium — crack TNPSC faster',
    ta: 'பிரீமியம் பெறுங்கள் — TNPSC-ஐ விரைவாக வெல்லுங்கள்',
  },
  premiumValidity: { en: 'Group 1 · 3-month plan', ta: 'குரூப் 1 · 3-மாத திட்டம்' },
  premiumPerk1: { en: 'Unlimited practice tests', ta: 'வரம்பற்ற பயிற்சித் தேர்வுகள்' },
  premiumPerk2: {
    en: '5 mock exams (2 anytime + 3 after the exam announcement)',
    ta: '5 மாதிரித் தேர்வுகள் (2 எப்போது வேண்டுமானாலும் + அறிவிப்புக்குப் பின் 3)',
  },
  premiumPerk3: {
    en: 'Previous-year papers — last 5 years',
    ta: 'முந்தைய ஆண்டு வினாத்தாள்கள் — கடந்த 5 ஆண்டுகள்',
  },
  premiumPerk4: {
    en: 'Current Affairs (Aug 2025 – Jun 2026)',
    ta: 'நடப்பு நிகழ்வுகள் (ஆக 2025 – ஜூன் 2026)',
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
  premiumBonus5: { en: '1 exam kit', ta: '1 தேர்வு கிட்' },
  premiumPerYear: { en: '/ 3 months', ta: '/ 3 மாதம்' },
  premiumFlatSave: { en: 'Flat save', ta: 'சேமிப்பு' },
  premiumYouSave: { en: 'You save', ta: 'நீங்கள் சேமிக்கிறீர்கள்' },
  premiumApplied: { en: 'applied', ta: 'பயன்படுத்தப்பட்டது' },
  premiumCouponPlaceholder: { en: 'Coupon code', ta: 'கூப்பன் குறியீடு' },
  premiumApply: { en: 'Apply', ta: 'பயன்படுத்து' },
  premiumRemoveCoupon: { en: 'Remove coupon', ta: 'கூப்பனை அகற்று' },
  premiumGet: { en: 'Get Premium', ta: 'பிரீமியம் பெறு' },
  premiumGetFree: { en: 'Unlock Premium — Free', ta: 'பிரீமியத்தை இலவசமாகத் திற' },
  premiumFree: { en: 'FREE', ta: 'இலவசம்' },
  premiumThanks: {
    en: 'Welcome to Premium — thank you!',
    ta: 'பிரீமியத்திற்கு வரவேற்கிறோம் — நன்றி!',
  },
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

  // Percentile + syllabus
  yourRank: { en: 'Your Standing', ta: 'உங்கள் நிலை' },
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

  // ─── Notifications ────────────────────────────────────────────────────────
  notifications: { en: 'Notifications', ta: 'அறிவிப்புகள்' },
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
  notificationsTab: { en: 'Notify', ta: 'அறிவிப்பு' },

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
  orDivider: { en: 'or', ta: 'அல்லது' },
  googleSignInFailed: {
    en: "Couldn't sign in with Google. Please try again.",
    ta: 'Google மூலம் உள்நுழைய முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
  },
  // Complete-profile onboarding (Google signups land here to add the details
  // Google doesn't provide — phone + target group).
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
  errPasswordShort: { en: 'Password must be at least 6 characters.', ta: 'கடவுச்சொல் குறைந்தது 6 எழுத்துகள் இருக்க வேண்டும்.' },
  errPasswordMismatch: { en: 'Passwords do not match.', ta: 'கடவுச்சொற்கள் பொருந்தவில்லை.' },
  errNameRequired: { en: 'Please enter your full name.', ta: 'உங்கள் முழுப் பெயரை உள்ளிடவும்.' },
  errPhoneRequired: { en: 'Please enter your phone number.', ta: 'உங்கள் தொலைபேசி எண்ணை உள்ளிடவும்.' },
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
  feedbackRateLimited: {
    en: 'Thanks! You can share feedback again once every 3 months.',
    ta: 'நன்றி! ஒவ்வொரு 3 மாதங்களுக்கு ஒருமுறை மீண்டும் கருத்து தெரிவிக்கலாம்.',
  },

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
  couponsTab: { en: 'Coupons', ta: 'கூப்பன்கள்' },
  revenueTab: { en: 'Revenue', ta: 'வருவாய்' },
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
