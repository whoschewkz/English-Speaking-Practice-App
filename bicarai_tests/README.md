# BicarAI — Test Suite Setup & Run Guide

## Prasyarat
- Python 3.9+
- Server backend berjalan di http://localhost:8000
- Server frontend berjalan di http://localhost:3000

## Instalasi

```bash
# 1. Masuk ke folder test
cd bicarai_tests

# 2. Install dependencies
pip install -r requirements.txt

# 3. Install Playwright browser
playwright install chromium

# 4. Buat folder laporan
mkdir -p reports/screenshots reports/videos
```

## Menjalankan Test

### Semua test sekaligus
```bash
pytest
```

### Per modul
```bash
pytest tests/test_auth.py        -v   # Auth saja
pytest tests/test_sessions.py   -v   # Sesi saja
pytest tests/test_evaluation.py -v   # Evaluasi saja
pytest tests/test_dashboard.py  -v   # Dashboard saja
pytest tests/test_rater.py      -v   # Rater saja
pytest tests/test_admin.py      -v   # Admin saja
pytest tests/test_security.py   -v   # Keamanan saja
pytest tests/test_integration.py -v  # Integrasi saja
pytest tests/test_e2e_ui.py     -v   # E2E UI saja
```

### Per marker
```bash
pytest -m auth         # Semua test auth
pytest -m security     # Semua test keamanan
pytest -m e2e          # Semua test UI
pytest -m integration  # Semua test integrasi
```

### Skip E2E (kalau Playwright belum terpasang)
```bash
pytest --ignore=tests/test_e2e_ui.py
```

## Laporan

Setelah test selesai, buka laporan HTML:
```
reports/report.html
```

Screenshot tersimpan di:
```
reports/screenshots/
```

## Struktur Folder

```
bicarai_tests/
├── pytest.ini
├── requirements.txt
├── README.md
├── tests/
│   ├── conftest.py          ← Fixtures & setup
│   ├── test_auth.py         ← TC-AUTH-01~08
│   ├── test_sessions.py     ← TC-SESS-01~08
│   ├── test_evaluation.py   ← TC-EVAL-01~06
│   ├── test_dashboard.py    ← TC-DASH-01~04
│   ├── test_rater.py        ← TC-RATE-01~06
│   ├── test_admin.py        ← TC-ADMIN-01~06
│   ├── test_security.py     ← TC-SEC-01~10
│   ├── test_integration.py  ← TC-INT-01~05
│   ├── test_e2e_ui.py       ← TC-E2E-01~05
│   └── fixtures/
│       └── dummy_audio.wav
└── reports/
    ├── report.html
    └── screenshots/
```

## Catatan

- Test akan otomatis membuat 4 akun test sebelum dijalankan
- Akun test: test_admin, test_user, test_rater1, test_rater2
- Dummy audio (1 detik silence) dipakai untuk test yang butuh file audio
- TC-SEC-10 (rate limit) bersifat informatif, tidak strict assertion
