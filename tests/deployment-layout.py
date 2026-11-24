#!/usr/bin/env python3
"""Probe private paths in both the source checkout and the packaged Apache release."""
import argparse
from contextlib import contextmanager
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import urlopen
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
PRIVATE_PATHS = (
    "/database/schema.sql",
    "/docs/",
    "/vendor/autoload.php",
    "/composer.lock",
    "/backend/.env",
    "/backend/storage/",
    "/dist/",
    "/test-results/",
    "/node_modules/",
    "/.git/",
    "/dev-router.php",
    "/backend/jobs/",
    "/backend/lib/",
)


def response_status(url):
    try:
        with urlopen(url, timeout=2) as response:
            return response.status
    except HTTPError as response:
        status = response.code
        response.close()
        return status


@contextmanager
def apache_server(apache, document_root, work):
    work.mkdir(parents=True, exist_ok=True)
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    root = document_root.as_posix()
    configuration = work / "httpd.conf"
    configuration.write_text(f"""
ServerRoot "{apache.as_posix()}"
LoadModule authz_core_module modules/mod_authz_core.so
LoadModule authz_host_module modules/mod_authz_host.so
LoadModule headers_module modules/mod_headers.so
LoadModule mime_module modules/mod_mime.so
LoadModule dir_module modules/mod_dir.so
LoadModule rewrite_module modules/mod_rewrite.so
ServerName 127.0.0.1
Listen 127.0.0.1:{port}
PidFile "{(work / 'httpd.pid').as_posix()}"
ErrorLog "{(work / 'error.log').as_posix()}"
DocumentRoot "{root}"
DirectoryIndex index.php index.html
<Directory />
    AllowOverride None
    Require all denied
</Directory>
<Directory "{root}">
    Options FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>
""", encoding="ascii")
    process_log = work / "process.log"
    with process_log.open("wb") as output:
        server = subprocess.Popen([str(apache / "bin/httpd.exe"), "-X", "-f", str(configuration)],
                                  stdout=output, stderr=output)
    origin = f"http://127.0.0.1:{port}"
    try:
        for _ in range(60):
            if server.poll() is not None:
                raise RuntimeError(process_log.read_text(errors="replace") +
                                   ((work / "error.log").read_text(errors="replace")
                                    if (work / "error.log").exists() else ""))
            try:
                response_status(origin + "/")
                break
            except URLError:
                time.sleep(0.1)
        else:
            raise RuntimeError("Apache fixture did not become ready.")
        yield origin
    finally:
        if server.poll() is None:
            server.terminate()
            server.wait(timeout=10)


def assert_private_paths(apache, document_root, label, work):
    with apache_server(apache, document_root, work) as origin:
        for path in PRIVATE_PATHS:
            status = response_status(origin + path)
            assert status in (403, 404), f"{label} exposed {path} with HTTP {status}"
    print(f"PASSED Apache private-path probes for {label}.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apache", default=os.environ.get("ATTACHLINK_TEST_APACHE", "C:/xampp/apache"),
                        help="Apache installation directory")
    args = parser.parse_args()
    apache = Path(args.apache).resolve()
    executable = apache / "bin/httpd.exe"
    if not executable.is_file():
        parser.error(f"Apache executable not found: {executable}")

    with tempfile.TemporaryDirectory(prefix="attachlink-layout-") as directory:
        work = Path(directory)
        assert_private_paths(apache, ROOT, "repository layout", work / "repository")

        archive = work / "attachlink.zip"
        subprocess.run([sys.executable, str(ROOT / "scripts/build-release.py"), "--output", str(archive)],
                       cwd=ROOT, check=True)
        extracted = work / "release"
        extracted.mkdir()
        with ZipFile(archive) as package:
            assert package.testzip() is None
            package.extractall(extracted)
        assert (extracted / "public" / ".htaccess").is_file()
        assert (extracted / "database" / "schema.sql").is_file()
        assert (extracted / "docs" / "DEPLOYMENT.md").is_file()
        assert not (extracted / "public" / "database").exists()
        assert not (extracted / "public" / "docs").exists()
        assert_private_paths(apache, extracted / "public", "release layout", work / "release-apache")


if __name__ == "__main__":
    main()
