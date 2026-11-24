<?php
declare(strict_types=1);

const LOCATION_FIELDS = ['physical_address','town_id','latitude','longitude','accuracy_m',
    'location_precision','location_source','landmark_directions'];

function location_bounds(): array {
    $bounds=explode(',',config_env('ATTACHLINK_ZW_LOCATION_BOUNDS','-22.5,25,-15.5,33.5'));
    if (count($bounds)!==4 || count(array_filter($bounds,'is_numeric'))!==4) {
        throw new ConfigException('Set ATTACHLINK_ZW_LOCATION_BOUNDS to south,west,north,east.');
    }
    [$south,$west,$north,$east]=array_map('floatval',$bounds);
    if ($south < -90 || $north > 90 || $west < -180 || $east > 180 || $south >= $north || $west >= $east) {
        throw new ConfigException('ATTACHLINK_ZW_LOCATION_BOUNDS is invalid.');
    }
    return [$south,$west,$north,$east];
}

function location_distance_limit(): float {
    $value=config_env('ATTACHLINK_LOCATION_MAX_KM','150');
    if (!is_numeric($value) || (float)$value<=0 || (float)$value>1000) {
        throw new ConfigException('Set ATTACHLINK_LOCATION_MAX_KM to a positive distance up to 1000.');
    }
    return (float)$value;
}

function location_decimal(mixed $value, int $limit, int $digits, string $label): string {
    if ((!is_string($value) && !is_int($value) && !is_float($value))
        || !preg_match('/\A-?\d+(?:\.\d{1,'.$digits.'})?\z/',(string)$value)
        || abs((float)$value)>$limit) fail('Invalid '.$label.'.',422);
    return number_format((float)$value,$digits,'.','');
}

function location_text(array $input,string $field,int $limit): ?string {
    $value=$input[$field]??'';
    if (!is_string($value)||mb_strlen(trim($value))>$limit) fail('Invalid '.str_replace('_',' ',$field).'.',422);
    return trim($value)===''?null:trim($value);
}

function validate_company_location(array $input,bool $admin): array {
    $townId=positive($input['town_id']??null);
    $provinceId=positive($input['province_id']??null);
    $town=getrow('SELECT id,latitude,longitude FROM towns WHERE id=? AND province_id=?',[$townId,$provinceId]);
    if (!$town) fail('Select a town in the chosen province.',422);
    $precision=$input['location_precision']??'town';
    if (!in_array($precision,['town','exact'],true)) fail('Invalid location precision.',422);
    $latitude=$town['latitude'];
    $longitude=$town['longitude'];
    $accuracy=null;
    $source='town_seed';
    $warning=null;
    if ($precision==='exact') {
        if (($input['pin_confirmed']??null)!==true) fail('Confirm the exact company pin before saving.',422);
        $latitude=location_decimal($input['latitude']??null,90,6,'latitude');
        $longitude=location_decimal($input['longitude']??null,180,6,'longitude');
        $source=$admin?'admin':($input['location_source']??null);
        if (!in_array($source,['admin','employer_pin','employer_gps_once','pasted_link'],true) || (!$admin && $source==='admin')) fail('Invalid pin source.',422);
        if ($source==='employer_gps_once') {
            $accuracy=location_decimal($input['accuracy_m']??null,10000000,2,'GPS accuracy');
            if ((float)$accuracy<0) fail('Invalid GPS accuracy.',422);
            if ((float)$accuracy>500 && ($input['confirm_low_accuracy']??null)!==true) fail('Confirm the low accuracy or adjust the pin.',422);
        }
        $lat=deg2rad((float)$latitude);
        $townLat=deg2rad((float)$town['latitude']);
        $deltaLon=deg2rad((float)$longitude-(float)$town['longitude']);
        $h=sin(($lat-$townLat)/2)**2+cos($lat)*cos($townLat)*sin($deltaLon/2)**2;
        $max=location_distance_limit();
        if (12742*asin(sqrt(min(1,max(0,$h))))>$max) fail('The pin must be within '.$max.' km of the selected town.',422);
    } elseif ($admin) {
        $source='admin';
    }
    [$south,$west,$north,$east]=location_bounds();
    if ($latitude<$south||$latitude>$north||$longitude<$west||$longitude>$east) $warning='This location is outside the configured Zimbabwe boundary.';
    return [[
        'physical_address'=>location_text($input,'physical_address',255),
        'town_id'=>$townId,'latitude'=>$latitude,'longitude'=>$longitude,'accuracy_m'=>$accuracy,
        'location_precision'=>$precision,'location_source'=>$source,
        'landmark_directions'=>location_text($input,'landmark_directions',300)
    ],$warning];
}

function company_location_record(int $companyId): ?array {
    return getrow('SELECT c.id,c.verification_status,c.physical_address,c.town_id,c.latitude,c.longitude,c.accuracy_m,
        c.location_precision,c.location_source,c.location_review_status,c.location_updated_at,c.location_approved_at,
        c.landmark_directions,t.province_id,t.name AS town_name,p.name AS province_name
        FROM companies c LEFT JOIN towns t ON t.id=c.town_id LEFT JOIN provinces p ON p.id=t.province_id WHERE c.id=?',[$companyId]);
}

function store_company_location(int $id,array $candidate,string $status): void {
    $fields=implode(',',array_map(static fn(string $key): string=>$key.'=?',LOCATION_FIELDS));
    execute("UPDATE companies SET $fields,location_review_status=?,location_updated_at=COALESCE(?,NOW()),
        location_approved_at=IF(?='approved',NOW(),NULL) WHERE id=?",
        [...array_map(static fn(string $key)=>$candidate[$key],LOCATION_FIELDS),$status,$candidate['location_updated_at']??null,$status,$id]);
}

function company_location_response(int $id): array {
    $record=company_location_record($id);
    if (!$record) fail('Company not found.',404);
    $proposal=getrow('SELECT details FROM company_location_proposals WHERE company_id=?',[$id]);
    $pending=$proposal?json_decode($proposal['details'],true,512,JSON_THROW_ON_ERROR):null;
    if ($pending) {
        $town=getrow('SELECT province_id FROM towns WHERE id=?',[$pending['town_id']]);
        $pending['province_id']=$town['province_id'];
    }
    return ['location'=>$record,'pending'=>$pending,'revision'=>hash('sha256',json_encode([$record,$pending],JSON_THROW_ON_ERROR))];
}
