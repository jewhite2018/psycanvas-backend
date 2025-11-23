import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_HOST = process.env.PINECONE_INDEX_HOST; // The https://... link

if (!OPENAI_API_KEY || !PINECONE_API_KEY) {
  console.error("❌ Missing API Keys! Make sure they are in your .env file.");
  process.exit(1);
}

// Initialize clients
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small", // Must match your Pinecone settings
    input: text,
  });
  return response.data[0].embedding;
}

async function seed() {
  console.log("🌱 Starting ingestion...");

  // 1. Connect to the index
  const index = pinecone.index("psycanvas"); // Must match your Pinecone Index Name

  // 2. Read files from the 'documents' folder
  const docsDir = path.join(__dirname, 'documents');
  if (!fs.existsSync(docsDir)) {
    console.error(`❌ No 'documents' folder found at ${docsDir}`);
    return;
  }

  const files = fs.readdirSync(docsDir);
  console.log(`found ${files.length} files.`);

  for (const file of files) {
    if (!file.endsWith('.txt')) continue; // Simple text support for now

    console.log(`Processing ${file}...`);
    const filePath = path.join(docsDir, file);
    const text = fs.readFileSync(filePath, 'utf-8');

    // 3. Simple Chunking (Split by paragraphs to fit in AI memory)
    // A real app might use a smarter splitter (like LangChain)
    const chunks = text.split('\n\n').filter(c => c.length > 50); 

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // 4. Get Embedding
      const embedding = await generateEmbedding(chunk);

      // 5. Upload to Pinecone
      await index.upsert([{
        id: `${file}-${i}`, // Unique ID for this chunk
        values: embedding,
        metadata: { 
          text: chunk, 
          source: file 
        }
      }]);
      
      console.log(`   --> Uploaded chunk ${i + 1}/${chunks.length}`);
    }
  }

  console.log("✅ Library updated successfully!");
}

seed().catch(console.error);
