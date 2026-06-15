# TNPSC Proctored Mock Test Module

## 1. Real Exam Simulation

### Exam Configuration
- Exact TNPSC exam duration.
- Exact number of questions.
- Subject-wise question distribution matching TNPSC patterns.
- Configurable exam templates:
  - Group 1
  - Group 2
  - Group 2A
  - Group 4
  - VAO

### Exam Instructions
- Display instructions before starting.
- Candidate confirmation checkbox.
- Test begins only after user confirmation.

---

## 2. OMR-Style Test Interface

### Question Navigation
- Question palette showing all question numbers.

### Color Indicators
- Not Visited
- Visited
- Answered
- Marked for Review
- Answered & Marked for Review

### Actions
- Save & Next
- Clear Response
- Mark for Review
- Mark for Review & Next
- Previous Question
- Jump to Specific Question

### Timer
- Fixed countdown timer.
- Warning notifications:
  - 30 minutes remaining
  - 10 minutes remaining
  - 5 minutes remaining

---

## 3. Full-Screen Enforcement

### Mandatory Full Screen
- Test launches in full-screen mode.
- User cannot begin without entering full screen.

### Violation Detection
Detect:
- Exiting full screen.
- Pressing Esc.
- Browser full-screen exit.

### Violation Handling
- First violation → Warning.
- Second violation → Warning.
- Third violation → Warning.
- Configurable maximum violation count.

### Logging
Store:
- Timestamp
- Violation type
- Question number at violation

---

## 4. Tab Switching Detection

### Detect Events
- Browser tab change.
- Browser minimization.
- Window focus loss.
- Alt + Tab (indirectly through focus loss).
- Opening another application.

### Logging
Record:
- Timestamp
- Duration away from test
- Active question

### Dashboard
Admin can view:
- Total switches
- Switch duration
- Violation timeline

---

## 5. Copy/Paste Prevention

### Disable Actions
- Right-click context menu.
- Text selection.
- Copy (Ctrl + C).
- Paste (Ctrl + V).
- Cut (Ctrl + X).
- Drag and drop text.

### Keyboard Restrictions
Block:
- Ctrl + C
- Ctrl + V
- Ctrl + X
- Ctrl + A

### Logging
Record attempts with timestamps.

---

## 6. Screen Monitoring

### Device Information Collection
Capture:
- Screen resolution.
- Browser information.
- Operating system.
- Device type.

### Multi-Monitor Detection
Where browser capabilities allow:
- Detect extended displays.
- Flag potential multi-monitor usage.

### Session Metadata
Store:
- Login time.
- Test start time.
- Test end time.
- Device fingerprint.

---

## 7. Question Randomization

### Question Shuffling
Randomize:
- Question sequence.
- Question sets.

### Option Shuffling
Randomize:
- Option A/B/C/D order.

### Integrity
- Maintain correct answer mapping.
- Preserve exam blueprint.

---

## 8. Auto Submission

### Automatic Submission Conditions

#### Time Expiry
- Submit immediately when timer reaches zero.

#### Excessive Violations
Configurable threshold:
- Full-screen violations.
- Tab switches.
- Copy/paste attempts.

#### Browser Closure Recovery
- Auto-save every 10–15 seconds.
- Resume if allowed.
- Auto-submit if resume window expires.

---

## 9. Post-Test Analysis

### Score Summary
Display:
- Total Score
- Correct Answers
- Wrong Answers
- Unanswered Questions
- Accuracy Percentage

### Subject-wise Analysis
Show:
- History
- Geography
- Polity
- Economics
- Science
- Current Affairs
- Aptitude
- Tamil

### Time Analysis
- Time spent per question.
- Fastest questions.
- Slowest questions.
- Average response time.

### Difficulty Analysis
Performance in:
- Easy Questions
- Medium Questions
- Hard Questions

### Weak Area Identification
Automatically identify:
- Weak subjects.
- Weak topics.
- Frequently incorrect concepts.

### Improvement Recommendations
Generate:
- Suggested revision topics.
- Suggested quizzes.
- Suggested mock tests.

---

## 10. Proctoring Report

### Candidate Report
Display:
- Test duration.
- Number of violations.
- Violation categories.
- Final score.

### Admin Report
Include:
- Full-screen exits.
- Tab switches.
- Copy/paste attempts.
- Browser focus loss.
- Violation timeline.

### Risk Assessment
Categories:
- Low Risk
- Medium Risk
- High Risk

---

## 11. Admin Controls

### Configuration
Admin can configure:
- Exam duration.
- Number of questions.
- Violation limits.
- Randomization settings.
- Auto-submit rules.

### Monitoring Dashboard
View:
- Active candidates.
- Live test status.
- Violation alerts.
- Test completion status.