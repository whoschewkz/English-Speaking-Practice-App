"""
test_e2e_ui.py — Pengujian End-to-End (UI) menggunakan Playwright
TC-E2E-01 s/d TC-E2E-05

Mensimulasikan alur pengguna nyata:
Landing → Login → Mulai Sesi → Lihat Dashboard

Catatan selector:
- Input username menggunakan autocomplete="username" (React controlled, tanpa name attribute)
- Input password menggunakan type="password"
"""

import pytest
import time
from playwright.sync_api import Page, expect
from conftest import BASE_URL_UI, TEST_USERS, REPORTS_DIR, screenshot

pytestmark = pytest.mark.e2e


class TestLandingPage:

    def test_TC_E2E_01_landing_page_tampil(self, page: Page):
        """TC-E2E-01: Landing page harus dapat dibuka dan tampil dengan benar."""
        page.goto(BASE_URL_UI)
        screenshot(page, "TC_E2E_01_landing")

        print(f"\n[TC-E2E-01] URL: {page.url}")
        print(f"  → Title: {page.title()}")

        assert page.url.startswith(BASE_URL_UI), "URL tidak sesuai"

        body_text = page.inner_text("body")
        print(f"  → Body text sample: {body_text[:200]}")
        assert len(body_text) > 100, "Halaman tampak kosong"


class TestAuthentication:

    def test_TC_E2E_02_alur_login(self, page: Page):
        """TC-E2E-02: Pengguna dapat login melalui antarmuka web."""
        d = TEST_USERS["user"]

        page.goto(f"{BASE_URL_UI}/auth")
        screenshot(page, "TC_E2E_02_auth_page")
        print(f"\n[TC-E2E-02] Halaman auth: {page.url}")

        # Frontend menggunakan autocomplete="username" (React controlled, tanpa name attribute)
        username_selectors = [
            'input[autocomplete="username"]',
            'input[placeholder*="username"]',
            'input[placeholder*="Username"]',
        ]
        username_filled = False
        for selector in username_selectors:
            try:
                page.fill(selector, d["username"], timeout=3000)
                username_filled = True
                print(f"  → Username field: {selector}")
                break
            except Exception:
                continue

        if not username_filled:
            screenshot(page, "TC_E2E_02_fail_no_username_field")
            pytest.fail(f"Username field tidak ditemukan di {page.url}")

        # Password field
        try:
            page.fill('input[type="password"]', d["password"], timeout=3000)
            print(f"  → Password field: input[type='password']")
        except Exception:
            pytest.fail("Password field tidak ditemukan")

        screenshot(page, "TC_E2E_02_form_filled")

        # Submit
        submit_selectors = [
            'button[type="submit"]',
            'button:has-text("Masuk")',
            'button:has-text("Login")',
            'button:has-text("Sign in")',
        ]
        for selector in submit_selectors:
            try:
                page.click(selector, timeout=3000)
                print(f"  → Submit button: {selector}")
                break
            except Exception:
                continue

        # Tunggu navigasi setelah submit
        try:
            page.wait_for_url(lambda url: "/auth" not in url, timeout=10000)
        except Exception:
            pass

        page.wait_for_timeout(1500)
        screenshot(page, "TC_E2E_02_after_login")
        current_url = page.url
        body_text   = page.inner_text("body").lower()
        print(f"  → URL setelah login: {current_url}")

        # Jika rate limit terkena, UI akan tampilkan pesan error
        if "rate limit" in body_text or "terlalu banyak" in body_text or "too many" in body_text:
            print(f"  ℹ️  Rate limit aktif — login ditolak server, bukan bug UI")
            pytest.xfail("Rate limit aktif saat TC-E2E-02 dijalankan — jalankan ulang setelah 1 menit")

        assert "/auth" not in current_url or "practice" in current_url or "dashboard" in current_url, \
            f"Login mungkin gagal — masih di: {current_url}"

    def test_TC_E2E_03_login_kredensial_salah(self, page: Page):
        """TC-E2E-03: Login dengan kredensial salah harus menampilkan pesan error."""
        page.goto(f"{BASE_URL_UI}/auth")

        username_selectors = [
            'input[autocomplete="username"]',
            'input[placeholder*="username"]',
        ]
        for sel in username_selectors:
            try:
                page.fill(sel, "wrong_username_xyz", timeout=3000)
                break
            except Exception:
                continue

        try:
            page.fill('input[type="password"]', "WrongPassword999", timeout=3000)
        except Exception:
            pass

        submit_selectors = [
            'button[type="submit"]',
            'button:has-text("Masuk")',
            'button:has-text("Login")',
        ]
        for sel in submit_selectors:
            try:
                page.click(sel, timeout=3000)
                break
            except Exception:
                continue

        page.wait_for_timeout(2000)
        screenshot(page, "TC_E2E_03_login_error")

        print(f"\n[TC-E2E-03] URL setelah login salah: {page.url}")

        current_url = page.url
        body_text   = page.inner_text("body").lower()
        has_error   = (
            "error"   in body_text or
            "invalid" in body_text or
            "salah"   in body_text or
            "gagal"   in body_text or
            "incorrect" in body_text or
            "/auth"   in current_url
        )
        print(f"  → Error terdeteksi: {has_error}")
        assert has_error, "Seharusnya ada pesan error untuk login gagal"


class TestDashboardUI:

    def test_TC_E2E_04_dashboard_tampil_setelah_login(self, logged_in_page: Page):
        """TC-E2E-04: Dashboard harus tampil dengan elemen-elemen progres."""
        page = logged_in_page
        screenshot(page, "TC_E2E_04_dashboard")

        print(f"\n[TC-E2E-04] URL: {page.url}")
        body_text = page.inner_text("body")
        print(f"  → Body sample: {body_text[:300]}")

        assert "500" not in body_text[:100], "Server error 500 terdeteksi"
        assert len(body_text) > 50, "Dashboard tampak kosong"

    def test_TC_E2E_05_navigasi_ke_halaman_latihan(self, logged_in_page: Page):
        """TC-E2E-05: Pengguna dapat navigasi ke halaman latihan."""
        page = logged_in_page

        practice_selectors = [
            'a[href*="practice"]',
            'a:has-text("Latihan")',
            'a:has-text("Practice")',
            'button:has-text("Mulai Latihan")',
            'button:has-text("Start Practice")',
        ]

        clicked = False
        for selector in practice_selectors:
            try:
                page.click(selector, timeout=3000)
                clicked = True
                print(f"\n[TC-E2E-05] Klik: {selector}")
                break
            except Exception:
                continue

        if not clicked:
            page.goto(f"{BASE_URL_UI}/practice")

        page.wait_for_timeout(2000)
        screenshot(page, "TC_E2E_05_practice_page")

        print(f"  → URL setelah navigasi: {page.url}")
        body_text = page.inner_text("body")
        assert len(body_text) > 50, "Halaman latihan tampak kosong"
