#!/usr/bin/env python3
"""Compare a clean AttachLink install and upgrade on a disposable MariaDB server."""
import argparse
import difflib
import os
from pathlib import Path
import re
import secrets
import subprocess

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--port", required=True, type=int)
parser.add_argument("--mysql", default="C:/xampp/mysql/bin/mysql.exe")
parser.add_argument("--dump", default="C:/xampp/mysql/bin/mysqldump.exe")
parser.add_argument("--php", default="C:/xampp/php/php.exe")
args = parser.parse_args()
if args.port == 3306:
    parser.error("Use an isolated MariaDB server on a non-default port.")

suffix = secrets.token_hex(4)
upgrade = "attachlink_qa_upgrade_" + suffix
fresh = "attachlink_qa_fresh_" + suffix
connection = ["--protocol=tcp", "-h127.0.0.1", "-P" + str(args.port), "-uroot"]
for schema in (upgrade, fresh):
    subprocess.run([args.mysql, *connection, "-e",
                    "CREATE DATABASE " + schema + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"], check=True)


def import_schema(schema, file):
    source = re.sub(rb"(?m)^(?:CREATE DATABASE|USE ).*\r?\n", b"", (ROOT / file).read_bytes())
    subprocess.run([args.mysql, *connection, schema], input=source, check=True)


import_schema(upgrade, "tests/fixtures/schema-baseline.sql")
subprocess.run([args.mysql, *connection, upgrade, "-e",
                "CREATE TABLE IF NOT EXISTS login_attempts(bucket CHAR(64) CHARACTER SET ascii PRIMARY KEY,"
                "window_id BIGINT UNSIGNED NOT NULL,attempts INT UNSIGNED NOT NULL);"
                "INSERT INTO login_attempts(bucket,window_id,attempts) VALUES"
                "(REPEAT('a',64),FLOOR(UNIX_TIMESTAMP()/86400),1),"
                "(REPEAT('b',64),FLOOR(UNIX_TIMESTAMP()/3600),1),"
                "(REPEAT('c',64),FLOOR(UNIX_TIMESTAMP()/900),1)"], check=True)
environment = {key: value for key, value in os.environ.items() if not key.startswith("ATTACHLINK_")}
environment.update(ATTACHLINK_ENV="development", ATTACHLINK_DB_HOST="127.0.0.1",
                   ATTACHLINK_DB_PORT=str(args.port), ATTACHLINK_DB_NAME=upgrade, ATTACHLINK_DB_USER="root",
                   ATTACHLINK_DB_PASS="")
migration = [args.php, "backend/jobs/migrate.php"]
subprocess.run(migration, env=environment, cwd=ROOT, check=True)
assert not subprocess.check_output(migration, env=environment, cwd=ROOT).strip(), "Migration rerun applied changes"
window_seconds = subprocess.check_output(
    [args.mysql, *connection, "-N", upgrade, "-e",
     "SELECT GROUP_CONCAT(window_seconds ORDER BY bucket) FROM login_attempts WHERE bucket IN (REPEAT('a',64),REPEAT('b',64),REPEAT('c',64))"],
    text=True).strip()
assert window_seconds == "86400,3600,900", window_seconds
import_schema(fresh, "database/schema.sql")


def ddl(schema):
    return subprocess.check_output([args.dump, *connection, "--no-data", "--compact",
                                    "--skip-add-drop-table", "--skip-dump-date", schema]).decode()


diff = list(difflib.unified_diff(ddl(upgrade).splitlines(), ddl(fresh).splitlines(), fromfile="upgrade", tofile="fresh"))
if diff:
    raise SystemExit("\n".join(diff))


def versions(schema):
    return subprocess.check_output([args.mysql, *connection, "-N", schema, "-e",
                                    "SELECT version FROM schema_migrations ORDER BY version"])


assert versions(upgrade) == versions(fresh)
print(f"Fresh and upgraded schema and migration versions match ({fresh}, {upgrade}).")
