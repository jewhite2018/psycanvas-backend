import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import winston from 'winston';

dotenv.config();

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS with environment variables
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Rate limiting for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// Joi validation schema for /api/chat endpoint
const chatSchema = Joi.object({
  question: Joi.string().min(10).max(5000).required().messages({
    'string.base': 'Question must be a string',
    'string.min': 'Question must be at least 10 characters long',
    'string.max': 'Question cannot exceed 5000 characters',
    'any.required': 'Question is required'
  }),
  citationStyle: Joi.string().valid('apa', 'mla', 'chicago').default('apa').messages({
    'any.only': 'Citation style must be one of: apa, mla, chicago'
  }),
  citationMode: Joi.string().valid('strict', 'balanced', 'flexible').default('balanced').messages({
    'any.only': 'Citation mode must be one of: strict, balanced, flexible'
  }),
  recency: Joi.string().valid('5', '10', '15', 'all').default('10').messages({
    'any.only': 'Recency must be one of: 5, 10, 15, all'
  }),
  materials: Joi.array().items(
    Joi.string().max(500).messages({
      'string.max': 'Each material entry cannot exceed 500 characters'
    })
  ).max(20).default([]).messages({
    'array.max': 'Materials cannot exceed 20 items'
  })
});

/**
 * POST /api/chat
 * 
 * Main endpoint for processing chat requests with AI-generated responses
 * about mental health concepts, DSM-5-TR criteria, and evidence-based treatments.
 * 
 * @param {Object} req.body - Request body
 * @param {string} req.body.question - The question to answer (required, 10-5000 chars)
 * @param {string} [req.body.citationStyle='apa'] - Citation style (apa, mla, chicago)
 * @param {string} [req.body.citationMode='balanced'] - Citation mode (strict, balanced, flexible)
 * @param {string} [req.body.recency='10'] - Recency preference (5, 10, 15, all)
 * @param {string[]} [req.body.materials=[]] - Course materials (max 20 items, 500 chars each)
 * 
 * @returns {Object} Response with answer or error
 * @returns {string} response.answer - AI-generated answer with citations
 * @returns {string} response.error - Error message if request failed
 */
app.post('/api/chat', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Validate request body
    const { error, value } = chatSchema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const validationErrors = error.details.map(detail => detail.message);
      logger.warn('Validation error in /api/chat', { errors: validationErrors, ip: req.ip });
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    const {
      question,
      citationStyle,
      citationMode,
      recency,
      materials,
    } = value;

    logger.info('Processing chat request', {
      ip: req.ip,
      questionLength: question.length,
      citationStyle,
      citationMode,
      recency,
      materialsCount: materials.length
    });

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
- Recency preference: ${recency === 'all' ? 'no hard limit, but flag older work' : 'focus on roughly the last ' + recency + ' years of research'}.

Course materials:
${materials.length ? '- User has indicated the following course materials:\n  - ' + materials.join('\n  - ') : '- No specific course materials listed in this request.'}

Output format:
1. Provide a clear, structured explanation or answer to the user's question.
2. Use in-text citations with author and year (and page/section if appropriate).
3. End with a "References" section, listing the main sources you relied on, formatted as best you can in the chosen style.
`.trim();

    // Set timeout for AI request (30 seconds)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 30000);
    });

    const generatePromise = generateText({
      model,
      system: systemPrompt,
      prompt: question,
    });

    const { text } = await Promise.race([generatePromise, timeoutPromise]);

    const duration = Date.now() - startTime;
    logger.info('Chat request completed successfully', {
      ip: req.ip,
      duration: `${duration}ms`
    });

    res.json({ answer: text });
  } catch (err) {
    const duration = Date.now() - startTime;
    
    // Categorize and handle different error types
    if (err.message === 'Request timeout') {
      logger.error('Request timeout in /api/chat', {
        ip: req.ip,
        duration: `${duration}ms`,
        error: err.message
      });
      return res.status(408).json({
        error: 'Request timeout',
        message: 'The request took too long to process. Please try again.'
      });
    }

    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.message?.includes('network')) {
      logger.error('Network error in /api/chat', {
        ip: req.ip,
        error: err.message,
        code: err.code,
        stack: err.stack
      });
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Unable to connect to AI service. Please try again later.'
      });
    }

    if (err.status === 401 || err.message?.includes('API key') || err.message?.includes('authentication')) {
      logger.error('API key error in /api/chat', {
        error: err.message,
        stack: err.stack
      });
      return res.status(500).json({
        error: 'Configuration error',
        message: 'The service is currently unavailable. Please contact support.'
      });
    }

    if (err.status === 429 || err.message?.includes('rate limit')) {
      logger.error('Rate limit error in /api/chat', {
        ip: req.ip,
        error: err.message,
        stack: err.stack
      });
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.'
      });
    }

    if (err.message?.includes('model') || err.message?.includes('invalid')) {
      logger.error('Invalid model error in /api/chat', {
        error: err.message,
        stack: err.stack
      });
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Invalid AI model configuration. Please contact support.'
      });
    }

    // Generic error handler
    logger.error('Unexpected error in /api/chat', {
      ip: req.ip,
      error: err.message,
      stack: err.stack
    });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Something went wrong while generating an answer. Please try again.'
    });
  }
});

/**
 * GET /health
 * 
 * Health check endpoint to verify the service is running
 * 
 * @returns {Object} Health status
 * @returns {string} response.status - Service status ('ok')
 * @returns {string} response.timestamp - Current timestamp in ISO format
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.send('PsyCanvas backend is running.');
});

app.listen(port, () => {
  logger.info(`PsyCanvas backend started on port ${port}`, {
    port,
    nodeEnv: process.env.NODE_ENV || 'development',
    allowedOrigins
  });
  console.log(`PsyCanvas backend listening on port ${port}`);
});
