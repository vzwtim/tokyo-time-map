'use strict';

const tokyoGuide='https://www.gotokyo.org/jp/destinations/';
const tokyoYokocho='https://www.gotokyo.org/jp/story/guide/drink-and-dine-like-a-local-a-guide-to-exploring-yokocho-alleyways/';
const cityShinagawa='https://www.city.shinagawa.tokyo.jp/kurashi/sumai/1009385/1003547/';
const stationAreas = {
  新宿: ['西口のオフィス街と御苑側では街並みが変わります。物件から駅まで実際に使う出口を確認すると比較しやすいです。','東口に歌舞伎町とゴールデン街。大人数なら席数を、小さな店を回るなら横丁を目安に。',tokyoGuide+'western-tokyo/shinjuku/index.html'],
  神楽坂: ['商店の並ぶ神楽坂通りと石畳の路地。徒歩経路の坂や階段も確認したい街です。','石畳の裏通りに料亭やレストラン。ゆっくり話せる席を探しやすいエリアです。',tokyoGuide+'central-tokyo/kagurazaka/index.html'],
  高円寺: ['駅前から商店街が続き、買い物と外食を近くで済ませやすい街です。','商店街に地元のバーや飲食店。かしこまらず集まるなら、駅の南北を比べてみてください。',tokyoGuide+'western-tokyo/koenji/index.html'],
  中野: ['駅前に商店街と飲食店。駅からの道で買い物を済ませたい場合の候補です。','商店街を軸に飲食店が集まる街。駅前で集まってから店へ向かいやすいです。',tokyoGuide+'western-tokyo/nakano/index.html'],
  下北沢: ['駅前の商店街に古着店やカフェが並び、周りには住宅街が広がります。','商店街のカフェや飲食店から、小さめの店で話したいときに。',tokyoGuide+'western-tokyo/shimokitazawa/index.html'],
  上野: ['公園口側は上野恩賜公園。生活の買い物と休日の散歩で、駅のどちら側を使うかが変わります。','南側のアメ横は活気があり、ワイワイ飲みたいときの目安になります。',tokyoGuide+'northern-tokyo/ueno/index.html'],
  池袋: ['駅周辺に百貨店や大型商業施設が集中。駅が大きいので、物件までの出口と道順も確認すると便利です。','出口が多い駅。店を決めたら、集合場所は東口・西口まで指定すると迷いにくいです。',tokyoGuide+'northern-tokyo/ikebukuro/index.html'],
  赤羽: ['一番街の商店街と住宅街が近接。駅前のにぎわいと住まい周辺の静けさを分けて見たい街です。','赤羽一番街で店を探すと、にぎやかな雰囲気の候補を見つけやすいです。',tokyoGuide+'northern-tokyo/akabane/index.html'],
  吉祥寺: ['北口側は商店街、南側には井の頭恩賜公園。買い物と公園の両方を普段使いしやすい街です。','北口側のハモニカ横丁は小さな店が並ぶ路地。少人数のはしご酒の候補に。',tokyoGuide+'western-tokyo/kichijoji/index.html'],
  恵比寿: ['駅前の飲食エリアと、ガーデンプレイス方面で歩いたときの雰囲気が異なります。','恵比寿横丁には焼鳥やワインバーなどが並びます。席数やにぎやかさは店ごとに確認を。','https://www.gotokyo.org/jp/spot/451/index.html'],
  新橋: ['駅前はオフィス・飲食街。住まいを選ぶなら夜に駅から物件まで歩いて確かめたいエリアです。','駅近くに横丁や路地の飲食店。仕事帰りに集まってワイワイ飲む候補に。',tokyoYokocho],
  渋谷: ['買い物・外食先が多い一方、利用する路線と出口で日常の歩き方が変わります。','横丁や飲食街があり、にぎやかに集まる場所を選びやすい街です。',tokyoYokocho],
  大崎: ['駅に大崎ニューシティの店舗があり、目黒川沿いには散歩できる道があります。','駅に面した商業施設も集合場所の候補。駅直結の飲食店と五反田方面を比較できます。',cityShinagawa+'1003549.html'],
  五反田: ['駅周辺に複数の商店街。西五反田には目黒川沿いの水辺広場もあります。','五反田駅周辺の商店街と西五反田の飲食店街で、集合場所からの歩きやすさを比較できます。',cityShinagawa+'1003549.html'],
  大井町: ['東口やすずらん通りなど複数の商店街。物件の最寄り側で日常の買い物先を確認できます。','東口商店街周辺が店探しの目安。小さめの店を選ぶときは座れる人数を確認すると安心です。',cityShinagawa+'1003548.html'],
  西大井: ['住宅街の中に寺社や地域の飲食店が点在。落ち着いた街並みを見たいときの候補です。','駅周辺は住宅街。駅近くの店と、商店街のある大井町側まで足を延ばす案を比べられます。','https://shinagawa-kanko.or.jp/featured/nisioi-walk/'],
  武蔵小杉: ['駅周辺に大型商業施設。駅前で買い物を済ませ、休日は多摩川の河川敷へ足を延ばせます。','駅前の商業施設が待ち合わせの目安。JRと東急では使う改札が異なるため、店に近い出口も確認を。','https://www.tokyu.co.jp/area/musashi-kosugi/'],
  自由が丘: ['駅の周りにカフェ、ベーカリー、生活雑貨の店が集まります。','カフェや飲食店の集まる駅周辺で、席に座って話せる店を探すときの候補に。',tokyoGuide+'southern-tokyo/jiyugaoka/index.html'],
  中目黒: ['目黒川沿いにカフェやショップ。散歩の動線を駅近くで確保しやすい街です。','川沿いにレストラン、駅の高架下にバーや飲食店。落ち着いて話す店と駅近の店を探し分けられます。',tokyoGuide+'southern-tokyo/nakameguro/index.html'],
  御茶ノ水: ['神田川沿いの学生街。駅南側に楽器店が並び、神保町の古書店街も歩いて行けます。','駅南側から神保町にかけて、飲食店を見ながら待ち合わせ場所を選べます。',tokyoGuide+'central-tokyo/kanda-and-jimbocho/index.html'],
  品川: ['港南口側に駅ビルやオフィス、高輪口側にホテルや商業施設。普段使う出口から買い物先までの動線を見ておくと便利です。','港南口の駅ビルや高輪口側のホテル・商業施設が集合の目印。店のある側の出口を先に決めると合流しやすいです。','https://transit.yahoo.co.jp/station/22709/exit'],
  横浜: ['駅ビルや大型商業施設が集まります。東西で景色が異なるので、使う改札側で生活動線を確認できます。','東口・西口の両側に飲食店があります。最初にどちら側で集まるかを決めるとスムーズです。','https://www.welcome.city.yokohama.jp/spot/area/area02.php'],
};

const drinkPreference={vibe:'',drink:''};
for(const button of $('drinkPreferences').querySelectorAll('[data-preference]')){
  button.onclick=()=>{
    const {preference,value}=button.dataset;
    drinkPreference[preference]=drinkPreference[preference]===value?'':value;
    for(const peer of $('drinkPreferences').querySelectorAll('[data-preference="'+preference+'"]')){
      peer.setAttribute('aria-pressed',peer.dataset.value===drinkPreference[preference]);
    }
    updatePlannerDecision();
  };
}
function stationAreaLinks(station) {
  const place=station.name+'駅 '+(station.region==='東京圏'?'':station.region??'');
  const mapSearch=what=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(place+' '+what);
  return plannerMode==='living'
    ? [['スーパー',mapSearch('スーパー')],['公園',mapSearch('公園')],['街並み',mapSearch('')]]
    : [[drinkPreference.drink?drinkPreference.drink+'のお店を探す':'周辺の飲食店を探す',
      mapSearch([drinkPreference.drink||'居酒屋',drinkPreference.vibe==='ワイワイ'?'にぎやか':drinkPreference.vibe==='ゆったり'?'落ち着いた':''].join(' '))]];
}
function plannerExternalLink(label,url) {
  const link=document.createElement('a');
  link.href=url;link.textContent=label+' ↗';link.target='_blank';link.rel='noopener';
  return link;
}
function updatePlannerDecision() {
  $('plannerDecision')?.remove();
  const row=plannerCandidates.find(entry=>entry.station.id===plannerDecisionId);
  if(!row)return;
  const holder=$('plannerResults').querySelector('[data-candidate="'+row.station.id+'"]')?.parentElement;
  if(!holder)return;
  const {station, minutes, longest}=row;
  const living=plannerMode==='living';
  const section=document.createElement('div');
  section.className='planner-decision';section.id='plannerDecision';
  const title=document.createElement('strong');
  title.textContent=living?'暮らしの目安':'集まり方の目安';
  section.append(title);
  const guide=station.region==='東京圏'||!station.region?stationAreas[station.name]:null;
  const description=document.createElement('p'), tradeoff=document.createElement('p');
  if(guide){
    description.textContent=guide[living?0:1];
    section.append(description);
  }
  tradeoff.className='planner-tradeoff';
  const gap=Math.round(Math.max(...minutes)-Math.min(...minutes));
  tradeoff.textContent=(living?'片道が長い方で':'一番遠い人で')+'約'+Math.round(longest)+'分'+(gap?' · 最短との差 '+gap+'分':' · 所要時間はほぼ同じ');
  if(!living&&(drinkPreference.vibe||drinkPreference.drink)){
    tradeoff.textContent+=' · '+[drinkPreference.vibe,drinkPreference.drink].filter(Boolean).join(' / ');
  }
  section.append(tradeoff);
  const links=document.createElement('div');links.className='planner-decision-links';
  for(const [label,url] of stationAreaLinks(station))links.append(plannerExternalLink(label,url));
  if(guide)links.append(plannerExternalLink('街のガイド',guide[2]));
  if(living){
    const rent=householdRecord(plannerSearch.household,station);
    if(rent){
      const group=layoutIndex()===0?'1LDK・2K・2DK':'2LDK・3K・3DK';
      const note=document.createElement('p');note.className='planner-tradeoff';
      note.textContent=group+'の駅相場 · '+plannerSearch.household.retrieved;
      section.append(note);
      links.append(plannerExternalLink('家賃の出典',plannerSearch.household.sources[rent[1]]));
    }
  }
  section.append(links);holder.append(section);
}
