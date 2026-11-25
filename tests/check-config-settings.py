#!/usr/bin/env python3
"""Verify configuration checks without connecting to a non-disposable database."""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SECRET = "never-print-this-check-config-secret"


def php_string(value):
    return '"' + value.replace("\\", "/").replace('"', '\\"') + '"'


def run_check(php, scratch, environment, settings, document_root):
    wrapper = scratch / "check-config-wrapper.php"
    wrapper.write_text(
        "<?php $_SERVER['DOCUMENT_ROOT']=getenv('ATTACHLINK_TEST_DOCUMENT_ROOT') ?: ''; "
        "require " + php_string(str(ROOT / "backend/check-config.php")) + ";",
        encoding="ascii",
    )
    command = [php]
    for key, value in settings.items():
        command.extend(["-d", f"{key}={value}"])
    command.append(str(wrapper))
    env = {key: value for key, value in os.environ.items() if not key.upper().startswith("ATTACHLINK_")}
    env.update(environment)
    env["ATTACHLINK_TEST_DOCUMENT_ROOT"] = str(document_root)
    return subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, check=False)


def php_settings(scratch, valid=True):
    directory = scratch / "php-temp"
    directory.mkdir(exist_ok=True)
    if valid:
        return {
            "upload_max_filesize": "5M",
            "post_max_size": "46M",
            "max_file_uploads": "9",
            "upload_tmp_dir": str(directory),
            "session.save_path": str(directory),
            "session.gc_maxlifetime": "43200",
        }
    return {
        "upload_max_filesize": "1M",
        "post_max_size": "40M",
        "max_file_uploads": "2",
        "upload_tmp_dir": str(scratch / "missing-temp"),
        "session.save_path": str(scratch / "missing-sessions"),
        "session.gc_maxlifetime": "1440",
    }


def base_environment(scratch):
    document_root = scratch / "public"
    document_root.mkdir(exist_ok=True)
    storage = scratch / "private-storage"
    storage.mkdir(exist_ok=True)
    avatars = scratch / "private-avatars"
    avatars.mkdir(exist_ok=True)
    backup = scratch / "private-backups"
    backup.mkdir(exist_ok=True)
    return {
        "ATTACHLINK_ENV": "development",
        "ATTACHLINK_DB_HOST": "127.0.0.1",
        "ATTACHLINK_DB_PORT": "1",
        "ATTACHLINK_DB_NAME": "attachlink_config_test",
        "ATTACHLINK_DB_USER": "qa",
        "ATTACHLINK_DB_PASS": SECRET,
        "ATTACHLINK_DOCUMENT_STORAGE": str(storage),
        "ATTACHLINK_AVATAR_STORAGE": str(avatars),
        "ATTACHLINK_MAIL_TRANSPORT": "log",
        "ATTACHLINK_MAIL_LOG": str(scratch / "private-mail" / "mail.jsonl"),
    }, document_root, storage, backup


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--php", default="C:/xampp/php/php.exe")
    args = parser.parse_args()
    php = str(Path(args.php).resolve())
    with tempfile.TemporaryDirectory(prefix="attachlink-config-check-") as directory:
        scratch = Path(directory)
        env, document_root, storage, backup = base_environment(scratch)
        os.chmod(storage, 0o700)
        os.chmod(backup, 0o700)
        env.update(
            ATTACHLINK_TRUSTED_PROXIES="127.0.0.1,::1",
            ATTACHLINK_INTERVIEW_AI_URL="https://api.example.invalid/v1/chat/completions",
            ATTACHLINK_INTERVIEW_AI_MODEL="qa-model",
            ATTACHLINK_INTERVIEW_AI_KEY=SECRET,
            ATTACHLINK_SUPPORT_AI="1",
            ATTACHLINK_MAP_TILE_URL="https://tiles.example.invalid/{z}/{x}/{y}.png",
            ATTACHLINK_MAP_ATTRIBUTION="QA tiles",
            ATTACHLINK_BACKUP_DIR=str(backup),
            ATTACHLINK_BACKUP_DAYS="30",
            ATTACHLINK_BACKUP_RECIPIENT="age1" + "a" * 58,
        )
        valid = run_check(php, scratch, env, php_settings(scratch), document_root)
        assert valid.returncode == 1 and "INVALID Database connection " in valid.stdout, valid.stdout
        expected = (
            "OK ATTACHLINK_TRUSTED_PROXIES ",
            "OK ATTACHLINK_SUPPORT_AI ",
            "OK ATTACHLINK_INTERVIEW_AI_URL ",
            "OK ATTACHLINK_INTERVIEW_AI_MODEL ",
            "OK ATTACHLINK_INTERVIEW_AI_KEY ",
            "OK ATTACHLINK_MAP_TILE_ORIGIN ",
            "OK ATTACHLINK_BACKUP_DIR ",
            "OK ATTACHLINK_BACKUP_RECIPIENT ",
            "OK ATTACHLINK_BACKUP_DAYS ",
            "OK ATTACHLINK_DOCUMENT_STORAGE ",
            "OK ATTACHLINK_AVATAR_STORAGE ",
            "OK PHP upload_max_filesize ",
            "OK PHP post_max_size ",
            "OK PHP max_file_uploads ",
            "OK PHP upload_tmp_dir ",
            "OK PHP session.save_path ",
            "OK PHP session.gc_maxlifetime ",
            "OK ATTACHLINK_MAIL_TRANSPORT ",
        )
        for line in expected:
            assert line in valid.stdout, (line, valid.stdout)
        assert SECRET not in valid.stdout + valid.stderr

        invalid_env = dict(env)
        invalid_env.update(
            ATTACHLINK_TRUSTED_PROXIES="localhost,192.0.2.1",
            ATTACHLINK_INTERVIEW_AI_URL="http://provider.example.invalid/v1",
            ATTACHLINK_INTERVIEW_AI_MODEL="",
            ATTACHLINK_MAP_TILE_URL="http://tiles.example.invalid/{z}/{x}/{y}.png",
            ATTACHLINK_DOCUMENT_STORAGE=str(ROOT / "assets"),
            ATTACHLINK_AVATAR_STORAGE=str(ROOT / "assets"),
            ATTACHLINK_BACKUP_DIR=str(ROOT / "docs"),
            ATTACHLINK_BACKUP_RECIPIENT="not-an-age-recipient",
        )
        invalid = run_check(php, scratch, invalid_env, php_settings(scratch, valid=False), ROOT)
        assert invalid.returncode == 1
        for line in (
            "INVALID ATTACHLINK_TRUSTED_PROXIES ",
            "INVALID ATTACHLINK_INTERVIEW_AI_URL ",
            "MISSING ATTACHLINK_INTERVIEW_AI_MODEL ",
            "INVALID ATTACHLINK_MAP_TILE_ORIGIN ",
            "INVALID ATTACHLINK_DOCUMENT_STORAGE ",
            "INVALID ATTACHLINK_AVATAR_STORAGE ",
            "INVALID ATTACHLINK_BACKUP_DIR ",
            "INVALID ATTACHLINK_BACKUP_RECIPIENT ",
            "INVALID PHP upload_max_filesize ",
            "INVALID PHP post_max_size ",
            "INVALID PHP max_file_uploads ",
            "INVALID PHP upload_tmp_dir ",
            "INVALID PHP session.save_path ",
            "INVALID PHP session.gc_maxlifetime ",
        ):
            assert line in invalid.stdout, (line, invalid.stdout)
        assert SECRET not in invalid.stdout + invalid.stderr

        production = dict(env)
        production.update(ATTACHLINK_ENV="production", ATTACHLINK_MAIL_TRANSPORT="log")
        production.pop("ATTACHLINK_ADMIN_TOTP_KEY", None)
        production.pop("ATTACHLINK_BACKUP_DIR", None)
        production.pop("ATTACHLINK_BACKUP_RECIPIENT", None)
        checked = run_check(php, scratch, production, php_settings(scratch), document_root)
        assert checked.returncode == 1
        for line in (
            "MISSING ATTACHLINK_ADMIN_TOTP_KEY ",
            "MISSING ATTACHLINK_BACKUP_DIR ",
            "MISSING ATTACHLINK_BACKUP_RECIPIENT ",
            "INVALID ATTACHLINK_MAIL_TRANSPORT ",
        ):
            assert line in checked.stdout, (line, checked.stdout)
        assert SECRET not in checked.stdout + checked.stderr

    print("PASSED config validation, document-root checks, PHP limits, secret redaction, and fail-closed exit status.")


if __name__ == "__main__":
    main()
