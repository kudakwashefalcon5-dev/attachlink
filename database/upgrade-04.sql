SET @add_reason = IF(
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='company_verification_decisions' AND column_name='reason'),
    'SELECT 1',
    'ALTER TABLE company_verification_decisions ADD COLUMN reason TEXT NULL'
);
PREPARE attachlink_migration FROM @add_reason;
EXECUTE attachlink_migration;
DEALLOCATE PREPARE attachlink_migration;
SET @add_reason = NULL;
