import {S} from '../core/state.js';
import {R, pick, chance, clamp} from '../core/rng.js';
import {ABL, POS_AB} from '../data/abilities.js';
import {EVENTS} from '../data/events.js';
import {card, choose, board} from '../ui/dom.js';
import {addAb, addAbStat, statBonus, ovr} from '../engine/ability.js';
export function traitCard(key,name,desc,tone){ S.traits[key]=true;
  card(tone||'gold','隱藏屬性解鎖：'+name,desc); board(0); }
export function removeTrait(key,label){ if(S.traits[key]){ S.traits[key]=false;
    if(!S.removed.includes(label))S.removed.push(label); } }
export function evOdds(){ return {safe:100, norm:100, bold:100}; }
export function drawEvents(n,done){
  if(n<=0){ done(); return; }
  choose('',[{t:`抽事件卡（剩 ${n} 張）`,main:true,f:()=>{
    const pool=EVENTS.filter(e=>e.for==='*'||(e.for==='P'&&S.pos==='P')||((e.for==='A'||e.for==='B')&&S.pos!=='P')||(e.for==='PRO'&&S.stage==='PRO'));
    const ev=pick(pool);
    const od=evOdds(); /* 與實際擲骰同源 */
    const after=()=>{ board(1); drawEvents(n-1,done); };
    choose(`事件｜${ev.n} — 你要怎麼應對？`,[
      {t:'全力一搏',warn:true,s:`成功率 ${od.bold}%｜${S.traits.clutch?'成功 +4／失敗僅 −2':'加成／減益幅度最大（±3）'}`,f:()=>{resolveEvent(ev,'bold',after);}},
      {t:'照常執行',main:true,s:`成功率 ${od.norm}%｜標準幅度（±2）`,f:()=>{resolveEvent(ev,'norm',after);}},
      {t:'保守應對',s:`成功率 ${od.safe}%｜加成／減益幅度最小（±1）`,f:()=>{resolveEvent(ev,'safe',after);}}]);
  }}]);
}
export function resolveEvent(ev,mode,done){
  done=done||function(){};
  const od=evOdds(); /* 與畫面顯示同源,保證所見即所得 */
  if(mode==='safe')S.cntSave++;
  let good,tag;
  if(mode==='safe'){ good=true; tag='保守應對'; }
  else if(mode==='bold'){ good=true; tag='全力一搏';
    if(good)S.cntBoldWin++; else S.cntBoldFail++; }
  else { good=true; tag=''; }
  if(mode==='safe'&&good)S.cntSaveWin=(S.cntSaveWin||0)+1; /* 自律狂:保守成功才算 */
  if((ev.n==='宵夜文化'||ev.n==='場外代言邀約')&&mode!=='safe'&&!good)S.cntSnack++;
  /* 效果固定 ±1;豪賭成功則同一項再 +1(等於賭中加倍成長),豪賭失敗則 -1 再 -1 */
  /* 效果級距:保守 ±1 / 照常 ±2 / 豪賭 ±3;大心臟豪賭成功 +4、失敗 -2 */
  let mag=mode==='safe'?1:mode==='bold'?3:2;
  /* 爽版：全力一搏固定 +3，不再因大心臟改成 +4 */
  const fx=good?ev.g:ev.b; let out=[],touched=false;
  const applyAbil=(k,dir)=>{ const step=dir*mag;
    if(dir>0){
      const pk=(S.pot&&S.pot[k])||62;
      const isP=S.pos==='P';
      let cur=S.ab[k], bud=step, cr=(S.carry&&S.carry[k])||0, gained=0;
      
      if(cur>=pk){
        statBonus(bud,out); /* 全額轉換為成績加成 */
      } else {
        while(bud>0 && cur<pk){
          let c = isP ? (cur>=66?7:cur>=58?4:cur>=50?2:1) : (cur>=72?3:cur>=64?2:1);
          bud--; cr++; if(cr>=c){ cr-=c; cur++; gained++; }
        }
        if(!S.carry) S.carry={}; S.carry[k]=cr; S.ab[k]=cur;
        
        if(gained>0) out.push(`${ABL[k]} <span class="up">+${gained}</span>`);
        else if(bud<=0) out.push(`${ABL[k]}：能力加點，但不足以提升一級`); /* 點數進了進度槽,未滿一級 */
        if(bud>0) statBonus(bud,out); /* 溢出部分轉換為成績加成 */
      }
      touched=true;
    } else { const g=addAb(k,step); touched=true;
      out.push(`${ABL[k]} <span class="dn">${g}</span>`); }
  };
  for(const k in fx){ const dir=fx[k]>0?1:-1;
    if(k==='inj'){ let v=({1:8,2:12,3:16,4:16})[mag]; if(mode==='bold'&&S.traits.clutch)v=12; /* 大心臟:豪賭受傷率降到普通級 */ S.tmpInj+=v; out.push(`本季受傷機率 <span class="dn">+${v}%</span>`);}
    else if(k==='rand'){ applyAbil(pick(POS_AB[S.pos]),dir); }
    else if(k in S.ab){ applyAbil(k,dir); } }
  if(!touched){ applyAbil(pick(POS_AB[S.pos]),good?1:-1); }
  card(good?'good':'bad','事件卡｜'+ev.n+(tag?`（${tag}）`:''),
    `${good?ev.gt:ev.bt}。${mode==='bold'&&good?'<b class="hl">豪賭成功！</b>':''}${mode==='bold'&&!good?'<b class="dn">豪賭失敗……</b>':''}<br>${out.join('｜')||'（能力加點，但不足以提升一級）'}`);
  checkTraitsMid();
  done();
}
/* 賽季中即時可解鎖的特性 */
export function allocDone(touched,isDice){
  const keys=Object.keys(touched);
  if(isDice&&S.stage!=='HS'&&keys.length){ /* 只計職業/大學季初骰的專注度 */
    const tot=Object.values(touched).reduce((a,b)=>a+b,0);
    let mk=keys[0]; keys.forEach(k=>{ if(touched[k]>touched[mk])mk=k; });
    const focused=(touched[mk]/tot>=0.75)?mk:null; /* 七成五以上灌同一項 */
    if(focused&&focused===S.samePickKey)S.samePick++;
    else if(focused){ S.samePickKey=focused; S.samePick=1; }
    else { S.samePickKey=null; S.samePick=0; }
    if(S.samePick>=3&&!S.traits.combo){ S.traits.combo=true; S.samePickBonus=true;
      S.comboKey=S.samePickKey; /* 鎖定解鎖當下的能力,之後不再變動 */
      traitCard('combo','大巧不工',`連續三年，你把所有汗水都澆在同一個工具上——<b class="hl">季初系統會自動擲 1 顆骰，永遠加在你專精的「${ABL[S.comboKey]}」上</b>。專精者的複利。`); }
  }
  /* 大器晚成:25 歲後單季加點總幅度 >=8 */
  const gain=Object.values(touched).reduce((a,b)=>a+b,0);
  if(!S.traits.late&&!S.traits.genius&&ovr()<47&&S.age>=25&&S.age<32&&isDice&&gain>=16){
    S.traits.late=true;
    const exDef=S.pos==='C'?['rng','fld','arm','cat']:[];
    const cands=POS_AB[S.pos].filter(k=>S.ab[k]<70&&!exDef.includes(k));
    for(let i=cands.length-1;i>0;i--){const j=Math.floor(R()*(i+1));const t=cands[i];cands[i]=cands[j];cands[j]=t;}
    const boost=cands.slice(0,2), bl=[];
    boost.forEach(k=>{ S.pot[k]=Math.min(80,(S.pot[k]||62)+10); S.ab[k]=clamp(S.ab[k]+5,1,80);
      bl.push(`${ABL[k]} <b class="up">+5</b>（潛力上限 +10 → ${S.pot[k]}）`); });
    card('gold','隱藏素質解鎖：大器晚成',`別人都以為你到頂了，你卻在這一年脫胎換骨——從今以後，每一顆訓練骰<b class="hl">永久固定 3 點以上</b>，事件卡好結果機率提升至 <b class="hl">70%</b>。`+(bl.length?`潛能重新被評估：${bl.join('、')}。`:'')+'你的故事，才正要展開。');
    board(1); }
}
export function checkTraitsMid(){
  /* 自律狂:25 歲前累積保守「成功」15 次 + 從未外遇被抓 + 宵夜 <5 次 */
  if(!S.traits.disc&&S.age<25&&(S.cntSaveWin||0)>=15&&S.love.caught===0&&S.cntSnack<5){
    traitCard('disc','自律狂','你見過凌晨四點的洛杉磯嗎？——年紀輕輕就把身體當成聖殿經營，沒有派對、沒有酒精，只有重訓室的鐵片聲：<b class="hl">整條衰退曲線延後兩年</b>，你的巔峰比同梯更長。'); }
  /* 大心臟:25 歲前豪賭(全力一搏)成功 7 次(允許失敗) */
  if(!S.traits.clutch&&S.age<25&&S.cntBoldWin>=7){
    traitCard('clutch','大心臟','每次的豪賭淬鍊出你無與無比的心性，愈刺激的狀況只會讓你更加幹勁十足。從此以後，愈賭愈強，成功獎勵愈大，失敗懲罰愈少，不過在豪賭的路上，還是要注意一下身邊的其他人……<br><b class="hl">「全力一搏」成功率提升至天才級、成功加成 +4、失敗只 −2、受傷風險降到普通級；國際賽個人成績獲得小幅加成</b>。'); }
  /* 外務纏身:宵夜/代言/緋聞累計(以宵夜次數 + 感情事件觸發次數估) */
  if(!S.traits.distract&&!S.traits.disc&&(S.love.affairs+S.love.caught+S.cntSnack)>=4&&(S.love.affairs+S.love.caught)>=1){
    traitCard('distract','外務纏身','通告、代言、社群媒體佔據了你太多心神，休賽季很久沒有完整專注在棒球上——<b class="dn">季初擲骰永久 −1 顆</b>（最低 2 顆）。','bad'); }
  /* 更衣室毒瘤:豪賭失敗 4+ 次,或渣男 */
  if(!S.traits.cancer&&!S.traits.franchise&&!S.traits.intlace&&(S.cntBoldFail>=10||S.traits.scum)){
    traitCard('cancer','更衣室毒瘤','教練受夠了你的不可控，隊友對你的新聞指指點點。比起成績，球團現在更想清理休息室的氣氛——<b class="dn">季末被交易機率大增、續約條件惡化</b>。','bad'); }
}
