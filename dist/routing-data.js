/* Schedule-free routing policy. Sources and limitations are documented in About.
   A through rule joins only the specified station and directed service pair.
   Directions: 0 follows the authored stop list, 1 follows it in reverse. */
if(S['新桜台']===undefined){const id=STATIONS.length;STATIONS.push({id,name:'新桜台',lon:139.6670,lat:35.7410});S['新桜台']=id;}
line('西武有楽町線','#ad985d',.55,'小竹向原 新桜台 練馬');
line('京急泉岳寺連絡線','#b16d5f',.75,'泉岳寺 品川');
line('東武押上方面急行','#8e83a8',.9,'押上 曳舟 北千住 西新井 草加',true);
const ROUTING_POLICY={
 boardingWait:3, transferWalk:5, stationExit:1, stationEntry:2,
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
