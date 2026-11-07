"""Build nationwide rail adjacency and coastline from MLIT N02-25 and Natural Earth."""
import collections
import heapq
import json
import math
import pathlib
import sys

source = pathlib.Path(sys.argv[1])
destination = pathlib.Path(__file__).resolve().parents[1] / 'dist' / 'geodata.js'

def region_of(x, y):
    if y > 41.55 or (x < 140.5 and y > 41.35):
        return '北海道'
    if x > 139.5 and y >= 37:
        return '東北'
    if x >= 138.65 and y >= 35.16 and y < 37:
        return '東京圏'
    if 134.6 <= x < 136.48 and 34 <= y < 35.53:
        return '京阪神'
    if x >= 136.48 or (x > 135.3 and y >= 35.53):
        return '中部'
    if y < 28:
        return '沖縄'
    if x < 131.25 or (x < 132.15 and y < 33.5):
        return '九州'
    if y < 34.45 and x > 132 and x < 134.75:
        return '四国'
    return '中国・近畿'

def km(a, b):
    return math.hypot((a[0]-b[0])*111.195*math.cos(math.radians((a[1]+b[1])/2)), (a[1]-b[1])*111.2)

def key(point):
    return tuple(round(x, 5) for x in point[:2])

def group_features(kind):
    grouped = collections.defaultdict(list)
    for f in json.loads((source / ('N02-25_'+kind+'.geojson')).read_text())['features']:
        p = f['properties']
        points = f['geometry']['coordinates']
        pair = p['N02_004'], p['N02_003']
        if pair == ('三国芦原線', 'えちぜん鉄道'):
            pair = pair[::-1]
        grouped[pair].append((p, points))
    return grouped

sections, stops = group_features('RailroadSection'), group_features('Station')
stations, lines = {}, []
for (operator, line), entries in sorted(stops.items()):
    graph, node_station = collections.defaultdict(dict), {}
    for p, coords in entries:
        station_id = p['N02_005g']
        middle = [(coords[0][i]+coords[-1][i])/2 for i in (0,1)]
        display_name = 'なんば' if operator == '大阪市高速電気軌道' and p['N02_005'] == '難波' else p['N02_005']
        stations.setdefault(station_id, [display_name, *key(middle), region_of(*middle)])
        for point in coords:
            node_station[key(point)] = station_id

    for _, coords in sections[operator, line] + entries:
        points = list(map(key, coords))
        for a, b in zip(points, points[1:]):
            if a != b:
                graph[a][b] = graph[b][a] = km(a,b)

    # Close sub-50 m seams at section endpoints, never across entire missing sections.
    ends = [point for point, neighbors in graph.items() if len(neighbors) == 1]
    bins = collections.defaultdict(list)
    for a in ends:
        ix, iy = int(a[0]*2000), int(a[1]*2000)
        for dx in (-1,0,1):
            for dy in (-1,0,1):
                for b in bins[ix+dx,iy+dy]:
                    if (d := km(a,b)) < .047:
                        graph[a][b] = graph[b][a] = d
        bins[ix,iy].append(a)

    edges = {}
    starts = collections.defaultdict(list)
    for point, station_id in node_station.items():
        if point in graph:
            starts[station_id].append(point)
    for station_id, points in starts.items():
        best = dict.fromkeys(points, 0)
        queue = [(0,p) for p in points]
        heapq.heapify(queue)
        while queue:
            distance, point = heapq.heappop(queue)
            if distance != best[point]:
                continue
            other = node_station.get(point)
            if other and other != station_id:
                pair = tuple(sorted([station_id, other]))
                edges[pair] = min(edges.get(pair, math.inf), distance)
                continue
            for target, length in graph[point].items():
                if distance+length < best.get(target, math.inf):
                    best[target] = distance+length
                    heapq.heappush(queue, (distance+length,target))

    # Report stations absent from physical adjacency for QA.
    linked = set(sum((list(pair) for pair in edges), []))
    missing = [stations[s][0] for s in starts if s not in linked]
    if missing:
        print(operator, line, 'isolated', ', '.join(missing))
    kind = entries[0][0]['N02_001']
    lines.append([operator, line, [[a,b,round(d,3)] for (a,b),d in sorted(edges.items())], kind])

shinkansen = {}
bullet_stops = {}
east = {}
for f in json.loads((source / 'N02-25_Station.geojson').read_text())['features']:
    p, points = f['properties'], f['geometry']['coordinates']
    name = p['N02_005']
    middle = key([(points[0][i]+points[-1][i])/2 for i in (0,1)])
    if p['N02_002'] == '1':
        bullet_stops[name] = p['N02_005g']
    if p['N02_003'] == '東海道新幹線':
        shinkansen[name] = list(middle)
    if p['N02_004'] == '東日本旅客鉄道' and p['N02_003'] == '東海道線':
        east[name] = list(middle)

countries = json.loads((source / 'countries.json').read_text())
rings = []
for feature in countries['features']:
    if feature['properties'].get('ADMIN') != 'Japan':
        continue
    geom = feature['geometry']
    for poly in geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]:
        ring = poly[0]
        rings.append([list(key(p)) for p in ring])
destination.write_text('const RAIL_GEODATA = '+json.dumps(dict(stations=stations,lines=lines,coast=rings, shinkansen=shinkansen, bullet_stops=bullet_stops, east=east),ensure_ascii=False,separators=(',',':'))+';\n')
print(len(stations),'stations',len(lines),'lines',sum(len(l[2]) for l in lines),'rail edges',len(rings),'coastline rings')
