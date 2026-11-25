<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }

$lockName=null;
$lockAcquired=false;
try {
    require_once __DIR__.'/../config.php';
    require_once __DIR__.'/../lib/Migrations.php';
    if ($issue=app_environment_issue()) throw new ConfigException($issue);
    $pdo=connect_database();
    $lockName='attachlink-migrate:'.substr(hash('sha256',DB_NAME),0,40);
    $lock=$pdo->prepare('SELECT GET_LOCK(?,0)');
    $lock->execute([$lockName]);
    $acquired=(int)$lock->fetchColumn()===1;
    $lock->closeCursor();
    if (!$acquired) throw new RuntimeException('Another migration is running.');
    $lockAcquired=true;
    try {
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
            // Persist each migration version only after its SQL file completes.
            $record->execute([$version]);
            echo "Applied $version\n";
        }
    } finally {
        if ($lockAcquired) {
            $release=$pdo->prepare('SELECT RELEASE_LOCK(?)');
            $release->execute([$lockName]);
            $released=(int)$release->fetchColumn()===1;
            $release->closeCursor();
            if (!$released) throw new RuntimeException('Could not release the migration lock.');
        }
    }
} catch (Throwable $error) {
    $message=$error instanceof ConfigException || $error instanceof RuntimeException
        ?$error->getMessage()
        :'Migration failed'.(isset($version)?" at $version":'').'. Check the database and migration permissions.';
    fwrite(STDERR,$message."\n");
    exit(1);
}
