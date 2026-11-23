<?php
declare(strict_types=1);
require_once __DIR__.'/backend/bootstrap.php';
header('Content-Type: text/html; charset=utf-8');
header('Referrer-Policy: no-referrer');
header('X-Robots-Tag: noindex, nofollow');
?>
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Manage your account | AttachLink</title><link rel="stylesheet" href="assets/account-actions.css"><script defer src="assets/account-actions.js"></script></head>
<body><main>
<p><a href="index.php">AttachLink</a></p>
<h1 id="account-heading">Reset your password</h1>
<form id="account-form" hidden>
    <label id="email-label">Email address <input name="email" type="email" maxlength="190" autocomplete="email" required></label>
    <label id="password-label" hidden>New password <input name="new_password" type="password" minlength="10" maxlength="72" autocomplete="new-password" disabled required></label>
    <button type="submit">Email me a reset link</button>
</form>
<p id="account-status" role="status"></p>
<p><a href="designs/students/login.html">Student sign in</a> · <a href="designs/employers/login.html">Employer sign in</a> · <a href="designs/admin/login.html">Admin sign in</a></p>
</main></body></html>
