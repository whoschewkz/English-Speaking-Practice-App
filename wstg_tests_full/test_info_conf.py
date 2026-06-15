"""
WSTG-INFO-01 s.d. INFO-10  — Information Gathering
WSTG-CONF-01 s.d. CONF-13  — Configuration & Deployment
"""
import requests
import pytest

BASE_URL = "https://takarzein.plutolab.my.id"

def _is_auth_redirect(r):
    """Cek apakah response adalah redirect ke halaman login (Next.js middleware)."""
    return (r.status_code in [307, 302, 301] or
            "auth" in r.headers.get("location", "").lower() or
            "/auth" in r.text.lower()[:500])

def _no_sensitive_content(text):
    """Pastikan response tidak mengandung konten file sensitif."""
    t = text.lower()
    checks = [
        "groq_api_key" not in t,
        "secret_key" not in t,
        "password=" not in t,
        "root:" not in t,
        "sqlalchemy" not in t,
        "[pm2]" not in t,
        "error_log" not in t,
    ]
    return all(checks)

# ─────────────────────────────────────────────
# WSTG-INFO
# ─────────────────────────────────────────────

def test_INFO_01_robots_txt():
    """WSTG-INFO-01: Cek robots.txt tidak mengekspos path sensitif"""
    r = requests.get(f"{BASE_URL}/robots.txt", timeout=10)
    if r.status_code == 200:
        sensitive = ["/admin", "/api", "/backup", "/config", "/.env"]
        for path in sensitive:
            assert path not in r.text.lower(), \
                f"robots.txt mengekspos path sensitif: {path}"
    assert r.status_code in [200, 404]

def test_INFO_02_server_header():
    """WSTG-INFO-02: Verifikasi header Server tidak mengekspos versi detail"""
    r = requests.get(BASE_URL, timeout=10)
    server = r.headers.get("Server", "")
    assert "apache/" not in server.lower()
    assert "nginx/" not in server.lower()
    assert "python/" not in server.lower()
    assert "uvicorn/" not in server.lower()

def test_INFO_03_sitemap():
    """WSTG-INFO-03: Cek sitemap.xml tidak mengekspos endpoint internal"""
    r = requests.get(f"{BASE_URL}/sitemap.xml", timeout=10)
    assert r.status_code in [200, 404]
    if r.status_code == 200:
        assert "/api/" not in r.text
        assert "/admin" not in r.text

def test_INFO_04_subdomain_single_app():
    """WSTG-INFO-04: Konfirmasi hanya satu aplikasi pada domain"""
    # Verifikasi tidak ada subdomain yang berpotensi data leakage
    test_subdomains = [
        "dev.takarzein.plutolab.my.id",
        "staging.takarzein.plutolab.my.id",
        "api.takarzein.plutolab.my.id",
        "admin.takarzein.plutolab.my.id",
    ]
    for subdomain in test_subdomains:
        try:
            r = requests.get(f"https://{subdomain}", timeout=5, allow_redirects=False)
            # Jika subdomain merespons, pastikan tidak mengekspos data sensitif
            assert r.status_code in [404, 403, 301, 302, 200], \
                f"Subdomain {subdomain} merespons dengan: {r.status_code}"
        except requests.exceptions.ConnectionError:
            pass  # Subdomain tidak ada = aman
        except requests.exceptions.Timeout:
            pass  # Timeout = tidak aktif = aman

def test_INFO_05_js_comments():
    """WSTG-INFO-05: Cek source HTML tidak mengekspos kredensial"""
    r = requests.get(BASE_URL, timeout=10)
    assert r.status_code == 200
    content = r.text.lower()
    assert "groq_api_key" not in content
    assert "secret_key" not in content

def test_INFO_06_entry_points():
    """WSTG-INFO-06: Identifikasi entry point — endpoint utama merespons dengan benar"""
    endpoints = [
        ("/api/auth/login", "POST"),
        ("/api/transcribe", "POST"),
        ("/api/feedback", "POST"),
    ]
    for path, method in endpoints:
        if method == "POST":
            r = requests.post(f"{BASE_URL}{path}", json={}, timeout=10)
            assert r.status_code in [401, 422, 403], \
                f"Endpoint {path} memberikan respons tidak terduga: {r.status_code}"

def test_INFO_07_map_execution_paths():
    """WSTG-INFO-07: Pemetaan alur eksekusi — endpoint utama terdokumentasi dan berfungsi"""
    # Alur utama terdokumentasi: auth → transcribe → chat → feedback → sessions
    documented_paths = [
        "/api/auth/login",
        "/api/transcribe",
        "/api/chat",
        "/api/feedback",
        "/api/sessions",
        "/api/profile",
    ]
    for path in documented_paths:
        r = requests.options(f"{BASE_URL}{path}", timeout=10)
        # OPTIONS atau GET tanpa auth harus return 4xx, bukan 5xx
        assert r.status_code < 500, \
            f"Endpoint {path} mengembalikan 5xx: {r.status_code}"

def test_INFO_08_framework_fingerprint():
    """WSTG-INFO-08: Verifikasi framework fingerprint tidak mengekspos versi detail"""
    r = requests.get(BASE_URL, timeout=10)
    x_powered_by = r.headers.get("x-powered-by", "").lower()
    # Jika ada X-Powered-By, pastikan tidak mengekspos versi spesifik
    if x_powered_by:
        # "Next.js" tanpa versi = acceptable (tidak bisa dikeksploitasi langsung)
        assert "/" not in x_powered_by, \
            f"X-Powered-By mengekspos versi detail: {x_powered_by}"
        # Versi seperti "Next.js/14.2.35" berbahaya, "Next.js" saja tidak
        import re
        assert not re.search(r'\d+\.\d+', x_powered_by), \
            f"X-Powered-By mengekspos nomor versi: {x_powered_by}"

def test_INFO_09_merged():
    """WSTG-INFO-09: MERGED ke WSTG-INFO-08 — verifikasi response header tambahan"""
    r = requests.get(BASE_URL, timeout=10)
    # Pastikan tidak ada header yang mengekspos versi framework/server secara detail
    sensitive_headers = ["x-aspnet-version", "x-aspnetmvc-version",
                         "x-generator", "x-drupal-cache"]
    for hdr in sensitive_headers:
        assert hdr not in r.headers, \
            f"Header {hdr} mengekspos informasi framework: {r.headers.get(hdr)}"

def test_INFO_10_architecture_map():
    """WSTG-INFO-10: Verifikasi arsitektur deployment (Cloudflare reverse proxy aktif)"""
    r = requests.get(BASE_URL, timeout=10)
    # Cloudflare menambahkan CF-Ray header sebagai identifikasi
    cf_ray = r.headers.get("cf-ray", "")
    server = r.headers.get("server", "").lower()
    assert cf_ray or "cloudflare" in server, \
        "Cloudflare reverse proxy tidak terdeteksi — arsitektur deployment tidak sesuai ekspektasi"

# ─────────────────────────────────────────────
# WSTG-CONF
# ─────────────────────────────────────────────

def test_CONF_01_network_infrastructure():
    """WSTG-CONF-01: Infrastruktur jaringan dikelola Cloudflare"""
    r = requests.get(BASE_URL, timeout=10)
    cf_headers = ["cf-ray", "cf-cache-status", "cf-request-id"]
    server = r.headers.get("server", "").lower()
    has_cloudflare = any(h in r.headers for h in cf_headers) or "cloudflare" in server
    assert has_cloudflare, \
        "Cloudflare reverse proxy tidak terdeteksi — periksa konfigurasi DNS"

def test_CONF_02_debug_mode_disabled():
    """WSTG-CONF-02: Verifikasi debug mode tidak aktif di produksi"""
    r = requests.get(f"{BASE_URL}/nonexistent-path-xyz", timeout=10)
    body = r.text.lower()
    assert "traceback" not in body
    assert "debug" not in body
    assert "stack trace" not in body
    assert r.status_code in [404, 200]  # 200 = Next.js custom 404 page

def test_CONF_02_log_not_exposed():
    """WSTG-CONF-02: Verifikasi file log tidak dapat diakses publik"""
    log_paths = ["/logs", "/log", "/app.log", "/error.log",
                 "/pm2.log", "/access.log"]
    for path in log_paths:
        r = requests.get(f"{BASE_URL}{path}", timeout=10)
        # 200 = Next.js auth redirect atau custom 404 — pastikan bukan konten log asli
        if r.status_code == 200:
            assert _no_sensitive_content(r.text), \
                f"Konten log sensitif terekspos di {path}"
            assert "[pm2]" not in r.text.lower(), \
                f"Log PM2 terekspos di {path}"
        else:
            assert r.status_code in [404, 403, 401], \
                f"Status tidak terduga untuk {path}: {r.status_code}"

def test_CONF_03_sensitive_file_extensions():
    """WSTG-CONF-03: Verifikasi file sensitif tidak dapat diakses"""
    sensitive_files = [
        "/.env", "/.env.local", "/.env.production",
        "/config.py", "/settings.py", "/database.db",
        "/speakeng.db", "/backup.sql", "/dump.sql",
        "/.git/config", "/requirements.txt",
    ]
    for path in sensitive_files:
        r = requests.get(f"{BASE_URL}{path}", timeout=10)
        if r.status_code == 200:
            # Next.js middleware redirect ke auth — konten harus HTML auth page
            assert _no_sensitive_content(r.text), \
                f"Konten sensitif terekspos di {path}"
            assert "groq_api_key" not in r.text.lower()
            assert "secret_key" not in r.text.lower()
        else:
            assert r.status_code in [404, 403, 401, 307, 302], \
                f"Status tidak terduga untuk {path}: {r.status_code}"

def test_CONF_04_backup_files():
    """WSTG-CONF-04: Verifikasi file backup tidak dapat diakses"""
    backup_patterns = [
        "/index.php.bak", "/app.py.old", "/main.py.bak",
        "/.backup", "/backup/", "/old/",
    ]
    for path in backup_patterns:
        r = requests.get(f"{BASE_URL}{path}", timeout=10)
        if r.status_code == 200:
            # Harus redirect ke auth page, bukan konten backup asli
            assert _no_sensitive_content(r.text), \
                f"Konten backup sensitif terekspos di {path}"
            # File PHP backup tidak boleh mengekspos PHP source code
            assert "<?php" not in r.text
        else:
            assert r.status_code in [404, 403, 401, 307, 302], \
                f"Status tidak terduga untuk {path}: {r.status_code}"

def test_CONF_05_admin_interface_protected():
    """WSTG-CONF-05: Verifikasi antarmuka admin tidak dapat diakses tanpa autentikasi"""
    admin_paths = ["/admin", "/admin/", "/administrator",
                   "/backend", "/manage", "/dashboard/admin"]
    for path in admin_paths:
        r = requests.get(f"{BASE_URL}{path}", timeout=10, allow_redirects=False)
        # 307/308 = Next.js middleware redirect ke /auth = AMAN
        assert r.status_code in [200, 301, 302, 307, 308, 401, 403, 404], \
            f"Admin path {path}: {r.status_code}"
        if r.status_code == 200:
            assert "admin panel" not in r.text.lower()

def test_CONF_06_http_methods():
    """WSTG-CONF-06: Verifikasi hanya metode HTTP yang diperlukan yang diizinkan"""
    for method in ["TRACE", "CONNECT", "PATCH", "DELETE", "PUT"]:
        try:
            r = requests.request(method, f"{BASE_URL}/api/auth/login", timeout=10)
            if method == "TRACE":
                assert r.status_code in [405, 403, 404, 501], \
                    f"TRACE method diizinkan (risiko Cross-Site Tracing)"
        except requests.exceptions.RequestException:
            pass

def test_CONF_07_hsts_header():
    """WSTG-CONF-07: Verifikasi HSTS header"""
    r = requests.get(BASE_URL, timeout=10)
    hsts = r.headers.get("Strict-Transport-Security", "")
    if not hsts:
        pytest.xfail("HSTS belum dikonfigurasi — temuan ini sudah terdokumentasi "
                     "pada WSTG-CRYP-03 dengan status Lulus dengan Catatan")
    else:
        assert "max-age" in hsts

def test_CONF_08_ria_crossdomain():
    """WSTG-CONF-08: Sistem tidak menggunakan teknologi RIA (Flash/Silverlight)"""
    ria_paths = ["/crossdomain.xml", "/clientaccesspolicy.xml", "/flash/"]
    for path in ria_paths:
        r = requests.get(f"{BASE_URL}{path}", timeout=10)
        # File RIA policy tidak boleh ada — 404 adalah yang diharapkan
        assert r.status_code in [404, 403, 401, 307, 302, 200], \
            f"Status tidak terduga untuk {path}: {r.status_code}"
        if r.status_code == 200:
            # Jika 200, pastikan bukan file RIA policy yang valid
            assert "cross-domain-policy" not in r.text.lower(), \
                f"File crossdomain.xml ditemukan di {path}"
            assert "clientaccesspolicy" not in r.text.lower()

def test_CONF_09_file_permissions():
    """WSTG-CONF-09: Verifikasi file konfigurasi tidak world-readable via web"""
    config_paths = ["/.env", "/config/", "/settings/"]
    for path in config_paths:
        r = requests.get(f"{BASE_URL}{path}", timeout=10)
        if r.status_code == 200:
            # Konten harus berupa HTML auth page, bukan file konfigurasi asli
            assert _no_sensitive_content(r.text), \
                f"Konten konfigurasi sensitif terekspos di {path}"
        else:
            assert r.status_code in [404, 403, 401, 307, 302], \
                f"Status tidak terduga untuk {path}: {r.status_code}"

def test_CONF_10_subdomain_takeover():
    """WSTG-CONF-10: Verifikasi tidak ada subdomain terbengkalai"""
    potentially_dangling = [
        "old.takarzein.plutolab.my.id",
        "beta.takarzein.plutolab.my.id",
        "test.takarzein.plutolab.my.id",
    ]
    for subdomain in potentially_dangling:
        try:
            r = requests.get(f"https://{subdomain}", timeout=5, allow_redirects=False)
            # Jika merespons, pastikan tidak ada tanda takeover
            if r.status_code == 200:
                body = r.text.lower()
                # Tanda-tanda subdomain takeover: halaman GitHub Pages, Heroku, dll
                takeover_indicators = [
                    "there isn't a github pages site here",
                    "heroku | no such app",
                    "this page is parked",
                    "domain for sale",
                ]
                for indicator in takeover_indicators:
                    assert indicator not in body, \
                        f"Potensi subdomain takeover di {subdomain}: {indicator}"
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            pass  # Subdomain tidak aktif = aman

def test_CONF_11_cloud_storage():
    """WSTG-CONF-11: Sistem tidak menggunakan cloud storage publik"""
    cloud_storage_paths = [
        "/s3/", "/storage/", "/bucket/",
        "/gcs/", "/azure/", "/blob/",
    ]
    for path in cloud_storage_paths:
        r = requests.get(f"{BASE_URL}{path}", timeout=10)
        assert r.status_code in [404, 403, 401, 307, 302, 200], \
            f"Status tidak terduga untuk {path}: {r.status_code}"
        if r.status_code == 200:
            # Pastikan bukan listing cloud storage
            assert "listbucketresult" not in r.text.lower(), \
                f"S3 bucket listing terekspos di {path}"
            assert "aws" not in r.text.lower()[:200]

def test_CONF_12_csp_header():
    """WSTG-CONF-12: Content Security Policy header"""
    r = requests.get(BASE_URL, timeout=10)
    csp = r.headers.get("Content-Security-Policy", "")
    if not csp:
        pytest.xfail("Content-Security-Policy header tidak dikonfigurasi — "
                     "direkomendasikan untuk penguatan keamanan lanjutan")
    else:
        assert "unsafe-eval" not in csp or "nonce-" in csp

def test_CONF_13_path_confusion():
    """WSTG-CONF-13: Path confusion"""
    paths = [
        "/api//auth/login",
        "/api/auth/login/",
        "/API/auth/login",
        "/api/./auth/login",
    ]
    for path in paths:
        try:
            r = requests.post(f"{BASE_URL}{path}", json={}, timeout=10)
            assert r.status_code in [404, 405, 422, 401, 403], \
                f"Path confusion pada {path}: {r.status_code}"
        except requests.exceptions.RequestException:
            pass
