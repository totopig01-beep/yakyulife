from pathlib import Path
import re, shutil, sys, subprocess

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else '_upstream')
DST = Path(sys.argv[2] if len(sys.argv) > 2 else 'docs')
PUBLIC_URL = 'https://totopig01-beep.github.io/yakyulife/'
TITLE = '模擬棒球人生爽版'

if not (SRC / 'index.html').exists():
    raise SystemExit('upstream index.html not found')

if DST.exists():
    shutil.rmtree(DST)

def ignore_dir(path, names):
    skip = {'.git', '.github', 'docs', 'CNAME'}
    return [n for n in names if n in skip]

shutil.copytree(SRC, DST, ignore=ignore_dir)
(DST / '.nojekyll').write_text('', encoding='utf-8')
(DST / 'CNAME').unlink(missing_ok=True)


def read(rel):
    p = DST / rel
    if not p.exists():
        raise SystemExit(f'missing required upstream file: {rel}')
    return p.read_text(encoding='utf-8')


def write(rel, s):
    (DST / rel).write_text(s, encoding='utf-8')


def replace_once(s, old, new, label):
    if old not in s:
        raise SystemExit(f'patch failed [{label}]: marker not found')
    return s.replace(old, new, 1)

# ---------- Branding / attribution ----------
html = read('index.html')
html = html.replace('YaKyoLife - 棒球人生模擬器', TITLE)
if 'name="author"' not in html:
    html = html.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n<meta name="author" content="最先生 Mr.TheMost">', 1)
html = re.sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{PUBLIC_URL}">', html)
html = re.sub(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{PUBLIC_URL}">', html)
html = html.replace('https://www.yakyolife.com/og.png', PUBLIC_URL + 'og.png')

logo_pat = re.compile(r'<h1 id="logo-tap" class="lockup">.*?</h1>', re.S)
logo = '''<h1 id="logo-tap" class="lockup" style="display:block;text-align:center">
      <span style="display:block;font-size:clamp(30px,7vw,52px);font-weight:900;color:var(--chalk);letter-spacing:.06em">模擬棒球人生爽版</span>
      <span class="lockup-sub"><i></i><em>YaKyoLife 設定調整版</em><i></i></span>
    </h1>
    <div class="sub" style="text-align:center;line-height:1.8;margin-top:8px">
      原作者：<a href="https://www.threads.com/@mr.themost" target="_blank" rel="noopener noreferrer" style="color:var(--accent);font-weight:700">最先生 Mr.TheMost</a><br>
      <span style="font-size:12px">本版本以原作者 YaKyoLife 為基底，調整部分遊戲設定；非商業使用。</span>
    </div>'''
html, n = logo_pat.subn(logo, html, count=1)
if n != 1:
    raise SystemExit('patch failed [branding]: logo block not found')
write('index.html', html)

# Keep share/restart URLs on this Pages build.
cfg = read('src/config.js')
cfg, n = re.subn(r"export const OFFICIAL_URL='[^']*';", f"export const OFFICIAL_URL='{PUBLIC_URL}';", cfg, count=1)
if n != 1:
    raise SystemExit('patch failed [config]: OFFICIAL_URL')
write('src/config.js', cfg)

# ---------- Event cards: every choice is 100% success ----------
ev = read('src/flow/events.js')
# v1.5.x puts eventEligible immediately after evOdds; older modular versions put drawEvents there.
ev, n = re.subn(
    r"export function evOdds\(\)\{.*?\n\}\n(?=export function (?:eventEligible|drawEvents))",
    "export function evOdds(){ return {safe:100, norm:100, bold:100}; }\n",
    ev, count=1, flags=re.S)
if n != 1:
    raise SystemExit('patch failed [events]: evOdds')

for mode in ('safe','bold','norm'):
    old = f'good=chance(od.{mode})'
    if old not in ev:
        raise SystemExit(f'patch failed [events]: {mode} success marker')
    ev = ev.replace(old, 'good=true', 1)

# New event system can add temporary injury risk after a bad result. In 爽版 it is always zero.
ev, n = re.subn(
    r"const injuryRisk=eventInjuryRisk\(ev,mode,good,!!S\.traits\.clutch\);",
    "const injuryRisk=0; /* 爽版：事件也不增加受傷機率 */",
    ev, count=1)
if n == 0 and 'eventInjuryRisk' in ev:
    # Older event system has no eventInjuryRisk call, which is fine.
    pass

# Do not allow clutch+genius to turn the strongest training-event reward into +4.
ev = ev.replace("(good?(full?4:3):(soft?2:3))", "(good?3:(soft?2:3))")

if 'good=chance(od.' in ev:
    raise SystemExit('validation failed [events]: probability check remains')
write('src/flow/events.js', ev)

# ---------- Pre-season training: exactly six dice, all sixes ----------
ph = read('src/flow/phases.js')
ph, n = re.subn(
    r"export function phasePre\(\)\{\s*\n\s*board\(0\);",
    "export function phasePre(){\n  /* 爽版：傷病與 Tommy John 永久關閉；舊存檔殘留在季初清除。 */\n  S.rehab=0; S.tj=0; S.injNext=0; S.tmpInj=0; S.marketInjury='healthy';\n  board(0);",
    ph, count=1)
if n != 1:
    raise SystemExit('patch failed [NO-INJURY]: phasePre reset')

ph, n = re.subn(
    r"let n=S\.skipMid\?2:\(\(\)=>\{const r=R\(\);return r<0\.35\?3:r<0\.75\?4:r<0\.95\?5:6;\}\)\(\);",
    "let n=6;",
    ph, count=1)
if n != 1:
    raise SystemExit('patch failed [MAX6]: dice count')
ph = re.sub(r"\s*if\(S\.traits\.distract&&!S\.skipMid\)n=Math\.max\(2,n-1\);[^\n]*", "\n    /* 爽版：外務纏身不改變固定六顆 */", ph, count=1)
ph = re.sub(r"\s*if\(S\.traits\.academy&&!S\.skipMid&&chance\(35\)\)n\+\+;[^\n]*", "\n    /* 爽版：學院派不增加骰數 */", ph, count=1)
ph, n = re.subn(
    r"const v=S\.traits\.genius\?ri\(4,6\):S\.traits\.late\?ri\(3,6\):ri\(1,6\);",
    "const v=6;",
    ph, count=1)
if n != 1:
    raise SystemExit('patch failed [MAX6]: die value')
ph = ph.replace("if(S.traits.combo && !S.skipMid && (S.comboKey||S.samePickKey)) {", "if(false && S.traits.combo && !S.skipMid && (S.comboKey||S.samePickKey)) {", 1)
ph = ph.replace('（擲骰減為 2 顆）', '（爽版：仍固定 6 顆骰）')
ph = ph.replace('自主訓練擲出 <b class="hl">${n}</b> 顆骰。', '自主訓練固定擲出 <b class="hl">6</b> 顆骰：<b class="hl">6、6、6、6、6、6</b>。')
if 'let n=6;' not in ph or 'const v=6;' not in ph:
    raise SystemExit('validation failed [MAX6]')
write('src/flow/phases.js', ph)

# ---------- Injuries / Tommy John: hard-disabled ----------
inj = read('src/engine/injury.js')
inj = replace_once(
    inj,
    "export function tjAccrue(st,lv){",
    "export function tjAccrue(st,lv){ S.tj=0; return; /* 爽版：不累積 TJ 負荷 */",
    'TJ accrue off')
inj = replace_once(
    inj,
    "export function tjGamble(cont){",
    "export function tjGamble(cont){ S.tj=0; S.rehab=0; if(cont)cont(); return; /* 爽版：永不觸發 Tommy John */",
    'TJ gamble off')
inj = replace_once(
    inj,
    "export function injuryProb(){",
    "export function injuryProb(){ return 0; /* 爽版：所有一般傷病機率固定 0% */",
    'injury probability zero')
inj = replace_once(
    inj,
    "export function rollInjury(){",
    "export function rollInjury(){ S.injNext=0; S.tmpInj=0; S.rehab=0; S.tj=0; S.marketInjury='healthy'; card('info','健康回報','本季平安出賽。（爽版：受傷機率 0%｜Tommy John 關閉）'); return; /* 爽版硬關閉傷病判定 */",
    'injury roll off')
if '所有一般傷病機率固定 0%' not in inj or '永不觸發 Tommy John' not in inj:
    raise SystemExit('validation failed [NO-INJURY]')
write('src/engine/injury.js', inj)

# v1.5.x already records annual salary and renders a salary section in the retirement image.
# We deliberately keep the upstream implementation rather than patching it again.

# Record exactly which upstream revision produced the build.
try:
    sha = subprocess.check_output(['git', '-C', str(SRC), 'rev-parse', 'HEAD'], text=True).strip()
except Exception:
    sha = 'unknown'
(DST / '.upstream-sha').write_text(sha + '\n', encoding='utf-8')

print('Built 爽版 from upstream', sha)
