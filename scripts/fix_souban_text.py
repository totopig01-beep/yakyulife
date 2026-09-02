from pathlib import Path

p=Path('docs/src/flow/events.js')
s=p.read_text(encoding='utf-8')

old="s:`成功率 ${od[mode]}%｜${scale}`"
new="s:`成功率 ${od[mode]}%｜固定成功・${scale}`"

if new not in s:
    if old not in s:
        raise SystemExit('event label marker changed upstream')
    s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')
