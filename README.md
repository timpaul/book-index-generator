# Book Index Generator


## Prerequisites

- Node.js (version 14 or higher)
- npm or yarn
- Claude API key from Anthropic

## Run locally

### Step 1: Set Up Backend

1. Install backend dependencies:
```bash
cd backend
npm install
```

2. Create `.env` file:
```bash
touch .env
```

3. Add your Claude API key to `.env`:
```
CLAUDE_API_KEY=your_claude_api_key_here
```

### Step 2: Set Up Frontend

1. Install frontend dependencies:
```bash
cd frontend
npm install
```

### Step 3: Run the Application

You'll need to run both the backend and frontend servers:

#### Terminal 1 - Backend:
```bash
cd backend
npm run dev
```
This starts the Express server on http://localhost:3001

#### Terminal 2 - Frontend:
```bash
cd frontend
npm start
```
This starts the React app on http://localhost:3000

## Project Structure

```
book-index-generator/
├── frontend/              # React app
│   ├── src/
│   │   ├── App.js
│   │   ├── BookIndexGenerator.js
│   │   └── index.js
│   ├── public/
│   └── package.json
├── backend/               # Express API server
│   ├── server.js
│   ├── package.json
│   └── .env
└── README.md
```

## How It Works

1. **Frontend**: React app provides the user interface
2. **Backend**: Express server handles Claude API calls
3. **API Integration**: Images are sent to `/api/ocr` endpoint which:
   - Receives the image file
   - Converts it to base64
   - Sends it to Claude's Vision API
   - Returns extracted index entries
