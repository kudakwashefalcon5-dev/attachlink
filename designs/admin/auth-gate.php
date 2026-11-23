<?php
/** AttachLink portal page protection — compatible with the bundled XAMPP backend. */
declare(strict_types=1);
require_once __DIR__ . '/../../backend/bootstrap.php';
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Robots-Tag: noindex, nofollow');
$page = $_GET['page'] ?? '';
$allowed = ['attachees-directory', 'dashboard', 'messages', 'placements-registry', 'system-settings', 'verification-queue'];
if (!is_string($page) || !in_array($page, $allowed, true)) {
    http_response_code(404); exit('Page not found.');
}
$id = (int)($_SESSION['user_id'] ?? 0);
if (!$id) { header('Location: ../students/login.html?role=admin', true, 302); exit; }
$account = getrow('SELECT role, is_active, password_changed_at FROM users WHERE id = ?', [$id]);
if (!$account || $account['password_changed_at'] !== ($_SESSION['password_changed_at'] ?? null) || !(int)$account['is_active']) {
    unset($_SESSION['user_id']);
    header('Location: ../students/login.html?role=admin', true, 302); exit;
}
if ($account['role'] !== 'admin') {
    http_response_code(403); exit('Access denied: wrong portal.');
}
$file = __DIR__ . '/' . $page . '.html';
if (!is_file($file)) {http_response_code(404);exit('Page missing.');}
readfile($file);
