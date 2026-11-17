"""Build the shared-map Edo roads overlay from CODH open data.

Usage: python tools/build-old-roads.py ROAD.gpkg POST.geojson
Requires GDAL's ogr2ogr. Source links and licenses are in the map credits.
"""
import json
import subprocess
import sys
from pathlib import Path


def main(road_file, post_file):
    roads = json.loads(subprocess.check_output([
        "ogr2ogr", "-f", "GeoJSON", "-simplify", "0.0015", "/vsistdout/", road_file
    ]))["features"]
    posts = json.loads(Path(post_file).read_text())["features"]
    stops_by_road = {}
    for post in sorted(posts, key=lambda feature: feature["properties"]["id"]):
        info = post["properties"]
        lon, lat = post["geometry"]["coordinates"]
        stops_by_road.setdefault(info["road_id"], []).append([
            info["name"], info["serial"], info["kg"], round(lon, 5), round(lat, 5)
        ])

    result = []
    for road in sorted(roads, key=lambda feature: feature["properties"]["numbering"]):
        info, geometry = road["properties"], road["geometry"]
        road_id = info["numbering"]
        paths = geometry["coordinates"]
        if geometry["type"] == "LineString":
            paths = [paths]
        result.append([
            road_id, info["name"],
            [[[round(lon, 5), round(lat, 5)] for lon, lat in path] for path in paths],
            stops_by_road.get(road_id, []),
        ])
    assert len(result) > 5 and all(road[2] for road in result)
    output = Path(__file__).resolve().parent.parent / "dist" / "old-roads.json"
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main(*sys.argv[1:])
