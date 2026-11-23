#!/usr/bin/env python3
"""Exercise Phase 3 account operations against the isolated XAMPP QA fixture."""
import argparse
import hashlib
from http.cookiejar import CookieJar
import json
import os
from pathlib import Path
import random
import subprocess
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--url", default="http://127.0.0.1:18745")
parser.add_argument("--port", required=True, type=int)
parser.add_argument("--db", required=True)
parser.add_argument("--mysql", default="C:/xampp/mysql/bin/mysql.exe")
args = parser.parse_args()
if args.port == 3306 or not args.db.startswith(("attachlink_qa", "attachlink_phase1")):
    parser.error("Use an isolated QA database.")
root = args.url.rstrip("/") + "/backend/api/"
password = "Isolated pilot fixture pass 11"
suffix = random.randrange(100000, 999999)


def client():
    return build_opener(HTTPCookieProcessor(CookieJar()))


def call(session, route, code=200, data=None):
    headers = {}
    if isinstance(data, dict):
        headers["Content-Type"] = "application/json"
        data = json.dumps({**data, "csrf_token":call(session, "auth/csrf.php")["csrf_token"]}).encode()
    if isinstance(data, tuple):
        data, boundary = data
        headers["Content-Type"] = "multipart/form-data; boundary=" + boundary
    try:
        response = session.open(Request(root + route, data=data, headers=headers), timeout=20)
    except HTTPError as error:
        response = error
    with response:
        content = response.read()
        assert response.code == code, (route, response.code, content if response.code >= 400 else "")
        return json.loads(content) if response.headers.get_content_type() == "application/json" else content


def sql(query):
    return subprocess.check_output([args.mysql, "--protocol=tcp", "-h127.0.0.1", "-P"+str(args.port),
                                    "-uroot", "-N", args.db, "-e", query], text=True).strip()


def register(session, role, phone):
    account = {"role": role, "email": f"phase3-{role}-{suffix}@example.invalid", "password": password,
               "first_name": "Release", "last_name": "Test", "phone": phone+str(suffix),
               "company_name": f"Release Company {suffix}"}
    call(session, "auth/register.php", 422, account)
    registered = call(session, "auth/register.php", 201, {**account, "consent": True,
                                                          "consent_version": "pilot-2026-11"})
    call(session, "auth/login.php", data={key:account[key] for key in ("email", "role", "password")})
    return registered["user_id"], account["email"]


student, employer, admin, other_admin = (client() for _ in range(4))
student_id, student_email = register(student, "student", "0739")
employer_id, _ = register(employer, "employer", "0789")
assert sql(f"SELECT CONCAT(consent_version,':',consent_at IS NOT NULL) FROM users WHERE id={int(student_id)}") == "pilot-2026-11:1"
admin_id = call(admin, "auth/login.php", data={"role":"admin","email":"qa-admin@example.invalid",
                                              "password":os.environ["ATTACHLINK_QA_ADMIN_PASSWORD"]})["user"]["id"]
call(student, "admin/retention.php", 403)
assert "pending_file_removals" in call(admin, "admin/retention.php")["status"]
for identity in (student_id, employer_id):
    call(admin, "admin/verify-user-email.php", data={"user_id":identity})
company_id=call(employer, "employer/company.php")["company"]["id"]
call(admin, "admin/companies.php", data={"company_id":company_id,"status":"verified"})
opening_id=call(employer, "employer/openings.php", data={"title":"QA deletion opening "+str(suffix),
                                                      "description":"Disposable fixture","status":"published"})["id"]

boundary="attachlink-phase3-fixture"
fields={"csrf_token":call(student,"auth/csrf.php")["csrf_token"],"listing_id":str(opening_id)}
parts=[f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode()
       for key,value in fields.items()]
parts.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"; filename="fixture.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4\n%%EOF\n\r\n'.encode()
             for key in ("stamped_letter","academic_certificates","national_id","transcript","birth_certificate"))
parts.append(f"--{boundary}--\r\n".encode())
application_id=call(student,"student/apply-with-documents.php",201,(b"".join(parts),boundary))["application_id"]
files=sql(f"SELECT stored_name FROM application_documents WHERE application_id={int(application_id)}").splitlines()
storage=Path(os.environ["ATTACHLINK_DOCUMENT_STORAGE"])
assert len(files)==5 and all((storage/file).is_file() for file in files)
call(student,"student/withdraw-application.php",data={"application_id":application_id})
print("PASSED consent enforced and recorded; five documents exist before account deletion.")

bucket=hashlib.sha256(("forgot-global:"+student_email).encode()).hexdigest()
sql(f"INSERT INTO login_attempts(bucket,window_id,attempts) VALUES('{bucket}',FLOOR(UNIX_TIMESTAMP()/86400),10)")
before=call(client(),"auth/forgot-password.php",data={"email":student_email})
assert sql(f"SELECT COUNT(*) FROM password_resets WHERE user_id={int(student_id)}")=="0"
call(student,"admin/clear-reset-quota.php",403,{"user_id":student_id})
call(admin,"admin/clear-reset-quota.php",data={"user_id":student_id})
assert call(client(),"auth/forgot-password.php",data={"email":student_email})==before
assert sql(f"SELECT COUNT(*) FROM password_resets WHERE user_id={int(student_id)}")=="1"
assert call(admin,"admin/audit-log.php?action=user.reset_quota_cleared")["events"]
print("PASSED daily reset throttle, admin clearing, generic response and audit.")

admin_email=f"phase3-admin-{suffix}@example.invalid"
created=call(admin,"admin/admin-accounts.php",201,{"action":"create","first_name":"New","last_name":"Admin",
                                                 "email":admin_email,"password":password})["user_id"]
call(other_admin,"auth/login.php",data={"role":"admin","email":admin_email,"password":password})
call(admin,"admin/admin-accounts.php",409,{"action":"deactivate","user_id":admin_id})
call(admin,"admin/admin-accounts.php",data={"action":"deactivate","user_id":created})
call(other_admin,"auth/me.php",401)
assert call(admin,"admin/audit-log.php?action=admin.create")["events"]
assert call(admin,"admin/audit-log.php?action=admin.deactivate")["events"]
print("PASSED administrator creation, deactivation, session revocation and audit.")

call(student,"student/delete-account.php",403,{"confirm":True,"current_password":"incorrect"})
call(student,"student/delete-account.php",data={"confirm":True,"current_password":password})
call(student,"auth/me.php",401)
assert sql(f"SELECT COUNT(*) FROM users WHERE id={int(student_id)}")=="0"
assert sql(f"SELECT COUNT(*) FROM applications WHERE id={int(application_id)}")=="0"
assert all(not (storage/file).exists() for file in files)
print("PASSED account deletion removed the application, status history, files and session.")
