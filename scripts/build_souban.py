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


def need_replace(s, old, new, label):
    if old not in s:
        raise SystemExit(f'patch failed [{label}]: marker not found')
    return s.replace(old, new, 1)

# ---------- Branding / attribution ----------
html = read('index.html')
html = html.replace('YaKyoLife - 棒球人生模擬器', TITLE)
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
      <span style="font-size:12px">本版本以原作者 YaKyoLife 為基底，僅調整部分遊戲設定與介面；非商業使用。</span>
    </div>'''
html, n = logo_pat.subn(logo, html, count=1)
if n != 1:
    raise SystemExit('patch failed [branding]: logo block not found')
write('index.html', html)

# Keep share/restart URLs on this independent Pages build.
cfg = read('src/config.js')
cfg, n = re.subn(r"export const OFFICIAL_URL='[^']*';", f"export const OFFICIAL_URL='{PUBLIC_URL}';", cfg, count=1)
if n != 1:
    raise SystemExit('patch failed [config]: OFFICIAL_URL')
write('src/config.js', cfg)

# ---------- Event cards: every choice is 100% success ----------
ev = read('src/flow/events.js')
ev, n = re.subn(
    r"export function evOdds\(\)\{.*?\n\}\nexport function drawEvents",
    "export function evOdds(){ return {safe:100, norm:100, bold:100}; }\nexport function drawEvents",
    ev, count=1, flags=re.S)
if n != 1:
    raise SystemExit('patch failed [events]: evOdds')
for old, new, label in [
    ("if(mode==='safe'){ good=chance(od.safe); tag='保守應對'; }", "if(mode==='safe'){ good=true; tag='保守應對'; }", 'safe100'),
    ("else if(mode==='bold'){ good=chance(od.bold); tag='全力一搏';", "else if(mode==='bold'){ good=true; tag='全力一搏';", 'bold100'),
    ("else { good=chance(od.norm); tag=''; }", "else { good=true; tag=''; }", 'norm100'),
]:
    ev = need_replace(ev, old, new, label)
# Keep the user's requested +1 / +2 / +3 scale even after clutch unlocks.
ev = ev.replace("if(mode==='bold'&&S.traits.clutch)mag=good?4:2; /* 大心臟:上檔更高、下檔更軟 */", "/* 爽版：全力一搏固定 +3，不再因大心臟改成 +4 */")
# Injury-type event cards cannot add injury risk in 爽版; keep the display consistent with the hard 0% rule.
ev, n_inj = re.subn(
    r"if\(k==='inj'\)\{.*?\}\s*else if\(k==='rand'\)",
    "if(k==='inj'){ S.tmpInj=0; out.push('爽版：本季受傷機率固定 <span class=\"up\">0%</span>');}\n    else if(k==='rand')",
    ev, count=1, flags=re.S)
if n_inj != 1:
    raise SystemExit('patch failed [events]: injury event branch')
if 'good=chance(od.' in ev:
    raise SystemExit('validation failed [events]: probability success check remains')
write('src/flow/events.js', ev)

# ---------- Pre-season training: exactly six dice, all sixes ----------
ph = read('src/flow/phases.js')
# Clear any injury/TJ residue from old saves before the new season starts.
ph, n = re.subn(
    r"export function phasePre\(\)\{\s*\n\s*board\(0\);",
    "export function phasePre(){\n  /* 爽版：傷病與 Tommy John 永久關閉；舊存檔殘留也在季初清除。 */\n  S.rehab=0; S.tj=0; S.injNext=0; S.tmpInj=0; S.marketInjury='healthy';\n  board(0);",
    ph, count=1)
if n != 1:
    raise SystemExit('patch failed [NO-INJURY]: phasePre reset')
ph, n = re.subn(r"let n=S\.skipMid\?2:\(\(\)=>\{const r=R\(\);return r<0\.35\?3:r<0\.75\?4:r<0\.95\?5:6;\}\)\(\);", "let n=6;", ph, count=1)
if n != 1:
    raise SystemExit('patch failed [MAX6]: dice count')
ph = re.sub(r"\s*if\(S\.traits\.distract&&!S\.skipMid\)n=Math\.max\(2,n-1\);[^\n]*", "\n    /* 爽版：外務纏身不改變固定六顆 */", ph, count=1)
ph = re.sub(r"\s*if\(S\.traits\.academy&&!S\.skipMid&&chance\(35\)\)n\+\+;[^\n]*", "\n    /* 爽版：學院派不增加骰數 */", ph, count=1)
ph, n = re.subn(r"const v=S\.traits\.genius\?ri\(4,6\):S\.traits\.late\?ri\(3,6\):ri\(1,6\);", "const v=6;", ph, count=1)
if n != 1:
    raise SystemExit('patch failed [MAX6]: die value')
ph = ph.replace("if(S.traits.combo && !S.skipMid && (S.comboKey||S.samePickKey)) {", "if(false && S.traits.combo && !S.skipMid && (S.comboKey||S.samePickKey)) {", 1)
ph = ph.replace('（擲骰減為 2 顆）', '（爽版：仍固定 6 顆骰）')
ph = ph.replace('自主訓練擲出 <b class="hl">${n}</b> 顆骰。', '自主訓練固定擲出 <b class="hl">6</b> 顆骰：<b class="hl">6、6、6、6、6、6</b>。')
if 'let n=6;' not in ph or 'const v=6;' not in ph:
    raise SystemExit('validation failed [MAX6]')

# Save each professional season's actual salary into that year's log row.
salary_insert = "S.salary+=sal;\n    const _salaryRows=S.log.filter(r=>r&&r.st&&r.y===S.year&&r.age===S.age);\n    if(_salaryRows.length)_salaryRows[_salaryRows.length-1].sal=sal;"
ph = need_replace(ph, 'S.salary+=sal;', salary_insert, 'annual salary log')
write('src/flow/phases.js', ph)

# ---------- Injuries / Tommy John: hard-disabled ----------
inj = read('src/engine/injury.js')
inj = need_replace(
    inj,
    "export function tjAccrue(st,lv){",
    "export function tjAccrue(st,lv){ S.tj=0; return; /* 爽版：不累積 TJ 負荷 */",
    'TJ accrue off')
inj = need_replace(
    inj,
    "export function tjGamble(cont){",
    "export function tjGamble(cont){ S.tj=0; S.rehab=0; if(cont)cont(); return; /* 爽版：永不觸發 Tommy John */",
    'TJ gamble off')
inj = need_replace(
    inj,
    "export function injuryProb(){",
    "export function injuryProb(){ return 0; /* 爽版：所有一般傷病機率固定 0% */",
    'injury probability zero')
inj = need_replace(
    inj,
    "export function rollInjury(){",
    "export function rollInjury(){ S.injNext=0; S.tmpInj=0; S.rehab=0; S.tj=0; S.marketInjury='healthy'; card('info','健康回報','本季平安出賽。（爽版：受傷機率 0%｜Tommy John 關閉）'); return; /* 爽版硬關閉傷病判定 */",
    'injury roll off')
if "return 0; /* 爽版：所有一般傷病機率固定 0% */" not in inj or "永不觸發 Tommy John" not in inj:
    raise SystemExit('validation failed [NO-INJURY]')
write('src/engine/injury.js', inj)

# ---------- Career timeline / retirement share image: append annual salary ----------
rt = read('src/ui/retire.js')
start = rt.find('export function rpProData(proLogs)')
end = rt.find('export function retireScene', start)
if start < 0 or end < 0:
    raise SystemExit('patch failed [salary timeline]: rpProData block')
blk = rt[start:end]
blk = blk.replace("'ERA','WHIP']", "'ERA','WHIP','薪資']", 1)
blk = blk.replace("'RBI','SB','DEF'];", "'RBI','SB','DEF','薪資'];", 1)
marker = "    /* level cell carries the season's role:"
if marker not in blk:
    raise SystemExit('patch failed [salary timeline]: row marker')
blk = blk.replace(marker, "    txt.push(r.sal==null?'—':fmtMoney(r.sal));\n" + marker, 1)
if "'薪資'" not in blk or "fmtMoney(r.sal)" not in blk:
    raise SystemExit('validation failed [salary timeline]')
rt = rt[:start] + blk + rt[end:]
write('src/ui/retire.js', rt)

# Record exactly which upstream revision produced the build.
try:
    sha = subprocess.check_output(['git', '-C', str(SRC), 'rev-parse', 'HEAD'], text=True).strip()
except Exception:
    sha = 'unknown'
(DST / '.upstream-sha').write_text(sha + '\n', encoding='utf-8')

print('Built 爽版 from upstream', sha)
