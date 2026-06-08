"""Prompt templates for AI content generation."""


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
