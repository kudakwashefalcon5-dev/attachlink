<?php
declare(strict_types=1);

const REQUIRED_APPLICATION_DOCUMENTS = [
    'national_id' => ['id', 'a certified copy of your national ID'],
    'academic_certificates' => ['academic_certificates', 'your academic certificates'],
    'stamped_letter' => ['attachment_letter', 'your attachment letter'],
    'birth_certificate' => ['birth_certificate', 'your birth certificate'],
    'transcript' => ['transcript', 'your academic transcripts'],
];

function copy_vault_document(string $name): string {
    if (!preg_match('/\A[a-f0-9]{48}\.(pdf|jpg|png)\z/',$name)) throw new RuntimeException('Invalid stored document.');
    $storage=application_storage();
    $source=$storage.'/'.$name;
    if (!is_file($source) || is_link($source)) throw new RuntimeException('Vault file unavailable.');
    $copy=bin2hex(random_bytes(24)).'.'.pathinfo($name,PATHINFO_EXTENSION);
    if (!copy($source,$storage.'/'.$copy)) {
        @unlink($storage.'/'.$copy);
        throw new RuntimeException('Could not attach vault file.');
    }
    return $copy;
}
