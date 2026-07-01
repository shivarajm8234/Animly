# Animly: Interactive AI Tutor

Animly is a Next.js web application that transforms standard PDF documents into engaging, interactive AI tutor sessions. Students can learn complex topics through concise dialogue, visual flowcharts, curated YouTube recommendations, and localized conversational audio.

## 🚀 Features

- **Context-Aware Tutoring:** Upload a PDF and interact with an AI tutor restricted exclusively to the document's context, ensuring hallucination-free educational assistance.
- **Ultra-Fast LLM Processing:** Powered by **Groq API** (Llama-3.1-8b-instant), returning minimal, precise, high-yield answers (4-5 lines max) alongside structured whiteboard JSON payloads.
- **Multilingual Text-to-Speech (TTS):** Integrated with **Sarvam AI** (bulbul:v3) to generate lifelike conversational Indian voices (English, Hindi, Bengali, Telugu, Tamil, etc.). Robust fallback to the native browser Web Speech API.
- **Dynamic Whiteboard Visuals:** 
  - Generates detailed textual notes flawlessly aligned using Tailwind CSS Typography.
  - Automatically structures concept comparisons using HTML tables.
  - Renders visual diagrams and mind maps on the fly using **React Flow**.
- **CORS-Free Video Fetching:** Intelligently fetches educational YouTube videos using Invidious API instances and DuckDuckGo scraping, safely routed through client-side proxies to prevent browser CORS blocks.
- **Firebase Infrastructure:** Utilizes Firebase Authentication for secure access and Firebase Realtime Database for fast, synchronized session and profile storage.
- **Static Export Ready:** Fully optimized for static hosting (Firebase Hosting, Vercel, Netlify) leveraging Next.js trailing slash routing.

## 🛠 Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Static Export)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) & `@tailwindcss/typography`
- **Database & Auth:** [Firebase Realtime Database & Authentication](https://firebase.google.com/)
- **AI / LLM:** [Groq SDK](https://groq.com/)
- **Speech Synthesis:** [Sarvam AI](https://www.sarvam.ai/)
- **Visuals:** [React Flow](https://reactflow.dev/), [Dagre](https://github.com/dagrejs/dagre)

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)
- Firebase Account (for Authentication & Realtime Database)
- Groq API Key
- Sarvam API Key

### Installation

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Set up your Firebase project and add your credentials to a `.env.local` file:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY="your_api_key"
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_project.firebaseapp.com"
   NEXT_PUBLIC_FIREBASE_DATABASE_URL="https://your_project.firebaseio.com"
   NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_project_id"
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_project.appspot.com"
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
   NEXT_PUBLIC_FIREBASE_APP_ID="your_app_id"
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🚢 Deployment

Animly is configured for a fully static export (`output: 'export'` and `trailingSlash: true`). 

To build and deploy to Firebase Hosting:
```bash
npm run build
npx -y firebase-tools deploy
```

## 🔒 Bring Your Own Key (BYOK)

To keep the application highly scalable, Animly implements a BYOK structure. After exhausting the initial free tier session, users can input their personal **Groq** and **Sarvam AI** API keys directly in their Settings profile to continue generating interactive sessions securely from their local browsers.
