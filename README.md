# VivaPro — AI-Powered Viva Examination Platform

VivaPro is a web-based platform that automates and enhances the oral examination (viva) process for universities. Teachers create assignments with marking schemes, and students sit AI-proctored vivas with real-time voice interaction, automatic grading, and intelligent follow-up questions.

---

## Features

**For Teachers**
- Create assignments and upload marking schemes (Word document or manual entry)
- AI parses uploaded documents and extracts questions + model answers automatically
- View all student submissions, scores, and detailed feedback
- Monitor proctoring violation logs per student

**For Students**
- Voice-based viva — speak answers using the microphone (Whisper STT)
- AI reads questions aloud (gTTS text-to-speech)
- Gemini AI grades answers in real time against model answers
- Intelligent follow-up questions generated from the student's own uploaded assignment
- Live proctoring during the exam (face tracking, gaze detection, object detection)

**AI Proctoring Engine**
- MediaPipe face mesh — detects face presence and gaze direction (left/right/up/away)
- YOLOv8 custom model — detects phones and books in frame
- Multi-person detection — flags if more than one person is visible
- Streak-based violation system — ignores single-frame false positives, fires after sustained bad behaviour
- Per-student session state — no cross-contamination between concurrent exams

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Backend | Python, Flask |
| Speech-to-text | OpenAI Whisper |
| Text-to-speech | gTTS |
| AI grading & follow-ups | Google Gemini 2.5 Flash |
| Face / gaze tracking | MediaPipe Face Mesh |
| Object detection | YOLOv8 (custom trained model) |
| Auth | Firebase Authentication |
| Database | Supabase (PostgreSQL) |
| Charts | Recharts |

---

## Project Structure

```
vivapro/
├── components/
│   ├── Login.tsx              # Firebase auth login/signup
│   ├── Layout.tsx             # App shell and nav
│   ├── TeacherDashboard.tsx   # Teacher assignment + results view
│   ├── StudentDashboard.tsx   # Student viva interface
│   └── preloader.tsx          # Animated loading screen
├── services/
│   ├── firebase.ts            # Firebase auth + Firestore setup
│   ├── supabase.ts            # Supabase data layer
│   └── geminiService.ts       # Gemini AI — grading, follow-ups, doc parsing
├── server.py                  # Flask backend — Whisper, gTTS, MediaPipe, YOLO
├── App.tsx                    # Root component and routing
├── types.ts                   # Shared TypeScript types
└── requirements.txt           # Python dependencies
```

---

## Running Locally

### Prerequisites

- Node.js 18+
- Python 3.9+
- ffmpeg installed and on your PATH

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/vivapro.git
cd vivapro
```

### 2. Set up environment variables

Create a `.env.local` file in the project root:

```
GEMINI_API_KEY=your_gemini_api_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You will also need to add your Firebase config to `services/firebase.ts`.

### 3. Download AI model weights

The YOLOv8 model weights (`best.pt`) are not included in the repo due to file size.  
Download from: *(add your link here — Google Drive, etc.)*  
Place `best.pt` in the project root alongside `server.py`.

### 4. Set up the Python backend

```bash
python -m venv env
source env/bin/activate        # Windows: env\Scripts\activate
pip install -r requirements.txt
python server.py
```

The Flask server runs on `http://localhost:5000`.

### 5. Set up the React frontend

```bash
npm install
npm run dev
```

The app runs on `http://localhost:5173`.

---

## How It Works

1. Teacher creates an assignment with questions and model answers
2. Student logs in, uploads their assignment document, and starts the viva
3. The AI reads each question aloud — the student answers by voice
4. Whisper transcribes the spoken answer in real time
5. Gemini grades the answer against the model answer (0–10 with feedback)
6. After Round 1, Gemini generates 2–3 personalised follow-up questions from the student's own submitted work
7. Throughout the exam, the proctoring engine monitors for violations (looking away, phone use, multiple people, no face)
8. Teacher reviews all results, scores, and proctoring logs in their dashboard

---

## This Project

Built as a Final Year Project (FYP) at university.
