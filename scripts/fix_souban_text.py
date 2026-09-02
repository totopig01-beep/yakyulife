from pathlib import Path

# Event choice text: all routes are hard-coded to succeed.
p=Path('docs/src/flow/events.js')
s=p.read_text(encoding='utf-8')
old="s:`成功率 ${od[mode]}%｜${scale}`"
new="s:`成功率 ${od[mode]}%｜固定成功・${scale}`"
if new not in s:
    if old not in s:
        raise SystemExit('event label marker changed upstream')
    s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# Pitcher planning text: TJ mechanics are disabled in 爽版, so don't show fake TJ risk.
p=Path('docs/src/flow/phases.js')
s=p.read_text(encoding='utf-8')
repls={
    '成績最佳｜手臂負荷最大（TJ 累積 ×1.30）':'成績最佳｜爽版：無 TJ 風險',
    '標準強度｜TJ 累積正常':'標準強度｜爽版：無 TJ 風險',
    '成績保守｜省手臂（TJ 累積 ×0.80）':'成績保守｜爽版：無 TJ 風險',
}
for old,new in repls.items():
    if old in s:
        s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
