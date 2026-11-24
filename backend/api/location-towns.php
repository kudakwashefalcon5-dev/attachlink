<?php
declare(strict_types=1);
require_once __DIR__.'/../bootstrap.php';
require_once __DIR__.'/../lib/CompanyLocation.php';
method('GET');
out(['ok'=>true,'provinces'=>rows('SELECT id,name FROM provinces ORDER BY name'),
    'towns'=>rows('SELECT id,province_id,name,latitude,longitude,coordinate_source,attribution FROM towns ORDER BY name'),
    'bounds'=>location_bounds(),'tiles'=>map_tile_settings()]);
