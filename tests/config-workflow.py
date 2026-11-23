#!/usr/bin/env python3
"""Run against a disposable MariaDB instance with an upgraded attachlink_db."""
import argparse
from contextlib import contextmanager
from http.cookiejar import CookieJar, DefaultCookiePolicy
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import HTTPCookieProcessor, Request, build_opener

ROOT = Path(__file__).resolve().parent.parent
GENERIC = "The service is temporarily unavailable. Please try again later."


def request(client, url, data=None, headers=None):
    headers = dict(headers or {})
    if data is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(data).encode()
    try:
        response = client.open(Request(url, data=data, headers=headers), timeout=12)
    except HTTPError as error:
        response = error
    with response:
        return response.code, response.read().decode()


def api(client, base, route, status, data=None, headers=None):
    if data is not None:
        csrf = api(client, base, "csrf", 200, headers=headers)["csrf_token"]
        data = {**data, "csrf_token": csrf}
    code, body = request(client, base + "/backend/api/auth/" + route + ".php", data, headers)
    assert code == status, (route, code, body)
    result = json.loads(body)
    if status == 503:
        assert result == {"ok": False, "message": GENERIC}, result
    return result


@contextmanager
def server(php, db_port, environment, scratch, production=False):
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    router = ROOT / "backend/dev-router.php"
    if production:
        router = scratch / "https-fixture.php"
        # This fixture supplies PHP's trusted server-side HTTPS flag.
        router.write_text("<?php $_SERVER['HTTPS']='on'; return require "
                          + repr((ROOT / "backend/dev-router.php").as_posix()) + ";")
    base = f"http://127.0.0.1:{port}"
    with tempfile.TemporaryFile() as log:
        process = subprocess.Popen(
            [php, "-d", f"mysqli.default_port={db_port}", "-d", f"session.save_path={scratch}", "-d", f"upload_tmp_dir={scratch}",
             "-S", f"127.0.0.1:{port}", "-t", str(ROOT), str(router)],
            cwd=ROOT, env=environment, stdout=log, stderr=log,
        )
        try:
            for _ in range(60):
                try:
                    with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                        break
                except OSError:
                    if process.poll() is not None:
                        raise RuntimeError("PHP QA server exited.")
                    time.sleep(0.1)
            else:
                raise RuntimeError("PHP QA server did not start.")
            yield base
        except Exception:
            log.seek(0)
            print(log.read().decode(errors="replace"))
            raise
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=10)


def run(args):
    env = {key: val for key, val in os.environ.items() if not key.upper().startswith("ATTACHLINK_")}
    env_file = ROOT / "backend/.env"
    assert not env_file.exists(), "Run this suite in an isolated checkout without backend/.env."
    password = "Local QA " + secrets.token_hex(16)
    fixture = {"role": "student", "consent": True, "consent_version": "pilot-2026-11", "first_name": "QA", "last_name": "Configuration",
               "email": f"config-{secrets.token_hex(8)}@example.invalid",
               "phone": f"0779{secrets.randbelow(900000) + 100000}", "password": password}
    signin = {key: fixture[key] for key in ("role", "email", "password")}
    with tempfile.TemporaryDirectory(prefix="attachlink-config-") as directory:
        scratch = Path(directory)
        with server(args.php, args.db_port, env, scratch) as base:
            client = build_opener(HTTPCookieProcessor(CookieJar()))
            api(client, base, "register", 201, fixture)
            api(client, base, "login", 200, signin)
            api(client, base, "csrf", 503, headers={"Host": "example.invalid"})
            api(client, base, "csrf", 503, headers={"Host": "example.invalid", "X-Forwarded-Host": "localhost"})
        print("PASSED loopback registration and sign-in with no environment or .env")
        print("PASSED non-loopback host fails closed without leaking configuration")

        production = {**env, "ATTACHLINK_ENV": "production", "ATTACHLINK_DB_USER": args.production_user,
                      "ATTACHLINK_DB_PASS": os.environ["ATTACHLINK_TEST_DB_PASS"],
                      "ATTACHLINK_MAIL_TRANSPORT": "smtp", "ATTACHLINK_SMTP_HOST": "smtp.example.invalid",
                      "ATTACHLINK_SMTP_EHLO": "pilot.example.invalid", "ATTACHLINK_SMTP_FROM": "mail@example.invalid"}
        refused = {**fixture, "email": f"rollback-{secrets.token_hex(8)}@example.invalid",
                   "phone": f"0739{secrets.randbelow(900000) + 100000}"}
        for url in ("", "http://pilot.example.invalid"):
            candidate = {**production, "ATTACHLINK_BASE_URL": url}
            with server(args.php, args.db_port, candidate, scratch, production=True) as base:
                client = build_opener(HTTPCookieProcessor(CookieJar(policy=DefaultCookiePolicy(secure_protocols=("https", "http")))))
                api(client, base, "login", 200, signin)
                api(client, base, "register", 503, refused)
                api(client, base, "forgot-password", 503, {"email": signin["email"]})
                api(client, base, "resend-verification", 503, {})
        with server(args.php, args.db_port, env, scratch) as base:
            api(build_opener(HTTPCookieProcessor(CookieJar())), base, "register", 201, refused)
        print("PASSED missing and HTTP production base URLs reject link endpoints, preserve sign-in, and roll back accounts")

        canonical = "https://canonical.example.invalid/pilot"
        mail_log = scratch / "mail.jsonl"
        forged_environment = {**env, "ATTACHLINK_ENV": "development", "ATTACHLINK_BASE_URL": canonical,
                              "ATTACHLINK_MAIL_LOG": str(mail_log)}
        with server(args.php, args.db_port, forged_environment, scratch) as base:
            client = build_opener(HTTPCookieProcessor(CookieJar()))
            api(client, base, "forgot-password", 200, {"email": signin["email"]},
                {"Host": "forged.example.invalid", "X-Forwarded-Host": "forwarded.example.invalid"})
        subprocess.run([args.php, "-d", f"mysqli.default_port={args.db_port}", "backend/jobs/send-emails.php"],
                       env=forged_environment, cwd=ROOT, check=True)
        mail = [json.loads(line) for line in mail_log.read_text(encoding="utf-8").splitlines()]
        reset = next(message for message in mail if message["recipient"] == signin["email"]
                     and message["subject"] == "Reset your AttachLink password")
        assert canonical + "/account-recovery.php?action=reset" in reset["body"]
        assert "forged.example.invalid" not in reset["body"] and "forwarded.example.invalid" not in reset["body"]
        print("PASSED forged Host and X-Forwarded-Host do not alter email links")

        for transport, smtp_host in (("", "smtp.example.invalid"), ("smtp", "invalid/host")):
            invalid_mail = {**production, "ATTACHLINK_BASE_URL": canonical,
                            "ATTACHLINK_MAIL_TRANSPORT": transport, "ATTACHLINK_SMTP_HOST": smtp_host}
            with server(args.php, args.db_port, invalid_mail, scratch, production=True) as base:
                client = build_opener(HTTPCookieProcessor(CookieJar(policy=DefaultCookiePolicy(secure_protocols=("https", "http")))))
                api(client, base, "forgot-password", 503, {"email": signin["email"]})
        print("PASSED missing transport and invalid SMTP settings return generic HTTP 503")

        checked = subprocess.run([args.php, "-d", f"mysqli.default_port={args.db_port}", "backend/check-config.php"],
                                 env=production, cwd=ROOT, capture_output=True, text=True, check=False)
        assert checked.returncode == 1 and "MISSING ATTACHLINK_BASE_URL " in checked.stdout, checked.stdout
        assert production["ATTACHLINK_DB_PASS"] not in checked.stdout + checked.stderr
        print("PASSED check-config reports MISSING and exits nonzero without exposing secrets")

        local = subprocess.run([args.php, "-d", f"mysqli.default_port={args.db_port}", "backend/check-config.php"],
                               env={**env, "ATTACHLINK_DOCUMENT_STORAGE": str(scratch / "documents")},
                               cwd=ROOT, capture_output=True, text=True, check=False)
        assert local.returncode == 0 and "OK Database connection " in local.stdout, local.stdout
        assert "OK ATTACHLINK_DOCUMENT_STORAGE " in local.stdout and "OK ATTACHLINK_MAIL_TRANSPORT " in local.stdout
        print("PASSED check-config validated the upgraded database, storage and development transport")
        with server(args.php, args.db_port, {**env, "ATTACHLINK_DB_NAME": "config_missing_fixture"}, scratch) as base:
            api(build_opener(HTTPCookieProcessor(CookieJar())), base, "login", 503, signin)
        print("PASSED unavailable database returns generic HTTP 503")

        marker = "dotenv-" + secrets.token_hex(8)
        with env_file.open("x", encoding="utf-8") as output:
            output.write(f'ATTACHLINK_TEST_SENTINEL="{marker} # literal $PATH"\n')
        try:
            command = [args.php, "-r", "require 'backend/config.php'; echo getenv('ATTACHLINK_TEST_SENTINEL');"]
            assert subprocess.check_output(command, env=env, cwd=ROOT, text=True) == marker + " # literal $PATH"
            assert subprocess.check_output(command, env={**env, "ATTACHLINK_TEST_SENTINEL": "process"},
                                           cwd=ROOT, text=True) == "process"
            print("PASSED the real environment overrides .env and values are literal")
            code, body = request(build_opener(), args.apache_url.rstrip("/") + "/backend/.env")
            assert code in (403, 404) and marker not in body, code
            print(f"PASSED Apache refused a present backend/.env with HTTP {code}")
        finally:
            env_file.unlink()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--php", default="C:/xampp/php/php.exe")
    parser.add_argument("--db-port", type=int, required=True, help="Port of an isolated MariaDB instance")
    parser.add_argument("--production-user", required=True, help="Non-root account on the isolated MariaDB instance")
    parser.add_argument("--apache-url", default="http://localhost/attachlink")
    arguments = parser.parse_args()
    if arguments.db_port == 3306:
        parser.error("Use an isolated MariaDB instance on a non-default port.")
    run(arguments)
