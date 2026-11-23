#!/usr/bin/env python3
"""Send 100 simultaneous login requests to a pool of local PHP QA listeners."""
from concurrent.futures import ThreadPoolExecutor
import argparse
import json
import os
import statistics
from threading import Barrier
from time import perf_counter
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPCookieProcessor

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--require-fpm", action="store_true", help="Confirm Apache and PHP-FPM before recording timings")
parser.add_argument("listeners", nargs="+")
arguments = parser.parse_args()
bases = [url.rstrip("/") for url in arguments.listeners]
urls = [base + "/backend/api/auth/" for base in bases]
if any((parsed := urlsplit(base)).scheme != "http" or parsed.hostname != "127.0.0.1"
       or parsed.username is not None or parsed.password is not None or parsed.query or parsed.fragment
       for base in bases):
    raise SystemExit("Supply disposable loopback QA listener URLs.")
if arguments.require_fpm:
    for base in bases:
        with build_opener().open(base + "/tests/sapi.php", timeout=15) as response:
            if "apache" not in response.headers.get("Server", "").lower() or json.load(response)["sapi"] != "fpm-fcgi":
                raise SystemExit("Benchmark refused: the listener did not report Apache and PHP-FPM.")
    print("Verified Apache and PHP-FPM on every listener.", flush=True)
secret = os.environ["ATTACHLINK_QA_LOGIN_PASSWORD"]
email = os.environ["ATTACHLINK_QA_LOGIN_EMAIL"]
barrier = Barrier(100)


def login(index):
    base = urls[index % len(urls)]
    client = build_opener(HTTPCookieProcessor())
    try:
        with client.open(base + "csrf.php", timeout=150) as response:
            csrf_token = json.load(response)["csrf_token"]
    except Exception:
        barrier.abort()
        raise
    data = json.dumps({"role": "student", "email": email, "password": secret, "csrf_token": csrf_token}).encode()
    barrier.wait(timeout=150)
    started = perf_counter()
    with client.open(Request(base + "login.php", data=data, headers={"Content-Type": "application/json"}), timeout=180) as response:
        assert response.status == 200 and json.load(response)["ok"]
    return (perf_counter() - started) * 1000


with ThreadPoolExecutor(max_workers=100) as pool:
    results = sorted(pool.map(login, range(100)))
print(f"100/100 successful from one IP. Median {statistics.median(results):.1f} ms, p95 {results[94]:.1f} ms.")
