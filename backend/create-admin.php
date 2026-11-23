<?php
// CLI-only; run from XAMPP PHP command line: php backend/create-admin.php admin@example.com "LongPassword123!" "System" "Administrator"
if(PHP_SAPI!=='cli'){http_response_code(403);exit('CLI only');}
if($argc<4){exit("Usage: php backend/create-admin.php EMAIL PASSWORD FIRST_NAME [LAST_NAME]\n");}
[$file,$email,$password,$first]=$argv;$last=$argv[4]??'Administrator';
if(!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($password)<12)exit("Invalid email or password shorter than 12 characters.\n");
try {
    require_once __DIR__.'/config.php';
    if ($issue=app_environment_issue()) throw new ConfigException($issue);
    $pdo=connect_database();
    $statement=$pdo->prepare("INSERT INTO users(role,first_name,last_name,email,password_hash) VALUES('admin',?,?,?,?)");
    $statement->execute([$first,$last,$email,attachlink_password_hash($password)]);
    echo "Admin account created.\n";
} catch (Throwable $error) {
    fwrite(STDERR,($error instanceof ConfigException?$error->getMessage():'Could not create admin. Check email uniqueness and database permissions.')."\n");
    exit(1);
}
