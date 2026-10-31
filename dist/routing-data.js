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
