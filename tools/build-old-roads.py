"""Build the five-road pack from CODH street, station and late-Edo coast data.

Usage: python tools/build-old-roads.py ROAD.gpkg POST.geojson COAST.shp
Requires GDAL's ogr2ogr. Source links and licenses are in the app's map credits.
"""
import json
import subprocess
import sys
from pathlib import Path

ROAD_IDS = ("R001", "R002", "R003", "R004", "R005")


def export_geojson(source, *options):
    return json.loads(subprocess.check_output([
        "ogr2ogr", "-f", "GeoJSON", *options, "/vsistdout/", source
    ]))["features"]


def rounded_path(points):
    return [[round(lon, 5), round(lat, 5)] for lon, lat in points]


def coast_path(feature):
    geometry = feature["geometry"]
    if not geometry:
        return ""
    polygons = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        polygons = [polygons]
    parts = []
    for polygon in polygons:
        for ring in polygon:
            if len(ring) < 4:
                continue
            path = [
                f"{'L' if index else 'M'}{(lon - 139) * .81:.5f},{37 - lat:.5f}"
                for index, (lon, lat) in enumerate(ring[:-1])
            ]
            parts.append("".join(path) + "Z")
    return "".join(parts)


def main(road_file, post_file, coast_file):
    roads = export_geojson(
        road_file, "-where", "numbering in (" + ",".join(map(repr, ROAD_IDS)) + ")",
        "-simplify", "0.0015",
    )
    posts = json.loads(Path(post_file).read_text())["features"]
    coast = export_geojson(
        coast_file, "-spat", "131.5", "32.5", "144", "43", "-simplify", "0.014",
    )
    result = []
    for road in sorted(roads, key=lambda feature: feature["properties"]["numbering"]):
        info = road["properties"]
        geometry = road["geometry"]
        paths = geometry["coordinates"]
        if geometry["type"] == "LineString":
            paths = [paths]
        stops = [
            {
                "name": stop["properties"]["name"],
                "serial": stop["properties"]["serial"],
                "region": stop["properties"]["kg"],
                "point": rounded_path([stop["geometry"]["coordinates"]])[0],
            }
            for stop in sorted(posts, key=lambda feature: feature["properties"]["id"])
            if stop["properties"]["road_id"] == info["numbering"]
        ]
        result.append({"name": info["name"], "lines": list(map(rounded_path, paths)), "stops": stops})
    assert len(result) == len(ROAD_IDS) and all(road["stops"] for road in result)
    output = Path(__file__).resolve().parent.parent / "dist" / "old-roads.json"
    output.write_text(json.dumps(
        {"roads": result, "coast": "".join(map(coast_path, coast))},
        ensure_ascii=False, separators=(",", ":"),
    ) + "\n")


if __name__ == "__main__":
    main(*sys.argv[1:])
