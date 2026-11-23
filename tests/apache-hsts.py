#!/usr/bin/env python3
"""Verify the documented HSTS directive on a temporary XAMPP TLS virtual host."""
import os
from pathlib import Path
import socket
import ssl
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

apache = Path(os.environ.get("ATTACHLINK_TEST_APACHE", "C:/xampp/apache")).resolve()
output = Path(__file__).resolve().parents[1] / "test-results"
output.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix="attachlink-https-", dir=output) as directory:
    fixture = Path(directory)
    (fixture / "index.html").write_text("AttachLink HTTPS fixture", encoding="ascii")
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    configuration = fixture / "httpd.conf"
    configuration.write_text(f"""
ServerRoot "{apache.as_posix()}"
LoadModule authz_core_module modules/mod_authz_core.so
LoadModule headers_module modules/mod_headers.so
LoadModule ssl_module modules/mod_ssl.so
ServerName localhost
Listen 127.0.0.1:{port}
PidFile "{(fixture / 'httpd.pid').as_posix()}"
ErrorLog "{(fixture / 'error.log').as_posix()}"
DocumentRoot "{fixture.as_posix()}"
<Directory />
    AllowOverride None
</Directory>
<Directory "{fixture.as_posix()}">
    Require all granted
</Directory>
<VirtualHost 127.0.0.1:{port}>
    SSLEngine on
    SSLCertificateFile conf/ssl.crt/server.crt
    SSLCertificateKeyFile conf/ssl.key/server.key
    Header always set Strict-Transport-Security "max-age=31536000"
</VirtualHost>
""", encoding="ascii")
    command = [str(apache / "bin/httpd.exe"), "-X", "-f", configuration.as_posix()]
    log_path = fixture / "process.log"
    with log_path.open("wb") as log, subprocess.Popen(command, stdout=log, stderr=log) as server:
        try:
            context = ssl._create_unverified_context()
            origin = f"https://127.0.0.1:{port}"
            for _ in range(60):
                try:
                    with urlopen(origin + "/index.html", context=context, timeout=1) as response:
                        assert response.headers["Strict-Transport-Security"] == "max-age=31536000"
                    break
                except HTTPError:
                    raise
                except URLError:
                    if server.poll() is not None:
                        raise RuntimeError(log_path.read_text(errors="replace"))
                    time.sleep(0.1)
            else:
                error_path = fixture / "error.log"
                raise RuntimeError(log_path.read_text(errors="replace") +
                                   (error_path.read_text(errors="replace") if error_path.exists() else ""))
            try:
                urlopen(origin + "/missing.html", context=context, timeout=2)
            except HTTPError as response:
                with response:
                    assert response.code == 404
                    assert response.headers["Strict-Transport-Security"] == "max-age=31536000"
            else:
                raise AssertionError("Expected an Apache-generated 404")
            print("PASSED Apache TLS static response and Apache-generated 404 both returned HSTS.")
        finally:
            if server.poll() is None:
                server.terminate()
                server.wait(timeout=10)
