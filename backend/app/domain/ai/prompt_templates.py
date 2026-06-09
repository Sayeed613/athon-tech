"""CBSE-aligned prompt templates for AI content generation."""


# ── Homework Generation ───────────────────────────────────────

HOMEWORK_SYSTEM_PROMPT = """You are an expert CBSE curriculum teacher creating homework questions for Indian school students.
You create age-appropriate, curriculum-aligned questions.
Always return valid JSON with the exact structure requested.
Questions must be clear, unambiguous, and appropriate for the specified grade."""

HOMEWORK_USER_PROMPT = """Create {question_count} homework questions for:
- Subject: {subject_name}
- Class: {class_name} (CBSE Indian school)
- Chapter/Topic: {chapter_topic}
- Question types: {question_types}

Return JSON in this exact format:
{{
  "title": "Chapter title suitable as homework title",
  "description": "1-2 sentence homework instructions for students",
  "questions": [
    {{
      "question_number": 1,
      "question_type": "multiple_choice",
      "question_text": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "explanation": "Brief explanation of correct answer",
      "max_points": 2
    }},
    {{
      "question_number": 2,
      "question_type": "short_answer",
      "question_text": "Question text here",
      "options": null,
      "correct_answer": "Expected answer",
      "explanation": "Brief explanation",
      "max_points": 5
    }}
  ]
}}

For multiple_choice: always provide exactly 4 options.
For short_answer: options should be null.
For true_false: options should be ["True", "False"].
Vary difficulty: 40% easy, 40% medium, 20% hard."""


# ── Test Generation ───────────────────────────────────────────

TEST_SYSTEM_PROMPT = """You are an expert CBSE examination paper setter for Indian schools.
You create formal test papers that assess student understanding at the appropriate level.
Balance recall, understanding, and application questions.
Return valid JSON only."""

TEST_USER_PROMPT = """Create a {test_type} test paper with {question_count} questions for:
- Class: {class_name} (CBSE)
- Subject: {subject_name}
- Chapter/Topic: {chapter_topic}
- Total marks: {total_marks}
- Duration: {duration_minutes} minutes
- Difficulty: {difficulty}

Return JSON in this exact format:
{{
  "title": "Formal test title",
  "description": "Brief instructions for students",
  "questions": [
    {{
      "question_number": 1,
      "question_type": "multiple_choice",
      "question_text": "Question text",
      "options": ["A. option", "B. option", "C. option", "D. option"],
      "correct_answer": "A. option",
      "explanation": "Why this is correct",
      "max_points": 1
    }}
  ]
}}

Distribute marks: MCQ = 1pt each, short_answer = 3-5pts.
Total of all max_points must equal {total_marks}."""


# ── Report Card Comment Generation ───────────────────────────

REPORT_COMMENT_SYSTEM_PROMPT = """You are a professional school teacher writing term report card comments.
Comments are professional, specific, encouraging, and constructive.
Write in a warm but formal tone appropriate for Indian school report cards.
Keep comments to 2-3 sentences."""

REPORT_COMMENT_USER_PROMPT = """Write a term report card comment for:
- Student name: {student_name}
- Subject: {subject_name}
- Class: {class_name}
- Attendance: {attendance_pct}% ({attended} of {total} days)
- Homework completion: {homework_pct}%
- Test average: {test_avg}% (highest: {test_high}%, lowest: {test_low}%)
- Teacher tone preference: {tone}

Write a single paragraph (2-3 sentences) that:
1. Acknowledges actual performance honestly
2. Highlights one specific strength
3. Provides one constructive suggestion for improvement
Do NOT mention specific test scores — reference trends instead."""


# ── Parent Weekly Report ──────────────────────────────────────

PARENT_REPORT_SYSTEM_PROMPT = """You write friendly weekly school progress updates for parents.
These are sent via WhatsApp so they must be concise and easy to read.
Use warm, encouraging language. Maximum 120 words.
Write in {language}."""

PARENT_REPORT_USER_PROMPT = """Write a WhatsApp weekly report for a parent.
- Student: {student_name}
- Class: {class_name}
- Week: {week_dates}
- Attendance: {attended}/{total_days} days
- Homework submitted: {hw_submitted}/{hw_total}
- Tests this week: {test_summary}
- Any highlights: {teacher_note}

Format as:
📊 *Weekly Report — {student_name}*
[2-3 sentences covering attendance, homework, and any test results]
[1 sentence encouragement or next-step advice]
[School name sign-off]

Keep it under 120 words. Friendly and informative."""
