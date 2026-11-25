#!/usr/bin/env python3
"""Verify scheduled-job locks, migration step records, worker failures and heartbeats on disposable MariaDB."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--port", type=int, required=True)
parser.add_argument("--php", default="C:/xampp/php/php.exe")
parser.add_argument("--mysql", default="C:/xampp/mysql/bin/mysql.exe")
args = parser.parse_args()
if args.port == 3306:
    parser.error("Use an isolated MariaDB server on a non-default port.")

database = "attachlink_qa_jobs_" + secrets.token_hex(4)
mysql = [args.mysql, "--protocol=tcp", "-h127.0.0.1", "-P" + str(args.port), "-uroot"]
subprocess.run([*mysql, "-e", "CREATE DATABASE " + database + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"], check=True)
created = True


def query(statement):
    return subprocess.check_output([*mysql, "-N", database, "-e", statement], text=True).strip()


def php(script, environment, check=True):
    return subprocess.run([args.php, script], cwd=ROOT, env=environment, capture_output=True, text=True, check=check)


def owner_for_lock(lock_name, environment, work):
    source = """<?php
require_once %s;
$pdo=connect_database();
$lock=$pdo->prepare('SELECT GET_LOCK(?,0)');
$lock->execute([$argv[1]]);
if ((int)$lock->fetchColumn()!==1) exit(2);
echo "READY\\n";
fflush(STDOUT);
fgets(STDIN);
$release=$pdo->prepare('SELECT RELEASE_LOCK(?)');
$release->execute([$argv[1]]);
""" % json.dumps(str(ROOT / "backend/config.php"))
    script = work / "hold-lock.php"
    script.write_text(source, encoding="utf-8")
    process = subprocess.Popen([args.php, str(script), lock_name], cwd=ROOT, env=environment,
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               text=True, bufsize=1)
    if process.stdout.readline().strip() != "READY":
        process.kill()
        raise AssertionError("Could not acquire test advisory lock: " + process.stderr.read())
    return process


def assert_lock_refused(lock_name, job, environment, work, expected):
    owner = owner_for_lock(lock_name, environment, work)
    try:
        result = php(job, environment, check=False)
        assert result.returncode != 0 and expected in result.stderr, result
    finally:
        owner.stdin.write("\n")
        owner.stdin.flush()
        owner.wait(timeout=10)
        owner.stdin.close()
        owner.stdout.close()
        owner.stderr.close()


try:
    schema = re.sub(rb"(?m)^(?:CREATE DATABASE|USE ).*\r?\n", b"", (ROOT / "database/schema.sql").read_bytes())
    subprocess.run([*mysql, database], input=schema, check=True)
    with tempfile.TemporaryDirectory(prefix="attachlink-job-ops-") as temporary:
        work = Path(temporary)
        storage = work / "documents"
        storage.mkdir()
        environment = {key: value for key, value in os.environ.items() if not key.startswith("ATTACHLINK_")}
        environment.update(ATTACHLINK_ENV="development", ATTACHLINK_DB_HOST="127.0.0.1",
                           ATTACHLINK_DB_PORT=str(args.port), ATTACHLINK_DB_NAME=database,
                           ATTACHLINK_DB_USER="root", ATTACHLINK_DB_PASS="",
                           ATTACHLINK_DOCUMENT_STORAGE=str(storage),
                           ATTACHLINK_MAIL_LOG=str(work / "mail" / "mail.jsonl"))

        query("DELETE FROM schema_migrations WHERE version='upgrade-20'; DROP TABLE job_heartbeats")
        migration = php("backend/jobs/migrate.php", environment)
        assert migration.stdout.strip() == "Applied upgrade-20", migration
        assert query("SELECT version FROM schema_migrations WHERE version='upgrade-20'") == "upgrade-20"
        assert not php("backend/jobs/migrate.php", environment).stdout.strip()

        migration_lock = "attachlink-migrate:" + hashlib.sha256(database.encode()).hexdigest()[:40]
        assert_lock_refused(migration_lock, "backend/jobs/migrate.php", environment, work, "Another migration is running.")
        purge_lock = "attachlink-purge:" + hashlib.sha256(database.encode()).hexdigest()[:40]
        assert_lock_refused(purge_lock, "backend/jobs/purge-documents.php", environment, work, "Another document purge job is running.")

        purge = php("backend/jobs/purge-documents.php", environment)
        assert not purge.stderr, purge
        assert query("SELECT job_name FROM job_heartbeats WHERE job_name='purge-documents'") == "purge-documents"

        empty_worker = php("backend/jobs/send-emails.php", environment)
        assert json.loads(empty_worker.stdout.strip()) == {
            "event": "job_finished", "job": "send-emails", "processed": 0, "failures": 0, "status": "succeeded"
        }, empty_worker
        previous_heartbeat = query("SELECT last_successful_at FROM job_heartbeats WHERE job_name='send-emails'")
        query("INSERT INTO email_outbox(recipient,subject,body,next_attempt_at) VALUES('invalid-address','QA failure case','test',NOW())")
        failure_environment = dict(environment, ATTACHLINK_MAIL_TRANSPORT="smtp",
                                   ATTACHLINK_SMTP_HOST="localhost", ATTACHLINK_SMTP_EHLO="qa.example.invalid",
                                   ATTACHLINK_SMTP_TLS="implicit", ATTACHLINK_SMTP_PORT="1",
                                   ATTACHLINK_SMTP_FROM="qa@example.invalid")
        failed_worker = php("backend/jobs/send-emails.php", failure_environment, check=False)
        failure_summary = json.loads(failed_worker.stderr.strip().splitlines()[-1])
        assert failed_worker.returncode == 1 and failure_summary["failures"] == 1 and failure_summary["status"] == "failed", failed_worker
        assert query("SELECT last_successful_at FROM job_heartbeats WHERE job_name='send-emails'") == previous_heartbeat
        query("DELETE FROM email_outbox WHERE recipient='invalid-address'")

        status_script = "require 'backend/config.php'; require 'backend/lib/JobHeartbeat.php'; echo json_encode(job_heartbeat_status(connect_database()));"
        status_result = subprocess.run([args.php, "-r", status_script], cwd=ROOT, env=environment,
                                       capture_output=True, text=True, check=True)
        statuses = {job["job"]: job for job in json.loads(status_result.stdout)}
        assert statuses["send-emails"]["stale"] is False
        assert statuses["purge-documents"]["stale"] is False
        assert statuses["backup"]["stale"] is True
        print("PASSED migration step recording and locking, purge locking and heartbeat, email failure summary, and stale-job status.")
finally:
    if created:
        subprocess.run([*mysql, "-e", "DROP DATABASE " + database], check=True)
