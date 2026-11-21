// Metadati renderizzati dal Worker: disponibili anche ai crawler che non eseguono JavaScript.
export const PUBLIC_PAGE_META=Object.freeze({
 '/': ['Ristorante Oasi | Cucina e ospitalità dal 1997','Ristorante Oasi a Roccabernarda: cucina, ospitalità, eventi e prenotazioni online.'],
 '/chi-siamo': ['La nostra storia | Ristorante Oasi','Scopri la storia e l’accoglienza del Ristorante Oasi a Roccabernarda dal 1997.'],
 '/menu': ['Menù PDF | Ristorante Oasi','Consulta e scarica il menù aggiornato del Ristorante Oasi.'],
 '/galleria': ['Galleria fotografica | Ristorante Oasi','Scopri gli ambienti e i momenti del Ristorante Oasi attraverso le fotografie.'],
 '/eventi-cerimonie': ['Eventi e cerimonie | Ristorante Oasi','Matrimoni, cerimonie e ricevimenti al Ristorante Oasi di Roccabernarda.'],
 '/prenota': ['Prenota un tavolo | Ristorante Oasi','Prenota online pranzo o cena al Ristorante Oasi a Roccabernarda.'],
 '/privacy': ['Privacy | Ristorante Oasi','Informativa relativa al trattamento dei dati personali.']
});
export async function enhancePageResponse(request,response){
 const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/';
 const headers=new Headers(response.headers);
 headers.set('X-Content-Type-Options','nosniff');
 headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 if(path==='/admin'||path==='/annulla')headers.set('X-Robots-Tag','noindex, nofollow');
 const meta=PUBLIC_PAGE_META[path];
 if(request.method!=='GET'||!meta||!headers.get('content-type')?.includes('text/html')){
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 }
 const html=await response.text();
 const updated=html
  .replace(/<title>[^<]*<\/title>/i,`<title>${meta[0]}</title>`)
  .replace(/<meta\s+name=["']description["'][^>]*>/i,`<meta name="description" content="${meta[1]}"/>`);
 return new Response(updated,{status:response.status,statusText:response.statusText,headers});
}
