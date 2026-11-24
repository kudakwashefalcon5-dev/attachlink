<?php
declare(strict_types=1);
require_once __DIR__.'/../../bootstrap.php';
user('student');
method('GET','POST');

require_once __DIR__.'/../../lib/ChatProvider.php';
$provider = chat_provider_config();
$configured = $provider !== null;

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    out(['ok'=>true, 'configured'=>$configured, 'csrf_token'=>$configured ? csrf() : null]);
}

$input = body();
protect($input);
if (!$configured) fail('AI coaching is currently unavailable. Try a sample practice question.', 503);

$tracks = [
    'general'=>'general industrial attachment',
    'technical'=>'IT and networking',
    'software'=>'software development',
    'behavioural'=>'behavioural interview skills',
];
$track = $input['track'] ?? 'general';
if (!is_string($track) || !isset($tracks[$track])) fail('Invalid interview focus.', 422);
$message = required($input, 'message', 1400);
$history = $input['history'] ?? [];
if (!is_array($history) || !array_is_list($history) || count($history) > 8) {
    fail('Invalid interview conversation.', 422);
}

$instructions = "You are AttachLink's interview coach for students seeking industrial attachment in Zimbabwe. "
    ."The selected focus is {$tracks[$track]}. Ask one realistic, entry-level interview question at a time. "
    ."When a mock interview begins, open with a brief greeting and the first question. "
    ."When a student answers, mention one thing they did well and one concrete way to improve, then ask one natural follow-up question. "
    ."For requests for advice, give practical, concise guidance and use the STAR method where relevant. "
    ."Write like a friendly person chatting in short paragraphs. Use plain text without Markdown, headings, numbered questions or scorecards. "
    ."Keep the conversation focused on interview preparation and never request sensitive personal data.";
$messages = [['role'=>'system', 'content'=>$instructions]];
foreach ($history as $turn) {
    if (!is_array($turn) || !in_array($turn['role'] ?? null, ['user','assistant'], true)) {
        fail('Invalid interview conversation.', 422);
    }
    $messages[] = ['role'=>$turn['role'], 'content'=>required($turn, 'text', 1400)];
}
$messages[] = ['role'=>'user', 'content'=>$message];

$now = time();
$attempts = array_values(array_filter($_SESSION['interview_ai_attempts'] ?? [], static fn(int $time): bool => $time > $now - 60));
if (count($attempts) >= 6) {
    header('Retry-After: '.($attempts[0] + 60 - $now));
    fail('You have sent several messages. Wait a moment and try again.', 429);
}
$attempts[] = $now;
$_SESSION['interview_ai_attempts'] = $attempts;
session_write_close();

$result = request_chat_reply($provider, $messages, 800, 25);
if ($result['status'] !== 200) fail('The AI coach could not respond. Please try again.', 503);
if ($result['reply'] === null) fail('The AI coach returned no reply. Please try again.', 502);
out(['ok'=>true, 'reply'=>$result['reply']]);
