#!/usr/bin/env python3
"""Run on Windows with XAMPP and an isolated upgraded MariaDB schema."""
import argparse
from http.cookiejar import CookieJar
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--xampp", default="C:/xampp")
parser.add_argument("--db-port", type=int, required=True)
parser.add_argument("--db-name", required=True)
args = parser.parse_args()
if args.db_port == 3306 or not args.db_name.startswith("attachlink_qa"):
    parser.error("Use an isolated QA schema on a non-default MariaDB port.")
xampp = Path(args.xampp)
php = str(xampp / "php/php.exe")
httpd = str(xampp / "apache/bin/httpd.exe")
mysql = str(xampp / "mysql/bin/mysql.exe")
env = {k: v for k, v in os.environ.items() if not k.upper().startswith("ATTACHLINK_")}
password = "Isolated XAMPP QA password 11"
email = f"xampp-{secrets.token_hex(8)}@example.invalid"


def query(statement):
    return subprocess.check_output([mysql, "--protocol=tcp", "-h127.0.0.1", "-P" + str(args.db_port),
                                    "-uroot", "-N", args.db_name, "-e", statement], env=env, text=True).strip()


def make_bcrypt(cost):
    return subprocess.check_output([php, "-r", f"echo password_hash('{password}', PASSWORD_BCRYPT, ['cost'=>{cost}]);"],
                                   env=env, text=True).strip()


with tempfile.TemporaryDirectory(prefix="attachlink-clean-xampp-") as folder:
    scratch = Path(folder)
    site = scratch / "site"
    site.mkdir()
    backend = site / "backend"
    shutil.copytree(root / "backend", backend, ignore=shutil.ignore_patterns(".env", "storage"))
    shutil.copyfile(root / ".htaccess", site / ".htaccess")
    dotenv = (backend / ".env.example").read_text()
    dotenv = dotenv.replace("ATTACHLINK_DB_PORT=3306", "ATTACHLINK_DB_PORT=" + str(args.db_port))
    dotenv = dotenv.replace("ATTACHLINK_DB_NAME=attachlink_db", "ATTACHLINK_DB_NAME=" + args.db_name)
    (backend / ".env").write_text(dotenv)
    check = subprocess.run([php, "backend/check-config.php"], cwd=site, env=env, capture_output=True, text=True, check=True)
    print("check-config.php output, no ATTACHLINK_* process environment:")
    print(check.stdout, end="")
    print(f"Exit code {check.returncode}.", flush=True)

    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    session = scratch / "sessions"
    session.mkdir()
    conf = scratch / "httpd.conf"
    xampp_posix = xampp.as_posix()
    conf.write_text(f'''
ServerRoot "{xampp_posix}/apache"
ServerName localhost
Listen 127.0.0.1:{port}
PidFile "{(scratch / 'apache.pid').as_posix()}"
ErrorLog "{(scratch / 'apache.log').as_posix()}"
LoadModule authz_core_module modules/mod_authz_core.so
LoadModule dir_module modules/mod_dir.so
LoadModule headers_module modules/mod_headers.so
LoadModule rewrite_module modules/mod_rewrite.so
LoadFile "{xampp_posix}/php/php8ts.dll"
LoadModule php_module "{xampp_posix}/php/php8apache2_4.dll"
PHPIniDir "{xampp_posix}/php"
DocumentRoot "{site.as_posix()}"
<Directory "{site.as_posix()}">
    Require all granted
    AllowOverride All
    php_value session.save_path "{session.as_posix()}"
</Directory>
<FilesMatch "\\.php$">
    SetHandler application/x-httpd-php
</FilesMatch>
''')
    subprocess.run([httpd, "-t", "-f", str(conf)], env=env, check=True)
    process = subprocess.Popen([httpd, "-f", str(conf)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               creationflags=subprocess.CREATE_NO_WINDOW)
    origin = f"http://127.0.0.1:{port}"
    browser = build_opener(HTTPCookieProcessor(CookieJar()))

    def call(route, expected, data=None):
        headers = {}
        if data is not None:
            data = json.dumps({**data, "csrf_token": call("csrf", 200)["csrf_token"]}).encode()
            headers["Content-Type"] = "application/json"
        try:
            response = browser.open(Request(origin+"/backend/api/auth/"+route+".php", data=data, headers=headers), timeout=20)
        except HTTPError as error:
            response = error
        with response:
            result = json.load(response)
            assert response.code == expected, (route, response.code, result)
            return result

    try:
        for _ in range(80):
            try:
                with socket.create_connection(("127.0.0.1", port), timeout=0.25):
                    break
            except OSError:
                if process.poll() is not None:
                    raise RuntimeError("Isolated Apache exited.")
                time.sleep(.1)
        else:
            raise RuntimeError("Isolated Apache did not start.")
        record = call("register", 201, {"role":"student","first_name":"QA","last_name":"XAMPP","email":email,
                        "phone":"0779"+str(secrets.randbelow(900000)+100000),"password":password,
                        "consent":True,"consent_version":"pilot-2026-11"})
        user_id = int(record["user_id"])
        signin = {"role":"student", "email":email, "password":password}
        assert query(f"SELECT SUBSTRING(password_hash,5,2) FROM users WHERE id={user_id}") == "11"
        call("login", 200, signin)
        print("PASSED isolated Apache registration and sign-in using only backend/.env.")
        try:
            browser.open(origin+"/backend/.env", timeout=10)
            raise AssertionError("Apache served backend/.env")
        except HTTPError as error:
            assert error.code in (403, 404)
            print(f"PASSED Apache refused backend/.env with HTTP {error.code}.")

        old_hash = make_bcrypt(8)
        query(f"UPDATE users SET password_hash='{old_hash}' WHERE id={user_id}")
        unchanged = query(f"SELECT COALESCE(password_changed_at,'unchanged') FROM users WHERE id={user_id}")
        call("login", 401, {**signin, "password":"incorrect"})
        call("login", 403, {**signin, "role":"employer"})
        assert query(f"SELECT password_hash FROM users WHERE id={user_id}") == old_hash
        call("login", 200, signin)
        upgraded = query(f"SELECT password_hash FROM users WHERE id={user_id}")
        assert upgraded != old_hash and upgraded.split("$")[2] == "11"
        assert query(f"SELECT COALESCE(password_changed_at,'unchanged') FROM users WHERE id={user_id}") == unchanged
        call("login", 200, signin)
        assert query(f"SELECT password_hash FROM users WHERE id={user_id}") == upgraded
        strong = make_bcrypt(12)
        query(f"UPDATE users SET password_hash='{strong}' WHERE id={user_id}")
        call("login", 200, signin)
        assert query(f"SELECT password_hash FROM users WHERE id={user_id}") == strong
        print("PASSED cost-8 hash upgraded after successful login, password timestamp retained, and cost-12 hash preserved.")
    except Exception:
        log = scratch / "apache.log"
        if log.exists():
            print(log.read_text(errors="replace"))
        raise
    finally:
        if process.poll() is None:
            subprocess.run(["taskkill.exe", "/PID", str(process.pid), "/T", "/F"],
                           capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
            process.wait(timeout=15)
