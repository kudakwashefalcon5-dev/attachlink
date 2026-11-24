"""Generate idempotent Zimbabwe town reference data from GeoNames ZW.zip.

Download https://download.geonames.org/export/dump/ZW.zip separately.
Data: GeoNames, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
Only province records and populated places of 5,000+ or provincial capitals
are selected. Coordinates describe places, never a specific business.
"""
import argparse
from zipfile import ZipFile


def quote(value):
    return "'" + value.replace("'", "''") + "'"


def generate(archive):
    with ZipFile(archive) as source:
        records = [row.split("\t") for row in source.read("ZW.txt").decode().splitlines()]
    provinces = {row[10]: row for row in records if row[7] == "ADM1"}
    towns = {}
    for row in records:
        if row[6] != "P" or row[10] not in provinces:
            continue
        if int(row[14]) < 5000 and row[7] not in {"PPLA", "PPLC"}:
            continue
        key = (row[10], row[1].casefold())
        if key not in towns or int(row[14]) > int(towns[key][14]):
            towns[key] = row
    print("-- GeoNames Zimbabwe extract, CC BY 4.0. https://www.geonames.org/export/")
    print("INSERT IGNORE INTO provinces (id,name) VALUES")
    print(",\n".join(f"({row[0]},{quote(row[1].removesuffix(' Province'))})" for row in sorted(provinces.values(), key=lambda r: r[1])) + ";")
    print("INSERT IGNORE INTO towns (id,province_id,name,latitude,longitude,coordinate_source,attribution) VALUES")
    print(",\n".join(
        f"({row[0]},{provinces[row[10]][0]},{quote(row[1])},{float(row[4]):.6f},{float(row[5]):.6f},"
        f"'geonames','GeoNames (CC BY 4.0), https://www.geonames.org/{row[0]}/')"
        for row in sorted(towns.values(), key=lambda r: (r[10], r[1]))
    ) + ";")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive")
    generate(parser.parse_args().archive)
