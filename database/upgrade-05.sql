SET @opening_stipend = IF(
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='openings' AND column_name='stipend_usd'),
    'SELECT 1',
    'ALTER TABLE openings ADD COLUMN stipend_usd DECIMAL(10,2) NULL'
);
PREPARE attachlink_migration FROM @opening_stipend;
EXECUTE attachlink_migration;
DEALLOCATE PREPARE attachlink_migration;
SET @opening_stipend = NULL;

SET @opening_status = IF(
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='openings' AND column_name='status' AND column_type LIKE '%archived%'),
    'SELECT 1',
    'ALTER TABLE openings MODIFY status ENUM(''draft'',''published'',''closed'',''archived'') NOT NULL DEFAULT ''draft'''
);
PREPARE attachlink_migration FROM @opening_status;
EXECUTE attachlink_migration;
DEALLOCATE PREPARE attachlink_migration;
SET @opening_status = NULL;
