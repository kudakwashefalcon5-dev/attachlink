-- Preserve existing application document types and add the new required types.
ALTER TABLE application_documents
    MODIFY document_type ENUM('attachment_letter','cv','id','transcript','o_level','a_level','other_certificate','academic_certificates','birth_certificate') NOT NULL;
