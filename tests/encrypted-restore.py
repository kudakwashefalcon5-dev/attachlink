#!/usr/bin/env python3
"""Verify paired encrypted backups, recursive storage manifests, and isolated restores."""
import argparse
import json
import os
from pathlib import Path, PurePosixPath
import re
import secrets
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--age", required=True)
parser.add_argument("--age-keygen", required=True)
parser.add_argument("--port", type=int, required=True)
parser.add_argument("--php", default="C:/xampp/php/php.exe")
parser.add_argument("--mysql", default="C:/xampp/mysql/bin/mysql.exe")
parser.add_argument("--dump", default="C:/xampp/mysql/bin/mysqldump.exe")
args = parser.parse_args()
if args.port == 3306:
    parser.error("Use an isolated MariaDB server on a non-default port.")

suffix = secrets.token_hex(4)
source_db = "attachlink_qa_backup_" + suffix
restored_db = "attachlink_qa_restore_" + suffix
mysql = [args.mysql, "--protocol=tcp", "-h127.0.0.1", "-P" + str(args.port), "-uroot"]
created = []


def import_schema(database):
    schema = re.sub(rb"(?m)^(?:CREATE DATABASE|USE ).*\r?\n", b"", (ROOT / "database/schema.sql").read_bytes())
    subprocess.run([*mysql, database], input=schema, check=True)


try:
    for database in (source_db, restored_db):
        subprocess.run([*mysql, "-e", "CREATE DATABASE " + database + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"], check=True)
        created.append(database)
    import_schema(source_db)

    with tempfile.TemporaryDirectory(prefix="attachlink-age-backup-") as work_path:
        with tempfile.TemporaryDirectory(prefix="attachlink-age-restore-") as restore_path:
            work, restore = Path(work_path), Path(restore_path)
            documents = work / "documents"
            avatars = work / "avatars"
            backups = work / "backups"
            documents.mkdir()
            avatars.mkdir()
            backups.mkdir()
            identity = restore / "test-identity"
            wrong_identity = restore / "wrong-identity"
            for key in (identity, wrong_identity):
                subprocess.run([args.age_keygen, "-o", str(key)], check=True, capture_output=True)
            recipient = subprocess.check_output([args.age_keygen, "-y", str(identity)], text=True).strip()

            fixture_files = {
                "documents/records/application/nested/cv.pdf": b"application document fixture",
                "documents/vault/nested/deep/transcript.pdf": b"vault fixture",
                "documents/company/nested/verification.pdf": b"company file fixture",
                "documents/logos/nested/company.png": b"company logo fixture",
                "documents/orphan/nested/unclassified.bin": b"unclassified nested fixture",
                "avatars/nested/profile.jpg": b"nested avatar fixture",
            }
            for relative, content in fixture_files.items():
                path = work / Path(relative)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
            sql = """INSERT INTO companies(name) VALUES('Backup manifest fixture');
SET @company=LAST_INSERT_ID();
INSERT INTO users(role,first_name,last_name,email,password_hash)
VALUES('student','Backup','Fixture','backup-fixture@example.invalid','not-used');
SET @student=LAST_INSERT_ID();
INSERT INTO openings(company_id,title,description) VALUES(@company,'Fixture opening','Restore test');
SET @opening=LAST_INSERT_ID();
INSERT INTO applications(opening_id,student_id) VALUES(@opening,@student);
SET @application=LAST_INSERT_ID();
INSERT INTO application_documents(application_id,document_type,original_name,stored_name,mime_type)
VALUES(@application,'cv','cv.pdf','records/application/nested/cv.pdf','application/pdf');
INSERT INTO student_document_vault(student_id,document_type,slot,original_name,stored_name,mime_type)
VALUES(@student,'transcript',1,'transcript.pdf','vault/nested/deep/transcript.pdf','application/pdf');
INSERT INTO company_files(company_id,purpose,original_name,stored_name,mime_type)
VALUES(@company,'verification','verification.pdf','company/nested/verification.pdf','application/pdf');
INSERT INTO company_files(company_id,purpose,original_name,stored_name,mime_type)
VALUES(@company,'logo','company.png','logos/nested/company.png','image/png');
SELECT id FROM users WHERE email='backup-fixture@example.invalid';
"""
            student_id = subprocess.check_output([*mysql, "-N", source_db, "-e", sql], text=True).strip().splitlines()[-1]
            (avatars / (student_id + ".jpg")).write_bytes(b"student avatar fixture")

            environment = {key: value for key, value in os.environ.items() if not key.upper().startswith("ATTACHLINK_")}
            environment.update(
                ATTACHLINK_ENV="development",
                ATTACHLINK_DB_HOST="127.0.0.1",
                ATTACHLINK_DB_PORT=str(args.port),
                ATTACHLINK_DB_NAME=source_db,
                ATTACHLINK_DB_USER="root",
                ATTACHLINK_DB_PASS="",
                ATTACHLINK_DOCUMENT_STORAGE=str(documents),
                ATTACHLINK_AVATAR_STORAGE=str(avatars),
                ATTACHLINK_BACKUP_DIR=str(backups),
                ATTACHLINK_MYSQLDUMP=args.dump,
                ATTACHLINK_AGE=args.age,
                ATTACHLINK_BACKUP_RECIPIENT=recipient,
            )
            command = [args.php, "backend/jobs/backup.php", "all"]
            subprocess.run(command, cwd=ROOT, env=environment, check=True)
            pairs = [path for path in backups.iterdir() if path.is_dir() and path.name.startswith("attachlink-backup-")]
            assert len(pairs) == 1, pairs
            pair = pairs[0]
            encrypted = sorted(pair.glob("*.age"))
            assert len(encrypted) == 2 and all(path.read_bytes().startswith(b"age-encryption.org/v1") for path in encrypted)
            assert {path.name for path in backups.iterdir()} == {pair.name, ".attachlink-backup.lock"}
            database_cipher = next(path for path in encrypted if path.name.startswith("attachlink-db-"))
            files_cipher = next(path for path in encrypted if path.name.startswith("attachlink-files-"))
            for ciphertext in encrypted:
                rejected = subprocess.run([args.age, "-d", "-i", str(wrong_identity), str(ciphertext)],
                                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                assert rejected.returncode != 0
            database_dump = restore / database_cipher.name[:-4]
            files_tar = restore / files_cipher.name[:-4]
            subprocess.run([args.age, "-d", "-i", str(identity), "-o", str(database_dump), str(database_cipher)], check=True)
            subprocess.run([args.age, "-d", "-i", str(identity), "-o", str(files_tar), str(files_cipher)], check=True)

            extracted = restore / "extracted"
            extracted.mkdir()
            with tarfile.open(files_tar) as archive:
                members = archive.getmembers()
                assert all(member.isfile() for member in members)
                for member in members:
                    name = PurePosixPath(member.name)
                    assert not name.is_absolute() and ".." not in name.parts and name.parts
                    destination = extracted.joinpath(*name.parts)
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    with archive.extractfile(member) as source, destination.open("wb") as target:
                        target.write(source.read())
            manifest = json.loads((extracted / "manifest.json").read_text(encoding="utf-8"))
            assert {kind: details["file_count"] for kind, details in manifest["kinds"].items()} == {
                "application_documents": 1, "vault": 1, "company_files": 1, "logos": 1, "avatars": 2, "unclassified": 1
            }
            manifest_paths = {file["path"] for group in manifest["kinds"].values() for file in group["files"]}
            assert {"documents/records/application/nested/cv.pdf",
                    "documents/vault/nested/deep/transcript.pdf",
                    "documents/company/nested/verification.pdf",
                    "documents/logos/nested/company.png",
                    "documents/orphan/nested/unclassified.bin",
                    "avatars/nested/profile.jpg"} <= manifest_paths

            with database_dump.open("rb") as source:
                subprocess.run([*mysql, restored_db], stdin=source, check=True)
            restored_environment = dict(environment, ATTACHLINK_DB_NAME=restored_db)
            verifier = [args.php, "backend/jobs/verify-restore.php", str(extracted), str(database_dump)]
            verified = subprocess.run(verifier, cwd=ROOT, env=restored_environment, capture_output=True, text=True)
            assert verified.returncode == 0 and "Verified logos: 1 file(s)." in verified.stdout, verified

            damaged = extracted / "documents" / "records" / "application" / "nested" / "cv.pdf"
            original = damaged.read_bytes()
            damaged.write_bytes(b"changed")
            rejected_restore = subprocess.run(verifier, cwd=ROOT, env=restored_environment, capture_output=True, text=True)
            assert rejected_restore.returncode != 0 and "checksum failed" in rejected_restore.stderr, rejected_restore
            damaged.write_bytes(original)

            failed_environment = dict(environment, ATTACHLINK_AGE=str(backups / "missing-age.exe"))
            failed_backup = subprocess.run(command, cwd=ROOT, env=failed_environment, capture_output=True, text=True)
            assert failed_backup.returncode != 0
            assert {path.name for path in backups.iterdir()} == {pair.name, ".attachlink-backup.lock"}
            print("PASSED recursive paired backup, per-kind manifest, dump checksum, restored database/file verification, tamper detection and atomic failure cleanup.")
finally:
    for database in created:
        subprocess.run([*mysql, "-e", "DROP DATABASE " + database], check=True)
