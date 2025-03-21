# Speaking Practice Platform

An AI-powered speaking practice platform with real-time conversation, feedback, and evaluation.

## Features

- Real-time AI conversation partner for language practice
- Multiple practice scenarios (presentation, daily conversations, grammar focus, etc.)
- Instant feedback on pronunciation, grammar, and fluency
- Progress tracking and detailed evaluation
- User-friendly interface with speech visualization

## Tech Stack

### Frontend
- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- shadcn/ui for components
- LiveKit SDK for WebRTC

### Backend
- FastAPI (Python)
- LiveKit Agents Framework
- PostgreSQL with pgvector
- Redis for caching

### AI Services
- Deepgram for Speech-to-Text
- Gemini 1.5 Flash for language processing
- ElevenLabs for Text-to-Speech
- Mixtral 8x7B for evaluation

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker and Docker Compose

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ibangj/speaking-practice-platform.git
   cd speaking-practice-platform
   ```

2. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

3. Install backend dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

4. Set up environment variables by copying the example files:
   ```bash
   cp frontend/.env.example frontend/.env.local
   cp backend/.env.example backend/.env
   ```

5. Start the development environment:
   ```bash
   docker-compose up -d
   ```

6. Run the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

7. Run the backend:
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

## License

MIT 