# 🗣️ English Speaking Practice App

Aplikasi web untuk latihan speaking bahasa Inggris berbasis **Agentic AI** dengan sistem penilaian **CEFR-aligned**, dual-rater assessment, dan adaptive learning. Dibangun untuk keperluan penelitian Tugas Akhir.

---

## ✨ Fitur Utama

### Latihan Speaking
- 🎙️ **Speaking Practice** — Rekam suara langsung via mikrofon, AI merespons secara real-time.
- 🤖 **Agent Mode** — AI menentukan skenario & level secara adaptif berdasarkan kelemahan user.
- 🔊 **Text-to-Speech** — Respons AI diputar sebagai audio (Google Cloud TTS / ElevenLabs / Edge TTS).

### Feedback & Penilaian
- 📊 **CEFR-Aligned Feedback** — Skor otomatis 5 dimensi: *Range, Accuracy, Fluency, Coherence, Interaction* (skala 1–5).
- 📈 **Moving Average (MA)** — Pelacakan progres skor tiap dimensi dari sesi ke sesi.
- 🎯 **Objektif Metrik** — Speech rate (WPM), filler word density, dan total kata dihitung otomatis.

### Refleksi & Rencana
- 🔄 **Session Reflection** — Ringkasan sesi, pola kesalahan, dan target vocabulary.
- 🗂️ **Next Session Plan** — Rencana sesi berikutnya: skenario, level, objectives, rubrik, dan starter turns.
- 🚀 **Starter Turn** — Lanjut langsung ke sesi baru tanpa kembali ke menu.

### Sistem Multi-Peran
- 🧑‍💼 **Admin Panel** — Manajemen user, skenario, sesi, dan analytics multi-user.
- ✍️ **Rater Interface** — Penilaian manual oleh dua rater independen dengan playback audio per turn.
- 📉 **Validasi & Korelasi** — Perbandingan skor AI vs rater manusia.

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| State & Data | Zustand, React Query |
| Charts | Recharts |
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| Database | SQLite (default) / PostgreSQL |
| Auth | JWT (access 30 menit + refresh 7 hari, bcrypt) |
| LLM | Groq API (Whisper large-v3 untuk transkripsi, LLaMA/Mixtral untuk feedback) |
| TTS | Google Cloud TTS / ElevenLabs / Edge TTS |
| Rate Limiting | SlowAPI + rotasi Groq API key otomatis |

---

## ⚙️ Instalasi

### Prasyarat
- Python 3.10+
- Node.js 18+
- Groq API Key (wajib) — [dapatkan di sini](https://console.groq.com/keys)

---

### 1. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
```

Buat file `.env` di folder `backend/`:

```env
# Wajib
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
SECRET_KEY=ganti-dengan-secret-yang-kuat

# Opsional (default sudah ada)
DATABASE_URL=sqlite:///./speaking.db
ALLOWED_ORIGINS=http://localhost:3000
ACCESS_TOKEN_EXP_MINUTES=30
REFRESH_TOKEN_EXP_DAYS=7
PORT=8000

# TTS alternatif (opsional)
ELEVENLABS_API_KEY=...
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
```

Jalankan server:

```bash
uvicorn app.main:app --reload --port 8000
```

---

### 2. Frontend (Next.js)

```bash
cd frontend
npm install
```

Buat file `.env.local` di folder `frontend/`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Jalankan dev server:

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

---

## ▶️ Cara Pakai

1. Daftar akun baru di halaman `/auth`.
2. Pilih skenario percakapan atau aktifkan **Agent Mode**.
3. Klik **Start Speaking** → bicara via mikrofon → AI merespons.
4. Klik **End Session & Get Feedback** untuk menutup sesi dan melihat skor.
5. *(Opsional)* Klik **Reflection & Next Plan** untuk melihat ringkasan dan rencana sesi berikutnya.
6. Klik **Starter Turn** untuk langsung lanjut ke sesi baru.
7. Pantau progres di halaman **Dashboard**.

---

## 🧭 Arsitektur

```
Frontend (Next.js)
├── /auth          → Login & Register
├── /practice      → Pilih skenario, lihat histori
├── /practice/[id] → Sesi latihan speaking (live)
├── /dashboard     → Statistik & progres user
├── /admin         → Manajemen user, skenario, analytics
└── /rater         → Penilaian manual (Rater 1 & 2)

Backend (FastAPI)
├── /api/auth      → Register, Login, Refresh, Logout, Me
├── /api/          → Transcribe, Chat, TTS, Feedback, Sessions, Scenarios, Profile
├── /api/agent/    → Next plan, Complete, Reflect, Plan
├── /api/admin/    → User & scenario management, analytics
└── /api/rater/    → Rater sessions & assessments
```

**Flow Sesi:**
```
Speaking → End Session → Feedback → Reflection → Next Plan → Starter Turn → Speaking lagi
```

---

## 🗄️ Database

SQLite digunakan secara default (file `backend/speaking.db`). Tabel utama:

| Tabel | Isi |
|---|---|
| `users` | Akun user (role: user / admin / rater1 / rater2) |
| `sessions` | Rekaman sesi (skor, audio, transkrip, durasi) |
| `profiles` | Profil speaking user (level CEFR, moving averages) |
| `scenarios` | Daftar skenario percakapan |
| `plans` / `plan_items` | Rencana belajar adaptif |
| `rater_assessments` | Skor penilaian manual dari rater |
| `error_patterns` | Pola kesalahan yang terdeteksi |

Schema auto-migrate saat startup (kolom baru ditambahkan otomatis jika belum ada).

---

## 📌 Catatan Penelitian

- Sistem feedback menggunakan **anchored few-shot prompting** dengan self-consistency check untuk skor CEFR.
- Skor AI dibandingkan dengan skor manual dua rater melalui halaman validasi & korelasi.
- Groq API key pool (hingga 5 key) dengan rotasi otomatis saat rate limit tercapai.

---

## 📸 Screenshot

#### Home Page
<img width="1896" height="870" alt="Home" src="https://github.com/user-attachments/assets/8efd264f-f058-4f56-8a25-bd23ee2f427a" />

#### Dashboard
<img width="1895" height="876" alt="Dashboard" src="https://github.com/user-attachments/assets/8fd770ad-6f48-4dfa-997d-b70d1d7b52f5" />

#### Pilihan Skenario
<img width="1894" height="871" alt="Scenarios" src="https://github.com/user-attachments/assets/c9384bfa-530c-4f4e-926b-db4cddb30c25" />

#### Halaman Latihan
<img width="1919" height="871" alt="Practice" src="https://github.com/user-attachments/assets/7d738eb5-d504-4ba9-9950-9e3eb7fab1b5" />

#### Result & Feedback
<img width="1893" height="868" alt="Feedback" src="https://github.com/user-attachments/assets/8d68c247-2533-47a6-b7d6-191a33475ee9" />

#### Reflection & Next Plan
<img width="1895" height="870" alt="Reflection" src="https://github.com/user-attachments/assets/43bf2917-6101-4659-b16e-0adf65acf886" />
