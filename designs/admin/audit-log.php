<?php
declare(strict_types=1);
require_once __DIR__.'/../../backend/bootstrap.php';
user('admin');
header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Audit log | AttachLink</title><link rel="stylesheet" href="../../assets/account-actions.css"><script defer src="audit-log.js?v=2"></script></head>
<body><main><p><a href="system-settings.html">System settings</a></p><h1>Admin audit log</h1>
<form id="verify-user-email">
<label>Account ID <input name="user_id" type="number" min="1" required></label>
<button name="action" value="verify-user-email">Mark email verified</button> <button name="action" value="clear-reset-quota">Clear daily reset quota</button><p role="status"></p>
</form>
<section aria-labelledby="admin-accounts-heading"><h2 id="admin-accounts-heading">Manage administrators</h2>
<form id="admin-create">
<label>First name <input name="first_name" autocomplete="off" required maxlength="100"></label>
<label>Last name <input name="last_name" autocomplete="off" required maxlength="100"></label>
<label>Email <input type="email" name="email" autocomplete="off" required maxlength="190"></label>
<label>Temporary password <input type="password" name="password" autocomplete="new-password" required minlength="12" maxlength="72"></label>
<button>Create administrator</button><p role="status"></p></form>
<form id="admin-deactivate"><label>Administrator ID <input type="number" name="user_id" min="1" required></label><button>Deactivate administrator</button><p role="status"></p></form></section>
<section aria-labelledby="retention-heading"><h2 id="retention-heading">Data retention report</h2><dl id="retention-report"></dl><p id="retention-status" role="status"></p></section>
<form id="audit-filter">
<label>Action <select name="action"><option value="">All actions</option><option>document.download</option><option>retention.view</option><option>company.verification</option><option>user.status</option><option>user.email_verified</option><option>user.reset_quota_cleared</option><option>admin.create</option><option>admin.deactivate</option><option>placement.create</option><option>placement.update</option><option>settings.update</option><option>settings.entry.create</option><option>settings.entry.update</option></select></label>
<label>Actor ID <input name="admin_id" type="number" min="1"></label>
<label>Target ID <input name="target_id" type="number" min="1"></label>
<button>Apply filters</button>
</form><p id="audit-status" role="status"></p><ol id="audit-events"></ol><button id="audit-more" type="button" hidden>Load older events</button></main></body></html>
