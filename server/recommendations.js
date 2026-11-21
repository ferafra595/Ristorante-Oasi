// Ranking deterministico, senza alterare le verifiche di disponibilità di D1.
export function rankTableOptions(options,party){
 const people=Number(party);
 return [...options].sort((a,b)=>{
  const score=x=>Math.max(0,Number(x.capacity)-people)+2*Math.max(0,(x.ids?.length||1)-1);
  return score(a)-score(b)
   ||(a.ids?.length||1)-(b.ids?.length||1)
   ||Number(a.capacity)-Number(b.capacity)
   ||Number(a.room_id)-Number(b.room_id)
   ||(a.ids||[]).join(',').localeCompare((b.ids||[]).join(','));
 });
}
