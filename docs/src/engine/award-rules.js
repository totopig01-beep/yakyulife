/* 只有真正會進入 honorScore() 的個人獎項才算「生涯得分獎項」。
   獎項觸發與結算評分共用這個純函式，避免規則再次分岔。 */
export function isCareerScoringAward(award){
  return /(?:年度MVP|年度最佳投手|年度最佳打者|賽揚|投手三冠王|打擊三冠王|勝投王|防禦率王|三振王|救援王|中繼王|打擊王|全壘打王|盜壘王|打點王|上壘王|守備聖經|金手套)$/.test(String(award||''));
}
