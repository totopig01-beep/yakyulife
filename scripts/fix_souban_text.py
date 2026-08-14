from pathlib import Path
p=Path('docs/src/flow/events.js')
s=p.read_text(encoding='utf-8')
repls={
"{t:'全力一搏',warn:true,s:`成功率 ${od.bold}%｜${S.traits.clutch?'成功 +4／失敗僅 −2':'加成／減益幅度最大（±3）'}`":"{t:'全力一搏',warn:true,s:`成功率 ${od.bold}%｜固定成功、最大加成（+3）`",
"{t:'照常執行',main:true,s:`成功率 ${od.norm}%｜標準幅度（±2）`":"{t:'照常執行',main:true,s:`成功率 ${od.norm}%｜固定成功、標準加成（+2）`",
"{t:'保守應對',s:`成功率 ${od.safe}%｜加成／減益幅度最小（±1）`":"{t:'保守應對',s:`成功率 ${od.safe}%｜固定成功、最小加成（+1）`",
}
for old,new in repls.items():
    if old not in s:
        raise SystemExit('event label marker changed upstream')
    s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
