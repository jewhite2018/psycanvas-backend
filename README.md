# PsyCanvas AI — Mental Health Study Assistant

PsyCanvas AI is designed to help college-level psychology and counseling students understand mental health concepts, DSM-5-TR criteria (in paraphrased form), case formulations, and evidence-based treatments. The assistant relies on both current mental health knowledge and user-provided course materials, such as textbooks and articles.

## Features & Goals

- **Concept Explanations**: Learn about mental health topics and disorders using clear, structured explanations.
- **DSM-5-TR Criteria Paraphrased**: Understand diagnostic criteria in accessible language.
- **Case Formulation Support**: Get guidance for building case formulations and treatment plans.
- **Evidence-Based Treatment Guidance**: Discover proven treatment methods, backed with current citations.
- **Reference & Citation Support**: All answers include in-text citations and a reference list formatted in your requested style.

## Security Features

This backend implements several production-ready security features:

- **CORS Protection**: Configurable origin-based CORS with credentials support
- **Rate Limiting**: 100 requests per 15 minutes per IP address on API routes
- **Input Validation**: Comprehensive request validation using Joi schemas
- **Structured Logging**: Winston logger with file and console transports
- **Request Timeout**: 30-second timeout on AI requests to prevent hanging
- **Error Handling**: Specific error types with appropriate status codes and messages

## Environment Setup

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd psycanvas-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory by copying `.env.example`:
```bash
cp .env.example .env
```

4. Configure the environment variables in `.env`:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
# Comma-separated list of allowed origins
ALLOWED_ORIGINS=http://localhost:3000,https://yourfrontend.com
```

### Running the Server

**Development mode** (with auto-restart):
```bash
npm run dev
```

**Production mode**:
```bash
npm start
```

The server will start on the port specified in your `.env` file (default: 3000).

## API Documentation

### POST /api/chat

Main endpoint for processing chat requests with AI-generated responses about mental health concepts, DSM-5-TR criteria, and evidence-based treatments.

#### Request Body

```json
{
  "question": "string (required, 10-5000 chars)",
  "citationStyle": "string (optional, default: 'apa', values: 'apa', 'mla', 'chicago')",
  "citationMode": "string (optional, default: 'balanced', values: 'strict', 'balanced', 'flexible')",
  "recency": "string (optional, default: '10', values: '5', '10', '15', 'all')",
  "materials": ["array of strings (optional, max 20 items, each max 500 chars)"]
}
```

#### Request Example

```json
{
  "question": "Explain the core symptoms of Major Depressive Disorder according to the DSM-5-TR, using APA citation style.",
  "citationStyle": "apa",
  "citationMode": "balanced",
  "recency": "10",
  "materials": [
    "Abnormal Psychology by Kring et al., 2021"
  ]
}
```

#### Success Response (200 OK)

```json
{
  "answer": "Major Depressive Disorder (MDD) is characterized by...\n\nReferences:\n..."
}
```

#### Error Responses

See the [Error Codes](#error-codes) section below for detailed error responses.

### GET /health

Health check endpoint to verify the service is running.

#### Success Response (200 OK)

```json
{
  "status": "ok",
  "timestamp": "2026-02-17T23:33:02.049Z"
}
```

### GET /

Root endpoint that confirms the backend is running.

#### Success Response (200 OK)

```
PsyCanvas backend is running.
```

## Usage

### Ask a Question

Pose questions about mental health concepts, diagnoses, treatments, or case studies.

### Provide Materials (Optional)

For more tailored assistance, list your textbooks, research articles, or course resources.

### Receive Structured Answers

Get responses that follow academic standards and are easy to follow.

### Citations Built-in

Every answer includes proper in-text citations and references in your chosen citation style.

## Citation Guidelines

- **Style**: Responses are formatted according to your preferred style (e.g., APA, MLA, Chicago).
- **Strictness**: Citation rules follow your requested mode—strict, balanced, or flexible.
- **Recency**: By default, PsyCanvas AI focuses on current research, but you may request older foundational work (these will be flagged accordingly).
- **Course Material Use**: Responses can incorporate user-provided materials for tailored support.

### Critical Rules

- PsyCanvas AI does not reproduce DSM-5-TR text verbatim. All diagnostic criteria are paraphrased.
- Citations are verified and accurate. If a reference cannot be confirmed, it will be marked as a suggested reading rather than a precise citation.

## Example Prompt

"Explain the core symptoms of Major Depressive Disorder according to the DSM-5-TR, using APA citation style. Please reference my textbook: 'Abnormal Psychology by Kring et al., 2021.'"

## Output Format

- **Explanation**: Structured answer with definitions, paraphrased criteria, and treatment information.
- **In-Text Citations**: Author(s) and year (with page/section if needed).
- **References**: Complete list of sources at the end, formatted in your chosen style.

## Error Codes

The API uses standard HTTP status codes and returns detailed error messages:

### 400 Bad Request - Validation Error

Returned when the request body fails validation.

```json
{
  "error": "Validation failed",
  "details": [
    "Question must be at least 10 characters long",
    "Citation style must be one of: apa, mla, chicago"
  ]
}
```

### 408 Request Timeout

Returned when the AI request takes longer than 30 seconds.

```json
{
  "error": "Request timeout",
  "message": "The request took too long to process. Please try again."
}
```

### 429 Too Many Requests - Rate Limit Exceeded

Returned when the rate limit is exceeded (100 requests per 15 minutes per IP).

```json
{
  "error": "Too many requests from this IP, please try again later.",
  "retryAfter": "15 minutes"
}
```

Or (from OpenAI):

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later."
}
```

### 500 Internal Server Error - Configuration Error

Returned when there's a configuration issue (e.g., invalid API key or model).

```json
{
  "error": "Configuration error",
  "message": "The service is currently unavailable. Please contact support."
}
```

Or (invalid model):

```json
{
  "error": "Configuration error",
  "message": "Invalid AI model configuration. Please contact support."
}
```

### 503 Service Unavailable - Network Error

Returned when unable to connect to the AI service.

```json
{
  "error": "Service unavailable",
  "message": "Unable to connect to AI service. Please try again later."
}
```

### Generic Error

Returned for unexpected errors.

```json
{
  "error": "Internal server error",
  "message": "Something went wrong while generating an answer. Please try again."
}
```

## Logging

The application uses Winston for structured logging:

- **error.log**: Contains only error-level logs
- **combined.log**: Contains all logs (info, warn, error)
- **Console**: Enabled in development mode (when `NODE_ENV !== 'production'`)

Logged events include:
- Server startup
- API requests with sanitized data
- Validation errors
- Rate limit violations
- All errors with stack traces

## Development

### Scripts

- `npm start`: Start the server in production mode
- `npm run dev`: Start the server in development mode with auto-restart (using nodemon)

### Project Structure

```
psycanvas-backend/
├── server.js          # Main application file
├── seed.js            # Database seeding script (if using vector DB)
├── package.json       # Dependencies and scripts
├── .env              # Environment variables (not committed)
├── .env.example      # Environment variables template
├── error.log         # Error logs (generated)
├── combined.log      # All logs (generated)
└── README.md         # This file
```

## License

This project is licensed under the terms specified in the repository.
