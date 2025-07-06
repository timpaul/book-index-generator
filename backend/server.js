const express = require('express');
const multer = require('multer');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
const port = 3001;

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

app.use(cors());
app.use(express.json());

// OCR endpoint
app.post('/api/ocr', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Convert image to base64
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const prompt = `
You are helping extract index entries from a book index page photo. 

Please analyze this image and extract all the index entries you can see. For each entry, identify:
1. The main term or topic
2. All page numbers associated with that term

Look for typical book index formatting like:
- "Topic Name, 12, 45, 67"
- "Main Topic, 23
    Subtopic, 45, 67"
- "Term (see also Other Term), 89, 123"

Format your response as a JSON object with this structure:
{
  "entries": [
    {
      "term": "Climate Change",
      "pages": [45, 67, 123]
    },
    {
      "term": "Democracy", 
      "pages": [23, 89, 156]
    }
  ]
}

IMPORTANT: 
- Your entire response MUST be valid JSON only, no other text
- Include ALL visible index entries, even partial ones
- Convert all entries to sentence case, so they start with a capital letter
- Be precise with page numbers - only include numbers you can clearly see
- Handle entries that span multiple lines
- For sub-entries, create separate entries or group appropriately
- If you see "see also" references, include the main term
- Ignore page headers, footers, or non-index content

DO NOT include any text outside the JSON structure. Your response must be parseable JSON.
`;

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: base64Image,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const responseText = message.content[0].text;
    
    // Try to parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Claude response as JSON:', responseText);
      return res.status(500).json({ 
        error: 'Failed to parse OCR response',
        details: parseError.message 
      });
    }

    // Convert Claude's structured format to simple text format for existing parser
    const textEntries = parsedResponse.entries.map(entry => 
      `${entry.term}, ${entry.pages.join(', ')}`
    );
    
    const result = textEntries.join('\n');
    
    res.json({ 
      success: true, 
      extractedText: result,
      rawResponse: parsedResponse 
    });

  } catch (error) {
    console.error('OCR Error:', error);
    res.status(500).json({ 
      error: 'Failed to process image',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Book Index Generator API is running' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('Make sure to set CLAUDE_API_KEY in your .env file');
});