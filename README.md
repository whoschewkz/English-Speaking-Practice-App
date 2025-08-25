# 🗣️ English Speaking Practice App

Aplikasi web untuk latihan speaking bahasa Inggris dengan **Agentic AI**.  
User bisa berlatih percakapan dengan AI, menerima feedback otomatis, lalu lanjut ke *reflection* dan *next session plan* agar progres terasa seperti kursus pribadi.  

---

## ✨ Fitur Utama
- 🎙️ **Speaking Practice**: Bicara langsung via mikrofon → AI merespons.  
- 🧠 **Agent Mode**: AI menentukan skenario & level sesuai kelemahan user.  
- 📊 **Automatic Feedback**: Skor (pronunciation, grammar, fluency, vocabulary, overall) + komentar.  
- 🔄 **Session Reflection**: Ringkasan, pola kesalahan, dan target vocabulary.  
- 🗂️ **Next Session Plan**: Rencana sesi berikutnya (scenario, level, objectives, rubric, starter turns).  
- 🚀 **Starter Turn**: Bisa langsung lanjut ke sesi berikutnya tanpa kembali ke menu.  

---

## 🛠️ Instalasi

### 1. Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
`````

Buat file .env dan isi dengan API Key Groq:
```bash
GROQ_API_KEY=grq_xxxxxxxxxxxxxxxxxxxx
`````
________________________________________
### 2. Frontend (Next.js 14)
```bash
cd frontend
npm install
npm run dev
`````
Buat file .env.local untuk koneksi ke backend:
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
`````
________________________________________
### 🔑 Cara Mendapatkan Groq API Key
1.	Buka https://console.groq.com/keys.
2.	Login atau buat akun Groq.
3.	Pergi ke menu API Keys.
4.	Klik Create API Key, lalu salin kunci yang muncul.
5.	Tempel ke file .env pada backend sebagai GROQ_API_KEY.
________________________________________
### ▶️ Cara Pakai
1.	Jalankan backend (uvicorn) dan frontend (npm run dev).
2.	Buka http://localhost:3000.
3.	Pilih skenario atau Agent Mode.
4.	Klik Start Speaking → bicara → AI akan merespons.
5.	Klik End Session & Get Feedback untuk menutup sesi dan dapat skor.
6.	(Opsional) Klik Reflection & Next Plan untuk ringkasan & rencana berikutnya.
7.	Pilih Starter Turn untuk langsung lanjut ke sesi baru (tanpa balik ke menu).
________________________________________
### 📌 Arsitektur Singkat
-	Frontend: Next.js + Tailwind → UI percakapan, rekaman audio, TTS.
-	Backend: FastAPI → handle transkripsi, chat LLM, feedback, reflection, plan.
-	LLM: Model LLM dari Groq API (misalnya mixtral-8x7b, llama3, dsb).
- Transkripsi: Whisper API (bisa via Groq atau OpenAI).
________________________________________
### 📊 Flow Sesi
Speaking → End Session → Feedback → Reflection → Next Plan → Starter Turn → Speaking lagi → Saved Practice History
________________________________________
