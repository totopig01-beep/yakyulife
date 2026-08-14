import {S} from '../core/state.js';
import {renderTraits} from './traits.js';
import {clearAlloc, allocFullClose} from './alloc.js';
import {themeModal, applyBigText, applyMobileUI} from './prefs.js';
import {DPN, POSN} from '../data/abilities.js';
import {TEAM_COLOR} from '../data/teams.js';
import {playerName} from '../core/state.js';
import {salParts, fmtMoney} from '../engine/contract.js';
import {roleN} from '../engine/season.js';
import {playerType, ovr} from '../engine/ability.js';

export const $=id=>document.getElementById(id);
export let _curYearBody=null; /* 當前年度的內容容器 */
const MAX_YEARS=8;         /* DOM 最多保留幾個年度區塊 */
export function logTarget(){ return _curYearBody || $('log'); }
export function scrollBottom(){ /* iOS Safari 於 iframe 內平滑滾動易觸發白畫面,改用同步滾動+rAF */
  try{ requestAnimationFrame(function(){ window.scrollTo(0, document.body.scrollHeight); }); }
  catch(e){ try{ window.scrollTo(0, document.body.scrollHeight); }catch(_){} }
}
/* Team colours are jersey primaries, not text colours. Measured against the old #1a1a1a chip
   background, 29 of the 48 fell below 3:1 and 紐約帝國 (#0C2340) sat at 1.10:1, which is what
   players reported as too dark to read. Use the colour as the chip's background instead and
   pick the text from its luminance: that keeps the team identity at full saturation and puts
   every one of the 48 above 4.5:1. The border is the text colour at low alpha so a dark team
   still reads as a chip against a dark card. */
export function teamChip(hex){
  const h=hex.replace('#','');
  const v=[0,2,4].map(i=>{ const c=parseInt(h.slice(i,i+2),16)/255;
    return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4); });
  const L=.2126*v[0]+.7152*v[1]+.0722*v[2];
  const dark=(L+.05)/.05 > 1.05/(L+.05); /* black text out-contrasts white on this colour */
  return {bg:hex,fg:dark?'#000000':'#ffffff',bd:dark?'rgba(0,0,0,.4)':'rgba(255,255,255,.45)'};
}
/* ---------- 主題化對話框(純呈現層) ---------- */
export function modalOpen(html){ const m=$('modal'); if(!m)return; $('modal-box').innerHTML=html; m.classList.add('show'); }
export function modalClose(){ const m=$('modal'); if(m)m.classList.remove('show'); }
export function menuModal(){
  const wide=matchMedia('(min-width:921px)').matches;
  const mob=document.body.classList.contains('mobile-ui');
  const big=document.body.classList.contains('big-text');
  modalOpen(`<h3>選單</h3>
    <button class="btn" id="md-theme" style="text-align:center">切換佈景主題</button>
    <button class="btn" id="md-big" style="text-align:center">${big?'切回標準字級':'改用大字級'}</button>
    ${wide?`<button class="btn" id="md-ui" style="text-align:center">${mob?'切回電腦版介面':'改用手機版介面'}</button>`:''}
    <button class="btn warn" id="md-restart0" style="text-align:center">重新開始</button>
    <button class="btn" id="md-close" style="text-align:center;margin-top:14px">關閉</button>`);
  $('md-theme').onclick=themeModal;
  $('md-big').onclick=()=>{ applyBigText(!big); menuModal(); };
  const mu=$('md-ui'); if(mu)mu.onclick=()=>{ applyMobileUI(!mob); menuModal(); };
  $('md-restart0').onclick=restartModal;
  $('md-close').onclick=modalClose;
}
export function restartModal(){
  modalOpen(`<h3>重新開始</h3><p>確定要放棄這段人生，從頭開始嗎？</p>
    <button class="btn warn" id="md-restart" style="text-align:center">放棄這段人生，重新開始</button>
    <button class="btn" id="md-cancel" style="text-align:center">繼續目前的生涯</button>`);
  $('md-restart').onclick=()=>{ _allowLeave=true; location.href=location.pathname; };
  $('md-cancel').onclick=menuModal;
}
/* Accidental-reload guard: pull-to-refresh / F5 / tab close mid-game triggers the
   native leave prompt; intentional restarts set _allowLeave, finished games skip it */
let _allowLeave=false;
window.addEventListener('beforeunload',function(ev){
  if(!S||S.done||_allowLeave)return;
  ev.preventDefault(); ev.returnValue='';
});
export function card(cls,title,html){ const d=document.createElement('div'); d.className='card '+cls;
  d.innerHTML=(title?`<h4>${title}</h4>`:'')+html; logTarget().appendChild(d);
  renderTraits(); /* settlement-time trait unlocks emit a card without a board() refresh */
  scrollBottom(); }
export function divider(t){ /* 每個 divider 開啟新的年度摺疊區塊 */ const log=$('log'); const blocks=log.querySelectorAll('.yr-block'); /* 替剛結束的「上一年」加上下拉箭頭標記，但保留展開（不加上 collapsed） */ const prev = blocks[blocks.length - 1]; if(prev){ const h = prev.querySelector('.yr-head'); if(h && prev.querySelector('.yr-body').children.length) h.classList.add('has-body'); } /* 找到「前年」（倒數第二個區塊）並將其摺疊起來 */ const prevPrev = blocks[blocks.length - 2]; if(prevPrev){ prevPrev.classList.add('collapsed'); } /* 建新區塊 */ const block=document.createElement('div'); block.className='yr-block'; const head=document.createElement('div'); head.className='yr-head'; head.textContent=t; const body=document.createElement('div'); body.className='yr-body'; head.onclick=()=>block.classList.toggle('collapsed'); block.appendChild(head); block.appendChild(body); log.appendChild(block); _curYearBody=body; /* 超過上限:移除最舊的年度區塊(釋放 DOM) */ const newBlocks=log.querySelectorAll('.yr-block'); if(newBlocks.length>MAX_YEARS){ for(let i=0;i<newBlocks.length-MAX_YEARS;i++)newBlocks[i].remove(); } }
export function actClear(){ const a=$('act'); a.innerHTML=''; a.classList.remove('collapsed');
  const t=$('act-toggle'); if(t)t.style.display='none';
  /* every actClear() site is a point where an allocation has ended or is restarting,
     so this is also where the overlay is torn down and the live allocation forgotten */
  clearAlloc(); allocFullClose(); const fb=$('af-body'); if(fb)fb.innerHTML='';
  const s=$('act-side'); if(s)s.classList.remove('alloc'); }
export function actToggleSync(){
  const a=$('act'), t=$('act-toggle'); if(!t)return;
  const has=a.innerHTML.trim()!=='' && a.style.display!=='none';
  t.style.display=has?'block':'none';
  t.textContent=a.classList.contains('collapsed')?'⌃ 展開選項':'⌄ 收合選項';
}
export function choose(title,opts){
  actClear(); const a=$('act');
  a.classList.remove('collapsed'); /* 新選項出現時自動展開 */
  if(title)a.innerHTML=`<div class="title">${title}</div>`;
  opts.forEach(o=>{ const b=document.createElement('button');
    b.className='btn'+(o.main?' main':'')+(o.warn?' warn':'');
    b.innerHTML=o.t+(o.s?`<small>${o.s}</small>`:'');
    b.onclick=()=>{ actClear(); o.f(); }; a.appendChild(b); });
  actToggleSync(); scrollBottom();
}
export function board(phase){
  renderTraits();
  $('bd-name').innerHTML=`${S.name}<small>#${S.jersey}</small>`;
  $('bd-role').textContent=`${S.dpos?DPN[S.dpos]:POSN[S.pos]}${S.role?'・'+roleN(S.role):''}・${playerType()}${S.traits.genius?' ★':''}`;
  let t;
  if(S.stage==='HS')t=S.team+'（高'+['一','二','三'][S.stageYr-1]+'）';
  else if(S.stage==='U')t=S.team+'（大'+['一','二','三','四'][S.stageYr-1]+'）';
  else if(S.stage==='AMA')t=S.team+'（業餘）';
  else t=S.teamName();
  { const tc = (S.orgTeam && TEAM_COLOR[S.orgTeam]) || 'var(--amber)';
    /* 判斷顏色是否為白色，避免白底白字 */
    const isWhite = (tc.toLowerCase() === '#ffffff' || tc.toLowerCase() === '#fff');
    
    /* 只有進入職業且有設定代表色時，才加上白底標籤樣式 */
    const isProColored = (S.stage === 'PRO' && TEAM_COLOR[S.orgTeam]);
    const txtColor = isProColored ? (isWhite ? '#000000' : tc) : 'var(--amber)';
    const bgStyle = isProColored ? 'background:#ffffff; padding:2px 8px; border-radius:6px; box-shadow:0 2px 4px rgba(0,0,0,0.4);' : '';
    
    const dot = isProColored ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${isWhite ? '#cccccc' : tc};margin-right:6px;vertical-align:middle;box-shadow:0 0 2px rgba(0,0,0,0.2);"></span>` : '';
    
    $('bd-team').innerHTML = dot + `<span style="color:${txtColor}; ${bgStyle} font-weight:900;">${t}</span>`; }
  $('bd-age').textContent=S.age; $('bd-year').textContent=S.year;
  $('bd-ovr').textContent=ovr(); if(S.pos==='P'){const el=$('bd-tj'); if(el)el.textContent='';}
  { const sal=Math.round(S.salary),sp=salParts(sal),salEl=$('bd-sal'); salEl.textContent=sp.v;
    salEl.style.fontSize='';
    const lb=$('bd-sal-lbl'); if(lb)lb.textContent=`生涯薪(${sp.u})`;
    const tip=$('bd-sal-tip'); if(tip)tip.textContent=fmtMoney(sal)+' 台幣'; }
  [0,1,2].forEach(i=>$('lp'+i).classList.toggle('on',i===phase));
}
