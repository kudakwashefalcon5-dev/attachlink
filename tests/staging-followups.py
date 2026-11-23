#!/usr/bin/env python3
"""Run staging regressions against disposable schemas on a local MariaDB test instance."""
import base64
import hashlib
import hmac
from http.cookiejar import CookieJar, DefaultCookiePolicy
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("config_workflow", ROOT / "tests/config-workflow.py")
config = importlib.util.module_from_spec(spec)
spec.loader.exec_module(config)
PHP = os.environ.get("ATTACHLINK_TEST_PHP", "C:/xampp/php/php.exe")
MYSQL = os.environ.get("ATTACHLINK_TEST_MYSQL", "C:/xampp/mysql/bin/mysql.exe")
PORT = int(os.environ.get("ATTACHLINK_TEST_DB_PORT", "3306"))
PASSWORD = "Staging QA " + secrets.token_hex(12)
SUFFIX = secrets.token_hex(5)
DB = "attachlink_qa_staging_" + SUFFIX
DB_USER = "alqa_" + SUFFIX
BASE = {k: v for k, v in os.environ.items() if not k.upper().startswith("ATTACHLINK_")}
assert not (ROOT / "backend/.env").exists(), "Use a checkout without a local .env."
ENV = dict(BASE, ATTACHLINK_ENV="development", ATTACHLINK_DB_NAME=DB, ATTACHLINK_DB_PORT=str(PORT))
CSRF = "backend/api/auth/csrf.php"


def sql(source, schema=None):
    command = [MYSQL, "--protocol=tcp", "-h127.0.0.1", "-P" + str(PORT), "-uroot", "-N"]
    if schema:
        command.append(schema)
    return subprocess.check_output(command, input=source.encode() if isinstance(source, str) else source).decode().strip()


def load(path):
    return re.sub(rb"(?m)^(?:CREATE DATABASE|USE ).*\r?\n", b"", (ROOT / path).read_bytes())


def cli(path, env, expected=0):
    result = subprocess.run([PHP, path], cwd=ROOT, env=env, text=True, capture_output=True)
    assert result.returncode == expected, (path, result.stdout, result.stderr)
    return result.stdout


def client():
    policy = DefaultCookiePolicy(secure_protocols=("https", "http"))
    return build_opener(HTTPCookieProcessor(CookieJar(policy=policy)))


def api(browser, url, endpoint, expected=200, data=None, uploads=None, headers=None):
    headers = dict(headers or {})
    if data is not None:
        fields = {**data, "csrf_token": api(browser, url, CSRF)["csrf_token"]}
        if uploads is not None:
            boundary = "attachlink-" + secrets.token_hex(8)
            parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'
                     for key, value in fields.items()]
            parts.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"; filename="fixture.pdf"\r\n'
                         f'Content-Type: application/pdf\r\n\r\n{value}\r\n' for key, value in uploads.items())
            payload = ("".join(parts) + f"--{boundary}--\r\n").encode()
            headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        else:
            payload = json.dumps(fields).encode()
            headers["Content-Type"] = "application/json"
    else:
        payload = None
    try:
        response = browser.open(Request(url + "/" + endpoint, data=payload, headers=headers), timeout=12)
    except HTTPError as error:
        response = error
    with response:
        assert response.code == expected, (endpoint, response.code, response.read())
        if expected == 503:
            assert json.load(response) == {"ok": False, "message": config.GENERIC}
            return
        if endpoint == CSRF and response.headers.get("Strict-Transport-Security"):
            assert response.headers["Strict-Transport-Security"] == "max-age=31536000"
        if response.headers.get_content_type() == "application/json":
            return json.load(response)
        return response.read()


def live_checks(scratch):
    api_root = "backend/api/"
    fields = ("national_id", "academic_certificates", "stamped_letter", "birth_certificate", "transcript")
    upload = "%PDF-1.4\n%%EOF\n"
    with config.server(PHP, PORT, ENV, scratch) as url:
        student, employer, admin = client(), client(), client()
        for identity, role in ((student, "student"), (employer, "employer"), (admin, "admin")):
            api(identity, url, api_root + "auth/login.php", data={
                "email": role + "@example.invalid", "role": role, "password": PASSWORD})
        assert b"Companies" in api(admin, url, "designs/admin/companies.html")
        assert b"signin-form" in api(client(), url, "designs/admin/login.html")
        print("PASSED authenticated Companies page and retired admin login redirect to the shared form.")
        apply = api_root + "student/apply-with-documents.php"
        vault = api_root + "student/document-vault.php"
        for field in fields:
            api(student, url, apply, 422, {"listing_id": 1}, {name: upload for name in fields if name != field})
        api(student, url, vault, 415, {"document_type": fields[0]}, {"file": "invalid"})
        for field in fields:
            api(student, url, vault, 200, {"document_type": field}, {"file": upload})
        assert len(api(student, url, vault)["documents"]) == 5
        api(employer, url, vault, 403)
        app = api(student, url, apply, 201, {"listing_id": 1, "use_vault": "1"}, {})
        assert app["document_count"] == 5
        print("PASSED all five direct uploads enforced; five saved vault files attached; invalid MIME and employer vault access rejected.")
        application_id = app["application_id"]
        detail = api_root + f"employer/applications.php?application_id={application_id}"
        prefs = api_root + "student/preferences.php"
        data = {"sectors": "Engineering", "work_model": "Hybrid", "relocation": "Harare", "stipend": "100"}
        api(student, url, prefs, data={**data, "recruiter_visible": False})
        keys = ("preferred_sectors", "preferred_work_model", "preferred_relocation", "preferred_stipend")
        assert not set(keys) & api(employer, url, detail)["application"].keys()
        api(student, url, prefs, data={**data, "recruiter_visible": True})
        shared = api(employer, url, detail)["application"]
        assert [shared[key] for key in keys[:3]] == ["Engineering", "Hybrid", "Harare"] and keys[3] not in shared
        print("PASSED employer preference privacy, visible preferences, and stipend omission.")
        documents = api(employer, url, api_root + f"employer/documents.php?application_id={application_id}")["documents"]
        assert len(documents) == 5
        api(employer, url, api_root + f"documents/download.php?id={documents[0]['id']}")
        verification = api(employer, url, api_root + "company-files.php", 201, {"purpose": "verification"}, {"file": upload})
        api(admin, url, api_root + f"company-files.php?company_id=1&id={verification['id']}")
        assert api(admin, url, api_root + "admin/retention.php")["status"]["saved_vault_documents"] == 5
        downloads = api(admin, url, api_root + "admin/audit-log.php?action=document.download")["events"]
        assert {item["target_type"] for item in downloads} == {"application_document", "company_verification_document"}
        assert api(admin, url, api_root + "admin/audit-log.php?action=retention.view")["events"]
        print("PASSED download and retention report events are available through action filters.")
        api(student, url, vault, 200, {"document_type": fields[0]}, {"file": upload})
        cli("backend/jobs/purge-documents.php", ENV)
        storage = Path(ENV["ATTACHLINK_DOCUMENT_STORAGE"])
        assert len(list(storage.glob("*.pdf"))) == 11
        api(student, url, api_root + "student/delete-account.php", data={"confirm": True, "current_password": PASSWORD})
        assert len(list(storage.glob("*.pdf"))) == 1
        assert sql("SELECT COUNT(*) FROM student_document_vault", DB) == "0"
        print("PASSED replacement purge and account deletion removed vault and application files.")


def production_checks(scratch):
    implicit = {key: value for key, value in ENV.items() if key != "ATTACHLINK_ENV"}
    for value in ("https://example.invalid", "http://example.invalid"):
        output = cli("backend/check-config.php", dict(implicit, ATTACHLINK_BASE_URL=value), 1)
        assert "MISSING ATTACHLINK_ENV" in output
    with config.server(PHP, PORT, implicit, scratch) as url:
        api(client(), url, CSRF)
        for header in ("Forwarded", "X-Forwarded-Proto", "X-Forwarded-Host", "X-Forwarded-Anything"):
            api(client(), url, CSRF, 503, headers={header: "localhost"})
        api(client(), url, CSRF, 503, headers={"Host": "example.invalid"})
    with config.server(PHP, PORT, implicit, scratch, production=True) as url:
        api(client(), url, CSRF, 503)
    print("PASSED unset environment rejects deployment URLs, HTTPS, forwarded headers, and non-loopback Host.")
    production = dict(ENV, ATTACHLINK_ENV="production", ATTACHLINK_BASE_URL="https://example.invalid",
                      ATTACHLINK_DB_USER=DB_USER, ATTACHLINK_DB_PASS=PASSWORD,
                      ATTACHLINK_ADMIN_TOTP_KEY=secrets.token_hex(32))
    with config.server(PHP, PORT, production, scratch, production=True) as url:
        browser = client()
        auth = "backend/api/auth/"
        credentials = {"email": "admin@example.invalid", "role": "admin", "password": PASSWORD}
        response = browser.open(url + "/" + CSRF)
        with response:
            assert response.headers["Strict-Transport-Security"] == "max-age=31536000"
        challenge = api(browser, url, auth + "login.php", data=credentials)
        api(browser, url, auth + "me.php", 401)
        secret = base64.b32decode(challenge["setup_key"])
        step = int(time.time()) // 30
        digest = hmac.digest(secret, step.to_bytes(8, "big"), hashlib.sha1)
        offset = digest[-1] & 15
        code = f"{(int.from_bytes(digest[offset:offset + 4], 'big') & 0x7fffffff) % 1000000:06d}"
        recovery = api(browser, url, auth + "admin-totp.php", data={"code": code})["recovery_codes"]
        assert len(set(recovery)) == 10
        api(browser, url, auth + "me.php")
        for candidate, expected in ((code, 401), (recovery[0], 200), (recovery[0], 401)):
            browser = client()
            assert not api(browser, url, auth + "login.php", data=credentials)["setup_key"]
            api(browser, url, auth + "admin-totp.php", expected, {"code": candidate})
    print("PASSED PHP HSTS, production admin enrollment, pre-factor denial, TOTP replay rejection and single-use recovery.")


def main():
    sql(f"CREATE DATABASE {DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
    try:
        sql(load("tests/fixtures/schema-baseline.sql"), DB)
        for i in range(2, 10):
            sql(load(f"database/upgrade-{i:02}.sql"), DB)
        with tempfile.TemporaryDirectory(prefix="attachlink-staging-") as tmp:
            scratch = Path(tmp)
            ENV.update(ATTACHLINK_DOCUMENT_STORAGE=str(scratch / "documents"), ATTACHLINK_MAIL_LOG=str(scratch / "mail.jsonl"))
            pending = cli("backend/check-config.php", ENV, 1)
            assert "INVALID Database migrations" in pending and all(f"upgrade-{i}" in pending for i in range(10, 15))
            with config.server(PHP, PORT, ENV, scratch) as url:
                api(client(), url, "backend/api/auth/login.php", 503, {"email": "student@example.invalid", "role": "student", "password": PASSWORD})
            output = cli("backend/jobs/migrate.php", ENV)
            assert re.findall(r"Applied (upgrade-\d+)", output) == [f"upgrade-{i}" for i in range(10, 15)], output
            assert "Detected upgrade-09" in output and not cli("backend/jobs/migrate.php", ENV).strip()
            assert "OK Database migrations" in cli("backend/check-config.php", ENV)
            print("PASSED unversioned upgrade-09 detected; only upgrades 10 through 14 applied; rerun made no changes.")
            digest = subprocess.check_output([PHP, "-r", "echo password_hash($argv[1], PASSWORD_BCRYPT);", PASSWORD], text=True)
            sql(f"CREATE USER '{DB_USER}'@'localhost' IDENTIFIED BY '{PASSWORD}'; GRANT ALL ON {DB}.* TO '{DB_USER}'@'localhost';")
            sql(f"INSERT INTO companies(id,name,verification_status) VALUES(1,'Fixture','verified'); INSERT INTO openings(id,company_id,title,description,status) VALUES(1,1,'Fixture','Fixture','published');", DB)
            for role in ("student", "employer", "admin"):
                company = "1" if role == "employer" else "NULL"
                sql(f"INSERT INTO users(role,company_id,first_name,last_name,email,password_hash,email_verified_at) VALUES('{role}',{company},'QA','Fixture','{role}@example.invalid','{digest}',NOW());", DB)
            live_checks(scratch)
            production_checks(scratch)
    finally:
        sql(f"DROP USER IF EXISTS '{DB_USER}'@'localhost'; DROP DATABASE {DB};")


if __name__ == "__main__":
    main()
