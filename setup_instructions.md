# Book Index Generator - Local Setup Instructions

This guide will help you set up the Book Index Generator to run locally with full Claude API integration.

## Prerequisites

- Node.js (version 14 or higher)
- npm or yarn
- Claude API key from Anthropic

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

## Setup Instructions

### Step 1: Create Project Directory
```bash
mkdir book-index-generator
cd book-index-generator
```

### Step 2: Set Up Backend

1. Create backend directory and files:
```bash
mkdir backend
cd backend
```

2. Create `package.json` (use the backend-package.json content provided)

3. Install backend dependencies:
```bash
npm install
```

4. Create `.env` file:
```bash
touch .env
```

5. Add your Claude API key to `.env`:
```
CLAUDE_API_KEY=your_claude_api_key_here
```

6. Create `server.js` (use the server.js content provided)

### Step 3: Set Up Frontend

1. Go back to root directory and create React app:
```bash
cd ..
npx create-react-app frontend
cd frontend
```

2. Install additional dependencies:
```bash
npm install lucide-react
```

3. Replace the generated `package.json` with the provided one (which includes the proxy configuration)

4. Replace `src/App.js` with the provided App.js content

5. Create `src/BookIndexGenerator.js` with the updated React component content

6. Add Tailwind CSS (optional but recommended for styling):
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

7. Configure `tailwind.config.js`:
```javascript
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

8. Add Tailwind directives to `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 4: Running the Application

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

## How It Works

1. **Frontend**: React app provides the user interface
2. **Backend**: Express server handles Claude API calls
3. **API Integration**: Images are sent to `/api/ocr` endpoint which:
   - Receives the image file
   - Converts it to base64
   - Sends it to Claude's Vision API
   - Returns extracted index entries

## Usage

1. Open http