# AttachLink deployment guide

Use [Deployment](docs/DEPLOYMENT.md) for XAMPP, VPS configuration, migration, release builds and backup restoration. See [Operations](docs/OPERATIONS.md) for staff procedures and the [staging checklist](docs/STAGING_CHECKLIST.md) for launch verification.
## Company location deployment

Run `php backend/jobs/migrate.php` and `php backend/check-config.php` before serving the Stage 1 release. The release contains `upgrade-19.sql` and self-hosted Leaflet 1.9.4 with its BSD 2-Clause licence.

Use HTTPS for the employer's one-time device location. The town and manual pin controls also work when geolocation is unavailable. `ATTACHLINK_ZW_LOCATION_BOUNDS` is an optional south,west,north,east warning boundary and `ATTACHLINK_LOCATION_MAX_KM` defaults to 150.

The map picker has no external tile provider by default. For a tile-backed map, set `ATTACHLINK_MAP_TILE_URL` to an HTTPS template containing `{z}`, `{x}`, and `{y}` and set `ATTACHLINK_MAP_ATTRIBUTION`. In Apache, also set the request environment variable `ATTACHLINK_MAP_TILE_ORIGIN` to that exact HTTPS origin (with port if applicable). For example, in the virtual host use `SetEnv ATTACHLINK_MAP_TILE_ORIGIN https://your-tile-host.example` and verify the browser CSP on the deployed site. Use a provider or self-hosted tiles for public traffic. The public OpenStreetMap tile service is unsuitable for heavy production traffic.

Rebuild with `python scripts/build-release.py` and verify with `python scripts/build-release.py --verify dist/attachlink.zip`.
