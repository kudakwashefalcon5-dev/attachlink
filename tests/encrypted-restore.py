#!/usr/bin/env python3
"""Encrypt, decrypt and restore a disposable AttachLink database and fixture files."""
import argparse
import hashlib
import os
from pathlib import Path
import secrets
import subprocess
import tarfile
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--age", required=True)
parser.add_argument("--age-keygen", required=True)
parser.add_argument("--port", type=int, required=True)
parser.add_argument("--db", required=True)
parser.add_argument("--php", default="C:/xampp/php/php.exe")
parser.add_argument("--mysql", default="C:/xampp/mysql/bin/mysql.exe")
parser.add_argument("--dump", default="C:/xampp/mysql/bin/mysqldump.exe")
parser.add_argument("--documents", required=True)
args = parser.parse_args()
if args.port == 3306 or not args.db.startswith(("attachlink_qa_", "attachlink_phase1")):
    parser.error("Use an isolated QA database on a non-default port.")
mysql = [args.mysql, "--protocol=tcp", "-h127.0.0.1", "-P"+str(args.port), "-uroot", "-N"]
restored = "attachlink_qa_age_restore_" + secrets.token_hex(4)

with tempfile.TemporaryDirectory(prefix="attachlink-age-backup-") as work:
    with tempfile.TemporaryDirectory(prefix="attachlink-age-restore-") as recovery:
        backup, restore = Path(work), Path(recovery)
        identity = restore / "test-identity"
        wrong_identity = restore / "wrong-identity"
        for key in (identity, wrong_identity):
            subprocess.run([args.age_keygen, "-o", str(key)], check=True, capture_output=True)
        recipient = subprocess.check_output([args.age_keygen, "-y", str(identity)], text=True).strip()
        environment = {k:v for k,v in os.environ.items() if not k.upper().startswith("ATTACHLINK_")}
        environment.update(ATTACHLINK_ENV="development", ATTACHLINK_DB_PORT=str(args.port),
                           ATTACHLINK_DB_NAME=args.db, ATTACHLINK_DOCUMENT_STORAGE=args.documents,
                           ATTACHLINK_BACKUP_DIR=work, ATTACHLINK_MYSQLDUMP=args.dump,
                           ATTACHLINK_AGE=args.age, ATTACHLINK_BACKUP_RECIPIENT=recipient)
        command = [args.php, "backend/jobs/backup.php"]
        subprocess.run([*command, "all"], env=environment, check=True)
        encrypted = sorted(backup.glob("*.age"))
        assert len(encrypted) == 2 and all(p.read_bytes().startswith(b"age-encryption.org/v1") for p in encrypted)
        assert set(backup.iterdir()) == {*encrypted, backup/".attachlink-backup.lock"}
        for ciphertext in encrypted:
            rejected = subprocess.run([args.age, "-d", "-i", str(wrong_identity), str(ciphertext)],
                                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            assert rejected.returncode != 0
            plaintext = restore / ciphertext.stem
            subprocess.run([args.age, "-d", "-i", str(identity), "-o", str(plaintext), str(ciphertext)], check=True)

        subprocess.run([*mysql, "-e", "CREATE DATABASE "+restored+" CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"], check=True)
        with next(restore.glob("*.sql")).open("rb") as source:
            subprocess.run([*mysql, restored], stdin=source, check=True)
        query = "SELECT COUNT(*) FROM application_documents"
        rows = int(subprocess.check_output([*mysql, restored, "-e", query]))
        assert rows and int(subprocess.check_output([*mysql, args.db, "-e", query])) == rows

        with tarfile.open(next(restore.glob("*.tar"))) as archive:
            members = [item for item in archive.getmembers() if item.name.startswith("documents/")]
            assert members
            for member in members:
                assert member.isfile()
                original = Path(args.documents) / Path(member.name).name
                assert hashlib.sha256(archive.extractfile(member).read()).digest() == hashlib.sha256(original.read_bytes()).digest()

        invalid = {**environment, "ATTACHLINK_AGE": str(backup / "no-age.exe")}
        failed = subprocess.run([*command, "documents"], env=invalid, capture_output=True)
        assert failed.returncode != 0 and set(backup.iterdir()) == {*encrypted, backup/".attachlink-backup.lock"}
        print(f"PASSED age encryption, wrong-key rejection, failure cleanup, and decrypted restore of {rows} document rows and {len(members)} files.")
