import {S, stageLabel} from '../core/state.js';
import {$, card, _curYearBody} from './dom.js';

/* ================= 生涯時間軸(純呈現層,不觸碰 RNG) ================= */
export let TL=[];
export function resetTL(){ TL=[]; }
export function tlStage(){
  if(!S)return '';
  if(S.stage==='HS')return '高中 · '+S.team;
  if(S.stage==='U')return '大學 · '+S.team;
  if(S.stage==='AMA')return '業餘 · '+S.team;
  const og={CPBL:'中職',NPB:'旅日',MiLB:'旅美'}[S.org]||'職業';
  return og+' · '+(S.orgTeam||'');
}
export function tlPush(){
  TL.push({year:S.year,stage:tlStage(),lab:stageLabel(),note:'',pri:0,el:_curYearBody?_curYearBody.parentElement:null});
  renderTimeline();
}
export function tlNote(pri,txt){ /* keep only the highest-priority note per year */
  const e=TL[TL.length-1]; if(!e||!txt)return;
  if(pri>=e.pri){ e.note=txt; e.pri=pri; renderTimeline(); }
}
export function renderTimeline(){
  const list=$('tl-list'), strip=$('tl-strip');
  if(list){
    let html='',cur=null;
    TL.forEach((e,i)=>{
      if(e.stage!==cur){ if(cur!==null)html+='</div>'; html+=`<div class="tlg"><div class="tlg-h">${e.stage}</div>`; cur=e.stage; }
      const now=i===TL.length-1, gone=!(e.el&&e.el.isConnected);
      html+=`<div class="tl-item${now?' now':''}${(gone&&!now)?' gone':''}" data-i="${i}"><span class="dot"></span><span class="t">${e.year} ${e.lab}${e.note?' <b>'+e.note+'</b>':''}</span></div>`;
    });
    if(cur!==null)html+='</div>';
    list.innerHTML='<div id="tl-wrap">'+html+'</div>';
    list.scrollTop=list.scrollHeight; /* keep the newest year in view */
  }
  if(strip){
    strip.innerHTML=TL.map((e,i)=>`<span class="tl-chip${i===TL.length-1?' now':''}" data-i="${i}">${e.year}${e.note?'★':''}</span>`).join('');
    strip.scrollLeft=strip.scrollWidth;
  }
}
export function tlScrollTo(e){ /* scroll via window.scrollTo (not scrollIntoView; see handoff) */
  if(!e||!e.el||!e.el.isConnected)return;
  e.el.classList.remove('collapsed'); /* expand the target year so the jump has visible feedback */
  const bd=$('board'), off=(bd?bd.offsetHeight:0)+10;
  window.scrollTo(0,Math.max(0,e.el.getBoundingClientRect().top+window.scrollY-off));
}
export function careerTimelineCard(){ /* two-layer horizontal timeline for the career summary */
  if(!TL.length)return;
  const eras=[];
  TL.forEach(e=>{ const last=eras[eras.length-1];
    if(last&&last.stage===e.stage)last.n++; else eras.push({stage:e.stage,from:e.year,n:1}); });
  const eraCols=['var(--info)','var(--good)','var(--accent)','var(--dim)'];
  const bands=eras.map((e,i)=>{ const to=e.from+e.n-1;
    const span=e.n>1?`${e.from}–${String(to).slice(2)}`:String(e.from);
    return `<div title="${e.stage} ${span}" style="flex:${e.n};min-width:0;background:var(--panel2);border-top:3px solid ${eraCols[i%4]};border-radius:var(--r);padding:6px 8px 5px">`+
      `<div style="font-family:var(--head);font-size:11px;font-weight:700;letter-spacing:.08em;white-space:nowrap;overflow:hidden">${e.stage}</div>`+
      `<div style="font-family:var(--mono);font-size:10px;opacity:.75;white-space:nowrap;overflow:hidden">${span}</div></div>`; }).join('');
  const y0=TL[0].year, span=Math.max(1,TL.length-1);
  let ms=TL.filter(e=>e.note);
  if(ms.length>7)ms=ms.slice().sort((a,b)=>b.pri-a.pri||a.year-b.year).slice(0,7).sort((a,b)=>a.year-b.year);
  /* width-aware greedy lanes: each label takes the first of 3 rows where it
     clears that row's previous label (widths estimated from char count at the
     guaranteed min-width, so wider containers only add slack); if 3 rows are
     not enough, the per-year pixel width grows until everything fits */
  const estW=s=>{let w=0;for(const c of s)w+=c.codePointAt(0)>0x2E7F?10.5:7.5;return w;};
  const labW=e=>Math.max(estW(String(e.year)),estW(e.note))+10;
  let pxY=32,placed=null;
  while(!placed&&pxY<=320){
    const axisW=TL.length*pxY-52,right=[],out=[];
    for(const e of ms){
      const x=(e.year-y0)/span*axisW,w=labW(e);
      let r=0;
      while(r<right.length&&x-w/2<right[r])r++;
      if(r>2){out.length=0;break;}
      right[r]=x+w/2;out.push({e,r});
    }
    if(out.length===ms.length)placed=out;else pxY+=8;
  }
  if(!placed)placed=ms.map((e,j)=>({e,r:j%3})); /* same-year duplicates can never separate; degrade gracefully */
  const maxR=placed.reduce((m,p)=>Math.max(m,p.r),0);
  const dots=placed.map(({e,r})=>`<div style="position:absolute;left:${((e.year-y0)/span*100).toFixed(2)}%;top:0;transform:translateX(-50%);text-align:center">`+
      `<span style="width:10px;height:10px;border-radius:50%;background:var(--accent);box-shadow:var(--glow);display:block;margin:4px auto 0"></span>`+
      `<div style="margin-top:${4+r*38}px">`+ /* row step 38px: the 2-line label block is ~33px tall at the inherited 1.6 line-height */
      `<span style="font-family:var(--mono);font-size:10px;color:var(--dim);display:block;white-space:nowrap">${e.year}</span>`+
      `<span style="font-size:10.5px;font-weight:700;display:block;white-space:nowrap">${e.note}</span></div></div>`).join('');
  /* guaranteed width per year; long careers scroll horizontally inside the card */
  const minW=TL.length*pxY;
  card('','生涯時間軸',
    `<div style="overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;margin-top:4px;padding-bottom:4px">`+
    `<div style="min-width:${minW}px">`+
    `<div style="display:flex;gap:3px;margin-bottom:6px">${bands}</div>`+
    `<div style="margin:0 26px"><div style="position:relative;height:${62+38*maxR}px">`+
    `<i style="position:absolute;left:0;right:0;top:8px;height:2px;background:var(--edge)"></i>${dots}</div></div>`+
    `</div></div>`);
}
