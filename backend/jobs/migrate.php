<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }

try {
    require_once __DIR__.'/../config.php';
    require_once __DIR__.'/../lib/Migrations.php';
    if ($issue=app_environment_issue()) throw new ConfigException($issue);
    $pdo=connect_database();
    $lock=$pdo->prepare('SELECT GET_LOCK(?,10)');
    $lock->execute(['attachlink-migrate:'.substr(hash('sha256',DB_NAME),0,40)]);
    if ((int)$lock->fetchColumn()!==1) throw new RuntimeException('Another migration is running.');
    $lock->closeCursor();
    $pdo->exec("CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(32) CHARACTER SET ascii PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
    $record=$pdo->prepare('INSERT INTO schema_migrations(version) VALUES(?)');
    if (!(int)$pdo->query('SELECT COUNT(*) FROM schema_migrations')->fetchColumn()) {
        foreach (detect_unversioned_migrations($pdo) as $version) {
            $record->execute([$version]);
            echo "Detected $version\n";
        }
    }
    foreach (pending_migrations($pdo) as $version=>$file) {
        $sql=file_get_contents($file);
        if ($sql===false) throw new RuntimeException('Cannot read '.$version.'.');
        // Older upgrades assume the default database in manual imports.
        $sql=preg_replace('/^USE `attachlink_db`;\s*$/mi','',$sql);
        // Execute the trusted multi-statement file without emulating parameterized queries.
        $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES,true);
        $result=$pdo->query($sql);
        while ($result->nextRowset()) {}
        $result->closeCursor();
        $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES,false);
        $record->execute([$version]);
        echo "Applied $version\n";
    }
} catch (Throwable $error) {
    fwrite(STDERR,($error instanceof ConfigException?$error->getMessage():'Migration failed'.(isset($version)?" at $version":'').'. Check the database and migration permissions.')."\n");
    exit(1);
}
