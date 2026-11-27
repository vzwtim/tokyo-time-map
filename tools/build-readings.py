"""Regenerate dist/readings.js (hiragana readings for every station).

Requires: node, python3 with pykakasi (pip install pykakasi).
Station order in STATION_READINGS matches the STATIONS array order (ids).
"""
import json
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[1]

dump = """
const fs=require('fs'),vm=require('vm');
const root=%r;
const c={console,Math,Float64Array,Int32Array,Set,Map,WeakMap,Promise,JSON,Object,Array,Number,String,Boolean,RegExp,Error,Date,Intl,URL,URLSearchParams};
c.window=c;c.globalThis=c;vm.createContext(c);
for(const f of ['data.js','routing-data.js','network-expansion.js','transfer-data.js','geodata.js','regions.js','engine.js'])
  vm.runInContext(fs.readFileSync(root+f,'utf8'),c,{filename:f});
process.stdout.write(JSON.stringify(vm.runInContext('STATIONS.map(s=>s.name)',c)));
""" % (str(root / 'dist') + '/')

names = json.loads(subprocess.run(['node', '-e', dump], capture_output=True, text=True, check=True).stdout)

import pykakasi
kks = pykakasi.kakasi()
readings = []
for name in names:
    hira = ''.join(part['hira'] for part in kks.convert(name)).lower()
    hira = hira.replace('ゖおか', 'がおか').replace('ゖ', 'け').replace('ゕ', 'か')
    readings.append(hira)

header = ('// 駅名の読み（ひらがな）。かな入力で駅を検索するために自動生成した索引。\n'
          '// 生成: tools/build-readings.py (pykakasi)。辞書ベースのため一部駅で実際の読みと異なる場合がある。\n')
out = root / 'dist' / 'readings.js'
out.write_text(header + 'const STATION_READINGS=' + json.dumps(readings, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'wrote {out} ({len(readings)} readings)')
