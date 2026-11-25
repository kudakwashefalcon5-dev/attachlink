<?php
declare(strict_types=1);

function backup_normalize_relative_path(string $path): string {
    $path=str_replace('\\','/',$path);
    if ($path==='' || str_starts_with($path,'/') || str_contains($path,':') || preg_match('/[\x00-\x1f\x7f]/',$path)) {
        throw new RuntimeException('Backup contains an invalid relative path.');
    }
    foreach (explode('/',$path) as $part) {
        if ($part==='' || $part==='.' || $part==='..') throw new RuntimeException('Backup contains an invalid relative path.');
    }
    return $path;
}

function backup_manifest_kind(array $files): array {
    $cleanFiles=[];
    foreach ($files as $file) {
        if (!is_array($file)) throw new RuntimeException('Backup manifest contains an invalid file record.');
        $path=backup_normalize_relative_path((string)($file['path']??''));
        $size=$file['size']??null;
        $checksum=$file['sha256']??null;
        if (!is_int($size) || $size<0 || !is_string($checksum) || !preg_match('/\A[a-f0-9]{64}\z/',$checksum)) {
            throw new RuntimeException('Backup manifest contains an invalid file record.');
        }
        $cleanFiles[]=['path'=>$path,'size'=>$size,'sha256'=>$checksum];
    }
    usort($cleanFiles,static fn(array $left,array $right): int=>strcmp($left['path'],$right['path']));
    $seen=[];
    $canonical=[];
    foreach ($cleanFiles as $file) {
        $path=$file['path'];
        $size=$file['size'];
        $checksum=$file['sha256'];
        if (isset($seen[$path])) throw new RuntimeException('Backup manifest contains a duplicate file record.');
        $seen[$path]=true;
        $canonical[]=$path."\0".$size."\0".$checksum;
    }
    return [
        'file_count'=>count($cleanFiles),
        'sha256'=>hash('sha256',implode("\n",$canonical)),
        'files'=>$cleanFiles,
    ];
}
