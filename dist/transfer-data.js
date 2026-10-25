'use strict';
/* Platform-to-platform WALK estimates, excluding the next train's wait.
   These are authored approximations, not official minimum connection times.
   Tokyo/Keiyo uses the midpoint of JRE's 10–15 minute walking guidance.
   Sources and exceptions: transfer-method.md. */
const TRANSFER_MODEL={
 version:1,
 hubs:{'新宿':1,'渋谷':1,'池袋':1,'東京':1,'大手町':1,'飯田橋':1},
 pairs:[
 ['東京','京葉線','*',12],['東京','総武線快速','*',8],
 ['新宿','大江戸線','*',9],['新宿','丸ノ内線','*',7],['新宿','京王新線','小田急線',7],
 ['新宿','京王線','京王新線',7],['新宿','京王線','都営新宿線',7],
 ['渋谷','銀座線','副都心線',9],['渋谷','銀座線','東横線',9],['渋谷','井の頭線','副都心線',10],['渋谷','井の頭線','東横線',10],['渋谷','井の頭線','田園都市線',8],['渋谷','山手線','埼京線',4],
 ['池袋','丸ノ内線','副都心線',8],['池袋','西武池袋線','東武東上線',9],
 ['大手町','丸ノ内線','東西線',7],['大手町','丸ノ内線','千代田線',6],['大手町','東西線','半蔵門線',7],['大手町','東西線','三田線',8],['大手町','千代田線','半蔵門線',5],
 ['飯田橋','中央・総武線','大江戸線',9],['飯田橋','東西線','南北線',7],['飯田橋','東西線','有楽町線',7],
 ['蔵前','浅草線','大江戸線',8],['本郷三丁目','丸ノ内線','大江戸線',7],['六本木','日比谷線','大江戸線',7],
 ['表参道','銀座線','半蔵門線',2],['赤坂見附','銀座線','丸ノ内線',2],['溜池山王','銀座線','南北線',4],
 ['九段下','半蔵門線','都営新宿線',3],['白金高輪','南北線','三田線',2],
 ['御茶ノ水','中央線快速','中央・総武線',2],['四ツ谷','中央線快速','中央・総武線',3],
 ['北千住','日比谷線','千代田線',7],['北千住','常磐線快速','日比谷線',6],['秋葉原','日比谷線','中央・総武線',6],
 ['武蔵小杉','湘南新宿ライン','南武線',11],['武蔵小杉','JR相鉄直通線','南武線',11],
 ['新木場','京葉線','りんかい線',5],['新木場','京葉線','有楽町線',5],['中野坂上','丸ノ内線','丸ノ内線支線',2]
 ]
};
function transferLineFamily(name){return name.replace(/快速急行$|特急$|急行$|特快$/,'');}
const TRANSFER_JR=new Set(['山手線','中央線快速','中央線','中央・総武線','埼京線','湘南新宿ライン','京浜東北線','東海道線','横須賀線','総武線快速','京葉線','武蔵野線','南武線','常磐線快速','常磐線各駅停車','JR相鉄直通線','横浜線','根岸線','宇都宮線','高崎線']);
const TRANSFER_METRO=new Set(['銀座線','丸ノ内線','丸ノ内線支線','千代田線','日比谷線','東西線','半蔵門線','有楽町線','副都心線','南北線']);
function modeledTransferMinutes(station,from,to,fromDir,toDir){const name=STATIONS[station].name,a=transferLineFamily(LINES[from].name),b=transferLineFamily(LINES[to].name);
 // Separate platforms when changing direction; staying on the train bypasses this function.
 if(a===b)return 2;
 for(const [s,x,y,t]of TRANSFER_MODEL.pairs)if(s===name&&((a===x&&(y==='*'||b===y))||(b===x&&(y==='*'||a===y))))return name==='表参道'&&fromDir!==toDir?4:t;
 const bothJR=TRANSFER_JR.has(a)&&TRANSFER_JR.has(b),bothMetro=TRANSFER_METRO.has(a)&&TRANSFER_METRO.has(b);let t=bothJR?3:bothMetro?4:5;
 if(a==='大江戸線'||b==='大江戸線')t+=2;return t+(TRANSFER_MODEL.hubs[name]||0);
}
