#!/usr/bin/env python3
"""Build and verify the AttachLink runtime archive without staging a second tree."""
import argparse
from pathlib import Path, PurePosixPath
import re
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
URL_HOST = re.compile(r"(?i)(?:https?:)?//([a-z0-9.-]+)")
CDN_DOMAINS = {
    "cdn.tailwindcss.com", "fonts.googleapis.com", "fonts.gstatic.com", "googleusercontent.com",
    "jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com", "bootstrapcdn.com", "cloudfront.net", "akamaihd.net",
}


def references_cdn(text):
    for match in URL_HOST.finditer(text):
        host = match[1].lower().rstrip(".")
        if any(host == domain or host.endswith("." + domain) for domain in CDN_DOMAINS):
            return True
        if any(re.fullmatch(r"cdn[0-9]*", label) for label in host.split(".")):
            return True
    return False


REMOTE_ASSET = re.compile(r"""(?i)\b(?:src|srcset)\s*=\s*["'](?:https?:)?//|@import\s+(?:url\()?["']?(?:https?:)?//|url\(\s*["']?(?:https?:)?//|<link\b[^>]*href\s*=\s*["'](?:https?:)?//""")
RUNTIME_TEXT = {".html", ".php", ".js", ".css", ".svg"}
SCANNED_TEXT = RUNTIME_TEXT | {".md", ".txt", ".json", ".lock", ".sql", ".example"}


def rules(filename):
    return [line.strip().lstrip("/") for line in (SCRIPTS / filename).read_text().splitlines()
            if line.strip() and not line.lstrip().startswith("#")]


def excluded(name):
    lower = name.lower()
    parts = lower.split("/")
    return (
        any(lower.startswith(rule.lower()) if rule.endswith("/") else lower == rule.lower()
            for rule in rules("release-excludes.txt"))
        or any(part in {"tests", "test-results", "design-references", "backups", "release", ".git", "node_modules"}
               for part in parts)
        or any(part in {"debug.log", "dashboard1.html"} or "backup" in part and not lower == "backend/jobs/backup.php"
               for part in parts)
        or any(part.startswith(".env") and lower != "backend/.env.example" for part in parts)
    )


def verify(archive, expected):
    with ZipFile(archive) as package:
        names = package.namelist()
        if len(names) != len(set(names)) or set(names) != set(expected):
            raise ValueError("ZIP members differ from the release allowlist.")
        damaged = package.testzip()
        if damaged:
            raise ValueError("ZIP integrity check failed for " + damaged)
        for name in names:
            path = PurePosixPath(name)
            if path.is_absolute() or ".." in path.parts or "\\" in name or excluded(name):
                raise ValueError("Forbidden ZIP member " + name)
            if path.suffix.lower() in SCANNED_TEXT:
                source = package.read(name).decode("utf-8", errors="replace")
                if references_cdn(source) or (path.suffix.lower() in RUNTIME_TEXT and not name.startswith("vendor/") and REMOTE_ASSET.search(source)):
                    raise ValueError("External CDN or remote asset reference in " + name)
    print(f"Verified {len(expected)} allowlisted ZIP files and checked for external CDN references.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default=str(ROOT / "dist/attachlink.zip"))
    parser.add_argument("--verify", metavar="ZIP", help="Verify an existing ZIP")
    args = parser.parse_args()
    allow = rules("release-allowlist.txt")
    paths = {item.relative_to(ROOT).as_posix(): item for glob in allow for item in ROOT.glob(glob)
             if item.is_file() and not item.is_symlink()}
    missing = [rule for rule in allow if "*" not in rule and rule not in paths]
    if missing:
        raise ValueError("Required release inputs are missing: " + ", ".join(missing))
    paths = {name: path for name, path in paths.items() if not excluded(name)}
    if args.verify:
        verify(args.verify, paths)
        return
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(prefix=".attachlink-", suffix=".zip", dir=output.parent, delete=False) as pending:
        staging = Path(pending.name)
    try:
        with ZipFile(staging, "w", compression=ZIP_DEFLATED, compresslevel=9) as package:
            for name, path in sorted(paths.items()):
                package.write(path, name)
        verify(staging, paths)
        staging.replace(output)
        print(output)
    finally:
        staging.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        raise SystemExit(str(error))
