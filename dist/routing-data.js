/* Schedule-free routing policy. Sources and limitations are documented in About.
   A through rule joins only the specified station and directed service pair.
   Directions: 0 follows the authored stop list, 1 follows it in reverse. */
if(S['新桜台']===undefined){const id=STATIONS.length;STATIONS.push({id,name:'新桜台',lon:139.6670,lat:35.7410});S['新桜台']=id;}
line('西武有楽町線','#ad985d',.55,'小竹向原 新桜台 練馬');
line('京急泉岳寺連絡線','#b16d5f',.75,'泉岳寺 品川');
line('東武押上方面急行','#8e83a8',.9,'押上 曳舟 北千住 西新井 草加',true);
const ROUTING_POLICY={
 initialBoardingWait:0, boardingWait:3, transferWalk:5, stationExit:1, stationEntry:2,
 // Minutes are assumptions for a representative, untimed journey.
 through:[
  ['代々木上原','小田急線',1,'千代田線',0],
  ['綾瀬','千代田線',0,'常磐線各駅停車',0],
  ['渋谷','田園都市線',1,'半蔵門線',0],
  ['渋谷','田園都市線急行',1,'半蔵門線',0],
  ['押上','半蔵門線',0,'東武押上方面急行',0],
  ['渋谷','副都心線',0,'東横線',0],
  ['渋谷','副都心線',0,'東横線特急',0],
  ['小竹向原','副都心線',1,'西武有楽町線',0],
  ['小竹向原','有楽町線',1,'西武有楽町線',0],
  ['練馬','西武有楽町線',0,'西武池袋線',0],
  ['大崎','埼京線',1,'りんかい線',0],
  ['新宿','都営新宿線',1,'京王新線',0],
  ['笹塚','京王新線',0,'京王線',0],
  ['泉岳寺','浅草線',1,'京急泉岳寺連絡線',0],
  ['品川','京急泉岳寺連絡線',0,'京急線',0],
  ['京急蒲田','京急線',0,'京急空港線',0],
  ['押上','浅草線',0,'京成押上線・北総線',0],
  ['中野','中央・総武線',0,'東西線',0]
 ]
};

/* Representative segment timings checked 2026-10-31. See timing-audit.md.
   [line, A, B, running A>B, running B>A, dwell at A, dwell at B].
   Times are minutes; dwell is charged only when continuing, never at arrival.
   Reverse Chuo values are symmetric estimates, not a reverse timetable import. */
const SEGMENT_TIMINGS=[
 ['中央線快速','吉祥寺','西荻窪',2,2,1,0],
 ['中央線快速','西荻窪','荻窪',2,2,0,1],
 ['中央線快速','荻窪','阿佐ケ谷',1,1,1,1],
 ['中央線快速','阿佐ケ谷','高円寺',1,1,1,1],
 ['中央線快速','高円寺','中野',2,2,1,0],
 ['中央線快速','中野','新宿',4,4,0,1],
 ['中央線快速','新宿','四ツ谷',4,4,1,0],
 ['中央線快速','四ツ谷','御茶ノ水',5,5,0,0],
 ['中央線快速','御茶ノ水','神田',2,2,0,1],
 ['中央線快速','神田','東京',2,2,1,0],
 // Inokashira intervals include stop allowance; no additional modeled dwell.
 // Westbound 16 min / eastbound 17 min: representative off-peak, not rush hour.
 ['井の頭線急行','渋谷','下北沢',3,3,0,0],
 ['井の頭線急行','下北沢','明大前',3,3,0,0],
 ['井の頭線急行','明大前','永福町',2,3,0,0],
 ['井の頭線急行','永福町','久我山',4,5,0,0],
 ['井の頭線急行','久我山','吉祥寺',4,3,0,0],
 // Major direct links cross-checked against published journey times.
 ['埼京線','渋谷','新宿',5,5,0.4,0.4],
 ['湘南新宿ライン','渋谷','新宿',5,5,0.6,0.6],
 ['埼京線','新宿','池袋',5,5,0.4,0.4],
 ['湘南新宿ライン','新宿','池袋',5,5,0.6,0.6],
 ['小田急線快速急行','新宿','代々木上原',5,5,0,0],
 ['小田急線快速急行','代々木上原','下北沢',2,2,0,0]
];
const SEGMENT_TIMING_INDEX=new Map();
for(const [line,a,b,ab,ba,ad,bd] of SEGMENT_TIMINGS){
 SEGMENT_TIMING_INDEX.set(line+':'+a+'>'+b,{run:ab,dwell:ad});
 SEGMENT_TIMING_INDEX.set(line+':'+b+'>'+a,{run:ba,dwell:bd});
}
function segmentTiming(line,from,to){return SEGMENT_TIMING_INDEX.get(line+':'+from+'>'+to);}

// Yahoo observations are samples, not a live timetable or all-day minima.
const TIMING_OBSERVATIONS=[
 {
  "id": "odakyu",
  "line": "小田急線快速急行",
  "observedDate": "2026-10-27 19:01",
  "source": "https://transit.yahoo.co.jp/search/result/新宿-町田",
  "stops": [
   "新宿",
   "代々木上原",
   "下北沢",
   "登戸",
   "新百合ヶ丘",
   "町田"
  ],
  "offsets": [
   0,
   5,
   8,
   17,
   25,
   34
  ]
 },
 {
  "id": "keio",
  "line": "京王線特急",
  "observedDate": "2026-10-23 10:40",
  "source": "https://transit.yahoo.co.jp/search/result/新宿-調布",
  "stops": [
   "新宿",
   "笹塚",
   "明大前",
   "千歳烏山",
   "調布"
  ],
  "offsets": [
   0,
   5,
   7,
   12,
   17
  ]
 },
 {
  "id": "tokaido",
  "line": "東海道線",
  "observedDate": "2026-10-27 19:24",
  "source": "https://transit.yahoo.co.jp/search/result/東京-横浜",
  "stops": [
   "東京",
   "新橋",
   "品川",
   "川崎",
   "横浜"
  ],
  "offsets": [
   0,
   3,
   10,
   19,
   27
  ]
 },
 {
  "id": "tojo",
  "line": "東武東上線急行",
  "observedDate": "2026-10-27 11:50",
  "source": "https://transit.yahoo.co.jp/search/result/池袋-川越",
  "stops": [
   "池袋",
   "成増",
   "和光市",
   "朝霞",
   "朝霞台",
   "志木",
   "ふじみ野",
   "川越"
  ],
  "offsets": [
   0,
   10,
   13,
   15,
   18,
   21,
   27,
   32
  ],
  "addService": true,
  "base": "東武東上線"
 },
 {
  "id": "joban",
  "line": "常磐線快速",
  "observedDate": "2026-10-22 10:45",
  "source": "https://transit.yahoo.co.jp/search/result/北千住-柏",
  "stops": [
   "北千住",
   "松戸",
   "柏"
  ],
  "offsets": [
   0,
   9,
   17
  ]
 },
 {
  "id": "denen",
  "line": "田園都市線急行",
  "observedDate": "2026-10-27 15:58",
  "source": "https://transit.yahoo.co.jp/search/result/渋谷-中央林間",
  "stops": [
   "渋谷",
   "三軒茶屋",
   "二子玉川",
   "溝の口",
   "鷺沼",
   "たまプラーザ",
   "あざみ野",
   "青葉台",
   "長津田"
  ],
  "offsets": [
   0,
   4,
   11,
   15,
   20,
   22,
   24,
   29,
   33
  ]
 },
 {
  "id": "sobu",
  "line": "総武線快速",
  "observedDate": "2026-10-27 21:47",
  "source": "https://transit.yahoo.co.jp/search/result/東京-千葉",
  "stops": [
   "東京",
   "新日本橋",
   "馬喰町",
   "錦糸町",
   "新小岩",
   "市川",
   "船橋",
   "津田沼",
   "稲毛",
   "千葉"
  ],
  "offsets": [
   0,
   2,
   4,
   8,
   13,
   19,
   25,
   28,
   35,
   39
  ]
 },
 {
  "id": "ginza",
  "line": "銀座線",
  "observedDate": "2026-10-27 19:24",
  "source": "https://transit.yahoo.co.jp/search/result/渋谷-浅草",
  "stops": [
   "渋谷",
   "表参道",
   "外苑前",
   "青山一丁目",
   "赤坂見附",
   "溜池山王",
   "虎ノ門",
   "新橋",
   "銀座",
   "京橋",
   "日本橋",
   "三越前",
   "神田",
   "末広町",
   "上野広小路",
   "上野",
   "稲荷町",
   "田原町",
   "浅草"
  ],
  "offsets": [
   0,
   2,
   4,
   6,
   9,
   11,
   13,
   15,
   17,
   19,
   21,
   22,
   24,
   26,
   28,
   30,
   32,
   34,
   35
  ]
 },
 {
  "id": "chiyoda",
  "line": "千代田線",
  "observedDate": "2026-10-16 16:51",
  "source": "https://transit.yahoo.co.jp/search/result/代々木上原-綾瀬",
  "stops": [
   "代々木上原",
   "代々木公園",
   "明治神宮前",
   "表参道",
   "乃木坂",
   "赤坂",
   "国会議事堂前",
   "霞ケ関",
   "日比谷",
   "二重橋前",
   "大手町",
   "新御茶ノ水",
   "湯島",
   "根津",
   "千駄木",
   "西日暮里",
   "町屋",
   "北千住",
   "綾瀬"
  ],
  "offsets": [
   0,
   2,
   4,
   6,
   8,
   11,
   12,
   14,
   16,
   18,
   20,
   22,
   24,
   26,
   28,
   30,
   33,
   37,
   40
  ]
 },
 {
  "id": "hanzomon",
  "line": "半蔵門線",
  "observedDate": "2026-10-30 15:02",
  "source": "https://transit.yahoo.co.jp/search/result/渋谷-押上",
  "stops": [
   "渋谷",
   "表参道",
   "青山一丁目",
   "永田町",
   "半蔵門",
   "九段下",
   "神保町",
   "大手町",
   "三越前",
   "水天宮前",
   "清澄白河",
   "住吉",
   "錦糸町",
   "押上"
  ],
  "offsets": [
   0,
   2,
   4,
   7,
   9,
   12,
   13,
   16,
   18,
   21,
   24,
   27,
   29,
   31
  ]
 },
 {
  "id": "oedo",
  "line": "大江戸線",
  "observedDate": "2026-10-28 00:34",
  "source": "https://transit.yahoo.co.jp/search/result/新宿-光が丘",
  "stops": [
   "新宿",
   "都庁前",
   "西新宿五丁目",
   "中野坂上",
   "東中野",
   "中井",
   "落合南長崎",
   "新江古田",
   "練馬",
   "豊島園",
   "練馬春日町",
   "光が丘"
  ],
  "offsets": [
   0,
   2,
   4,
   7,
   9,
   10,
   13,
   16,
   18,
   20,
   23,
   25
  ]
 },
 {
  "id": "keiyo",
  "line": "京葉線",
  "observedDate": "2026-10-29 16:45",
  "source": "https://transit.yahoo.co.jp/search/result/東京-舞浜",
  "stops": [
   "東京",
   "八丁堀",
   "越中島",
   "潮見",
   "新木場",
   "葛西臨海公園",
   "舞浜"
  ],
  "offsets": [
   0,
   2,
   4,
   7,
   10,
   13,
   16
  ]
 },
 {
  "id": "sotetsu",
  "line": "相鉄本線特急",
  "observedDate": "2026-10-24 19:37",
  "source": "https://transit.yahoo.co.jp/search/result/横浜-海老名(相鉄・小田急)",
  "stops": [
   "横浜",
   "西谷",
   "二俣川",
   "大和",
   "海老名"
  ],
  "offsets": [
   0,
   8,
   13,
   21,
   28
  ],
  "addService": true,
  "base": "相鉄本線"
 },
 {
  "id": "tozai-rapid",
  "line": "東西線快速",
  "observedDate": "2026-10-18 15:49",
  "source": "https://transit.yahoo.co.jp/search/result/大手町(東京都)-西船橋",
  "stops": [
   "大手町",
   "日本橋",
   "茅場町",
   "門前仲町",
   "木場",
   "東陽町",
   "浦安",
   "西船橋"
  ],
  "offsets": [
   0,
   2,
   3,
   6,
   8,
   10,
   17,
   24
  ],
  "addService": true,
  "base": "東西線"
 },
 {
  "id": "tozai-local",
  "line": "東西線",
  "observedDate": "2026-10-18 15:54",
  "source": "https://transit.yahoo.co.jp/search/result/大手町(東京都)-西船橋",
  "stops": [
   "大手町",
   "日本橋",
   "茅場町",
   "門前仲町",
   "木場",
   "東陽町",
   "南砂町",
   "西葛西",
   "葛西",
   "浦安",
   "南行徳",
   "行徳",
   "妙典",
   "原木中山",
   "西船橋"
  ],
  "offsets": [
   0,
   2,
   3,
   6,
   8,
   10,
   12,
   15,
   18,
   20,
   22,
   24,
   27,
   30,
   32
  ]
 },
 {
  "id": "hibiya",
  "line": "日比谷線",
  "observedDate": "日付未確認・13:42発の再取得結果",
  "source": "https://transit.yahoo.co.jp/search/result/中目黒-北千住",
  "stops": [
   "中目黒",
   "恵比寿",
   "広尾",
   "六本木",
   "神谷町",
   "虎ノ門ヒルズ",
   "霞ケ関",
   "日比谷",
   "銀座",
   "東銀座",
   "築地",
   "八丁堀",
   "茅場町",
   "人形町",
   "小伝馬町",
   "秋葉原",
   "仲御徒町",
   "上野",
   "入谷",
   "三ノ輪",
   "南千住",
   "北千住"
  ],
  "offsets": [
   0,
   3,
   6,
   9,
   12,
   13,
   15,
   18,
   19,
   21,
   23,
   25,
   27,
   29,
   31,
   33,
   35,
   36,
   38,
   40,
   43,
   45
  ]
 }
];

function installTimingObservations(){
 // Repair Keio limited-express stops; timing evidence covers Shinjuku to Chofu.
 const keio=LINES.find(l=>l.name==='京王線特急');
 keio.stops='新宿 笹塚 明大前 千歳烏山 調布 府中 分倍河原 聖蹟桜ヶ丘 高幡不動 北野 京王八王子'.split(' ').map(n=>S[n]);
 for(const p of TIMING_OBSERVATIONS){
  if(p.addService){const base=LINES.find(l=>l.name===p.base);line(p.line,base.color,base.speed,p.stops.join(' '),true);}
  const service=LINES.find(l=>l.name===p.line);
  if(!service||p.stops.length!==p.offsets.length)throw Error('Invalid timing profile '+p.id);
  for(let i=1;i<p.stops.length;i++){
   const from=p.stops[i-1],to=p.stops[i],a=service.stops.indexOf(S[from]),b=service.stops.indexOf(S[to]);
   if(a<0||b<0||Math.abs(b-a)!==1)throw Error('Timing skips a stop: '+p.id+' '+from+'>'+to);
   SEGMENT_TIMING_INDEX.set(p.line+':'+from+'>'+to,{run:p.offsets[i]-p.offsets[i-1],dwell:0,source:p.source,observed:true});
  }
 }
}
