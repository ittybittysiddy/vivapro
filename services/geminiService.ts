
import { GoogleGenAI, Type } from "@google/genai";
//import questions pair {id,question,modelans} and questions result {score,feedback}
import { QuestionPair, QuestionResult } from "../types";

/**
 * Utility to safely parse JSON from Gemini which might contain markdown blocks.
 */

//remove backticks as they are not valid in JSON but Ai models sometimes reutnr JSON with it
function safeJsonParse(text: string | undefined): any {
  if (!text) return null;
  const cleaned = text.replace(/```json\n?|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse Gemini response as JSON. Raw text:", text);
    throw new Error("The AI returned an invalid response format. Please try again.");
  }
}

//calls grade submmision - which gets students answers and model answers
export async function gradeSubmission(
  questions: (QuestionPair & { isFollowUp?: boolean })[],
  studentAnswers: string[]
): Promise<QuestionResult[]> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const pairs = questions.map((q, i) => ({
      type: q.isFollowUp ? 'follow_up' : 'standard',
      question: q.question,
      modelAnswer: q.isFollowUp ? null : (q.modelAnswer || '(no model answer provided)'),
      studentAnswer: studentAnswers[i] || '(no answer)',
    }));

    const prompt = `You are a fair but strict academic examiner. Grade each student answer based on its type.

There are two types of questions in this submission:

TYPE 1 — STANDARD QUESTIONS (type: "standard")
These have a model answer. Grade the student's answer against the model answer on a scale of 0–10.

SCORING SCALE for standard questions:
- 10: Perfect — all key concepts present, correct and complete
- 8–9: Very good — covers most key concepts with only minor gaps
- 6–7: Good — correct core idea but missing some important details
- 4–5: Partial — shows some understanding but significant gaps or errors
- 2–3: Weak — only a small relevant point mentioned, mostly incomplete
- 1: Barely attempted — very vague or nearly meaningless but not blank
- 0: No answer, expression of ignorance, blank, or completely irrelevant

TYPE 2 — FOLLOW-UP QUESTIONS (type: "follow_up")
These have NO model answer. They were generated from the student's own assignment to test whether they truly understand their own work. Grade purely on depth of understanding.

SCORING SCALE for follow-up questions:
- 10: Shows complete understanding — explains clearly in own words with correct reasoning
- 8–9: Strong understanding with only minor gaps
- 6–7: Decent understanding but lacks depth or precision
- 4–5: Partial — gets the general idea but can't explain properly
- 2–3: Weak — very surface level or mostly off-topic
- 1: Barely attempted — present but shows almost no understanding
- 0: Blank, "I don't know", completely irrelevant, or gibberish

ABSOLUTE ZERO RULES (apply to BOTH types):
- "I don't know", "idk", "no idea", blank, or any expression of ignorance → 0
- Completely unrelated answer → 0
- Gibberish → 0

GUIDELINES:
- Do not be harsh on minor spelling or grammar — grade on content only
- For follow-up questions: a one-line or single-phrase answer that only names a concept without any explanation cannot score above 5, even if the named concept is correct — to score 6 or above the student must explain HOW or WHY, not just WHAT
- Never give marks just for effort — content must be academically relevant

Return ONLY a JSON array, no markdown, no explanation. Each item must have:
- "score": integer 0–10
- "feedback": one concise sentence explaining exactly why this score was given

Questions and answers:
${JSON.stringify(pairs, null, 2)}`;

    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });

    let raw = (response.text || '').trim();
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (!arrayMatch) throw new Error('No JSON array found in Gemini response');
    raw = arrayMatch[0]
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");

    const parsed: QuestionResult[] = JSON.parse(raw);
    return parsed.map(r => ({ score: Math.min(10, Math.max(0, Math.round(r.score))), feedback: r.feedback || '' }));
  } catch (error) {
    console.error("Grading Error Details:", error);
    throw error;
  }
}

//generates 2-3 intelligent follow-up questions from the student's uploaded assignment
//called right after upload — runs in background while student does Round 1
export async function generateFollowUpQuestions(
  assignmentText: string,
  qaPairs: { question: string; modelAnswer: string; studentAnswer: string }[]
): Promise<string[]> {
  if (!assignmentText.trim()) throw new Error('Assignment text is empty.');

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `You are an AI viva examiner. Your job is to determine whether the student actually understands the work they submitted in their assignment.

Read the assignment carefully. It may be a written report OR source code. If it is code, analyze what the code does, the logic and approach used, and decisions the student made in their implementation.

Look for:
- Concepts, techniques, or methods they used — do they truly understand them or just used them without knowing why?
- Decisions they made — can they justify why they did something a certain way?
- Gaps in understanding — things mentioned or used in the assignment that a student might include without fully grasping
- Surface-level knowledge — definitions or steps listed without real depth

Based on your analysis, generate 2–3 follow-up questions that:
- Are directly taken from specific content in THIS assignment (mention actual details from it)
- Probe whether the student genuinely understands what they did
- Challenge unclear or weak areas
- Ask "why", "how", or "what would happen if" — not just "what is"
- Do NOT repeat or rephrase any of the standard viva questions listed below
- Are specific and meaningful — not generic questions that could apply to any assignment

IMPORTANT — Language and tone:
- Write questions in simple, clear, everyday English
- Avoid complex academic or technical vocabulary unless it appears directly in the assignment
- Ask questions the way a teacher would ask a student face to face — friendly but probing
- Keep each question short and easy to understand

ABSOLUTE RULES:
- Generate EXACTLY 2 or 3 questions — never more, never less than 2
- Return ONLY a JSON array of strings. No markdown, no explanation, no preamble.

STANDARD VIVA QUESTIONS (do not repeat these):
${qaPairs.map((p, i) => `${i + 1}. ${p.question}`).join('\n')}

STUDENT ASSIGNMENT:
${assignmentText}`;

  let raw = '';
  try {
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    raw = (response.text || '').trim()
      .replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (!arrayMatch) throw new Error('No JSON array in response');

    raw = arrayMatch[0]
      .replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')
      .replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");

    const parsed: string[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some(q => typeof q !== 'string')) {
      throw new Error('Unexpected response format');
    }
    return parsed.slice(0, 3);
  } catch (error) {
    console.error('Follow-up generation error:', error, 'Raw:', raw);
    throw error;
  }
}

//teacher uploading a word doc instead of manually typing 
//takes raw txt(file string) and returns question pair array( question,modelanswer) which is added yo assignments question array
export async function parseMarkingScheme(fileContent: string): Promise<QuestionPair[]> {
  if (!fileContent.trim()) {
    throw new Error("The document appears to be empty.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Analyze the following document and extract every question and its corresponding model answer/marking scheme:
        ---
        ${fileContent}
        ---
        Return a JSON array of objects. Each object must have "id", "question", and "modelAnswer".
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING },
              modelAnswer: { type: Type.STRING },
            },
            required: ["id", "question", "modelAnswer"],
          },
        },
      },
    });

    return safeJsonParse(response.text) || [];
  } catch (error) {
    console.error("AI Parsing Error Details:", error);
    throw error;
  }
}
