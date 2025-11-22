import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

app.post('/api/chat', async (req, res) => {
  try {
    const {
      question,
      citationStyle = 'apa',
      citationMode = 'balanced',
      recency = '10',
      materials = [],
    } = req.body || {};

    if (!question || typeof question !== 'string') {
      return res
        .status(400)
        .json({ error: 'Missing or invalid "question" field.' });
    }

    const model = openai('gpt-4.1-mini');

    const systemPrompt = `
You are PsyCanvas AI, a mental health study assistant for college-level psychology and counseling students.

Goals:
- Help users understand mental health concepts, DSM-5-TR criteria (described in your own words), case formulations, and evidence-based treatments.
- Use mental-health specific knowledge, plus the course materials the user provides (textbooks, articles).
- Always include in-text citations and a reference list in the requested style: ${citationStyle}.

Critical rules:
- Do NOT reproduce DSM-5-TR text verbatim (paraphrase in your own words).
- Use cautious, non-fabricated citations; if you are not sure about a reference, either omit it or clearly flag it as a suggested reading, not a precise citation.

Citation style:
- Current setting: ${citationStyle}.
- Citation strictness: ${citationMode}.
- Recency preference: ${
      recency === 'all'
        ? 'no hard limit, but flag older work'
        : 'focus on roughly the last ' + recency + ' years of research'
    }.

Course materials:
${
  materials.length
    ? '- User has indicated the following course materials:\n  - ' +
      materials.join('\n  - ')
    : '- No specific course materials listed in this request.'
}

Output format:
1. Provide a clear, structured explanation or answer to the user's question.
2. Use in-text citations with author and year (and page/section if appropriate).
3. End with a "References" section, listing the main sources you relied on, formatted as best you can in the chosen style.
`.trim();

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: question,
    });

    res.json({ answer: text });
  } catch (err) {
    console.error('Error in /api/chat:', err);
    res.status(500).json({
      error: 'Something went wrong while generating an answer.',
    });
  }
});

app.get('/', (req, res) => {
  res.send('PsyCanvas backend is running.');
});

app.listen(port, () => {
  console.log(`PsyCanvas backend listening on port ${port}`);
});
