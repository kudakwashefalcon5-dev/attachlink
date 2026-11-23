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
environment = {key: value for key, value in os.environ.items() if not key.startswith("ATTACHLINK_")}
environment.update(ATTACHLINK_ENV="development", ATTACHLINK_DB_HOST="127.0.0.1",
                   ATTACHLINK_DB_PORT=str(args.port), ATTACHLINK_DB_NAME=upgrade, ATTACHLINK_DB_USER="root",
                   ATTACHLINK_DB_PASS="")
migration = [args.php, "backend/jobs/migrate.php"]
subprocess.run(migration, env=environment, cwd=ROOT, check=True)
assert not subprocess.check_output(migration, env=environment, cwd=ROOT).strip(), "Migration rerun applied changes"
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
