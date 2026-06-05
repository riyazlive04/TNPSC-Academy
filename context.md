# TNPSC Mentor — Claude Code Build Context

## Project Overview

Build a complete, production-grade TNPSC exam preparation web application called **TNPSC Mentor**. This is a full-stack app with authentication, a multi-category test engine, timed quizzes, score tracking, and gated PDF explanation downloads.

**Do not skip any feature. Build everything completely.**

---

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS
- **Backend/DB/Auth**: Supabase (self-hosted compatible — use environment variables for URL and keys)
- **PDF Generation**: jsPDF
- **Routing**: React Router v6
- **State**: Zustand
- **Icons**: Lucide React
- **Fonts**: Google Fonts — use `Rajdhani` for headings, `Noto Sans Tamil` for Tamil text support, `Inter` for body

**Color Palette (strict — match the design):**
```
Primary Blue:   #0D47A1  (dark navy blue — backgrounds)
Secondary Blue: #1565C0  (cards, panels)
Accent Yellow:  #FFC107  (active buttons, highlights)
White:          #FFFFFF  (text, pill buttons)
Dark Navy Text: #0D1B2A  (text inside yellow buttons)
Orange/Red:     #FF5722  (warnings, important notes)
```

---

## Design Reference

The app uses a consistent dark navy blue background (#0D47A1) throughout all screens. Navigation elements are white pill-shaped buttons. Active/selected category headers are yellow pill buttons. The brand name is "✳ TNPSC MENTOR" in white with a red asterisk/snowflake icon.

---

## Complete File Structure to Build

```
tnpsc-mentor/
├── public/
│   └── favicon.ico
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── vite-env.d.ts
│   │
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client init
│   │   └── pdfGenerator.ts      # jsPDF explanation PDF logic
│   │
│   ├── store/
│   │   ├── authStore.ts         # Zustand auth state
│   │   └── quizStore.ts         # Zustand quiz session state
│   │
│   ├── types/
│   │   └── index.ts             # All TypeScript interfaces
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useQuiz.ts
│   │
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── AppLayout.tsx    # Wrapper with nav
│   │   │   └── ProtectedRoute.tsx
│   │   ├── UI/
│   │   │   ├── PillButton.tsx   # Reusable white pill button
│   │   │   ├── YellowBadge.tsx  # Yellow category header badge
│   │   │   ├── Timer.tsx        # Countdown timer display
│   │   │   └── ProgressBar.tsx
│   │   └── Quiz/
│   │       ├── QuestionCard.tsx
│   │       ├── OptionButton.tsx
│   │       └── ResultCard.tsx
│   │
│   └── pages/
│       ├── LoginPage.tsx
│       ├── RegisterPage.tsx
│       ├── ForgotPasswordPage.tsx
│       ├── TestArenaPage.tsx        # Home after login
│       ├── PreviousYearPage.tsx     # Group selection + subject
│       ├── SamacheerPage.tsx        # Subject → Standard → Topics
│       ├── CurrentAffairsPage.tsx   # Topic Wise + Month Wise
│       ├── AptitudePage.tsx         # Numerics + Reasoning topics
│       ├── QuizPage.tsx             # The actual test engine
│       └── ResultPage.tsx           # Score + PDF download
│
├── supabase/
│   └── schema.sql               # Complete DB schema
│
├── scrapers/
│   ├── requirements.txt
│   ├── pyq_scraper.py
│   ├── aptitude_scraper.py
│   ├── current_affairs_scraper.py
│   └── upload_to_supabase.py
│
├── .env.example
├── .env
├── tailwind.config.js
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Supabase Schema (supabase/schema.sql)

Build this exact schema:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Questions table
create table questions (
  id uuid default uuid_generate_v4() primary key,
  category text not null check (category in ('pyq', 'samacheer', 'current_affairs', 'aptitude')),
  
  -- PYQ fields
  group_type text check (group_type in ('Group1', 'Group2_2A', 'Group4_VAO')),
  year integer,
  
  -- Samacheer fields
  standard integer check (standard in (6, 7, 8, 9, 10)),
  
  -- Current Affairs fields
  ca_month text,    -- e.g. 'August 2025'
  ca_year integer,  -- e.g. 2025
  ca_type text check (ca_type in ('topic_wise', 'month_wise')),
  ca_topic text,    -- e.g. 'Science & Technology'
  
  -- Aptitude fields
  aptitude_type text check (aptitude_type in ('numerics', 'reasoning')),
  aptitude_topic text,  -- e.g. 'Simplification', 'Dice'
  
  -- Subject (shared across PYQ and Samacheer)
  subject text,
  -- Values: 'History and INM', 'Polity', 'History Culture Heritage of TN',
  --         'Development Administration of TamilNadu', 'Biology',
  --         'Physics', 'Chemistry', 'Indian Economy', 'Current Affairs', 'Aptitude'
  
  topic text,   -- chapter/topic within the subject
  
  -- Question content
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_answer text not null check (correct_answer in ('A', 'B', 'C', 'D')),
  explanation text,
  
  -- Metadata
  difficulty text default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  source_url text,
  created_at timestamptz default now()
);

-- Indexes for fast filtering
create index idx_questions_category on questions(category);
create index idx_questions_group_type on questions(group_type);
create index idx_questions_subject on questions(subject);
create index idx_questions_ca_month on questions(ca_month);
create index idx_questions_aptitude_topic on questions(aptitude_topic);
create index idx_questions_standard on questions(standard);

-- Test Sessions
create table test_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  
  -- What test this is
  category text not null,
  group_type text,
  subject text,
  standard integer,
  ca_month text,
  ca_type text,
  aptitude_type text,
  aptitude_topic text,
  
  -- Results
  total_questions integer not null,
  attempted integer default 0,
  correct integer default 0,
  score_percentage float default 0,
  
  -- Gating
  pdf_unlocked boolean default false,
  passed_80_percent boolean default false,
  
  -- Timing
  time_limit_seconds integer not null,
  time_taken_seconds integer,
  started_at timestamptz default now(),
  completed_at timestamptz,
  
  status text default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned'))
);

-- Individual Answers
create table test_answers (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references test_sessions(id) on delete cascade,
  question_id uuid references questions(id),
  selected_answer text check (selected_answer in ('A', 'B', 'C', 'D')),
  is_correct boolean,
  time_spent_seconds float default 0,
  flagged boolean default false,
  created_at timestamptz default now()
);

-- User Profiles
create table profiles (
  id uuid references auth.users(id) primary key,
  full_name text,
  email text,
  phone text,
  target_group text check (target_group in ('Group1', 'Group2_2A', 'Group4_VAO')),
  created_at timestamptz default now()
);

-- Row Level Security
alter table questions enable row level security;
alter table test_sessions enable row level security;
alter table test_answers enable row level security;
alter table profiles enable row level security;

-- Policies
create policy "Questions are readable by authenticated users"
  on questions for select to authenticated using (true);

create policy "Users can manage own sessions"
  on test_sessions for all to authenticated
  using (auth.uid() = user_id);

create policy "Users can manage own answers"
  on test_answers for all to authenticated
  using (session_id in (
    select id from test_sessions where user_id = auth.uid()
  ));

create policy "Users can manage own profile"
  on profiles for all to authenticated
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## TypeScript Types (src/types/index.ts)

```typescript
export interface Question {
  id: string
  category: 'pyq' | 'samacheer' | 'current_affairs' | 'aptitude'
  group_type?: 'Group1' | 'Group2_2A' | 'Group4_VAO'
  year?: number
  standard?: number
  ca_month?: string
  ca_year?: number
  ca_type?: 'topic_wise' | 'month_wise'
  ca_topic?: string
  aptitude_type?: 'numerics' | 'reasoning'
  aptitude_topic?: string
  subject?: string
  topic?: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: 'A' | 'B' | 'C' | 'D'
  explanation?: string
  difficulty?: 'easy' | 'medium' | 'hard'
}

export interface TestSession {
  id: string
  user_id: string
  category: string
  total_questions: number
  attempted: number
  correct: number
  score_percentage: number
  pdf_unlocked: boolean
  passed_80_percent: boolean
  time_limit_seconds: number
  time_taken_seconds?: number
  started_at: string
  completed_at?: string
  status: 'in_progress' | 'completed' | 'abandoned'
}

export interface TestAnswer {
  question_id: string
  selected_answer: 'A' | 'B' | 'C' | 'D'
  is_correct: boolean
  time_spent_seconds: number
}

export interface QuizConfig {
  category: string
  group_type?: string
  subject?: string
  standard?: number
  ca_month?: string
  ca_type?: string
  ca_topic?: string
  aptitude_type?: string
  aptitude_topic?: string
}

export interface Profile {
  id: string
  full_name: string
  email: string
  phone?: string
  target_group?: string
}
```

---

## Page-by-Page Specifications

### 1. LoginPage.tsx (`/login`)

**Design**: Full dark navy (#0D47A1) background. Centered card. Brand logo "✳ TNPSC MENTOR" at top in white with red star icon. Title "ENTER ASPIRANT PORTAL" in large white text. Two white rounded pill inputs for Username and Password. Below inputs: "REGISTER AS ASPIRANT" link in white, "FORGOT CREDENTIALS" link in yellow.

**Logic**:
- Use Supabase `signInWithPassword()`
- On success → navigate to `/test-arena`
- Show inline error on failure
- Form validation before submit

---

### 2. RegisterPage.tsx (`/register`)

**Design**: Same navy background. Form with: Full Name, Email, Phone, Password, Confirm Password, Target Group dropdown (Group 1 / Group 2/2A / Group 4 & VAO). Submit button is yellow pill.

**Logic**:
- Supabase `signUp()` with metadata `{ full_name }`
- Insert into profiles table
- On success → navigate to `/test-arena`

---

### 3. ForgotPasswordPage.tsx (`/forgot-password`)

**Design**: Simple. Email input + send button. Confirmation message shown after submit.

**Logic**: Supabase `resetPasswordForEmail()`

---

### 4. TestArenaPage.tsx (`/test-arena`) — Home Screen

**Design**: Navy background. Yellow pill badge "TEST ARENA" at top center. Below it, four white pill buttons in a grid:
- PREVIOUS YEAR QUESTION PAPERS
- SAMACHEER BASED
- CURRENT AFFAIRS
- APTITUDE TOPIC WISE

On hover over any button, show a small preview tooltip/card showing what's inside (e.g. "Group 1 | Group 2/2A | Group 4 & VAO" for PYQ). This is the "WHILWEHOWERING TAKE TEST SHOULD DISPLAY" note from the design.

**Logic**: Each button navigates to its respective page.

---

### 5. PreviousYearPage.tsx (`/test-arena/pyq`)

**Design**: Navy background. Yellow pill "PREVIOUS YEAR QUESTION PAPER" badge at top.

**Row 1**: Three white pill buttons:
- GROUP 1
- GROUP 2/2A
- GROUP 4 & VAO

When a group is selected (highlighted yellow), **Row 2** appears with 10 subject pills:
- HISTORY AND INM
- POLITY
- HISTORY CULTURE HERITAGE OF TN
- DEVELOPMENT ADMINISTRATION OF TAMILNADU
- BIOLOGY
- PHYSICS
- CHEMISTRY
- INDIAN ECONOMY
- CURRENT AFFAIRS
- APTITUDE

Selecting a subject → navigate to `/quiz` with config params.

**Logic**:
- State: `selectedGroup`, `selectedSubject`
- On subject click → `navigate('/quiz', { state: { category: 'pyq', group_type, subject } })`

---

### 6. SamacheerPage.tsx (`/test-arena/samacheer`)

**Design**: Same pattern. Yellow pill "SAMACHEER BASED" at top.

**Row 1**: 10 subject pills (same list as PYQ above).

When subject selected, **Row 2** shows standard pills:
- 6TH | 7TH | 8TH | 9TH | 10TH

When standard selected, **Row 3** shows topic pills (fetch from DB: distinct topics for that subject + standard).

Selecting a topic → navigate to quiz.

**Logic**:
- State: `selectedSubject`, `selectedStandard`, `selectedTopic`
- Fetch distinct topics from Supabase when subject + standard selected
- Navigate to quiz with `{ category: 'samacheer', subject, standard, topic }`

---

### 7. CurrentAffairsPage.tsx (`/test-arena/current-affairs`)

**Design**: Yellow pill "CURRENT AFFAIRS" badge. Two yellow sub-category pills: **TOPIC WISE** | **MONTH WISE**.

**Month Wise view**: Grid of white pill buttons for each month:
- August 2025, September 2025, October 2025, November 2025, December 2025
- January 2026, February 2026, March 2026, April 2026, May 2026, June 2026

**Topic Wise view**: Show topic categories as pills (fetch from DB distinct ca_topic values). Note: "TOPIC WISE REFER TO WORD DOCUMENT UPLOADED IN DRIVE IN CURRENT AFFAIRS FOLDER" — display a note that topic-wise content is manually curated and show whatever topics exist in DB.

Selecting month or topic → navigate to quiz.

---

### 8. AptitudePage.tsx (`/test-arena/aptitude`)

**Design**: Yellow pill "APTITUDE" at top. Two yellow sub-category pills: **NUMERICS** | **REASONING**.

**Numerics topics** (white pills, shown when NUMERICS selected):
- SIMPLIFICATION
- PROFIT AND LOSS
- PERCENTAGE
- RATIO AND PROPORTION
- LCM & HCF
- AREA AND VOLUME
- SIMPLE INTEREST & COMPOUND INTEREST
- TIME AND WORK
- A.P & G.P
- SQUARE ROOT & CUBE ROOT
- SURDS
- LOGS AND EXPONENTS

**Reasoning topics** (white pills, shown when REASONING selected):
- LOGICAL NUMBER SERIES
- LOGICAL ALPHABET SERIES
- ALPHA-NUMERIC REASONING
- ANALOGY
- DICE
- PUZZLES
- NO OF FIGURES
- MATHEMATICAL OPERATORS

Selecting any topic → navigate to quiz with `{ category: 'aptitude', aptitude_type, aptitude_topic }`.

---

### 9. QuizPage.tsx (`/quiz`) — THE CORE ENGINE

**Design**: 
- Navy background
- Top bar: Question counter (e.g. "Q 12 / 50"), Timer countdown (large, turns red when < 60s), subject/category label
- Question card: White/light card with question text in dark navy
- 4 option buttons: White pills labeled A, B, C, D — highlight selected option in yellow
- Bottom: Previous | Flag | Next buttons
- Progress bar showing completion

**Quiz Rules (implement all of these)**:

```
1. TIME = total_questions × 45 seconds
   Example: 50 questions = 2250 seconds = 37.5 minutes

2. MINIMUM TIME PER QUESTION = 15 seconds
   If user tries to go Next before 15 seconds, show warning:
   "Please spend at least 15 seconds on this question"
   Block navigation until 15 seconds elapsed.

3. MINIMUM ATTENDANCE = 80% of questions must be attempted
   If user submits with < 80% attempted, show warning:
   "You must attempt at least 80% of questions to unlock the explanation PDF.
    You can still submit to see your score."
   Two buttons: "Submit Anyway (Score Only)" | "Continue Test"

4. PDF UNLOCK GATE:
   - If attempted >= 80% → pdf_unlocked = true → show Download PDF button
   - If attempted < 80% → pdf_unlocked = false → show score only, PDF button disabled with message

5. AUTO-SUBMIT when timer reaches 0

6. Questions fetched from Supabase based on QuizConfig passed via router state
   Fetch up to 100 questions matching the filter, randomize order

7. Store each answer with time_spent_seconds (track per-question time)

8. Question flagging: users can flag questions to review before submitting
```

**State management (QuizStore)**:
```typescript
- questions: Question[]
- currentIndex: number
- answers: Record<string, TestAnswer>
- questionStartTime: number  // Date.now() when question shown
- totalTimeLeft: number
- sessionId: string
- isSubmitting: boolean
```

**On Submit Flow**:
1. Calculate score: count correct answers
2. Calculate attendance: count answered questions
3. Check 80% gate
4. Save session to Supabase (test_sessions table)
5. Save all answers to Supabase (test_answers table)
6. Navigate to `/result` with session data

---

### 10. ResultPage.tsx (`/result`)

**Design**: Navy background. Show:
- Large score display (e.g. "38 / 50")
- Percentage badge
- Subject and category label
- Time taken
- Accuracy percentage
- Green check / Red X per question summary (compact list)

**PDF Section**:
- If `pdf_unlocked = true`: Yellow "DOWNLOAD EXPLANATION PDF" button
- If `pdf_unlocked = false`: Grayed out button with text "Attempt 80% of questions to unlock explanations"

**PDF Content (pdfGenerator.ts)**:
Generate a PDF with jsPDF containing:
- Header: "TNPSC Mentor — Explanation Report"
- Test details (category, date, score)
- For each question:
  - Question number and text
  - All 4 options (mark correct in green, user's answer if wrong in red)
  - Explanation text
- Branded footer

**Logic**:
- Fetch full question data (with explanations) only if pdf_unlocked
- Use jsPDF to generate and auto-download

Back to Test Arena button at bottom.

---

## Python Scrapers (scrapers/)

### requirements.txt
```
requests==2.31.0
beautifulsoup4==4.12.2
supabase==2.3.0
python-dotenv==1.0.0
lxml==5.1.0
```

### aptitude_scraper.py

Scrape from `indiabix.com`:

```python
"""
Scrapes aptitude questions from IndiaBix.
Topics: Simplification, Profit and Loss, Percentage, 
        Ratio and Proportion, LCM and HCF, etc.

URL pattern: https://www.indiabix.com/aptitude/{topic}/
"""

import requests
from bs4 import BeautifulSoup
import json
import time
from dotenv import load_dotenv
import os

load_dotenv()

TOPIC_MAP = {
    'simplification': ('numerics', 'Simplification'),
    'profit-and-loss': ('numerics', 'Profit and Loss'),
    'percentage': ('numerics', 'Percentage'),
    'ratio-and-proportion': ('numerics', 'Ratio and Proportion'),
    'problems-on-lcm-and-hcf': ('numerics', 'LCM & HCF'),
    'area': ('numerics', 'Area and Volume'),
    'simple-interest': ('numerics', 'Simple Interest & Compound Interest'),
    'time-and-work': ('numerics', 'Time and Work'),
    'progressions': ('numerics', 'A.P & G.P'),
    'square-root-and-cube-root': ('numerics', 'Square Root & Cube Root'),
    'surds-and-indices': ('numerics', 'Surds'),
    'logarithm': ('numerics', 'Logs and Exponents'),
    # Reasoning
    'number-series': ('reasoning', 'Logical Number Series'),
    'alphabet-series': ('reasoning', 'Logical Alphabet Series'),
    'analogy': ('reasoning', 'Analogy'),
    'number-puzzles': ('reasoning', 'Puzzles'),
    'mathematical-operations': ('reasoning', 'Mathematical Operators'),
}

def scrape_indiabix_topic(slug, aptitude_type, topic_name):
    base_url = f"https://www.indiabix.com/aptitude/{slug}/"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    questions = []
    page = 1
    
    while page <= 5:  # scrape up to 5 pages per topic
        url = f"{base_url}0{page}0" if page > 1 else base_url
        try:
            resp = requests.get(url, headers=headers, timeout=10)
            soup = BeautifulSoup(resp.content, 'lxml')
            
            q_blocks = soup.select('.bix-div-queid')
            if not q_blocks:
                break
                
            for block in q_blocks:
                try:
                    q_text_el = block.find_next('.bix-td-qtxt')
                    q_text = q_text_el.get_text(strip=True) if q_text_el else ''
                    
                    options = block.find_all_next('.bix-td-option', limit=4)
                    option_texts = [o.get_text(strip=True) for o in options]
                    
                    answer_el = block.find_next('.jq-hdnakq')
                    answer_letter = answer_el.get('value', 'A').strip().upper() if answer_el else 'A'
                    
                    explain_el = block.find_next('.bix-ans-description')
                    explanation = explain_el.get_text(strip=True) if explain_el else ''
                    
                    if len(option_texts) >= 4 and q_text:
                        questions.append({
                            'category': 'aptitude',
                            'aptitude_type': aptitude_type,
                            'aptitude_topic': topic_name,
                            'question_text': q_text,
                            'option_a': option_texts[0],
                            'option_b': option_texts[1],
                            'option_c': option_texts[2],
                            'option_d': option_texts[3],
                            'correct_answer': answer_letter if answer_letter in ['A','B','C','D'] else 'A',
                            'explanation': explanation,
                            'difficulty': 'medium'
                        })
                except Exception as e:
                    print(f"Error parsing question: {e}")
                    continue
            
            page += 1
            time.sleep(1)
            
        except Exception as e:
            print(f"Error fetching page {page}: {e}")
            break
    
    return questions

def scrape_all_aptitude():
    all_questions = []
    for slug, (apt_type, topic_name) in TOPIC_MAP.items():
        print(f"Scraping {topic_name}...")
        questions = scrape_indiabix_topic(slug, apt_type, topic_name)
        print(f"  Found {len(questions)} questions")
        all_questions.extend(questions)
        time.sleep(2)
    
    with open('aptitude_questions.json', 'w', encoding='utf-8') as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)
    
    print(f"\nTotal aptitude questions: {len(all_questions)}")
    return all_questions

if __name__ == '__main__':
    scrape_all_aptitude()
```

### current_affairs_scraper.py

```python
"""
Scrapes monthly current affairs from affairscloud.com and gktoday.in
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re

MONTHS = [
    ('august-2025', 'August 2025', 2025),
    ('september-2025', 'September 2025', 2025),
    ('october-2025', 'October 2025', 2025),
    ('november-2025', 'November 2025', 2025),
    ('december-2025', 'December 2025', 2025),
    ('january-2026', 'January 2026', 2026),
    ('february-2026', 'February 2026', 2026),
    ('march-2026', 'March 2026', 2026),
    ('april-2026', 'April 2026', 2026),
    ('may-2026', 'May 2026', 2026),
    ('june-2026', 'June 2026', 2026),
]

TOPIC_CATEGORIES = [
    'Science & Technology', 'Sports', 'Economy & Finance',
    'Government Schemes', 'International Affairs', 'Awards & Honours',
    'Appointments', 'Environment', 'Defence', 'Tamil Nadu'
]

def scrape_gktoday_mcq(month_slug, ca_month, ca_year):
    """Scrape MCQs from GKToday monthly quiz"""
    url = f"https://www.gktoday.in/current-affairs-mcq/{month_slug}/"
    headers = {'User-Agent': 'Mozilla/5.0'}
    questions = []
    
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        soup = BeautifulSoup(resp.content, 'lxml')
        
        for q_div in soup.select('.wp-block-group'):
            try:
                q_text_el = q_div.find('p')
                if not q_text_el:
                    continue
                q_text = q_text_el.get_text(strip=True)
                if not q_text or len(q_text) < 10:
                    continue
                
                options = q_div.find_all('li')
                if len(options) < 4:
                    continue
                
                option_texts = [o.get_text(strip=True) for o in options[:4]]
                
                # Look for answer
                answer_el = q_div.find(string=re.compile(r'Answer[:\s]+[ABCD]', re.I))
                answer = 'A'
                if answer_el:
                    match = re.search(r'[ABCD]', answer_el)
                    if match:
                        answer = match.group()
                
                questions.append({
                    'category': 'current_affairs',
                    'ca_month': ca_month,
                    'ca_year': ca_year,
                    'ca_type': 'month_wise',
                    'question_text': q_text,
                    'option_a': option_texts[0],
                    'option_b': option_texts[1],
                    'option_c': option_texts[2],
                    'option_d': option_texts[3],
                    'correct_answer': answer,
                    'explanation': '',
                    'difficulty': 'medium'
                })
            except:
                continue
    except Exception as e:
        print(f"Error scraping {month_slug}: {e}")
    
    return questions

def scrape_all_current_affairs():
    all_questions = []
    for slug, month_label, year in MONTHS:
        print(f"Scraping {month_label}...")
        questions = scrape_gktoday_mcq(slug, month_label, year)
        print(f"  Found {len(questions)} questions")
        all_questions.extend(questions)
        time.sleep(2)
    
    with open('current_affairs_questions.json', 'w', encoding='utf-8') as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)
    
    print(f"\nTotal current affairs questions: {len(all_questions)}")
    return all_questions

if __name__ == '__main__':
    scrape_all_current_affairs()
```

### pyq_scraper.py

```python
"""
Scrapes TNPSC Previous Year Questions from tnpscguru.in and winmeen.com
"""

import requests
from bs4 import BeautifulSoup
import json
import time

GROUP_SUBJECTS = {
    'Group1': [
        'History and INM', 'Polity', 'History Culture Heritage of TN',
        'Development Administration of TamilNadu', 'Biology',
        'Physics', 'Chemistry', 'Indian Economy', 'Current Affairs', 'Aptitude'
    ],
    'Group2_2A': [
        'History and INM', 'Polity', 'History Culture Heritage of TN',
        'Biology', 'Physics', 'Chemistry', 'Indian Economy', 'Current Affairs', 'Aptitude'
    ],
    'Group4_VAO': [
        'History and INM', 'Polity', 'Biology', 'Physics', 'Chemistry',
        'Indian Economy', 'Current Affairs', 'Aptitude'
    ]
}

def scrape_tnpsc_winmeen(group, subject):
    """
    Scrape from winmeen.com TNPSC section.
    URL pattern: https://www.winmeen.com/tnpsc-{group}-{subject}-questions/
    """
    subject_slug = subject.lower().replace(' ', '-').replace('&', 'and')
    group_slug = group.lower().replace('_', '-')
    url = f"https://www.winmeen.com/tnpsc-{group_slug}-{subject_slug}-online-test/"
    
    headers = {'User-Agent': 'Mozilla/5.0'}
    questions = []
    
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        soup = BeautifulSoup(resp.content, 'lxml')
        
        for q_block in soup.select('.question-block, .quiz-question'):
            try:
                q_text = q_block.find('p', class_='question').get_text(strip=True)
                options = q_block.find_all('li', class_='option')
                
                if len(options) < 4:
                    continue
                
                option_texts = [o.get_text(strip=True) for o in options[:4]]
                
                correct_el = q_block.find('li', class_='correct')
                correct_idx = options.index(correct_el) if correct_el in options else 0
                correct_letter = ['A', 'B', 'C', 'D'][correct_idx]
                
                explain_el = q_block.find('div', class_='explanation')
                explanation = explain_el.get_text(strip=True) if explain_el else ''
                
                questions.append({
                    'category': 'pyq',
                    'group_type': group,
                    'subject': subject,
                    'question_text': q_text,
                    'option_a': option_texts[0],
                    'option_b': option_texts[1],
                    'option_c': option_texts[2],
                    'option_d': option_texts[3],
                    'correct_answer': correct_letter,
                    'explanation': explanation,
                    'difficulty': 'medium'
                })
            except:
                continue
    except Exception as e:
        print(f"Error: {url} — {e}")
    
    return questions

def scrape_all_pyq():
    all_questions = []
    for group, subjects in GROUP_SUBJECTS.items():
        for subject in subjects:
            print(f"Scraping {group} — {subject}...")
            questions = scrape_tnpsc_winmeen(group, subject)
            print(f"  Found {len(questions)} questions")
            all_questions.extend(questions)
            time.sleep(1.5)
    
    with open('pyq_questions.json', 'w', encoding='utf-8') as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)
    
    print(f"\nTotal PYQ questions: {len(all_questions)}")

if __name__ == '__main__':
    scrape_all_pyq()
```

### upload_to_supabase.py

```python
"""
Upload scraped JSON files to Supabase questions table.
Run after all scrapers complete.
"""

import json
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')  # use service role for bulk insert
)

def upload_file(filename, label):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"Uploading {len(data)} {label} questions...")
        
        # Upload in batches of 100
        for i in range(0, len(data), 100):
            batch = data[i:i+100]
            result = supabase.table('questions').insert(batch).execute()
            print(f"  Batch {i//100 + 1}: inserted {len(batch)} rows")
        
        print(f"✅ {label} upload complete")
        
    except FileNotFoundError:
        print(f"⚠️  {filename} not found. Run the scraper first.")
    except Exception as e:
        print(f"❌ Error uploading {label}: {e}")

if __name__ == '__main__':
    upload_file('aptitude_questions.json', 'Aptitude')
    upload_file('current_affairs_questions.json', 'Current Affairs')
    upload_file('pyq_questions.json', 'PYQ')
    print("\n🎉 All uploads complete!")
```

---

## Environment Variables

### .env.example
```
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### .env (fill in actual values — never commit)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### scrapers/.env
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## package.json Dependencies

```json
{
  "name": "tnpsc-mentor",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "jspdf": "^2.5.1",
    "lucide-react": "^0.383.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.3",
    "vite": "^5.1.0"
  }
}
```

---

## Critical Implementation Rules

1. **Never skip a page or feature.** All 10 pages must be fully built and functional.

2. **All 3 groups in PYQ** — Group 1, Group 2/2A, Group 4 & VAO — must be selectable with all subjects for each.

3. **Quiz timer is strict** — implement `useEffect` countdown, auto-submit on zero, per-question minimum 15s enforcement.

4. **80% gate is hard** — check before allowing PDF generation. If not met, disable the PDF button with explanation.

5. **Supabase calls must handle loading and error states** on every page that fetches data.

6. **ProtectedRoute** must wrap all pages except `/login`, `/register`, `/forgot-password`. Redirect to `/login` if not authenticated.

7. **Router**: Use `react-router-dom` with these exact routes:
   ```
   /                       → redirect to /login
   /login                  → LoginPage
   /register               → RegisterPage
   /forgot-password        → ForgotPasswordPage
   /test-arena             → TestArenaPage (protected)
   /test-arena/pyq         → PreviousYearPage (protected)
   /test-arena/samacheer   → SamacheerPage (protected)
   /test-arena/current-affairs → CurrentAffairsPage (protected)
   /test-arena/aptitude    → AptitudePage (protected)
   /quiz                   → QuizPage (protected)
   /result                 → ResultPage (protected)
   ```

8. **Responsive** — must work on mobile (aspirants use phones). Tailwind responsive classes throughout.

9. **QuizPage gets its config from `location.state`** (passed by React Router navigate). Always validate this exists; redirect to `/test-arena` if not.

10. **The PDF generation** only fetches explanation data from Supabase if `pdf_unlocked === true`. Never expose explanations before the gate is passed.

11. **Color consistency** — every page must use the exact colors defined above. The dark navy blue (#0D47A1) background is non-negotiable.

12. **Hover tooltip on Test Arena** — when user hovers over any of the 4 main test category buttons, show a small popup/tooltip showing what's inside that category.

---

## Deployment Notes

This app is designed to run on **Hostinger VPS** with:
- **Nginx** serving the React `/dist` build as static files
- **Self-hosted Supabase** running via Docker on the same VPS
- `VITE_SUPABASE_URL` pointing to `https://api.yourdomain.com` (Supabase Kong gateway)

Build command: `npm run build`
Output directory: `dist/`

---

## What to Build First (Suggested Order)

1. Project scaffold (Vite + TS + Tailwind + Router)
2. Supabase client + types
3. Auth store (Zustand)
4. Login / Register / Forgot Password pages
5. Protected Route + App Router
6. Test Arena home page
7. PYQ page (Group + Subject selection)
8. Aptitude page (Numerics + Reasoning topics)
9. Current Affairs page (Month Wise + Topic Wise)
10. Samacheer page (Subject + Standard + Topic)
11. Quiz Engine (QuizPage — the most complex)
12. Result page + PDF generation
13. Python scrapers
14. Supabase schema SQL
15. Final QA pass — test all routes, all flows, all edge cases

---

**Build the complete app. No placeholders. No TODOs. Every feature fully implemented.**
