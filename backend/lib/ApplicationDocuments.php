<?php
declare(strict_types=1);

const REQUIRED_APPLICATION_DOCUMENTS = [
    'cv' => ['cv', 'CV', 'Upload your current CV. You can download one from Career Tools → CV Builder.'],
    'stamped_letter' => ['attachment_letter', 'School attachment letter', 'Upload the official attachment letter issued by your school or training institution.'],
    'national_id' => ['id', 'Certified copy of national ID', 'Upload a clear scan or photo of your certified national ID copy.'],
    'academic_certificates' => ['academic_certificates', 'Academic certificates', 'Upload at least one certificate. You can save up to four files.'],
    'transcript' => ['transcript', 'Academic transcripts', 'Combine multiple transcript pages into one PDF.'],
    'birth_certificate' => ['birth_certificate', 'Birth certificate', 'Upload a clear scan or photo of your birth certificate.'],
];
const MAX_ACADEMIC_CERTIFICATES = 4;

function copy_vault_document(string $name): string {
    if (!preg_match('/\A[a-f0-9]{48}\.(pdf|jpg|png|docx?)\z/',$name)) throw new RuntimeException('Invalid stored document.');
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
