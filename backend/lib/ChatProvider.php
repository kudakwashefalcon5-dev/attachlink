<?php
declare(strict_types=1);

function chat_provider_config(): ?array {
    $endpoint = trim(config_env('ATTACHLINK_INTERVIEW_AI_URL'));
    $model = trim(config_env('ATTACHLINK_INTERVIEW_AI_MODEL'));
    $key = trim(config_env('ATTACHLINK_INTERVIEW_AI_KEY'));
    $hasCurl = function_exists('curl_init');
    $hasHttpsStream = (bool)ini_get('allow_url_fopen') && in_array('https', stream_get_wrappers(), true);
    $configured = ($hasCurl || $hasHttpsStream) && $model !== '' && $key !== ''
        && $key !== 'replace_with_your_real_key'
        && !preg_match('/[\r\n]/', $key)
        && filter_var($endpoint, FILTER_VALIDATE_URL)
        && parse_url($endpoint, PHP_URL_SCHEME) === 'https';
    return $configured ? compact('endpoint', 'model', 'key', 'hasCurl') : null;
}

function chat_cache_memory_bytes(): int {
    if (!function_exists('apcu_enabled') || !apcu_enabled()) return 0;
    $memory=apcu_sma_info(true);
    return is_array($memory)?(int)($memory['num_seg']*$memory['seg_size']):0;
}

function request_chat_reply(array $provider, array $messages, int $maxTokens, int $timeout, ?float $temperature = null, bool $cache = true): array {
    ['endpoint'=>$endpoint, 'model'=>$model, 'key'=>$key, 'hasCurl'=>$hasCurl] = $provider;
    $payload = ['model'=>$model, 'messages'=>$messages];
    if ($temperature !== null) $payload['temperature'] = $temperature;
    if (strtolower((string)parse_url($endpoint, PHP_URL_HOST)) === 'api.deepseek.com') {
        $payload['max_tokens'] = $maxTokens;
        $payload['thinking'] = ['type'=>'disabled'];
    } else {
        $payload['max_completion_tokens'] = $maxTokens;
    }

    $headers = ['Authorization: Bearer '.$key, 'Content-Type: application/json'];
    $json = json_encode($payload, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);
    $cacheKey=null;
    if ($cache && session_id()!=='') {
        $bytes=chat_cache_memory_bytes();
        if ($bytes>0 && $bytes<=10*1024*1024) {
            $cacheKey='attachlink-ai-v1:'.hash_hmac('sha256',__DIR__."\0".session_id()."\0".$endpoint."\0".$json,$key);
            $cached=apcu_fetch($cacheKey);
            if (is_string($cached)) return ['status'=>200,'reply'=>$cached];
        }
    }
    if ($hasCurl) {
        $request = curl_init($endpoint);
        curl_setopt_array($request, [
            CURLOPT_POST=>true,
            CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,
            CURLOPT_CONNECTTIMEOUT=>5,
            CURLOPT_TIMEOUT=>$timeout,
            CURLOPT_RETURNTRANSFER=>true,
            CURLOPT_HTTPHEADER=>$headers,
            CURLOPT_POSTFIELDS=>$json,
        ]);
        $response = curl_exec($request);
        $status = curl_getinfo($request, CURLINFO_HTTP_CODE);
        $transport = 'cURL '.curl_errno($request);
    } else {
        $context = stream_context_create(['http'=>[
            'method'=>'POST',
            'header'=>$headers,
            'content'=>$json,
            'timeout'=>$timeout,
            'follow_location'=>0,
            'ignore_errors'=>true,
        ], 'ssl'=>['verify_peer'=>true, 'verify_peer_name'=>true]]);
        $response = @file_get_contents($endpoint, false, $context);
        $responseHeaders = function_exists('http_get_last_response_headers')
            ? http_get_last_response_headers() : ($http_response_header ?? []);
        preg_match('/^HTTP\/\S+ (\d{3})\b/', $responseHeaders[0] ?? '', $matches);
        $status = (int)($matches[1] ?? 0);
        $transport = 'HTTPS stream';
    }
    if ($response === false || $status !== 200) {
        error_log("AttachLink chat provider failed (HTTP $status, $transport).");
        return ['status'=>$status, 'reply'=>null];
    }

    $result = json_decode($response, true);
    $content = $result['choices'][0]['message']['content'] ?? null;
    if ($cacheKey!==null && is_string($content) && trim($content)!=='' && strlen($content)<=8192) {
        apcu_add($cacheKey,trim($content),300);
    }
    $reply = $content ?? $result['choices'][0]['message']['refusal'] ?? null;
    return ['status'=>$status, 'reply'=>is_string($reply) && trim($reply) !== '' ? trim($reply) : null];
}
