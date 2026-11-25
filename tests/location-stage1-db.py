"""Verify Stage 1 against fresh and upgraded disposable schemas on local MariaDB."""
import os
from pathlib import Path
import re
import secrets
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
MYSQL = os.environ.get("ATTACHLINK_TEST_MYSQL", "C:/xampp/mysql/bin/mysql.exe")
PHP = os.environ.get("ATTACHLINK_TEST_PHP", "C:/xampp/php/php.exe")
CONNECTION = ["--protocol=tcp", "-h127.0.0.1", "-uroot"]
SUFFIX = secrets.token_hex(5)
UPGRADED, FRESH = ("attachlink_qa_location_" + kind + "_" + SUFFIX for kind in ("upgrade", "fresh"))


def sql(value, schema=None):
    return subprocess.check_output(
        [MYSQL, *CONNECTION, "-N", *((schema,) if schema else ())],
        input=value.encode() if isinstance(value, str) else value, cwd=ROOT).decode().strip()


def import_schema(source, name):
    sql(re.sub(rb"(?m)^(?:CREATE DATABASE|USE ).*\r?\n", b"", source), name)


schema = (ROOT / "database/schema.sql").read_bytes()
for table in ("users", "student_profiles"):
    definition = re.search(rb"CREATE TABLE `" + table.encode() + rb"` \(.*?\n\)", schema, re.S)[0]
    assert not re.search(rb"\b(?:latitude|longitude|gps|coordinates?)\b", definition, re.I), table
student_input = re.compile(r"""\[['"](?:latitude|longitude|lat|lng|coordinates|gps)['"]\]""", re.I)
for file in (ROOT / "backend/api/student").glob("*.php"):
    assert not student_input.search(file.read_text(encoding="utf-8")), file.name
print("PASSED student schema and student API coordinate scan.")

created = []
try:
    for name in (UPGRADED, FRESH):
        sql("CREATE DATABASE " + name + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        created.append(name)
    baseline = subprocess.check_output(["git", "show", "670618e:database/schema.sql"], cwd=ROOT)
    import_schema(baseline, UPGRADED)
    sql("INSERT INTO companies(name,city,description) VALUES ('Legacy company','Existing address','Original description')", UPGRADED)
    import_schema(schema, FRESH)
    with tempfile.TemporaryDirectory(prefix="attachlink-location-") as temporary:
        env = dict(os.environ, ATTACHLINK_ENV="development", ATTACHLINK_DB_NAME=UPGRADED,
                   ATTACHLINK_DB_HOST="127.0.0.1", ATTACHLINK_DB_PORT="3306", ATTACHLINK_DB_USER="root",
                   ATTACHLINK_DB_PASS="", ATTACHLINK_DOCUMENT_STORAGE=temporary)
        def cli(path):
            return subprocess.run([PHP,path],cwd=ROOT,env=env,capture_output=True,text=True)
        assert "Pending: upgrade-19, upgrade-20" in cli("backend/check-config.php").stdout
        migration = cli("backend/jobs/migrate.php")
        assert migration.returncode == 0 and migration.stdout.strip().splitlines() == ["Applied upgrade-19", "Applied upgrade-20"], migration
        assert cli("backend/jobs/migrate.php").stdout.strip() == ""
        assert "OK Database migrations" in cli("backend/check-config.php").stdout
    sql((ROOT / "database/upgrade-19.sql").read_bytes(), UPGRADED)
    assert sql("SELECT city,description,town_id FROM companies WHERE name='Legacy company'", UPGRADED) == "Existing address\tOriginal description\tNULL"
    for table in ("provinces","towns","companies","company_location_proposals","openings"):
        definition = lambda name: re.sub(r" AUTO_INCREMENT=\d+", "", sql("SHOW CREATE TABLE "+table,name))
        assert definition(UPGRADED) == definition(FRESH), table
    assert sql("SELECT COUNT(*) FROM provinces", UPGRADED) == "10"
    assert int(sql("SELECT COUNT(*) FROM towns", UPGRADED)) >= 40
    print("PASSED upgrade-18 to 20, repeat migration, fresh schema parity, legacy data, town seed and check-config.")
finally:
    for name in created:
        sql("DROP DATABASE "+name)
