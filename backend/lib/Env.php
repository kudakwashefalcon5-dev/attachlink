<?php
declare(strict_types=1);

final class ConfigException extends RuntimeException {}

function load_local_env(string $file): void {
    if (!file_exists($file)) return;
    $lines=@file($file,FILE_IGNORE_NEW_LINES);
    if ($lines===false) throw new ConfigException('backend/.env is unreadable.');
    $values=[];
    foreach ($lines as $index=>$line) {
        if ($index===0) $line=preg_replace('/^\xEF\xBB\xBF/','',$line);
        $line=trim($line);
        if ($line==='' || $line[0]==='#') continue;
        if (!preg_match('/\A(ATTACHLINK_[A-Z0-9_]+)\s*=(.*)\z/',$line,$parts)) {
            throw new ConfigException('backend/.env has an invalid assignment on line '.($index+1).'.');
        }
        [, $key, $raw]=$parts;
        $value=ltrim($raw);
        if (str_contains($value,"\0")) throw new ConfigException("$key contains an invalid character.");
        if (isset($value[0]) && ($value[0]==='"' || $value[0]==="'")) {
            if (!preg_match('/\A(["\x27])(.*?)\1(?:\s+#.*)?\z/',$value,$quoted)) {
                throw new ConfigException("$key has invalid quoting.");
            }
            $value=$quoted[2];
        } else {
            $value=trim(preg_replace('/\s+#.*\z/','',$raw));
        }
        $values[$key]=$value;
    }
    foreach ($values as $key=>$value) {
        if (getenv($key)===false && !putenv("$key=$value")) throw new ConfigException("$key could not be loaded.");
    }
}
