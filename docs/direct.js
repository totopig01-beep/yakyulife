
(function(){
'use strict';
const UXVER='2.0.7-STABLE';

/* ===== 1. 事件卡：三種應對全部固定成功 ===== */
drawEvents=function(n,done){
  if(n<=0){done();return;}
  choose('',[{t:`抽事件卡（剩 ${n} 張）`,main:true,f:()=>{
    const pool=EVENTS.filter(e=>e.for==='*'||(e.for==='P'&&S.pos==='P')||((e.for==='A'||e.for==='B')&&S.pos!=='P')||(e.for==='PRO'&&S.stage==='PRO'));
    const ev=pick(pool);
    const after=()=>{board(1);drawEvents(n-1,done);};
    choose(`事件｜${ev.n} — 你要怎麼應對？`,[
      {t:'全力一搏',warn:true,s:'成功率 100%｜固定成功、最大加成（+3）',f:()=>resolveEvent(ev,'bold',after)},
      {t:'照常執行',main:true,s:'成功率 100%｜固定成功、標準加成（+2）',f:()=>resolveEvent(ev,'norm',after)},
      {t:'保守應對',s:'成功率 100%｜固定成功、最小加成（+1）',f:()=>resolveEvent(ev,'safe',after)}
    ]);
  }}]);
};

resolveEvent=function(ev,mode,done){
  done=done||function(){};
  if(mode==='safe')S.cntSave++;
  const good=true;
  const tag=mode==='safe'?'保守應對':mode==='bold'?'全力一搏':'';
  if(mode==='bold')S.cntBoldWin++;
  if(mode==='safe')S.cntSaveWin=(S.cntSaveWin||0)+1;
  const mag=mode==='safe'?1:mode==='bold'?3:2;
  const fx=ev.g;
  let out=[],touched=false;
  const applyAbil=(k,dir)=>{
    const step=dir*mag;
    if(dir>0){
      let gained=0,overflow=0;
      for(let i=0;i<mag;i++){const g=addAb(k,1);if(g>0)gained+=g;else overflow++;}
      if(gained>0)out.push(`${ABL[k]} <span class="up">+${gained}</span>`);
      if(overflow>0)statBonus(overflow,out);
      touched=true;
    }else{
      const g=addAb(k,step);touched=true;
      out.push(`${ABL[k]} <span class="dn">${g}</span>`);
    }
  };
  for(const k in fx){
    const dir=fx[k]>0?1:-1;
    if(k==='inj'){
      const v=({1:8,2:12,3:16})[mag];
      S.tmpInj+=v;
      out.push(`本季受傷機率 <span class="dn">+${v}%</span>`);
    }else if(k==='rand') applyAbil(pick(POS_AB[S.pos]),dir);
    else if(k in S.ab) applyAbil(k,dir);
  }
  if(!touched)applyAbil(pick(POS_AB[S.pos]),1);
  card('good','事件卡｜'+ev.n+(tag?`（${tag}）`:''),
    `${ev.gt}。${mode==='bold'?'<b class="hl">豪賭成功！</b>':''}<br>${out.join('｜')||'（無數值變動）'}`);
  checkTraitsMid();
  done();
};

/* ===== 2. 季初訓練：永遠六顆、每顆都是6 ===== */
phasePre=function(){
  board(0);S.tmpInj=0;S.seasonFactor=1;S.skipMid=false;S.lastD=0;
  if(S.age>=48){endGame('身體已到極限，'+S.year+' 年春訓後宣布引退。');return;}
  const declAge=S.age-(S.traits.disc?2:0);
  if(declAge>=32){
    const dec=declAge>=35?5+(declAge-35):2;
    POS_AB[S.pos].forEach(k=>S.ab[k]=clamp(S.ab[k]-dec,1,80));
    card('bad','歲月不饒人',`${declAge>=35?'第二階段（逐年加劇）':'第一階段'}衰退：所有能力 <b class="dn">−${dec}</b>${S.traits.disc?'（自律狂：生涯延後兩年）':''}。訓練加點照常，但身體回不去了。`);
    board(0);
  }
  if(S.rehab>0){
    S.rehab--;S.skipMid=true;S.seasonFactor=0;
    card('bad','復健年','大傷尚未痊癒，本季確定<b class="dn">全年報銷</b>，只能在復健室度過。（MAX6：訓練仍固定 6 顆骰）');
    const dummySt={G:0,PA:0,AB:0,H:0,HR:0,RBI:0,SB:0,BB:0,W:0,L:0,SV:0,HLD:0,IP:0,SO:0,ER:0,avg:0,era:0,WHIP:0,DEF:0};
    S.log.push({y:S.year,age:S.age,tm:S.stage==='PRO'?S.teamName():(S.team||stageLabel()),line:'復健年・全年報銷',inj:true,st:S.stage==='PRO'?dummySt:null});
  }

  let afterAsk=()=>{
    const n=6,dice=[6,6,6,6,6,6];
    let newSix=0;
    for(let i=0;i<6;i++){
      if(S.age<22&&!S.traits.genius){S.six++;newSix++;}
    }
    let msg='自主訓練固定擲出 <b class="hl">6</b> 顆骰：<b class="hl">6、6、6、6、6、6</b>。';
    if(newSix&&!S.traits.genius)msg+=` 高標值「6」累計 <b class="hl">${S.six}/5</b> 次。`;
    card('','季初特訓',msg);
    if(S.six>=5&&!S.traits.genius&&S.age<22){
      S.traits.genius=true;
      const exDef=S.pos==='C'?['rng','fld','arm','cat']:[];
      const cands=POS_AB[S.pos].filter(k=>S.ab[k]<70&&!exDef.includes(k));
      for(let i=cands.length-1;i>0;i--){const j=Math.floor(R()*(i+1));const t=cands[i];cands[i]=cands[j];cands[j]=t;}
      const boost=cands.slice(0,2),bl=[];
      boost.forEach(k=>{S.pot[k]=Math.min(80,(S.pot[k]||62)+10);S.ab[k]=clamp(S.ab[k]+5,1,80);bl.push(`${ABL[k]} <b class="up">+5</b>（潛力上限 +10 → ${S.pot[k]}）`);});
      card('gold','隱藏素質解鎖：天才','22 歲前五度擲出高標值！'+(bl.length?`天賦覺醒：${bl.join('、')}。`:''));
      board(1);
    }
    choose('',[{t:'▸ 分配訓練成果（6 顆骰）',main:true,f:()=>dposReview(()=>allocUI({dice},'分配訓練成果（固定六顆6點）',()=>nextStep()))}]);
  };

  const preAsk=afterAsk;
  if(S.pos==='P'&&S.stage==='PRO'&&!S.skipMid){
    afterAsk=()=>{
      choose(`開季投球規劃（手臂狀況：${(function(){const r=S.tj/tjCap();return S.rehab>0?'復健中':r>=0.85?'手肘隱隱作痛':r>=0.6?'手臂略感疲勞':r>=0.35?'狀況尚可':'手感輕盈';})()}）`,[
        {t:'全力投',warn:true,s:'成績最佳｜手臂負荷最大（TJ 累積 ×1.25）',f:()=>{S.effort='全力投';preAsk();}},
        {t:'普通投',main:true,s:'標準強度｜TJ 累積正常',f:()=>{S.effort='普通投';preAsk();}},
        {t:'養生球',s:'成績保守｜省手臂（TJ 累積 ×0.65）',f:()=>{S.effort='養生球';preAsk();}}
      ]);
    };
  }
  if(S.stage==='U'&&S.stageYr>=2){
    const o=ovr();
    const opts=[
      {t:'投入中華職棒選秀',s:`目前綜合 ${o}｜年齡加權：越年輕評價越高`,f:()=>runDraft(true,afterAsk)},
      {t:'留在大學繼續磨練',main:true,f:afterAsk}
    ];
    const agePenalty=Math.max(0,S.age-18);
    const reqNPB=44+Math.floor(agePenalty/2),reqMiLB=50+Math.floor(agePenalty/2);
    const bonusNPB=Math.max(100,800-agePenalty*180),bonusMiLB=Math.max(150,1500-agePenalty*350);
    if(o>=reqNPB)opts.push({t:'洽談旅日合約',s:'休學挑戰日職｜大齡影響簽約金',f:()=>{S.stage='PRO';S.team='';S.svc=0;S.faElig=false;pickOfferUI('日職球團報價','NPB',makeOffers('NPB',2,bonusNPB,2,3,'NPB2',null),afterAsk);}});
    if(o>=reqMiLB)opts.push({t:'洽談旅美合約',s:'休學挑戰小聯盟｜大齡影響簽約金',f:()=>{S.stage='PRO';S.team='';S.svc=0;S.faElig=false;pickOfferUI('大聯盟球團報價','MiLB',makeOffers('MiLB',2,bonusMiLB,3,4,o>=55?'A1':'R',null),afterAsk);}});
    choose(`大${['一','二','三','四'][S.stageYr-1]}季前 · 升學與職棒的十字路口`,opts);
    return;
  }
  if(S.stage==='PRO'&&S.age>=36&&S.rehab===0){
    choose('又是一年春訓，身體大不如前了',[
      {t:'再戰一年',main:true,f:afterAsk},
      {t:'召開引退記者會',warn:true,s:'結束選手生涯',f:()=>{buyoutRemaining();daibaFarewell(()=>endGame('功成身退，於 '+S.year+' 年宣布引退。'));}}
    ]);
    return;
  }
  afterAsk();
};

/* ===== 3. 每年薪資：實際年薪寫入該年 log ===== */
let salaryAtYearStart=0;
const _startYear=startYear;
startYear=function(){
  salaryAtYearStart=S&&S.salary?S.salary:0;
  return _startYear.apply(this,arguments);
};
function stampSalary(){
  try{
    if(!S||S.stage!=='PRO')return;
    const sal=Math.max(0,Math.round((S.salary||0)-salaryAtYearStart));
    const rows=(S.log||[]).filter(r=>r&&r.st&&r.y===S.year&&r.age===S.age);
    if(rows.length)rows[rows.length-1].sal=sal;
  }catch(e){}
}
const _advance=advance;
advance=function(){stampSalary();return _advance.apply(this,arguments);};

const _endGame=endGame;
endGame=function(reason){
  stampSalary();
  const ret=_endGame.apply(this,arguments);
  setTimeout(()=>{
    try{
      const rows=(S.log||[]).filter(r=>r&&r.st);
      const table=[...document.querySelectorAll('table.fin')].find(t=>/WHIP|OPS|ERA/.test(t.textContent||''));
      if(!table||table.dataset.salaryAdded)return;
      table.dataset.salaryAdded='1';
      const th=document.createElement('th');th.textContent='薪資';table.querySelector('tr')?.appendChild(th);
      const trs=[...table.querySelectorAll('tr')].slice(1);
      trs.forEach((tr,i)=>{
        const td=document.createElement('td');
        td.style.whiteSpace='nowrap';
        td.textContent=rows[i]&&rows[i].sal!=null?fmtMoney(rows[i].sal):'—';
        tr.appendChild(td);
      });
    }catch(e){}
  },0);
  return ret;
};

/* 當年成績卡直接顯示預估/本年度薪水 */
const _card=card;
card=function(cls,title,html){
  try{
    if(S&&S.stage==='PRO'&&/^球季數據/.test(String(title||''))){
      let sal=Math.round(salaryFor(S.lv,S.lastD||0)*(S.ct?S.ct.mult:1)*dpMult());
      if(S.seasonFactor===0)sal=Math.round(sal*.5);
      html+=`<div class="statline" style="margin-top:8px">💰 當年薪水：<b class="hl">${fmtMoney(sal)}</b></div>`;
    }
  }catch(e){}
  return _card(cls,title,html);
};

/* 版本標記 */
const badge=document.createElement('div');
badge.textContent='UX 2.0.7｜ALL100 ✓｜6×6 ✓';
badge.style.cssText='position:fixed;right:8px;top:20px;z-index:9997;color:#8fd08f;font:700 10px monospace;pointer-events:none';
document.body.appendChild(badge);
console.info('YaKyoLife '+UXVER+' loaded');
})();
