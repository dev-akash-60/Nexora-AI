# Nexora AI 🎙️

### Intelligence that listens.

Nexora AI is a personal AI voice assistant designed to provide a natural, interactive conversational experience through voice and text. It combines a modern React frontend with a FastAPI backend and Google's Gemini Live API for real-time AI interactions.

## ✨ Features

- **Voice Interaction:** Designed for real-time voice conversations with an AI assistant.
- **Text Chat:** Send text messages and receive AI responses.
- **AI-Powered Conversations:** Integrates with Google's Gemini Live API.
- **Audio Processing:** Handles microphone audio input and generated audio output.
- **Live Transcription:** Supports input and output audio transcription through the configured AI session.
- **Animated Interface:** Modern dark-themed UI with animated elements and an interactive voice orb.
- **Conversation Panel:** Displays conversation messages in the interface.
- **Responsive Design:** Designed to adapt to different screen sizes.

## 🛠️ Tech Stack

### Frontend
- React
- Vite
- JavaScript
- Framer Motion
- Lucide React
- CSS3

### Backend
- Python
- FastAPI
- Uvicorn
- Google Gen AI SDK
- WebSockets
- Python Dotenv

### AI Integration
- Google Gemini Live API

## 📁 Project Structure

```text
ai-voice-agent/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   └── voice_agent.py
│   ├── .env.example
│   ├── .gitignore
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   │   └── audio-worklet.js
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── styles/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── .gitignore
│   ├── index.html
│   └── package.json
│
├── .gitignore
└── README.md
```

## ⚙️ Prerequisites

Before running Nexora AI, install:

- [Python](https://www.python.org/downloads/)
- [Node.js](https://nodejs.org/)
- [Git](https://git-scm.com/)
- A Google Gemini API key with access to a supported Live API model

