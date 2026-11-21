import './style.css';
const $=s=>document.querySelector(s),root=$('#app');
const state={data:null,user:null,adminView:'dashboard',customerQuery:'',opsService:'lunch',opsManualSelection:false,agendaManualSelection:false,agendaQuery:'',date:new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'}),room:1,reservationService:'all',reservations:[],rooms:[],tables:[],tableLinks:[],roomZones:[],menu:[],gallery:[],settings:null};
// Orario operativo locale: la sala passa alla cena alle 17:00 (Europe/Rome).
const oasiItalianToday=(d=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const oasiItalianService=(d=new Date())=>{const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',hourCycle:'h23'}).format(d));return hour>=17?'dinner':'lunch'};
function oasiAutoServiceRefresh(){
 if(state.adminView==='service'&&!state.opsManualSelection){
  const today=oasiItalianToday(),service=oasiItalianService();
  if(state.date!==today||state.opsService!==service){state.date=today;state.opsService=service;return true}
 }
 if(state.adminView==='reservations'&&!state.agendaManualSelection){
  const today=oasiItalianToday();
  if(state.date!==today||state.reservationService!=='all'){state.date=today;state.reservationService='all';return true}
 }
 return false;
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let oasiAdminWrites=0;
const api=async(path,method='GET',data)=>{const writing=path.startsWith('admin/')&&!['GET','HEAD'].includes(method);if(writing)oasiAdminWrites++;try{let r;try{r=await fetch('/api/'+path,{method,headers:data?{'content-type':'application/json'}:{},body:data?JSON.stringify(data):undefined,credentials:'same-origin',cache:'no-store'})}catch{throw Error('Impossibile contattare il server. Riprova tra poco.')}const type=r.headers.get('content-type')||'';const raw=await r.text();let o=null;try{o=JSON.parse(raw)}catch{}if(!o||typeof o!=='object'){console.error('API non JSON',{path,status:r.status,contentType:type,response:raw.slice(0,300)});throw Error('La richiesta API non arriva correttamente al backend (HTTP '+r.status+'). Verifica il deploy del Worker e i binding DB.')}if(!r.ok)throw Error(o.error||'Errore HTTP '+r.status);return o}finally{if(writing)oasiAdminWrites--}};
const msg=(t,type='ok')=>{const n=document.createElement('div');n.className='toast '+type;n.textContent=t;document.body.append(n);setTimeout(()=>n.remove(),5500)};
const icon=(name)=>({calendar:'◷',menu:'☰',close:'×'}[name]||'•');
const site=()=>state.data?.site||{};
const socialIcon=(name)=>({instagram:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.7" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',facebook:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M13.7 21v-8.2h2.8l.5-3.3h-3.3V7.4c0-.95.35-1.6 1.7-1.6H17V2.9c-.3-.05-1.4-.15-2.65-.15-2.65 0-4.45 1.6-4.45 4.55v2.2H7v3.3h2.9V21h3.8z"/></svg>',tiktok:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M16.6 2.5c.2 2 1.3 3.2 3.3 3.35v3.55a8.5 8.5 0 0 1-3.2-.75v6.15c0 4.1-2.65 6.65-6.25 6.65-3.35 0-5.9-2.5-5.9-5.75 0-3.7 2.8-6.15 6.85-6.15v3.55c-2.1-.2-3.4 1-3.4 2.6 0 1.4 1.15 2.35 2.5 2.35 1.5 0 2.5-1.05 2.5-2.8V2.5h3.6z"/></svg>'}[name]||'');
const socialLinks=(compact=false)=>[['instagram','Instagram'],['facebook','Facebook'],['tiktok','TikTok']].filter(([k])=>site()[k]).map(([k,label])=>`<a class="social-link" href="${esc(site()[k])}" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}">${socialIcon(k)}${compact?'':`<span>${label}</span>`}</a>`).join('');

// Independent image slots. Legacy values are used only until a slot is explicitly saved.
const mediaGroups=[
 ['Identità visiva', [['logoMain','Logo intestazione','PNG trasparente, 600 × 300'],['logoFooter','Logo footer (sfondo scuro)','PNG trasparente, 600 × 300'],['favicon','Icona browser','PNG quadrato, 256 × 256']]],
 ['Homepage', [['heroImage','Copertina principale','1920 × 1080'],['homeStoryImage','La nostra storia','1200 × 1500','storyImage'],['homeFoodImage','La cucina','1200 × 1500','foodImage'],['homeEventImage','Eventi e cerimonie','1200 × 1500','eventImage'],['homeGallery1','Anteprima galleria 1','1200 × 1500'],['homeGallery2','Anteprima galleria 2','1200 × 1500'],['homeGallery3','Anteprima galleria 3','1200 × 1500']]],
 ['Pagine dedicate', [['storyImage','Chi siamo – fotografia principale','1200 × 1500'],['foodImage','Menù PDF – fotografia','1200 × 1500'],['bookingImage','Prenota – fotografia laterale','1200 × 1500','storyImage']]],
 ['Eventi e cerimonie', [['eventImage','Copertina eventi','1920 × 1080'],['eventStoryImage','Presentazione ricevimenti','1200 × 1500','eventImage'],['eventWeddingImage','Matrimoni','1200 × 900','eventImage'],['eventCeremonyImage','Cerimonie','1200 × 900','eventImage'],['eventPrivateImage','Eventi privati','1200 × 900','eventImage']]]
];
const mediaValue=(d,k,fallback='')=>Object.prototype.hasOwnProperty.call(d,k)?d[k]||'':fallback||'';
const mediaUrl=v=>{if(!v)return '';try{const u=new URL(v,location.origin);return ['http:','https:'].includes(u.protocol)?String(v):''}catch{return ''}};
const publicMedia=(k,fallback='')=>mediaUrl(mediaValue(site(),k,fallback));
const brandImage=(k,cls,fallback='')=>{const url=publicMedia(k);return url?`<img class="${cls}" src="${esc(url)}" alt="Ristorante Oasi"/>`:fallback};
const mediaDefaults=(d,gallery=[])=>{const find=re=>gallery.find(x=>re.test(x.category||''))?.image_url||'';const rooms=find(/ambient|sala/i),food=find(/cucin|piatt|food|pizz/i),events=gallery.filter(x=>/event|cerimoni|matrimon|riceviment/i.test(x.category||''));return {heroImage:find(/ambient|sala|ristorant/i),storyImage:rooms,foodImage:food,eventImage:find(/event|cerimon|matrimon|riceviment/i),homeStoryImage:d.storyImage||rooms,homeFoodImage:d.foodImage||food,homeEventImage:d.eventImage||find(/event|cerimon|matrimon|riceviment/i),bookingImage:d.storyImage||rooms,homeGallery1:gallery[0]?.image_url||'',homeGallery2:gallery[1]?.image_url||'',homeGallery3:gallery[2]?.image_url||'',eventStoryImage:events[0]?.image_url||d.eventImage,eventWeddingImage:events[1]?.image_url||d.eventImage,eventCeremonyImage:events[2]?.image_url||d.eventImage,eventPrivateImage:events[3]?.image_url||d.eventImage}};
const oasiPhotoPosition=(data,key,axis)=>{const value=Number(data?.[key+'Position'+axis]);return Number.isFinite(value)&&value>=0&&value<=100?Math.round(value):50;};
const oasiFocalRatio=k=>/^(heroImage|eventImage)$/.test(k)?'16/9':/^homeGallery/.test(k)?'4/5':/^(eventWeddingImage|eventCeremonyImage|eventPrivateImage)$/.test(k)?'4/3':'5/4';
const oasiPhotoStyle=(key)=>key?` style="object-position:${oasiPhotoPosition(site(),key,'X')}% ${oasiPhotoPosition(site(),key,'Y')}%"`:'';
const mediaEditor=(d,gallery=[])=>mediaGroups.map(([title,slots])=>`<section class="oasi-media-group"><h3>${title}</h3><div class="oasi-media-grid">${slots.map(([k,label,hint])=>`<div class="oasi-media-card"><label>${label}<input type="text" name="${k}" data-media-slot value="${esc(mediaValue(d,k,mediaDefaults(d,gallery)[k]))}" placeholder="Carica una fotografia o inserisci URL"/></label><small>${hint}</small>${/^logo|^favicon$/.test(k)?'':`<div class="oasi-focal-editor" data-focal-key="${k}" style="--oasi-focal-ratio:${oasiFocalRatio(k)}"><strong>Inquadratura sul sito</strong><p>Regola il ritaglio senza modificare la foto originale.</p><div class="oasi-focal-preview" aria-label="Anteprima del ritaglio"><img alt="Anteprima del ritaglio" loading="lazy"><span class="oasi-focal-placeholder">Carica una foto per vedere l'anteprima</span></div><label>Orizzontale <output data-focal-output="X">${oasiPhotoPosition(d,k,'X')}%</output><input type="range" min="0" max="100" step="1" name="${k}PositionX" value="${oasiPhotoPosition(d,k,'X')}" data-focal-axis="X"></label><label>Verticale <output data-focal-output="Y">${oasiPhotoPosition(d,k,'Y')}%</output><input type="range" min="0" max="100" step="1" name="${k}PositionY" value="${oasiPhotoPosition(d,k,'Y')}" data-focal-axis="Y"></label><button type="button" class="mini oasi-focal-reset">Centra foto</button><small>Premi «Salva» in fondo alla sezione per pubblicare la posizione.</small></div>`}</div>`).join('')}</div></section>`).join('');
const nav=(active='')=>`<a class="oasi-skip-link" href="#contenuto-principale">Vai al contenuto principale</a><header class="nav nav-premium"><a class="brand" href="/" aria-label="Ristorante Oasi, homepage">${brandImage('logoMain','oasi-custom-logo','<span class="brand-mark">L’OASI<span class="brand-dot">.</span></span><span class="brand-sub">HOTEL · RISTORANTE · RICEVIMENTI</span>')}</a><button class="hamburger" id="hamburger" aria-controls="links" aria-label="Apri menu" aria-expanded="false"><svg class="oasi-menu-icon" viewBox="0 0 28 28" width="29" height="29" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 9h20M4 19h20"/></svg></button><nav id="links" aria-label="Navigazione principale"><a href="/chi-siamo">Chi siamo</a><a href="/menu">Menù</a><a href="/galleria">Galleria</a><a href="/eventi-cerimonie">Eventi</a><a href="/#contatti">Contatti</a><div class="nav-social">${socialLinks(true)}</div><a class="nav-book" href="/prenota">Prenota un tavolo <span><svg class="oasi-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></span></a></nav></header>`;
const footer=()=>`<footer class="footer footer-premium"><div class="footer-feature"><div class="eyebrow">UN INVITO A STARE BENE</div><h2>Ci vediamo <em>all’Oasi.</em></h2><a class="footer-cta" href="/prenota"><span class="footer-cta-label">Prenota la tua esperienza</span><span class="footer-cta-arrow" aria-hidden="true"><svg class="oasi-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></span></a></div><div class="footer-content"><div class="footer-brand">${brandImage('logoFooter','oasi-custom-footer-logo','<strong>L’OASI</strong><span>F.LLI FERA · DAL 1997</span>')}<p>Il gusto dell’ospitalità, da generazioni.</p><div class="footer-social">${socialLinks(true)}</div></div><div><h4>ESPLORA</h4><a href="/chi-siamo">Chi siamo</a><a href="/menu">Menù</a><a href="/galleria">Galleria</a><a href="/eventi-cerimonie">Eventi e cerimonie</a><a href="/prenota">Prenota</a></div><div><h4>VIENI A TROVARCI</h4><p>${esc(site().address||'Contrada Serrarossa, 88835 Roccabernarda KR')}</p><a href="tel:+393387036868">${esc(site().phone||'338 703 6868')}</a><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=Contrada+Serrarossa+Roccabernarda">Apri indicazioni <svg class="oasi-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></a></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} Ristorante Oasi · F.lli Fera</span><span><a href="/privacy">Privacy</a><a href="/admin">Area riservata</a></span></div></footer>`;

const defaultFaqs=[{"question": "Come posso prenotare un tavolo?", "answer": "Puoi prenotare direttamente dal sito scegliendo data, orario e numero di persone. La conferma è automatica in base alla disponibilità."}, {"question": "Quali sono gli orari del ristorante?", "answer": "Siamo aperti dal martedì alla domenica a pranzo e a cena. Gli orari disponibili per la prenotazione sono indicati nel calendario online."}, {"question": "Posso prenotare per più di 9 persone?", "answer": "Per gruppi di 10 o più persone ti chiediamo di chiamarci al 338 703 6868: il nostro personale ti aiuterà a organizzare la visita."}, {"question": "È possibile organizzare matrimoni e cerimonie?", "answer": "Sì. Puoi visitare la pagina Eventi e Cerimonie e inviarci una richiesta con la data e il numero indicativo di ospiti."}, {"question": "Posso richiedere un tavolo all'aperto?", "answer": "Quando il giardino è disponibile per le prenotazioni online, potrai scegliere questa possibilità. In caso di maltempo il personale ti aiuterà a valutare le alternative."}, {"question": "Come posso modificare o annullare una prenotazione?", "answer": "Puoi utilizzare il collegamento di annullamento ricevuto con la prenotazione. Per altre modifiche, contatta direttamente il ristorante."}];
const reviewsUrl='https://www.google.com/maps/search/?api=1&query=Ristorante+Oasi+Contrada+Serrarossa+Roccabernarda';
const homeExtras=()=>{const configured=site().faqs;const questions=Array.isArray(configured)?configured:defaultFaqs;return `<section class="oasi-reviews section" id="recensioni"><div class="oasi-reviews-copy"><div class="eyebrow">LE VOSTRE ESPERIENZE</div><h2>La nostra storia<br>continua <em>con voi.</em></h2><p>Ogni incontro, ogni cena e ogni occasione speciale diventano parte della storia dell’Oasi. Scopri le esperienze condivise dai nostri ospiti su Google.</p><div class="reviews-actions"><a class="btn btn-dark" href="${reviewsUrl}" target="_blank" rel="noopener noreferrer">Leggi le recensioni su Google </a><a class="reviews-second-link" href="${reviewsUrl}" target="_blank" rel="noopener noreferrer">Condividi la tua esperienza </a></div></div><div class="oasi-reviews-visual"><div class="review-quote-mark">“</div><p>Le parole dei nostri ospiti sono il racconto più autentico dell’esperienza all’Oasi.</p><div class="review-separator"></div><div class="review-google-mark"><svg viewBox="0 0 48 48" aria-hidden="true" width="32" height="32"><path fill="#4285F4" d="M44 24.5c0-1.4-.1-2.8-.4-4.1H24v7.9h11.2a9.6 9.6 0 0 1-4.2 6.3v5.2h6.8C41.8 36.2 44 30.8 44 24.5z"/><path fill="#34A853" d="M24 44c5.7 0 10.5-1.9 14-5.1l-6.8-5.2c-1.9 1.2-4.3 1.9-7.2 1.9-5.5 0-10.2-3.7-11.9-8.7H5.1v5.3C8.6 38.8 15.8 44 24 44z"/><path fill="#FBBC05" d="M12.1 26.9a12 12 0 0 1 0-7.8v-5.3H5.1a20 20 0 0 0 0 20z"/><path fill="#EA4335" d="M24 12.4c3.1 0 5.8 1.1 8 3.2l6-6C34.4 6 29.6 4 24 4 15.8 4 8.6 9.2 5.1 16.7l7 5.3c1.7-5 6.4-9.6 11.9-9.6z"/></svg><div><strong>Google</strong><span>Recensioni verificate sulla scheda del ristorante</span></div></div></div></section><section class="oasi-faq section" id="faq"><div class="oasi-faq-intro"><div class="eyebrow">INFORMAZIONI UTILI</div><h2>Tutto quello che<br>vuoi <em>sapere.</em></h2><p>Abbiamo raccolto alcune risposte alle domande più frequenti. Se hai richieste particolari, siamo sempre a disposizione.</p><a class="premium-text-link" href="tel:+393387036868">Parla con noi </a></div><div class="oasi-faq-questions">${questions.filter(q=>q&&q.question&&q.answer).map((q,i)=>`<details class="oasi-faq-item" ${i===0?'open':''}><summary><span>${esc(q.question)}</span><span class="faq-plus" aria-hidden="true">+</span></summary><p>${esc(q.answer)}</p></details>`).join('')}</div></section>`};

// I testi segnaposto non devono comparire nella homepage pubblica.
// Mantiene intatti i racconti autentici salvati dall'ADMIN.
const oasiPublicStory=raw=>{
 const value=String(raw||'').trim();
 if(value&&!/^(la nostra storia\s*:\s*aggiungi qui|inserisci qui la tua storia|presto racconteremo qui)/i.test(value))return value;
 return 'Dal 1997, l’Oasi è un luogo di incontro a Roccabernarda, tra il piacere della buona tavola e quello di ritrovarsi insieme. Una storia di ospitalità che continua a ogni servizio.';
};
const editorialPhoto=(category,configured)=>{const pics=state.data?.gallery||[];return configured||pics.find(x=>category.test(x.category||''))?.image_url||''};
const editorialImage=(url,alt,cls='',eager=false,slot='')=>url?`<img class="${cls}" src="${esc(url)}" alt="${esc(alt)}"${oasiPhotoStyle(slot)} ${eager?'fetchpriority="high"':'loading="lazy"'} decoding="async"/>`:`<div class="oasi-editorial-placeholder ${cls}" aria-hidden="true"><span>OASI</span><small>F.LLI FERA · DAL 1997</small></div>`;
const home=()=>{const d=site(),hero=publicMedia('heroImage',editorialPhoto(/ambient|sala|ristorant/i)),story=publicMedia('homeStoryImage',editorialPhoto(/ambient|sala/i,d.storyImage)),food=publicMedia('homeFoodImage',editorialPhoto(/cucin|piatt|food|pizz/i,d.foodImage)),event=publicMedia('homeEventImage',editorialPhoto(/event|cerimon|matrimon|riceviment/i,d.eventImage));return `${nav()}<main class="oasi-public-home"><section class="oasi-editorial-hero">${editorialImage(hero,'Ristorante Oasi','oasi-hero-photo',true,'heroImage')}<div class="oasi-hero-shade"></div><div class="oasi-hero-copy"><div class="eyebrow">ROCCABERNARDA, CALABRIA · DAL 1997</div><h1>Il bello di<br> <em>ritrovarsi.</em></h1><p>${esc(d.subtitle||'Cucina, ospitalità e occasioni da ricordare.')}</p><div class="oasi-hero-buttons"><a class="btn btn-light" href="/prenota">Prenota un tavolo </a><a class="oasi-hero-link" href="/menu">Esplora il menù </a></div><p class="oasi-hero-assurance">Prenotazione online semplice · Pranzo e cena · Gruppi e cerimonie su richiesta</p></div><div class="oasi-hero-caption"><span>F.LLI FERA</span><a href="#essenza">SCORRI PER SCOPRIRE</a></div></section><div class="oasi-editorial-strip"><span>01 / LA TAVOLA</span><span>02 / L’OSPITALITÀ</span><span>03 / LE OCCASIONI</span></div><section class="oasi-story-editorial" id="essenza"><div class="oasi-story-visual">${editorialImage(story,'Gli ambienti dell’Oasi','',false,'homeStoryImage')}<span class="oasi-photo-index">01 — DAL 1997</span></div><article><div class="eyebrow">LA NOSTRA STORIA</div><h2>Il piacere di<br>sentirsi <em>a casa.</em></h2><p>${esc(oasiPublicStory(d.story))}</p><a class="oasi-editorial-link" href="/chi-siamo">Conosci la nostra storia </a></article></section><section class="oasi-public-quicklinks" aria-label="Scopri Oasi"><a href="/menu"><span>01 / CUCINA</span><strong>Scegli cosa gustare</strong><small>Consulta il nostro menù</small></a><a href="/galleria"><span>02 / AMBIENTI</span><strong>Entra nell’Oasi</strong><small>Guarda gli spazi e i dettagli</small></a><a href="/eventi-cerimonie"><span>03 / EVENTI</span><strong>Festeggia con noi</strong><small>Raccontaci la tua occasione</small></a></section><section class="oasi-food-editorial"><article><div class="eyebrow">A TAVOLA CON NOI</div><h2>Il gusto di<br><em>stare insieme.</em></h2><p>Scopri la proposta del ristorante e scegli il tuo prossimo momento all’Oasi.</p><a class="btn btn-light" href="/menu">Consulta il menù </a></article>${editorialImage(food,'La cucina del Ristorante Oasi','',false,'homeFoodImage')}</section><section class="oasi-event-editorial">${editorialImage(event,'Gli eventi del Ristorante Oasi','',false,'homeEventImage')}<article><div class="eyebrow">EVENTI E CERIMONIE</div><h2>Ci sono giorni<br>che <em>restano.</em></h2><p>Una festa, un incontro, le persone più importanti. Scopri gli spazi e raccontaci come immagini il tuo evento.</p><a class="oasi-editorial-link" href="/eventi-cerimonie">Organizza il tuo evento </a></article></section><section class="oasi-gallery-editorial"><div class="oasi-gallery-head"><div><div class="eyebrow">L’OASI IN IMMAGINI</div><h2>Momenti <em>da vivere.</em></h2></div><a href="/galleria" class="oasi-editorial-link">Esplora la galleria</a></div>${photosPreview()}</section>${homeExtras()}<section class="contact section premium-contact" id="contatti"><div><div class="eyebrow">CI VEDIAMO ALL’OASI</div><h2>Il tuo prossimo<br><em>bel momento.</em></h2><p>${esc(d.address||'Contrada Serrarossa, 88835 Roccabernarda KR')}</p><p>Martedì – domenica · Pranzo e cena</p><div class="footer-social contact-social">${socialLinks(true)}</div></div><div class="contact-premium-card"><span>PRENOTAZIONI & INFORMAZIONI</span><h3>Ti aspettiamo.</h3><p>Riserva il tuo tavolo oppure chiamaci per un’occasione speciale.</p><a href="/prenota" class="btn btn-dark">Prenota ora <svg class="oasi-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></a><a class="contact-call" href="tel:+393387036868">${esc(d.phone||'338 703 6868')} <svg class="oasi-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></a><a class="contact-map" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=Contrada+Serrarossa+Roccabernarda">Come raggiungerci <svg class="oasi-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></a><div class="oasi-map-wrap"><iframe title="Mappa Ristorante Oasi a Roccabernarda" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=Contrada%20Serrarossa%2C%2088835%20Roccabernarda%20KR&t=&z=14&ie=UTF8&iwloc=&output=embed"></iframe><a class="oasi-map-link" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=Contrada+Serrarossa%2C+88835+Roccabernarda+KR">Apri il percorso </a></div></div></section></main>${footer()}`};
const photosPreview=()=>{const photos=(state.data?.gallery||[]).slice(0,3);const slots=[1,2,3].map((n,i)=>({url:publicMedia('homeGallery'+n,photos[i]?.image_url),caption:photos[i]?.caption||'Ristorante Oasi',slot:'homeGallery'+n})).filter(x=>x.url);return slots.length?`<div class="oasi-editorial-photo-grid">${slots.map(x=>`<a href="/galleria">${editorialImage(x.url,x.caption,'',false,x.slot)}</a>`).join('')}</div>`:''};
const aboutPage=()=>{const d=site();return `${nav('chi-siamo')}<main class="story-page"><section class="dedicated-hero"><div class="eyebrow">RISTORANTE OASI · DAL 1997</div><h1>La nostra <em>storia.</em></h1><p>Un luogo dove ospitalità, cucina e tradizione si incontrano.</p></section><section class="dedicated-story"><div class="dedicated-story-visual">${editorialImage(publicMedia('storyImage',editorialPhoto(/ambient|sala/i)),'Gli ambienti del Ristorante Oasi','',false,'storyImage')}<span class="dedicated-stamp">DAL 1997 · F.LLI FERA</span></div><article class="dedicated-story-copy"><div class="eyebrow">CHI SIAMO</div><h2>Il piacere di sentirsi <em>a casa.</em></h2><div class="gold-rule"></div><p class="story-user-text">${esc(oasiPublicStory(d.story))}</p><a class="btn btn-dark" href="/prenota">Prenota la tua visita <span aria-hidden="true"><svg class="oasi-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></span></a></article></section><section class="dedicated-outro"><div class="eyebrow">UN INVITO A STARE INSIEME</div><h2>Ogni incontro è una <em>storia da ricordare.</em></h2><a href="/galleria" class="premium-text-link">Scopri gli ambienti <span aria-hidden="true"><svg class="oasi-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></span></a></section></main>${footer()}`};
const galleryPage=()=>{const photos=state.data?.gallery||[];const items=photos;const cats=['Tutte',...new Set(items.map(p=>p.category||'Ambienti'))];return `${nav('galleria')}<main class="gallery-page"><section class="dedicated-hero"><div class="eyebrow">ATMOSFERE · SAPORI · EMOZIONI</div><h1>La nostra <em>galleria.</em></h1><p>Le immagini raccontano i momenti, le persone e i dettagli che ci rendono speciali.</p></section><section class="dedicated-gallery"><div class="gallery-filter-row" aria-label="Filtra la galleria">${cats.map((c,i)=>`<button class="gallery-filter ${i===0?'chosen':''}" type="button" data-gallery-filter="${esc(c)}">${esc(c)}</button>`).join('')}</div><div class="dedicated-gallery-grid">${items.length?'':'<p>Le fotografie saranno disponibili a breve.</p>'}${items.map((p,i)=>`<button type="button" class="dedicated-gallery-item" data-gallery-index="${i}" data-gallery-category="${esc(p.category||'Ambienti')}" aria-label="Apri fotografia: ${esc(p.caption||'Ristorante Oasi')}"><img src="${esc(p.image_url)}" loading="lazy" decoding="async" alt="${esc(p.caption||'Ristorante Oasi')}"/><span>${esc(p.caption||'Ristorante Oasi')}</span><span class="gallery-zoom" aria-hidden="true"><svg class="oasi-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></span></button>`).join('')}</div></section><div id="gallery-lightbox" class="gallery-lightbox" hidden role="dialog" aria-modal="true" aria-label="Fotografia ingrandita"><button class="lightbox-close" type="button" aria-label="Chiudi fotografia">×</button><button class="oasi-gallery-arrow oasi-gallery-prev" type="button" aria-label="Fotografia precedente">‹</button><img alt=""/><button class="oasi-gallery-arrow oasi-gallery-next" type="button" aria-label="Fotografia successiva">›</button><div class="oasi-gallery-lightbox-caption"><p></p><span class="oasi-gallery-counter" aria-live="polite"></span></div></div></main>${footer()}`};
const book=()=>`${nav()}<main class="page" id="contenuto-principale"><div class="page-top"><div class="eyebrow">OASI / PRENOTAZIONI</div><h1>Riserva il tuo <em>tavolo.</em></h1><p>Seleziona giorno e orario: penseremo noi ad assegnarti il tavolo più adatto.</p></div><div class="booking-layout"><form id="booking" class="panel"><h3>1. Scegli giorno e orario</h3><div class="fields two"><label>Data<input type="date" name="date" required value="${new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'})}" min="${new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'})}"/></label><label>Servizio<select name="service"><option value="lunch">Pranzo</option><option value="dinner">Cena</option></select></label><label>Orario di arrivo<input type="time" name="time" value="12:30" required /></label><label>Persone<select name="party_size">${Array.from({length:9},(_,i)=>`<option value="${i+1}" ${i===1?'selected':''}>${i+1} ${i?'persone':'persona'}</option>`).join('')}</select></label></div><button type="button" id="check-availability" class="btn btn-outline full">Verifica disponibilità <svg class="oasi-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></button><div id="availability" class="availability-note" role="status" aria-live="polite">Verifica la disponibilità prima di inserire i tuoi dati.</div><p class="oasi-book-summary" id="oasi-book-summary" aria-live="polite">Completa la scelta di data, servizio, orario e persone.</p><h3 class="oasi-book-step">2. Inserisci i tuoi dati</h3><div class="fields two"><label>Nome e cognome<input name="name" autocomplete="name" maxlength="120" required placeholder="Nome e cognome"/></label><label>Telefono<input type="tel" autocomplete="tel" name="phone" maxlength="40" required placeholder="Numero di telefono"/></label><label>Email<input type="email" autocomplete="email" name="email" required placeholder="nome@email.it"/></label><label>Note (facoltative)<input name="notes" maxlength="600" placeholder="Richieste particolari"/></label></div><label class="check-line"><input type="checkbox" required/> Ho letto l'<a href="/privacy" target="_blank">informativa privacy</a> relativa alla prenotazione.</label><button class="btn btn-dark full" type="submit" disabled>Conferma prenotazione <svg class="oasi-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></button><p class="tiny">Per gruppi di 10 o più persone chiamaci al <a href="tel:+393387036868">338 703 6868</a>.</p></form><aside class="booking-side">${editorialImage(publicMedia('bookingImage',editorialPhoto(/ambient|sala/i,site().storyImage)),'Ristorante Oasi','',false,'bookingImage')}<div><div class="eyebrow">TI ASPETTIAMO</div><h3>Un momento speciale, a ogni tavolo.</h3><p>La conferma appare subito sul sito. Riceverai anche una email se il servizio di invio è attivo.</p></div></aside></div></main>${footer()}`;

const menupage=()=>{
 const live=(state.data?.menu||[]).filter(item=>Number(item.available)!==0&&String(item.name||'').trim());
 const groups=new Map();
 for(const item of live){
  const name=String(item.section||item.category||'Le nostre proposte').trim()||'Le nostre proposte';
  if(!groups.has(name))groups.set(name,[]);
  groups.get(name).push(item);
 }
 const categories=[...groups.keys()];
 const pdf=!!state.data?.menuPdf;
 const menuList=categories.length?`<section class="oasi-public-menu-list" id="scopri-menu"><div class="oasi-public-menu-heading"><div class="eyebrow">SFOGLIA IL MENÙ</div><h2>La nostra proposta <em>da scoprire.</em></h2><p>Le voci pubblicate dal ristorante, organizzate per tipologia.</p></div><nav class="oasi-public-menu-filters" aria-label="Sezioni del menù"><button type="button" data-public-menu="all" class="chosen" aria-pressed="true">Tutto</button>${categories.map((name,i)=>`<button type="button" data-public-menu="${i}" aria-pressed="false">${esc(name)}</button>`).join('')}</nav><div class="oasi-public-menu-sections">${categories.map((name,i)=>`<section class="oasi-public-menu-category" data-public-menu-section="${i}"><h3>${esc(name)}</h3><div class="oasi-public-dishes">${groups.get(name).map(d=>`<article class="oasi-public-dish"><div><h4>${esc(d.name)}</h4>${d.category&&d.category!==name?`<small class="oasi-public-dish-category">${esc(d.category)}</small>`:''}${d.description?`<p>${esc(d.description)}</p>`:''}${d.allergens?`<small class="oasi-public-allergens">Allergeni: ${esc(d.allergens)}</small>`:''}</div>${d.price?`<strong class="oasi-public-price">${esc(d.price)}</strong>`:''}</article>`).join('')}</div></section>`).join('')}</div><p class="oasi-menu-disclaimer">Per allergie, intolleranze e disponibilità dei piatti chiedi sempre conferma al personale.</p><a class="btn btn-dark" href="/prenota">Prenota un tavolo</a></section>`:'';
 return `${nav('menu')}<main class="oasi-pdf-page"><section class="oasi-menu-editorial"><article><div class="eyebrow">LA NOSTRA CUCINA</div><h1>Il nostro <em>menù.</em></h1><p>Scopri le proposte dell’Oasi. Consulta il menù e scegli quando venirci a trovare.</p>${pdf?`<div class="oasi-menu-document"><span class="oasi-pdf-symbol" aria-hidden="true">PDF</span><div><strong>Menù del ristorante</strong><small>Documento caricato dal ristorante</small></div></div><div class="oasi-pdf-actions"><a class="btn btn-dark" href="/api/menu-pdf" target="_blank" rel="noopener noreferrer">Apri il menù PDF</a><a class="btn btn-outline" href="/api/menu-pdf?download=1" download="Menu-Ristorante-Oasi.pdf">Scarica PDF</a></div>`:live.length?'<a class="btn btn-dark" href="#scopri-menu">Sfoglia il menù</a>':'<p class="oasi-menu-empty">Il menù online sarà disponibile a breve. Per informazioni contattaci.</p><a class="btn btn-dark" href="tel:+393387036868">Chiama il ristorante</a>'}<a class="oasi-editorial-link" href="/prenota">Prenota il tuo tavolo</a></article>${editorialImage(publicMedia('foodImage',editorialPhoto(/cucin|piatt|food|pizz/i)),'La cucina del Ristorante Oasi','',false,'foodImage')}</section>${menuList}</main>${footer()}`;
};
const privacy=()=>`${nav()}<main class="page"><div class="page-top"><h1>Informativa <em>privacy.</em></h1><p>Questa pagina è un modello provvisorio da completare e verificare con il titolare prima della pubblicazione.</p></div><section class="section"><h2>Gestione delle prenotazioni</h2><p>I dati forniti nella prenotazione (nome, recapiti, numero di persone, note e data) sono utilizzati per gestire la richiesta e comunicare con il cliente. Il titolare del trattamento deve inserire qui denominazione legale, recapiti privacy, basi giuridiche, tempi di conservazione, fornitori e diritti degli interessati in una informativa GDPR completa.</p></section></main>${footer()}`;
const cancel=()=>`${nav()}<main class="page"><div class="page-top"><div class="eyebrow">GESTIONE PRENOTAZIONE</div><h1>Annulla la <em>prenotazione.</em></h1><p>Questa azione libera il tavolo assegnato. Non può essere annullata.</p><button id="cancel-booking" class="btn btn-dark">Conferma annullamento</button><p id="cancel-response"></p></div></main>${footer()}`;
const inputData=f=>Object.fromEntries(new FormData(f));
const bindPublic=()=>{const evtForm=$('#event-request');if(evtForm)evtForm.addEventListener('submit',e=>{e.preventDefault();if(!evtForm.reportValidity())return;const d=new FormData(evtForm);const message=`Buongiorno, vorrei informazioni per organizzare un evento all'Oasi.\nTipologia: ${d.get('type')}\nData indicativa: ${d.get('date')}\nInvitati: ${d.get('guests')}\nNote: ${d.get('note')||'Nessuna'}`;const url='https://wa.me/393387036868?text='+encodeURIComponent(message);const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';document.body.append(a);a.click();a.remove()});document.querySelectorAll('[data-event-type]').forEach(link=>link.addEventListener('click',()=>{const field=evtForm?.elements?.type;if(field)field.value=link.dataset.eventType}));if(location.pathname==='/galleria'){
 const modal=$('#gallery-lightbox'),photo=modal?.querySelector('img'),caption=modal?.querySelector('p'),counter=modal?.querySelector('.oasi-gallery-counter');
 let activeIndex=0,returnFocus=null;
 const visiblePhotos=()=>[...document.querySelectorAll('[data-gallery-index]')].filter(item=>!item.hidden);
 const show=(index)=>{
  const items=visiblePhotos();if(!items.length)return;
  activeIndex=(index+items.length)%items.length;
  const item=items[activeIndex],img=item.querySelector('img');
  photo.src=img.src;photo.alt=img.alt;caption.textContent=img.alt;
  counter.textContent=(activeIndex+1)+' / '+items.length;
 };
 const close=()=>{
  if(modal.hidden)return;
  modal.hidden=true;document.body.classList.remove('lightbox-open');returnFocus?.focus({preventScroll:true});
 };
 document.querySelectorAll('[data-gallery-filter]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('[data-gallery-filter]').forEach(b=>{const on=b===button;b.classList.toggle('chosen',on);b.setAttribute('aria-pressed',String(on))});
  document.querySelectorAll('[data-gallery-index]').forEach(item=>{item.hidden=button.dataset.galleryFilter!=='Tutte'&&item.dataset.galleryCategory!==button.dataset.galleryFilter});
 }));
 document.querySelectorAll('[data-gallery-index]').forEach(item=>item.addEventListener('click',()=>{
  returnFocus=item;activeIndex=visiblePhotos().indexOf(item);show(activeIndex);modal.hidden=false;document.body.classList.add('lightbox-open');
  modal.querySelector('.lightbox-close')?.focus({preventScroll:true});
 }));
 {const cat=new URLSearchParams(location.search).get('categoria');if(cat&&cat!=='Tutte'){const button=[...document.querySelectorAll('[data-gallery-filter]')].find(x=>x.dataset.galleryFilter.toLowerCase()===cat.toLowerCase());button?.click()}}
 modal?.querySelector('.lightbox-close')?.addEventListener('click',close);
 modal?.querySelector('.oasi-gallery-prev')?.addEventListener('click',()=>show(activeIndex-1));
 modal?.querySelector('.oasi-gallery-next')?.addEventListener('click',()=>show(activeIndex+1));
 modal?.addEventListener('click',e=>{if(e.target===modal)close()});
 document.addEventListener('keydown',e=>{
  if(modal?.hidden)return;
  if(e.key==='Escape'){e.preventDefault();close()}
  if(e.key==='ArrowLeft'){e.preventDefault();show(activeIndex-1)}
  if(e.key==='ArrowRight'){e.preventDefault();show(activeIndex+1)}
  if(e.key==='Tab'){
   const controls=[...modal.querySelectorAll('button')];const current=controls.indexOf(document.activeElement);
   if(!e.shiftKey&&current===controls.length-1){e.preventDefault();controls[0]?.focus()}
   if(e.shiftKey&&current===0){e.preventDefault();controls[controls.length-1]?.focus()}
  }
 });
 }
 document.querySelectorAll('a[href^="/#"], a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{const url=new URL(link.href,location.href);if(url.pathname!=='/'||!url.hash)return;if(location.pathname==='/' ){const destination=document.getElementById(decodeURIComponent(url.hash.slice(1)));if(destination){event.preventDefault();history.pushState(null,'',url.pathname+url.hash);document.getElementById('links')?.classList.remove('open');destination.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}}}));if($('#booking')){const f=$('#booking');const bcfg=state.data.booking||{};const setTime=()=>{const service=f.elements.service.value;f.elements.time.value=bcfg[service]?.start||'12:30';f.elements.time.min=bcfg[service]?.start||'00:00';f.elements.time.max=bcfg[service]?.last||'23:59'};f.elements.service.addEventListener('change',setTime);setTime();let availabilityVersion=0;const check=$('#check-availability'),note=$('#availability'),submit=f.querySelector('[type=submit]'),summary=$('#oasi-book-summary');let lastVerified='';
 const bookingSignature=()=>['date','service','time','party_size'].map(key=>f.elements[key].value).join('|');
 const bookingWarning=(text,field)=>{
  lastVerified='';submit.disabled=true;
  note.textContent=text;note.className='availability-note error';
  if(field)f.elements[field]?.focus({preventScroll:true});
 };
 const bookingClientValidation=()=>{
  const data=f.elements,day=data.date.value,svc=data.service.value,time=data.time.value,party=Number(data.party_size.value);
  const todayRome=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'});
  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(day))return ['Seleziona una data valida per la prenotazione.','date'];
  if(day<todayRome)return ['Non puoi prenotare per una data già trascorsa. Scegli un altro giorno.','date'];
  const ahead=new Date();ahead.setDate(ahead.getDate()+(Number(bcfg.maxDaysAhead)||90));
  if(day>ahead.toLocaleDateString('en-CA',{timeZone:'Europe/Rome'}))return ['Questa data è troppo lontana. Seleziona un giorno più vicino.','date'];
  const date=new Date(day+'T12:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day)return ['Seleziona una data valida.','date'];
  if((Array.isArray(bcfg.weekdays)&&!bcfg.weekdays.includes(date.getUTCDay()))||bcfg.closedDates?.includes(day))
   return ['Il ristorante è chiuso nella data selezionata. Scegli un altro giorno.','date'];
  const hours=bcfg[svc]||{},name=svc==='dinner'?'cena':'pranzo';
  if(hours.enabled===false)return ['Il servizio '+name+' non è disponibile. Seleziona un altro servizio.','service'];
  if(!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(time))return ['Seleziona un orario di arrivo valido.','time'];
  const start=hours.start||'00:00',last=hours.last||hours.end||'23:59';
  if(time<start)return ['Per il servizio '+name+' puoi prenotare a partire dalle '+start+'. Seleziona un orario successivo.','time'];
  if(time>last)return ['Ultimo orario prenotabile per il servizio '+name+': '+last+'. Seleziona un orario precedente.','time'];
  const notice=Number(bcfg.minNoticeMinutes)||0;
  const limit=new Date(Date.now()+notice*60000).toLocaleString('sv-SE',{timeZone:'Europe/Rome'}).replace(' ','T');
  if(day===todayRome&&day+'T'+time<limit)return ['L’orario selezionato è troppo vicino o già trascorso. Scegli un orario successivo.','time'];
  if(!Number.isInteger(party)||party<1)return ['Indica un numero di persone valido.','party_size'];
  const max=Number(bcfg.maxOnline)||9;
  if(party>max)return ['Per gruppi di '+(max+1)+' o più persone, contatta direttamente il ristorante.','party_size'];
  return null;
 };
 const bookingApiMessage=e=>{
  const message=String(e?.message||'');
  if(/Errore server|registri Cloudflare|Errore HTTP|richiesta API|binding DB|backend|SQLITE|D1|Worker|trace|fetch failed/i.test(message))
   return 'Si è verificato un problema tecnico nella verifica. Riprova tra poco oppure chiama il ristorante.';
  return message||'Non è stato possibile verificare la disponibilità. Riprova tra poco.';
 };
 const updateSummary=()=>{
  const data=f.elements,day=data.date.value,part=Number(data.party_size.value);
  const date=day?new Date(day+'T12:00:00'):null;
  const dateText=date&&!Number.isNaN(date.getTime())?date.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'scegli una data';
  summary.textContent=(data.service.value==='dinner'?'Cena':'Pranzo')+' · '+dateText+' · ore '+data.time.value+' · '+part+' '+(part===1?'persona':'persone');
 };
 const resetAvailability=()=>{availabilityVersion++;lastVerified='';submit.disabled=true;check.disabled=false;check.removeAttribute('aria-busy');note.textContent='Verifica la disponibilità per i dati selezionati.';note.className='availability-note';updateSummary()};
 for(const key of ['date','service','time','party_size'])f.elements[key].addEventListener('change',resetAvailability);
 updateSummary();check.onclick=async()=>{const validation=bookingClientValidation();if(validation){bookingWarning(...validation);return}const version=++availabilityVersion;check.disabled=true;check.setAttribute('aria-busy','true');note.textContent='Verifica in corso…';note.className='availability-note';const b=inputData(f);try{const q=new URLSearchParams({date:b.date,service:b.service,time:b.time,party_size:b.party_size});const o=await api('availability?'+q);if(version!==availabilityVersion||!note.isConnected)return;lastVerified=o.available?bookingSignature():'';submit.disabled=!o.available;$('#availability').textContent=o.available?'✓ Disponibile · '+o.rooms.map(x=>x.name).join(', '):(o.message||'Nessun tavolo disponibile in questo momento');$('#availability').className='availability-note '+(o.available?'success':'error')}catch(e){if(version===availabilityVersion&&note.isConnected){bookingWarning(bookingApiMessage(e))}}finally{if(version===availabilityVersion&&check.isConnected){check.disabled=false;check.removeAttribute('aria-busy')}}};f.onsubmit=async e=>{e.preventDefault();const btn=f.querySelector('[type=submit]');if(lastVerified!==bookingSignature()){note.textContent='Verifica prima la disponibilità aggiornata.';note.className='availability-note error';submit.disabled=true;return}btn.disabled=true;try{const o=await api('book','POST',inputData(f));f.innerHTML=`<div class="success-card" role="status" tabindex="-1"><div class="eyebrow">PRENOTAZIONE CONFERMATA</div><h2>Ti aspettiamo!</h2><p>La tua prenotazione n° <strong>${o.id}</strong> è confermata per il ${esc(o.date)} alle ${esc(o.time)}, per ${o.party_size} persone.</p>${Number(o.room_id)===2?'<p class="oasi-book-upstairs-note">La prenotazione è nella sala al <strong>primo piano</strong>. Il personale organizzerà i posti all’arrivo.</p>':''}<p>${o.email_status==='sent'?'Email di conferma accettata dal servizio di invio: controlla la casella (e lo spam).':o.email_status==='failed'?'La prenotazione è confermata, ma l’email non è stata inviata. Conserva il collegamento qui sotto.':'La prenotazione è confermata, ma l’invio email non è ancora configurato. Conserva il collegamento qui sotto.'}</p><a class="text-link" href="${esc(o.cancel_url)}">Gestisci o annulla prenotazione <svg class="oasi-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></a></div>`;f.querySelector('.success-card')?.focus()}catch(e){bookingWarning(bookingApiMessage(e));msg('Prenotazione non completata. Controlla l’avviso nel modulo.','error')}finally{if(btn.isConnected)btn.disabled=!lastVerified}}}if($('#cancel-booking'))$('#cancel-booking').onclick=async()=>{try{await api('cancel','POST',{token:new URLSearchParams(location.search).get('token')});$('#cancel-response').textContent='Prenotazione annullata correttamente.';$('#cancel-booking').disabled=true}catch(e){msg(e.message,'error')}};document.querySelectorAll('[data-public-menu]').forEach(button=>button.addEventListener('click',()=>{
  const selected=button.dataset.publicMenu;
  document.querySelectorAll('[data-public-menu]').forEach(b=>{const active=b===button;b.classList.toggle('chosen',active);b.setAttribute('aria-pressed',String(active))});
  document.querySelectorAll('[data-public-menu-section]').forEach(section=>{section.hidden=selected!=='all'&&section.dataset.publicMenuSection!==selected});
 }));
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('chosen'));b.classList.add('chosen');document.querySelectorAll('.menu-section').forEach(x=>x.hidden=x.dataset.section!==b.dataset.filter)});};
const eventsPage=()=>{const pics=(state.data?.gallery||[]).filter(x=>/event|cerimoni|matrimon|riceviment/i.test(x.category||''));return `${nav('eventi')}<main class="oasi-event-page"><section class="event-hero event-hero-premium"><div class="event-hero-photo">${editorialImage(publicMedia('eventImage',editorialPhoto(/event|cerimon|matrimon|riceviment/i)),'Eventi e cerimonie','',true,'eventImage')}</div><div class="event-hero-overlay"></div><div class="event-hero-text"><span class="eyebrow">RICEVIMENTI · CERIMONIE · EVENTI</span><h1>Il luogo in cui<br><em>i ricordi prendono vita.</em></h1><p>All’Oasi ogni evento nasce da un’atmosfera da vivere insieme: matrimoni, cerimonie, feste private e occasioni da ricordare con le persone più importanti.</p><div class="event-hero-actions"><a class="btn btn-light" href="#richiedi-evento">Richiedi informazioni <span><svg class="oasi-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></span></a><a class="event-hero-link" href="tel:+393387036868">Oppure chiamaci al ${esc(site().phone||'338 703 6868')}</a></div></div><div class="event-hero-facts"><div><strong>Matrimoni</strong><span>Atmosfera, accoglienza e cura del dettaglio.</span></div><div><strong>Cerimonie</strong><span>Battesimi, comunioni, anniversari e momenti di famiglia.</span></div><div><strong>Eventi privati</strong><span>Compleanni, feste e occasioni speciali da condividere.</span></div></div></section><section class="section event-story"><div class="event-story-copy"><div class="eyebrow">UN’OSPITALITÀ CHE SI RICORDA</div><h2>Ogni occasione merita<br><em>un’atmosfera speciale.</em></h2><p>Ci sono giornate che si aspettano a lungo e momenti che riuniscono le persone più care. All’Oasi il valore del tempo condiviso incontra la cura dell’accoglienza e il piacere di festeggiare insieme.</p><p>Dalla tavola allestita con attenzione agli spazi dedicati ai ricevimenti, accompagniamo ogni occasione con uno stile sobrio, raffinato e autentico.</p></div><div class="event-story-media">${editorialImage(publicMedia('eventStoryImage',pics[0]?.image_url||site().eventImage),'Allestimento floreale per cerimonia','',false,'eventStoryImage')}<div class="event-story-badge"><span>DAL 1997</span><strong>Ospitalità & ricevimenti</strong></div></div></section><section class="section event-offers"><div class="section-head"><div><div class="eyebrow">COSA POSSIAMO OSPITARE</div><h2>I vostri momenti, <em>con il tono giusto.</em></h2></div><p>Dalle ricorrenze di famiglia agli eventi più attesi, ogni occasione può trovare il suo spazio all’Oasi.</p></div><div class="event-offer-grid"><article class="event-offer-card">${editorialImage(publicMedia('eventWeddingImage',pics[1]?.image_url||site().eventImage),'Matrimonio elegante','',false,'eventWeddingImage')}<div><small>MATRIMONI</small><h3>Il giorno più atteso.</h3><p>Un contesto accogliente e curato, da vivere con le persone che contano davvero.</p><ul><li>Atmosfera elegante</li><li>Spazi dedicati al ricevimento</li><li>Richiesta informazioni personalizzata</li></ul><a href="#richiedi-evento" class="oasi-event-request-link" data-event-type="Matrimonio">Richiedi informazioni</a></div></article><article class="event-offer-card">${editorialImage(publicMedia('eventCeremonyImage',pics[2]?.image_url||site().eventImage),'Cerimonia con tavoli preparati','',false,'eventCeremonyImage')}<div><small>CERIMONIE</small><h3>Le tappe della vita.</h3><p>Battesimi, comunioni, cresime e anniversari da condividere in un luogo che sappia accogliere.</p><ul><li>Pranzi e cene di famiglia</li><li>Organizzazione semplice e chiara</li><li>Contatto diretto con il personale</li></ul><a href="#richiedi-evento" class="oasi-event-request-link" data-event-type="Comunione o cresima">Richiedi informazioni</a></div></article><article class="event-offer-card">${editorialImage(publicMedia('eventPrivateImage',pics[3]?.image_url||site().eventImage),'Evento privato e festa','',false,'eventPrivateImage')}<div><small>EVENTI PRIVATI</small><h3>Ogni festa ha il suo stile.</h3><p>Compleanni, eventi aziendali e occasioni speciali da raccontare insieme, nel modo più adatto.</p><ul><li>Feste private</li><li>Ricorrenze e ricordi</li><li>Richiesta rapida via WhatsApp</li></ul><a href="#richiedi-evento" class="oasi-event-request-link" data-event-type="Compleanno o festa privata">Richiedi informazioni</a></div></article></div></section><section class="section event-reasons"><div class="section-head"><div><div class="eyebrow">PERCHÉ OASI</div><h2>Un modo di ricevere<br><em>fatto di dettagli.</em></h2></div><p>Non solo uno spazio, ma un’esperienza costruita intorno alle persone, all’atmosfera e al piacere di stare bene insieme.</p></div><div class="event-reasons-grid"><article><strong>Ambienti curati</strong><p>Sale e spazi pensati per accogliere con stile e armonia.</p></article><article><strong>Accoglienza autentica</strong><p>Un’impostazione familiare, elegante e mai impersonale.</p></article><article><strong>Contatto diretto</strong><p>Puoi inviare una richiesta rapida e parlare subito con il personale.</p></article></div></section>${pics.length?`<section class="event-real-gallery section"><div class="section-head"><div><div class="eyebrow">SCATTI DAI NOSTRI EVENTI</div><h2>I ricordi <em>prendono forma.</em></h2></div><p>Alcuni dei momenti vissuti insieme all’Oasi.</p></div><div class="oasi-event-photos">${pics.slice(0,6).map(p=>`<img src="${esc(p.image_url)}" alt="${esc(p.caption||'Ricevimenti Oasi')}" loading="lazy"/>`).join('')}</div></section>`:''}<section class="section oasi-event-enquiry" id="richiedi-evento"><div class="event-enquiry-copy"><div class="eyebrow">RICHIEDI INFORMAZIONI</div><h2>Parliamo del vostro<br><em>prossimo evento.</em></h2><p>Per organizzare un evento o una cerimonia, contatta direttamente il ristorante. Il nostro staff verificherà personalmente spazi, data e disponibilità.</p><div class="event-contact-box"><div><span>Telefono</span><a href="tel:+393387036868">${esc(site().phone||'338 703 6868')}</a></div><div><span>Dove siamo</span><p>${esc(site().address||'Contrada Serrarossa, 88835 Roccabernarda KR')}</p></div></div></div><form id="event-request" class="event-internal-public-note oasi-event-form"><span class="eyebrow">RICHIESTA SENZA IMPEGNO</span><h3>Raccontaci l’occasione.</h3><p>Compila i dati essenziali: si aprirà WhatsApp con il messaggio pronto da inviare. La disponibilità sarà verificata dal personale.</p><div class="oasi-event-fields"><label>Tipo di evento<select name="type" required><option value="">Seleziona un evento</option><option value="Matrimonio">Matrimonio</option><option value="Comunione o cresima">Comunione o cresima</option><option value="Battesimo">Battesimo</option><option value="Compleanno o festa privata">Compleanno o festa privata</option><option value="Evento aziendale">Evento aziendale</option><option value="Altro evento">Altro evento</option></select></label><label>Data indicativa<input name="date" type="date" min="${new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'})}" required></label><label>Numero indicativo di invitati<input type="number" name="guests" min="1" max="500" inputmode="numeric" placeholder="Es. 40" required></label><label>Dettagli o richieste<textarea name="note" rows="3" maxlength="500" placeholder="Descrivici brevemente l'evento"></textarea></label></div><button class="btn btn-dark" type="submit">Prepara richiesta WhatsApp</button><p class="oasi-event-disclaimer">La richiesta non costituisce una prenotazione. Non inserire dati sensibili nel messaggio.</p><a class="oasi-editorial-link" href="tel:+393387036868">Preferisci chiamare? 338 703 6868</a></form></section></main>${footer()}`};
function renderPublic(){const pageMeta={'/':['Ristorante Oasi | Cucina e ospitalità dal 1997','Ristorante Oasi a Roccabernarda: cucina, ospitalità, eventi e prenotazioni online.'],'/chi-siamo':['La nostra storia | Ristorante Oasi','Scopri la storia e l’accoglienza del Ristorante Oasi a Roccabernarda dal 1997.'],'/menu':['Menù PDF | Ristorante Oasi','Consulta e scarica il menù aggiornato del Ristorante Oasi.'],'/galleria':['Galleria fotografica | Ristorante Oasi','Scopri gli ambienti e i momenti del Ristorante Oasi attraverso le fotografie.'],'/eventi-cerimonie':['Eventi e cerimonie | Ristorante Oasi','Matrimoni, cerimonie e ricevimenti al Ristorante Oasi di Roccabernarda.'],'/prenota':['Prenota un tavolo | Ristorante Oasi','Prenota online pranzo o cena al Ristorante Oasi a Roccabernarda.'],'/privacy':['Privacy | Ristorante Oasi','Informativa relativa al trattamento dei dati personali.'],'/annulla':['Gestisci prenotazione | Ristorante Oasi','Consulta e gestisci la prenotazione al Ristorante Oasi.']};const meta=pageMeta[location.pathname]||pageMeta['/'];document.title=meta[0];const description=document.querySelector('meta[name="description"]');if(description)description.setAttribute('content',meta[1]);const favicon=publicMedia('favicon');if(favicon){const link=document.createElement('link');link.rel='icon';link.href=favicon;document.head.append(link)}document.body.classList.add('oasi-public');const path=location.pathname;document.body.classList.toggle('oasi-home',path==='/');root.innerHTML=path==='/prenota'?book():path==='/menu'?menupage():path==='/chi-siamo'?aboutPage():path==='/galleria'?galleryPage():path==='/eventi-cerimonie'?eventsPage():path==='/privacy'?privacy():path==='/annulla'?cancel():home();root.querySelector('main')?.setAttribute('id','contenuto-principale');bindPublic();const menu=$('#links'),toggle=$('#hamburger'),mobile=matchMedia('(max-width:1000px)');const setMenu=(open,focus=false)=>{open=Boolean(open&&mobile.matches);menu.classList.toggle('open',open);menu.hidden=mobile.matches&&!open;menu.inert=menu.hidden;document.body.classList.toggle('oasi-nav-open',open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Chiudi menu':'Apri menu');if(focus)toggle.focus()};setMenu(false);toggle.addEventListener('click',()=>setMenu(toggle.getAttribute('aria-expanded')!=='true'));mobile.addEventListener('change',()=>setMenu(false));menu.querySelectorAll('a').forEach(a=>{if(new URL(a.href,location.href).pathname===path&&!a.hash)a.setAttribute('aria-current','page');a.addEventListener('click',()=>setMenu(false))});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true')setMenu(false,true)});if(path!=='/prenota'&&path!=='/annulla'&&path!=='/privacy')root.insertAdjacentHTML('beforeend','<div class="oasi-mobile-book"><a href="tel:+393387036868">Chiama</a><a href="/prenota">Prenota un tavolo</a></div>');if(location.hash&&location.pathname==='/'){requestAnimationFrame(()=>{const destination=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(destination)destination.scrollIntoView({behavior:'instant',block:'start'});});}}

// Menu ADMIN raggruppato: mantiene i data-tab usati dalle funzioni già esistenti.
const oasiSidebarGroups=[
 {id:'operation',title:'OPERATIVITÀ',items:['dashboard','calendar','service','reservations','events']},
 {id:'people',title:'CLIENTI E MESSAGGI',items:['customers','notifications','emails']},
 {id:'analysis',title:'CONTROLLO',items:['analytics','security']},
 {id:'rooms',title:'SALE E PRENOTAZIONI',items:['floor','rooms','booking']},
 {id:'website',title:'GESTIONE SITO',items:['menu','gallery','site','faq']}
];
const oasiSidebarPaths={calendar:'M7 2v4 M17 2v4 M3 9h18 M3 4h18v17H3z M7 13h2 M12 13h2 M17 13h1 M7 17h2 M12 17h2',dashboard:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',service:'M3 8h18 M3 16h18 M8 3v18 M16 3v18',reservations:'M7 2v4 M17 2v4 M3 9h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',events:'M4 21h16 M6 21V9l6-6 6 6v12 M9 13h6 M9 17h6',customers:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',notifications:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',emails:'M3 5h18v14H3z M3 7l9 7 9-7',analytics:'M3 3v18h18 M7 15l4-4 3 3 6-7',security:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',floor:'M3 3h18v18H3z M3 11h18 M11 3v18',rooms:'M4 22V4h16v18 M9 22v-7h6v7 M9 9h.01 M15 9h.01',booking:'M12 6v6l4 2 M22 12a10 10 0 1 1-10-10 10 10 0 0 1 10 10',menu:'M4 3h16v18H4z M8 8h8 M8 12h8 M8 16h5',gallery:'M3 3h18v18H3z M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3 M3 17l6-6 4 4 3-3 5 5',site:'M3 12h18 M12 3a15 15 0 0 1 0 18 M12 3a15 15 0 0 0 0 18 M2 12a10 10 0 1 0 20 0 10 10 0 0 0-20 0',faq:'M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17h.01 M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20'};
const oasiSideIcon=id=>`<svg class="oasi-side-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${oasiSidebarPaths[id]||oasiSidebarPaths.dashboard}"/></svg>`;
const oasiSidebarOpened=new Set(['operation']);
const oasiSidebarNav=tab=>oasiSidebarGroups.map(group=>{
 const selected=group.items.includes(tab);
 const opened=oasiSidebarOpened.has(group.id)||selected;
 return `<details class="oasi-side-group" data-side-group="${group.id}" ${opened?'open':''}><summary><span>${group.title}</span><svg class="oasi-side-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="oasi-side-group-links">${group.items.map(k=>{const label=adminNavItems.find(([id])=>id===k)?.[1]||k;return `<button type="button" class="side-item ${tab===k?'active':''}" data-tab="${k}" ${tab===k?'aria-current="page"':''}>${oasiSideIcon(k)}<span class="oasi-side-text">${label}</span></button>`}).join('')}</div></details>`}).join('');
const adminShell=(content,tab='dashboard')=>`<div class="admin"><aside class="sidebar" aria-label="Menu amministrazione"><div class="oasi-side-head"><a href="/" class="side-brand" aria-label="Ristorante Oasi, torna al sito"><img src="/logo-oasi.png" alt="Oasi"/></a><span class="oasi-side-eyebrow">PANNELLO AMMINISTRATORE</span><span class="oasi-side-admin"><span class="oasi-side-status"></span>Accesso ADMIN</span></div><nav class="oasi-side-nav" aria-label="Sezioni ADMIN">${oasiSidebarNav(tab)}</nav><div class="oasi-side-footer"><a href="/" class="oasi-side-footer-link">${oasiSideIcon('site')}<span>Visualizza sito</span></a><button id="logout" type="button" class="oasi-side-footer-link oasi-side-logout">${oasiSideIcon('security')}<span>Esci dall’ADMIN</span></button></div></aside><div class="admin-main"><div class="admin-mobile"><span class="oasi-mobile-brand" aria-label="L’Oasi, pannello amministratore"><strong>L’OASI<span aria-hidden="true">.</span></strong><small>AMMINISTRAZIONE</small></span><button type="button" id="oasi-admin-menu-toggle" aria-haspopup="dialog" aria-expanded="false"><span>${esc(adminNavItems.find(([k])=>k===tab)?.[1]||'Menu')}</span><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button></div>${adminTools()}${content}</div>${adminMobileNav(tab)}</div>`;
function bindOasiSidebar(){
 const toggle=$('#oasi-admin-menu-toggle');toggle?.addEventListener('click',()=>{if(document.querySelector('.oasi-admin-mobile-dialog'))return;const dialog=document.createElement('dialog');dialog.className='oasi-admin-mobile-dialog';dialog.setAttribute('aria-label','Menu amministrazione');dialog.innerHTML=`<header><div><small>RISTORANTE OASI</small><h2>Menu ADMIN</h2></div><button type="button" data-close aria-label="Chiudi menu">×</button></header><div class="oasi-admin-mobile-menu-content">${oasiSidebarGroups.map(g=>`<section><h3>${g.title}</h3>${g.items.map(key=>`<button type="button" data-mobile-route="${key}" ${state.adminView===key?'aria-current="page"':''}>${oasiSideIcon(key)}<span>${esc(adminNavItems.find(([k])=>k===key)?.[1]||key)}</span></button>`).join('')}</section>`).join('')}</div><footer><a href="/">Visualizza sito</a><button type="button" data-mobile-logout>Esci dall’ADMIN</button></footer>`;root.querySelector('.admin').append(dialog);toggle.setAttribute('aria-expanded','true');dialog.addEventListener('close',()=>{dialog.remove();toggle.setAttribute('aria-expanded','false');if(toggle.isConnected)toggle.focus()});dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelectorAll('[data-mobile-route]').forEach(b=>b.onclick=()=>{dialog.close();adminGoTo(b.dataset.mobileRoute)});dialog.querySelector('[data-mobile-logout]').onclick=()=>{dialog.close();$('#logout')?.click()};dialog.showModal()});

 document.querySelectorAll('.oasi-side-group').forEach(details=>details.addEventListener('toggle',()=>{if(details.open)oasiSidebarOpened.add(details.dataset.sideGroup);else oasiSidebarOpened.delete(details.dataset.sideGroup)}));
}
// Fase 6 — comandi rapidi, ricerca e navigazione mobile (solo sessione ADMIN).
const adminNavItems=[['dashboard','Panoramica'],['calendar','Calendario'],['service','Servizio e sala'],['reservations','Prenotazioni'],['customers','Clienti'],['analytics','Statistiche e report'],['events','Eventi e cerimonie'],['notifications','Notifiche'],['emails','Email'],['security','Sicurezza e registro'],['floor','Piantina tavoli'],['rooms','Sale e ambienti'],['menu','Menù PDF'],['gallery','Galleria'],['site','Contenuti e contatti'],['faq','Domande frequenti'],['booking','Orari e regole']];
const adminMobileItems=[['dashboard','Home'],['service','Sala'],['reservations','Agenda'],['customers','Clienti'],['events','Eventi']];
const adminTools=()=>`<div class="oasi-admin-tools" role="toolbar" aria-label="Azioni rapide ADMIN"><button type="button" class="oasi-tool-search" id="admin-search-open" aria-label="Cerca clienti e prenotazioni">⌕ <span>Cerca cliente o prenotazione</span> <kbd>/</kbd></button><button type="button" id="admin-shortcut-new" aria-label="Nuova prenotazione">＋ <span>Nuova prenotazione</span></button><button type="button" id="admin-shortcut-refresh" aria-label="Aggiorna dati">↻ <span>Aggiorna</span></button><small id="oasi-poll-status" aria-live="off" style="font-size:11px;opacity:.7;white-space:nowrap">Sincronizzazione ogni 30 s</small></div>`;
const adminMobileNav=tab=>`<nav class="oasi-mobile-nav" aria-label="Navigazione rapida ADMIN">${adminMobileItems.map(([key,label])=>`<button type="button" data-admin-goto="${key}" class="${tab===key?'active':''}" ${tab===key?'aria-current="page"':''}><span class="oasi-nav-symbol" aria-hidden="true">${oasiSideIcon(key)}</span><span>${label}</span></button>`).join('')}</nav>`;
async function adminGoTo(tab,openNew=false,preserveSelection=false){
 if(!adminNavItems.some(([key])=>key===tab))return;
 if(!preserveSelection&&tab==='reservations'){state.date=oasiItalianToday();state.reservationService='all';state.agendaManualSelection=false}
 if(!preserveSelection&&tab==='service'){state.opsManualSelection=false;state.date=oasiItalianToday();state.opsService=oasiItalianService()}
 state.adminView=tab;
 await renderAdmin();
 window.scrollTo({top:0,behavior:'instant'});
 if(openNew){const button=$('#new-book');if(button)button.click();else msg('Apri Prenotazioni per creare una prenotazione.','error')}
}
function closeAdminSearch(){document.querySelector('.oasi-search-overlay')?.remove();document.body.classList.remove('oasi-search-is-open');$('#admin-search-open')?.focus()}
function openAdminSearch(){
 if(document.querySelector('.oasi-search-overlay'))return;
 const layer=document.createElement('div');layer.className='oasi-search-overlay';layer.innerHTML=`<button type="button" class="oasi-search-shade" aria-label="Chiudi ricerca"></button><section class="oasi-search-panel" role="dialog" aria-modal="true" aria-label="Ricerca rapida"><div class="oasi-search-heading"><div><small>OASI · RICERCA RAPIDA</small><h2>Trova subito.</h2></div><button type="button" class="oasi-search-close" aria-label="Chiudi ricerca">×</button></div><label class="oasi-search-input-wrap"><span class="sr-only">Cerca clienti</span><input id="oasi-search-query" type="search" maxlength="100" autocomplete="off" placeholder="Nome, telefono o email del cliente" aria-describedby="oasi-search-help" /></label><p id="oasi-search-help" class="oasi-search-help">La ricerca consulta le schede clienti. Per le prenotazioni apri l'agenda del giorno selezionato.</p><div class="oasi-search-results" aria-live="polite"><p>Scrivi almeno 2 caratteri per cercare.</p></div><div class="oasi-search-bottom"><button class="mini" type="button" data-oasi-search-action="agenda">Apri agenda</button><button class="mini" type="button" data-oasi-search-action="new">+ Nuova prenotazione</button></div></section>`;
 document.body.appendChild(layer);document.body.classList.add('oasi-search-is-open');
 layer.querySelector('.oasi-search-shade').onclick=closeAdminSearch;
 layer.querySelector('.oasi-search-close').onclick=closeAdminSearch;
 layer.querySelector('[data-oasi-search-action="agenda"]').onclick=()=>{closeAdminSearch();adminGoTo('reservations')};
 layer.querySelector('[data-oasi-search-action="new"]').onclick=()=>{closeAdminSearch();adminGoTo('reservations',true)};
 const input=layer.querySelector('#oasi-search-query'),results=layer.querySelector('.oasi-search-results');let counter=0,timeout;
 input.addEventListener('input',()=>{clearTimeout(timeout);const q=input.value.trim(),version=++counter;
  if(q.length<2){results.innerHTML='<p>Scrivi almeno 2 caratteri per cercare.</p>';return}
  results.innerHTML='<p>Ricerca clienti in corso…</p>';
  timeout=setTimeout(async()=>{try{const found=await api('admin/customers?q='+encodeURIComponent(q));if(version!==counter||!layer.isConnected)return;
   results.innerHTML=found.length?found.slice(0,35).map(c=>`<button type="button" class="oasi-search-result" data-find-customer="${Number(c.id)}"><strong>${esc(c.name)}</strong><span>${esc(c.phone||'')} · ${esc(c.email||'')}</span><small>${Number(c.actual_visits||0)} visite · ${Number(c.total_bookings||0)} prenotazioni</small></button>`).join(''):'<p>Nessun cliente trovato. Prova con un altro nome o numero.</p>';
   results.querySelectorAll('[data-find-customer]').forEach(b=>b.onclick=async()=>{const id=b.dataset.findCustomer;closeAdminSearch();await adminGoTo('customers');openCustomerCard(id)});
  }catch(e){if(version===counter&&layer.isConnected)results.innerHTML=`<p>${esc(e.message)}</p>`}},250)
 });
 requestAnimationFrame(()=>input.focus());
}
function bindAdminTools(){
 $('#admin-search-open')?.addEventListener('click',openAdminSearch);
 $('#admin-shortcut-new')?.addEventListener('click',()=>{if(state.adminView==='service'||state.adminView==='dashboard')state.reservationService=state.adminView==='service'?state.opsService:oasiItalianService();openNewBookingDrawer()});
 $('#admin-shortcut-refresh')?.addEventListener('click',()=>renderAdmin());
 document.querySelectorAll('[data-admin-goto]').forEach(b=>b.addEventListener('click',()=>adminGoTo(b.dataset.adminGoto)));
}
document.addEventListener('keydown',e=>{
 if(location.pathname!=='/admin'||!state.user)return;
 if(e.key==='Escape'&&document.querySelector('.oasi-search-overlay')){e.preventDefault();closeAdminSearch();return}
 if((e.key==='/'||(e.ctrlKey&&e.key.toLowerCase()==='k'))&&!e.altKey&&!e.metaKey){const t=e.target;if(t instanceof HTMLElement&&t.closest('input,textarea,select,[contenteditable="true"]'))return;e.preventDefault();openAdminSearch()}
});
const heading=(h,sub)=>`<div class="admin-head"><div><div class="eyebrow">RISTORANTE OASI / ADMIN</div><h1>${h}</h1><p>${sub||''}</p></div></div>`;
const fields=(arr,d={})=>arr.map(([key,label,type='text'])=>`<label>${label}${type==='textarea'?`<textarea name="${key}" rows="4">${esc(d[key])}</textarea>`:type==='checkbox'?`<input type="checkbox" name="${key}" ${d[key]?'checked':''}/>`:`<input name="${key}" type="${type}" value="${esc(d[key]??'')}" />`}</label>`).join('');
const sectionForm=(title,inputs,submit='Salva')=>`<section class="panel"><h3>${title}</h3><form id="editor-form"><div class="fields two">${inputs}</div><div class="form-actions"><button class="btn btn-dark" type="submit">${submit} <svg class="oasi-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></button><button class="btn btn-outline" type="button" id="form-cancel">Annulla</button></div></form></section>`;
const parseForm=f=>{const o=inputData(f);f.querySelectorAll('[type=checkbox]').forEach(x=>o[x.name]=x.checked?1:0);return o};
const floorOrientation=t=>t?.shape==='rectangle'&&Number(t.h)>Number(t.w)?'vertical':'horizontal';
const floorTableCaption=t=>`${Number(t.min_seats||1)}–${Number(t.seats||1)} posti`;
const floorTableModules=t=>`${Number(t.module_count||1)} ${Number(t.module_count||1)===1?'tavolo':'tavoli'}`;
const oasiWhatsAppNumber=phone=>{let digits=String(phone||'').replace(/\D/g,'');if(digits.startsWith('00'))digits=digits.slice(2);if(digits.length===10&&digits[0]==='3')digits='39'+digits;return digits.length>=9&&digits.length<=15?digits:''};
const oasiWhatsAppHref=(phone,name,date='',time='')=>{const number=oasiWhatsAppNumber(phone);if(!number)return '';const message=`Buongiorno ${name||''}, ti contattiamo dal Ristorante Oasi${date?' per la prenotazione del '+date:''}${time?' alle '+time:''}.`;return 'https://wa.me/'+number+'?text='+encodeURIComponent(message)};
// Only suggest exact contact matches; never overwrite typed fields without explicit staff selection.
function customerAutocomplete(form){
 if(!form||form.dataset.customerLookup==='yes')return;
 const phone=form.querySelector('[name="phone"]'),email=form.querySelector('[name="email"]'),name=form.querySelector('[name="name"]');if(!phone||!email||!name)return;
 form.dataset.customerLookup='yes';const suggestion=document.createElement('div');suggestion.className='customer-autocomplete';suggestion.setAttribute('aria-live','polite');(form.id==='oasi-booking-drawer-form'?phone:email).closest('label')?.insertAdjacentElement('afterend',suggestion);
 let seq=0,timer;
 const find=()=>{clearTimeout(timer);const thisSeq=++seq;const p=phone.value.trim(),m=email.value.trim();suggestion.replaceChildren();if((p.replace(/\D/g,'').length<9)&&(!m.includes('@')))return;
  timer=setTimeout(async()=>{try{const results=await api('admin/customers?lookup=1&phone='+encodeURIComponent(p)+'&email='+encodeURIComponent(m));if(thisSeq!==seq||!form.isConnected)return;
   if(!results.length)return;
   const title=document.createElement('p');title.textContent=results.length===1?'Cliente già presente:':'Possibili clienti, scegli quello corretto:';suggestion.append(title);
   results.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='customer-suggestion';b.textContent=c.name+' · '+c.phone+' · '+c.email;b.addEventListener('click',()=>{name.value=c.name;phone.value=c.phone;email.value=c.email;suggestion.replaceChildren();++seq});suggestion.append(b)});
  }catch(e){if(thisSeq===seq){suggestion.textContent='Ricerca cliente non disponibile: inserisci i dati manualmente.'}}},350);
 };
 phone.addEventListener('input',find);email.addEventListener('input',find);
}
const zoneGroups=zones=>{const arr=(zones||[]).map(z=>({...z}));const overlaps=(a,b)=>!(a.x+a.w<b.x||b.x+b.w<a.x||a.y+a.h<b.y||b.y+b.h<a.y);const groups=[];for(const z of arr){let group=groups.find(g=>g.some(item=>overlaps(item,z)));if(!group){group=[];groups.push(group)}group.push(z);let changed=true;while(changed){changed=false;for(const other of groups.slice()){if(other===group)continue;if(other.some(item=>group.some(sel=>overlaps(item,sel)))){group.push(...other);groups.splice(groups.indexOf(other),1);changed=true;}}}}return groups};
// Render a true geometric union: internal boundaries disappear when rectangles overlap/touch.
const unionGeometry=zones=>{
 const cleanZones=(zones||[]).map(z=>({x:Math.max(0,Number(z.x)||0),y:Math.max(0,Number(z.y)||0),w:Math.max(0,Number(z.w)||0),h:Math.max(0,Number(z.h)||0)})).filter(z=>z.w>0&&z.h>0);
 if(!cleanZones.length)return '';
 const xs=[...new Set(cleanZones.flatMap(z=>[z.x,z.x+z.w]))].sort((a,b)=>a-b);
 const ys=[...new Set(cleanZones.flatMap(z=>[z.y,z.y+z.h]))].sort((a,b)=>a-b);
 const occupied=(i,j)=>i>=0&&j>=0&&i<xs.length-1&&j<ys.length-1&&cleanZones.some(z=>xs[i]>=z.x&&xs[i+1]<=z.x+z.w&&ys[j]>=z.y&&ys[j+1]<=z.y+z.h);
 let fill='',edges='';
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){
  if(!occupied(i,j))continue;
  const x=xs[i],y=ys[j],r=xs[i+1],b=ys[j+1];
  fill+=`<rect x="${x}" y="${y}" width="${r-x}" height="${b-y}"/>`;
  if(!occupied(i,j-1))edges+=`M${x} ${y}H${r}`;
  if(!occupied(i+1,j))edges+=`M${r} ${y}V${b}`;
  if(!occupied(i,j+1))edges+=`M${r} ${b}H${x}`;
  if(!occupied(i-1,j))edges+=`M${x} ${b}V${y}`;
 }
 return `<svg class="floor-union-svg" viewBox="0 0 1100 700" width="1100" height="700" aria-hidden="true"><g class="floor-union-fill">${fill}</g><path class="floor-union-outline" d="${edges}"/></svg>`;
};
const renderZones=zns=>`${unionGeometry(zns)}${(zns||[]).map(z=>`<button type="button" class="floor-zone" data-zone="${z.id}" style="left:${z.x}px;top:${z.y}px;width:${z.w}px;height:${z.h}px" aria-label="Modifica area ${esc(z.label||'Ambiente')}"><span class="floor-zone-name">${esc(z.label||'Ambiente')}</span><span class="floor-zone-resize" aria-label="Ridimensiona ambiente" title="Trascina per ridimensionare"></span></button>`).join('')}`;
const refreshZoneGeometry=()=>{const svg=$('.floor-union-svg');if(svg){const host=svg.parentElement;const temp=document.createElement('div');temp.innerHTML=unionGeometry(state.roomZones.filter(z=>z.room_id===state.room));if(temp.firstElementChild)host.replaceChild(temp.firstElementChild,svg);}};
const renderFloorTable=t=>`<button type="button" class="floor-table ${esc(t.shape)} ${floorOrientation(t)} ${t.enabled?'':'off'}" data-table="${t.id}" style="left:${t.x}px;top:${t.y}px;width:${t.w}px;height:${t.h}px;transform:rotate(${t.rotation}deg)"><span class="floor-table-code">${esc(t.code)}</span><span class="floor-table-info"><small class="floor-table-meta">${floorTableCaption(t)}</small><small class="floor-table-modules">${floorTableModules(t)}</small></span><span class="floor-table-resize" title="Trascina per ridimensionare" aria-label="Ridimensiona tavolo"></span></button>`;
const FLOOR_WIDTH=1100,FLOOR_HEIGHT=700;
const floorZoom={scale:1,mode:'fit'};
function applyFloorZoom(){const scroll=$('.floor-board-scroll'),board=$('#floor-board'),stage=$('#floor-stage');if(!scroll||!board||!stage)return;
 const available=Math.max(260,scroll.clientWidth-4),scale=floorZoom.mode==='fit'?Math.min(1,available/FLOOR_WIDTH):floorZoom.scale;
 floorZoom.scale=Math.min(1.75,Math.max(.28,scale));
 board.style.transform=`scale(${floorZoom.scale})`;board.style.transformOrigin='top left';
 stage.style.width=`${FLOOR_WIDTH*floorZoom.scale}px`;stage.style.height=`${FLOOR_HEIGHT*floorZoom.scale}px`;
 const label=$('#floor-zoom-label');if(label)label.textContent=Math.round(floorZoom.scale*100)+'%';
}
function bindFloorZoom(){if(!$('#floor-board'))return;
 const setScale=v=>{floorZoom.mode='manual';floorZoom.scale=Math.max(.3,Math.min(1.75,v));applyFloorZoom()};
 $('#floor-zoom-in')?.addEventListener('click',()=>setScale(Math.round((floorZoom.scale+.1)*100)/100));
 $('#floor-zoom-out')?.addEventListener('click',()=>setScale(Math.round((floorZoom.scale-.1)*100)/100));
 $('#floor-zoom-100')?.addEventListener('click',()=>setScale(1));
 $('#floor-zoom-fit')?.addEventListener('click',()=>{floorZoom.mode='fit';applyFloorZoom()});
 requestAnimationFrame(applyFloorZoom);
}
// Solo sincronizzazione prenotazioni: nessun suono, avviso esterno o servizio email.
const oasiReservationSync={timer:null,busy:false,key:'',signature:null,failures:0};
const oasiSyncViews=new Set(['dashboard','service','reservations','calendar']);
function oasiSyncPeriod(){
 if(!oasiSyncViews.has(state.adminView))return null;
 if(state.adminView==='calendar'){const range=calendarRange();const selected=calendarState().selected;return {key:'calendar:'+range.start+':'+range.end+':'+selected,...range,selected};}
 const service=state.adminView==='reservations'?(state.reservationService||'all'):(state.opsService||'lunch');
 return {key:`${state.adminView}:${state.date}:${service}`,date:state.date,service};
}
// Canonical representation of the actual data rendered, independent of SQL row ordering.
const oasiStableValue=v=>Array.isArray(v)?v.map(oasiStableValue):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,oasiStableValue(v[k])])):v;
const oasiSortedRows=rows=>[...(rows||[])].sort((a,b)=>String(a.id??'').localeCompare(String(b.id??'')));
function oasiSyncSignature(snapshot){
 if(snapshot.calendar)return JSON.stringify(oasiStableValue(snapshot));
 const reservations=oasiSortedRows(snapshot.reservations).map(r=>[r.id,r.status,r.visit_state,r.visit_note,r.book_date,r.service,r.time,r.party_size,r.name,r.phone,r.email,r.notes,r.room_id,String(r.table_ids||'').split(',').sort().join(','),r.table_codes,r.source]);
 return JSON.stringify(oasiStableValue({reservations,tables:oasiSortedRows(snapshot.tables),rooms:oasiSortedRows(snapshot.rooms),blocks:oasiSortedRows(snapshot.blocks),zones:oasiSortedRows(snapshot.zones),links:oasiSortedRows(snapshot.links)}));
}
let oasiRenderSerial=0,oasiRenderPending=0;
function oasiSyncSafeToRender(){
 if(!state.user||location.pathname!=='/admin'||document.hidden||!oasiSyncViews.has(state.adminView)||oasiRenderPending||oasiAdminWrites)return false;
 if(document.querySelector('.oasi-search-overlay,.phase2-drawer-wrap,.event-drawer-backdrop,.op-drawer-layer,.oasi-booking-drawer-layer,.floor-inspector-backdrop,.oasi-print-sheet,[aria-modal="true"]'))return false;
 if(document.body.classList.contains('floor-panel-open')||document.querySelector('#edit-area form'))return false;
 if(document.querySelector('form:focus-within,[contenteditable="true"]:focus,select:focus,input:focus,textarea:focus'))return false;
 const blockForm=document.querySelector('#op-block-form');
 if(blockForm&&(blockForm.dataset.oasiDirty==='1'||blockForm.elements.reason?.value.trim()))return false;
 return true;
}
document.addEventListener('input',e=>{const f=e.target.closest?.('#op-block-form');if(f)f.dataset.oasiDirty='1'});
document.addEventListener('change',e=>{const f=e.target.closest?.('#op-block-form');if(f)f.dataset.oasiDirty='1'});
async function oasiFetchSnapshot(period){
 if(period.key.startsWith('calendar:'))return {...await api('admin/calendar?'+new URLSearchParams({start:period.start,end:period.end,selected:period.selected})),calendar:true};
 const q=new URLSearchParams({date:period.date,service:period.service});
 if(period.key.startsWith('reservations:'))return {reservations:await api('admin/reservations?'+q.toString())};
 return api('admin/operations?'+q.toString());
}
function oasiSyncStatus(label){const el=document.getElementById('oasi-poll-status');if(el)el.textContent=label}
async function oasiSyncTick(){
 if(oasiReservationSync.busy||!oasiSyncSafeToRender())return;
 if(oasiAutoServiceRefresh()){await renderAdmin();return}
 const period=oasiSyncPeriod();if(!period)return;
 oasiReservationSync.busy=true;
 try{
  const serial=oasiRenderSerial;
  const snapshot=await oasiFetchSnapshot(period);
  if(!Array.isArray(snapshot.reservations))throw Error('Elenco prenotazioni non valido');
  if(!oasiSyncSafeToRender()||oasiSyncPeriod()?.key!==period.key||serial!==oasiRenderSerial)return;
  const signature=oasiSyncSignature(snapshot);
  if(oasiReservationSync.key!==period.key||oasiReservationSync.signature!==signature){
   const y=window.scrollY,navY=document.querySelector('.oasi-side-nav')?.scrollTop||0;
   await renderAdmin(snapshot);
   if(oasiSyncPeriod()?.key===period.key){window.scrollTo(0,y);const nav=document.querySelector('.oasi-side-nav');if(nav)nav.scrollTop=navY;}
  }
  oasiReservationSync.failures=0;
  oasiSyncStatus('Aggiornato ' +new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}));
 }catch(e){
  oasiReservationSync.failures++;
  oasiSyncStatus('Sincronizzazione non riuscita · premi Aggiorna');
  if(oasiReservationSync.failures===1)console.warn('Oasi: sincronizzazione prenotazioni non riuscita',e);
 }finally{oasiReservationSync.busy=false}
}
function oasiStartReservationSync(){
 if(oasiReservationSync.timer||location.pathname!=='/admin'||!state.user)return;
 oasiReservationSync.timer=setInterval(oasiSyncTick,30000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)oasiSyncTick()});
 oasiSyncTick();
}
async function loadAdmin(){try{await api('admin/me');state.user=true}catch{state.user=false}if(!state.user){root.innerHTML=`<main class="login-wrap"><div class="login-card"><img src="/logo-oasi.png" alt="Oasi"/><div class="eyebrow">AREA RISERVATA</div><h1>Benvenuto.</h1><p>Inserisci la password riservata per accedere al gestionale.</p><form id="login"><label>Password<input type="password" name="password" autocomplete="current-password" required autofocus/></label><button class="btn btn-dark full">Accedi <svg class="oasi-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></button></form><p class="tiny"><a href="/">← Torna al sito</a></p></div></main>`;$('#login').onsubmit=async e=>{e.preventDefault();try{await api('admin/login','POST',inputData(e.target));state.user=true;renderAdmin().then(oasiStartReservationSync)}catch(x){msg(x.message,'error')}};return}renderAdmin().then(oasiStartReservationSync)}
const opLabel={expected:'In attesa',arrived:'Arrivato',seated:'Al tavolo',finished:'Terminato',no_show:'Non presentato'};
const opServiceLabel=key=>key==='lunch'?'Pranzo':'Cena';
const operationalStats=(data,svc)=>{const reservations=data.reservations.filter(r=>r.status==='confirmed'&&(svc==='all'||r.service===svc));const byState=k=>reservations.filter(r=>r.visit_state===k).length;const blocked=(data.blocks||[]).filter(b=>svc==='all'||b.service===svc);const assigned=new Set(reservations.flatMap(r=>String(r.table_ids||'').split(',').map(Number)));const blockedRooms=new Set(blocked.filter(b=>b.scope==='room').map(b=>Number(b.target_id)));const blockedTables=new Set(blocked.filter(b=>b.scope==='table').map(b=>Number(b.target_id)));const allClosed=blocked.some(b=>b.scope==='service');const availableTables=(data.tables||[]).filter(t=>t.enabled&&!assigned.has(Number(t.id))&&!blockedRooms.has(Number(t.room_id))&&!blockedTables.has(Number(t.id))&&!allClosed&&((data.rooms||[]).find(r=>r.id===t.room_id)?.internal_enabled!==0)).length;return {availableTables,reservations,bookings:reservations.length,covers:reservations.reduce((n,r)=>n+Number(r.party_size||0),0),waiting:byState('expected'),arrived:byState('arrived'),seated:byState('seated'),finished:byState('finished'),noShow:byState('no_show'),blocked};};
const opSelect=(r)=>`<select class="op-visit-select" data-op-state="${Number(r.id)}" aria-label="Stato ${esc(r.name)}" ${r.status==='cancelled'?'disabled':''}>${Object.entries(opLabel).map(([key,label])=>`<option value="${key}" ${(r.visit_state||'expected')===key?'selected':''}>${label}</option>`).join('')}</select>`;
const oasiVisitNext={expected:['arrived','Segna arrivato'],arrived:['seated','Accompagna al tavolo'],seated:['finished','Termina servizio']};
const oasiServiceMobileCards=rows=>`<section class="oasi-service-mobile-cards" aria-label="Gestione rapida clienti"><div class="oasi-service-mobile-heading"><span class="eyebrow">GESTIONE RAPIDA</span><h3>Arrivi e tavoli</h3><p>Aggiorna lo stato dei clienti con un tocco.</p></div>${rows.length?rows.map(r=>{
 const visit=r.visit_state||'expected',next=oasiVisitNext[visit],phone=String(r.phone||'').replace(/[^+0-9]/g,'');
 return `<article class="oasi-service-guest" data-op-guest="${Number(r.id)}">
  <div class="oasi-service-guest-top"><span class="oasi-service-guest-time">${esc(r.time)}</span><span class="oasi-service-guest-status" data-visit-status="${esc(visit)}">${esc(opLabel[visit]||visit)}</span></div>
  <h4>${esc(r.name)}</h4>${r.source==='staff_banquet'?'<span class="oasi-banquet-tag">Banchetto · sala condivisa</span>':''}<p>${Number(r.party_size)} ${Number(r.party_size)===1?'persona':'persone'} · ${esc(r.table_codes||(Number(r.room_id)===2?'Primo piano · senza tavolo assegnato':'Da assegnare'))}</p>
  <div class="oasi-service-guest-actions">
   ${next?`<button class="oasi-service-next" type="button" data-op-step="${Number(r.id)}" data-op-next="${next[0]}" aria-label="${next[1]} per ${esc(r.name)}">${next[1]}</button>`:''}
   <button class="oasi-service-edit" type="button" data-op-mobile-edit="${Number(r.id)}" aria-label="Modifica prenotazione di ${esc(r.name)}">Modifica</button>
   ${phone?`<a class="oasi-service-call" href="tel:${esc(phone)}" aria-label="Chiama ${esc(r.name)}">Chiama</a>`:''}
  </div>
  <label class="oasi-service-guest-manual">Altri stati ${opSelect(r)}</label>
 </article>`}).join(''):'<p class="oasi-service-guest-empty">Nessuna prenotazione per il servizio selezionato.</p>'}</section>`;
const operationalTable=(rows,includeService=false)=>`<div class="table-scroll"><table class="op-table"><thead><tr><th>Ora</th><th>Cliente</th><th>Ospiti</th><th>Tavolo</th>${includeService?'<th>Servizio</th>':''}<th>Stato operativo</th><th>Contatto</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr class="${r.status==='cancelled'?'reservation-cancelled':''}"><td>${esc(r.time)}</td><td><strong>${esc(r.name)}</strong>${r.source==='staff_banquet'?'<small class="oasi-banquet-tag">Banchetto · sala condivisa</small>':''}${r.notes?`<small class="op-muted">${esc(r.notes)}</small>`:''}</td><td>${Number(r.party_size)}</td><td>${esc(r.table_codes||'Non assegnato')}</td>${includeService?`<td>${opServiceLabel(r.service)}</td>`:''}<td>${r.status==='cancelled'?'Annullata':opSelect(r)}</td><td><a href="tel:${esc(String(r.phone||'').replace(/[^+0-9]/g,''))}">${esc(r.phone)}</a></td></tr>`).join(''):`<tr><td colspan="${includeService?7:6}" class="reservation-empty">Nessuna prenotazione per questo servizio.</td></tr>`}</tbody></table></div>`;
// Agenda: due elenchi semplici e separati, anche quando si vedono entrambi i servizi.
const oasiAgendaGroup=(reservations,service)=>{
 const rows=reservations.filter(r=>r.service===service).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||''))||Number(a.id)-Number(b.id));
 const confirmed=rows.filter(r=>r.status==='confirmed'),covers=confirmed.reduce((n,r)=>n+Number(r.party_size||0),0);
 const name=service==='lunch'?'Pranzo':'Cena';
 return `<section class="oasi-agenda-group" aria-label="Prenotazioni ${name}">
  <header class="oasi-agenda-group-heading"><div><span class="eyebrow">${service==='lunch'?'SERVIZIO DIURNO':'SERVIZIO SERALE'}</span><h3>${name}</h3></div><p><strong>${confirmed.length}</strong> prenotazioni · <strong>${covers}</strong> coperti</p></header>
  <div class="oasi-agenda-entries">${rows.length?rows.map(r=>{
   const active=r.status==='confirmed',phone=String(r.phone||'').replace(/[^+0-9]/g,''),visit=r.visit_state||'expected';const nextStep={expected:['arrived','Segna arrivato'],arrived:['seated','Accompagna al tavolo'],seated:['finished','Termina servizio']}[visit];
   return `<article class="oasi-agenda-entry ${active?'':'is-cancelled'}" data-agenda-search="${esc([r.name,r.phone,r.table_codes,r.notes,r.time,r.source==='staff_banquet'?'banchetto':''].join(' ').toLocaleLowerCase('it-IT'))}">
      <div class="oasi-agenda-entry-time"><time>${esc(r.time||'—')}</time><span class="oasi-agenda-entry-source">${r.source==='web'?'Online':r.source==='staff_banquet'?'Banchetto':'Staff'}</span></div>
      <div class="oasi-agenda-entry-details"><h4>${esc(r.name)}</h4>${r.source==='staff_banquet'?'<span class="oasi-banquet-tag">Banchetto · sala condivisa</span>':''}<p><strong>${Number(r.party_size)}</strong> ${Number(r.party_size)===1?'persona':'persone'} · ${esc(r.table_codes||'Tavolo da assegnare')}</p>${r.notes?`<p class="oasi-agenda-entry-note">${esc(r.notes)}</p>`:''}</div>
      <div class="oasi-agenda-entry-side"><span class="oasi-agenda-visit-status ${active?'':'is-cancelled'}">${active?esc(opLabel[visit]||'In attesa'):'Annullata'}</span><div class="oasi-agenda-entry-actions">${active&&nextStep?`<button type="button" class="mini oasi-agenda-next" data-op-step="${Number(r.id)}" data-op-next="${nextStep[0]}">${nextStep[1]}</button>`:''}${active?`<button type="button" class="mini" data-move="${Number(r.id)}">Modifica</button><button type="button" class="mini danger" data-cancel="${Number(r.id)}">Annulla</button>`:''}${phone?`<a class="mini" href="tel:${esc(phone)}">Chiama</a>`:''}</div></div>
    </article>`}).join(''):'<p class="oasi-agenda-empty">Nessuna prenotazione per questo servizio.</p>'}</div>
 </section>`;
};
const opsDateControls=(svc)=>`<div class="op-toolbar"><label>Data<input id="admin-date" type="date" value="${esc(state.date)}"></label><label>Servizio ${state.adminView==='service'&&!state.opsManualSelection?'<small class="oasi-sala-auto-label">Automatico</small>':''}<select id="ops-service"><option value="lunch" ${svc==='lunch'?'selected':''}>Pranzo</option><option value="dinner" ${svc==='dinner'?'selected':''}>Cena</option></select></label><button class="mini" id="op-today" type="button">${state.adminView==='service'?'Oggi · Automatico':'Oggi'}</button><button class="mini" id="op-refresh" type="button">Aggiorna</button></div>`;
const opPills=(stats)=>`<div class="op-kpis"><article><span>Prenotazioni</span><strong>${stats.bookings}</strong></article><article><span>Coperti</span><strong>${stats.covers}</strong></article><article><span>Tavoli liberi</span><strong>${stats.availableTables}</strong></article><article><span>In attesa</span><strong>${stats.waiting}</strong></article><article><span>Al tavolo</span><strong>${stats.seated}</strong></article><article><span>Da gestire</span><strong>${stats.arrived+stats.noShow}</strong></article></div>`;
const floorOpsSvg=(tables,zones,bookings,blocks=[],links=[])=>{
 const blockedIds=new Set(blocks.filter(b=>b.scope==='table').map(b=>Number(b.target_id)));const blockedRoom=blocks.some(b=>b.scope==='room'&&Number(b.target_id)===Number(tables[0]?.room_id));const blockedService=blocks.some(b=>b.scope==='service');
 const finite=v=>Number.isFinite(Number(v))?Number(v):0;
 const boxes=[...zones,...tables].map(x=>({x:finite(x.x),y:finite(x.y),w:finite(x.w),h:finite(x.h)}));
 const x0=boxes.length?Math.min(...boxes.map(b=>b.x))-25:0,y0=boxes.length?Math.min(...boxes.map(b=>b.y))-25:0;
 const x1=boxes.length?Math.max(...boxes.map(b=>b.x+b.w))+25:1100,y1=boxes.length?Math.max(...boxes.map(b=>b.y+b.h))+25:700;
 const w=Math.max(250,x1-x0),h=Math.max(200,y1-y0);
 const bg=zones.map(z=>`<rect x="${finite(z.x)}" y="${finite(z.y)}" width="${finite(z.w)}" height="${finite(z.h)}" fill="#f1e7d8" stroke="none"/>`).join('');
 const roomTableMap=new Map(tables.map(t=>[Number(t.id),t]));
 const assignment=new Map();
 for(const booking of bookings.filter(r=>r.status==='confirmed')){
  for(const tableId of String(booking.table_ids||'').split(',').map(Number).filter(Boolean))assignment.set(tableId,booking);
 }
 // Disegna soltanto collegamenti verticali configurati ed effettivamente
 // occupati dalla stessa prenotazione. Gruppi separati non vengono uniti.
 const joins=(links||[]).flatMap(link=>{
  const a=roomTableMap.get(Number(link.table_a)),b=roomTableMap.get(Number(link.table_b));
  if(!a||!b||!oasiNearbyTable(a,b))return [];
  const first=assignment.get(Number(a.id)),second=assignment.get(Number(b.id));
  if(!first||!second||Number(first.id)!==Number(second.id))return [];
  const top=Number(a.y)<=Number(b.y)?a:b,bottom=Number(a.y)<=Number(b.y)?b:a;
  const ax=finite(top.x)+finite(top.w)/2,ay=finite(top.y)+finite(top.h);
  const bx=finite(bottom.x)+finite(bottom.w)/2,by=finite(bottom.y);
  return [`<line class="oasi-live-join" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#50785b" stroke-width="10" opacity=".95"/>`];
 }).join('');
 const ts=tables.map(t=>{const booking=bookings.find(r=>String(r.table_ids||'').split(',').map(Number).includes(Number(t.id)));const state=booking?.visit_state||'expected';const selected=!!booking;const fill=(!t.enabled||(!selected&&(blockedService||blockedRoom||blockedIds.has(Number(t.id)))))?'#e7c5c1':!selected?'#dcebdd':state==='seated'?'#d7e6f5':state==='finished'?'#e0ddd9':state==='no_show'?'#f1dbda':state==='arrived'?'#f8e5c4':'#e9ddc9';const x=finite(t.x),y=finite(t.y),tw=Math.max(45,finite(t.w)),th=Math.max(45,finite(t.h)),cx=x+tw/2,cy=y+th/2;const shape=t.shape==='circle'?`<ellipse cx="${cx}" cy="${cy}" rx="${tw/2}" ry="${th/2}"/>`:`<rect x="${x}" y="${y}" width="${tw}" height="${th}" rx="9"/>`;return `<g class="op-table-map ${selected?'booked':''}" data-op-table="${Number(t.id)}" transform="rotate(${finite(t.rotation)},${cx},${cy})" role="button" tabindex="0" aria-label="Tavolo ${esc(t.code)}, ${Number(t.seats||0)} posti${booking?', '+esc(booking.name):', libero'}"><title>${esc('Tavolo '+t.code+' · '+Number(t.seats||0)+' posti · '+(booking?booking.name:(!t.enabled||blockedService||blockedRoom||blockedIds.has(Number(t.id))?'Non disponibile':'Libero')))}</title><g fill="${fill}" stroke="#a28a68" stroke-width="2">${shape}</g><text x="${cx}" y="${cy-(selected?7:-5)}" font-size="22" text-anchor="middle" font-weight="700">${esc(t.code)}</text>${booking?`<text x="${cx}" y="${cy+10}" text-anchor="middle" font-size="11" font-weight="600">${esc(String(booking.name).slice(0,15))}</text>`:`<text x="${cx}" y="${cy+13}" text-anchor="middle" font-size="12">${Number(t.seats||0)} posti</text>`}</g>`}).join('');
 return `<svg class="op-room-svg" viewBox="${x0} ${y0} ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Piantina operativa"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#fcfaf6"/>${bg}${joins}${ts}</svg>`;
};
// Fase 8: calendario operativo. Usa date civili ISO e aritmetica UTC, senza slittamenti DST.
const calToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const calDate=d=>new Date(d+'T12:00:00Z');
const calISO=d=>d.toISOString().slice(0,10);
const calShift=(d,n)=>calISO(new Date(calDate(d).getTime()+n*86400000));
const calMonday=d=>calShift(d,-((calDate(d).getUTCDay()+6)%7));
const calMonthShift=(d,n)=>{const x=calDate(d),day=x.getUTCDate();x.setUTCDate(1);x.setUTCMonth(x.getUTCMonth()+n);const last=new Date(Date.UTC(x.getUTCFullYear(),x.getUTCMonth()+1,0)).getUTCDate();x.setUTCDate(Math.min(day,last));return calISO(x)};
const calFormat=(d,opts)=>calDate(d).toLocaleDateString('it-IT',{...opts,timeZone:'UTC'});
function calendarState(){return state.calendar||(state.calendar={selected:/^\d{4}-\d{2}-\d{2}$/.test(state.date)?state.date:calToday(),mode:'month',service:'all'})}
function calendarRange(){const c=calendarState();if(c.mode==='day')return {start:c.selected,end:c.selected};if(c.mode==='week'){const start=calMonday(c.selected);return {start,end:calShift(start,6)}}const start=calMonday(c.selected.slice(0,7)+'-01');return {start,end:calShift(start,41)}}
function calendarDay(data,date,service='all'){
 const services=service==='all'?['lunch','dinner']:[service];
 return {date,closed:!data.weekdays.includes(calDate(date).getUTCDay())||data.closedDates.includes(date),services:services.map(s=>{const rows=data.reservations.filter(r=>r.book_date===date&&r.service===s);return {service:s,onlineDisabled:data.serviceEnabled?.[s]===false,bookings:rows.filter(r=>r.status==='confirmed').reduce((a,r)=>a+Number(r.bookings),0),covers:rows.filter(r=>r.status==='confirmed').reduce((a,r)=>a+Number(r.covers),0),cancelled:rows.filter(r=>r.status==='cancelled').reduce((a,r)=>a+Number(r.bookings),0),blocks:data.blocks.filter(b=>b.book_date===date&&b.service===s)}}),events:data.events.filter(e=>e.start_date<=date&&e.end_date>=date&&(service==='all'||e.service==='both'||e.service===service))};
}
const calServiceName=s=>s==='lunch'?'Pranzo':s==='dinner'?'Cena':'Pranzo e cena';
const calEventStatus=s=>({confirmed:'Confermato',provisional:'Opzionato',completed:'Concluso'}[s]||s);
function calendarHTML(data){
 const c=calendarState(),range=calendarRange(),dates=Array.from({length:Math.round((calDate(range.end)-calDate(range.start))/86400000)+1},(_,i)=>calShift(range.start,i));
 const selected=calendarDay(data,c.selected,c.service),days=dates.map(d=>calendarDay(data,d,c.service));
 const title=c.mode==='month'?calFormat(c.selected,{month:'long',year:'numeric'}):c.mode==='week'?calFormat(range.start,{day:'numeric',month:'short'})+' – '+calFormat(range.end,{day:'numeric',month:'short',year:'numeric'}):calFormat(c.selected,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 const counted=days.filter(d=>c.mode!=='month'||d.date.slice(0,7)===c.selected.slice(0,7));const total=counted.flatMap(d=>d.services).reduce((a,s)=>({bookings:a.bookings+s.bookings,covers:a.covers+s.covers}),{bookings:0,covers:0});
 const dayCell=d=>`<button type="button" class="cal-day ${d.date===c.selected?'cal-selected':''} ${d.date===calToday()?'cal-today':''} ${c.mode==='month'&&d.date.slice(0,7)!==c.selected.slice(0,7)?'cal-outside':''}" data-cal-date="${d.date}" aria-pressed="${d.date===c.selected}" aria-label="${esc(calFormat(d.date,{weekday:'long',day:'numeric',month:'long'}))}, ${d.services.reduce((a,s)=>a+s.covers,0)} coperti, ${d.events.length} eventi"><span class="cal-number">${Number(d.date.slice(-2))}</span>${d.closed?'<span class="cal-closed">Chiuso online</span>':''}${d.services.map(s=>`<span class="cal-chip cal-${s.service}">${s.service==='lunch'?'P':'C'} <b>${s.covers}</b><span class="cal-wide"> coperti</span></span>${s.onlineDisabled?'<span class="cal-closed">Off online</span>':''}${s.blocks.length?`<span class="cal-block">${s.blocks.length} blocch.</span>`:''}`).join('')}${d.events.length?`<span class="cal-event">${d.events.length} ev.</span>`:''}</button>`;
 return heading('Calendario generale','Un’unica vista per prenotazioni, servizi, cerimonie e disponibilità.')+`<section class="panel oasi-calendar"><div class="cal-toolbar"><div class="cal-period"><button type="button" class="mini" data-cal-shift="-1" aria-label="Periodo precedente">‹</button><h2>${esc(title)}</h2><button type="button" class="mini" data-cal-shift="1" aria-label="Periodo successivo">›</button><button class="mini" type="button" id="cal-today">Oggi</button></div><div class="cal-filters"><label>Vista<select id="cal-mode">${[['month','Mese'],['week','Settimana'],['day','Giorno']].map(([v,l])=>`<option value="${v}" ${c.mode===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Servizio<select id="cal-service">${[['all','Tutti'],['lunch','Pranzo'],['dinner','Cena']].map(([v,l])=>`<option value="${v}" ${c.service===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Vai alla data<input id="cal-jump" type="date" value="${c.selected}"></label></div></div><div class="cal-summary"><div><small>Prenotazioni confermate</small><strong>${total.bookings}</strong></div><div><small>Coperti prenotati</small><strong>${total.covers}</strong></div><div><small>Eventi nel periodo</small><strong>${new Set(counted.flatMap(d=>d.events.map(e=>e.id))).size}</strong></div></div>${c.mode==='day'?'':`<div class="cal-grid ${c.mode==='week'?'cal-week':''}">${['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d=>`<span class="cal-weekday">${d}</span>`).join('')}${days.map(dayCell).join('')}</div><p class="cal-legend">P = pranzo · C = cena · ev. = eventi · blocch. = blocchi manuali. Seleziona un giorno per i dettagli.</p>`}</section><section class="panel cal-detail"><div class="cal-detail-head"><div><span class="eyebrow">GIORNO SELEZIONATO</span><h2>${esc(calFormat(c.selected,{weekday:'long',day:'numeric',month:'long',year:'numeric'}))}</h2>${selected.closed?'<p class="cal-warning">Chiusura per prenotazioni online da Orari e regole. Le prenotazioni ADMIN esistenti restano visibili.</p>':''}</div><button class="btn btn-dark" type="button" id="cal-new">+ Nuova prenotazione</button></div><div class="cal-services">${selected.services.map(s=>`<article class="cal-service-card"><h3>${calServiceName(s.service)}</h3>${s.onlineDisabled?'<p class="cal-warning">Servizio disabilitato online da Orari e regole.</p>':''}<div class="cal-service-numbers"><strong>${s.covers} coperti</strong><span>${s.bookings} prenotazioni · ${s.cancelled} annullate</span></div>${s.blocks.length?`<div class="cal-block-list">${s.blocks.map(b=>`<p><b>${b.scope==='service'?'Servizio chiuso':b.scope==='room'?'Sala '+esc(b.target_name||b.target_id):'Tavolo '+esc(b.target_name||b.target_id)}</b>${b.reason?' · '+esc(b.reason):''}</p>`).join('')}</div>`:'<p class="op-muted">Nessun blocco manuale.</p>'}<div class="cal-actions"><button type="button" class="mini" data-cal-agenda="${s.service}">Prenotazioni</button><button type="button" class="mini" data-cal-room="${s.service}">Sala e blocchi</button></div></article>`).join('')}</div><h3>Elenco prenotazioni del giorno</h3><div class="cal-booking-list">${(data.details||[]).filter(r=>c.service==='all'||r.service===c.service).map(r=>`<article class="cal-event-detail"><div><strong>${esc(r.time)} · ${esc(r.name)}</strong><p>${calServiceName(r.service)} · ${Number(r.party_size)} persone · ${r.status==='cancelled'?'Annullata':esc(opLabel[r.visit_state]||'Confermata')}</p><small>${r.table_codes?'Tavoli: '+esc(r.table_codes):'Nessun tavolo assegnato'}</small></div><button class="mini" type="button" ${r.status==='confirmed'?`data-cal-edit="${Number(r.id)}" data-cal-edit-service="${esc(r.service)}"`:`data-cal-agenda="${esc(r.service)}"`}>${r.status==='confirmed'?'Modifica':'Agenda'}</button></article>`).join('')||'<p class="op-muted">Nessuna prenotazione per questo giorno e servizio.</p>'}</div><div class="cal-events-head"><h3>Eventi e cerimonie</h3><button type="button" class="mini" id="cal-events">Gestisci eventi</button></div>${selected.events.length?selected.events.map(e=>`<article class="cal-event-detail"><div><strong>${esc(e.title)}</strong><p>${esc(calEventStatus(e.status))} · ${calServiceName(e.service)} · ${Number(e.guests)} invitati</p><small>${esc(e.room_names||'—')} · ${esc(e.start_date)}${e.end_date!==e.start_date?' – '+esc(e.end_date):''}</small></div><button class="mini" type="button" data-cal-event="${esc(e.id)}">Apri</button></article>`).join(''):'<p class="op-muted">Nessun evento nel giorno e servizio selezionati.</p>'}<div class="cal-actions"><button class="mini" type="button" id="cal-rules">Orari e chiusure online</button></div></section>`;
}
function bindCalendar(){const c=calendarState();const refresh=()=>renderAdmin();
 document.querySelectorAll('[data-cal-date]').forEach(b=>b.onclick=()=>{c.selected=b.dataset.calDate;refresh()});
 document.querySelectorAll('[data-cal-shift]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.calShift);c.selected=c.mode==='month'?calMonthShift(c.selected,n):calShift(c.selected,n*(c.mode==='week'?7:1));refresh()});
 $('#cal-today').onclick=()=>{c.selected=calToday();refresh()};$('#cal-mode').onchange=e=>{c.mode=e.target.value;refresh()};$('#cal-service').onchange=e=>{c.service=e.target.value;refresh()};$('#cal-jump').onchange=e=>{if(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){c.selected=e.target.value;refresh()}};
 const go=(tab,svc)=>{state.date=c.selected;if(svc){state.opsService=svc;state.reservationService=svc}if(tab==='service')state.opsManualSelection=true;if(tab==='reservations')state.agendaManualSelection=true;return adminGoTo(tab,false,true)};
 document.querySelectorAll('[data-cal-agenda]').forEach(b=>b.onclick=()=>go('reservations',b.dataset.calAgenda));document.querySelectorAll('[data-cal-room]').forEach(b=>b.onclick=()=>go('service',b.dataset.calRoom));
 document.querySelectorAll('[data-cal-edit]').forEach(b=>b.onclick=async()=>{await go('reservations',b.dataset.calEditService);const row=state.reservations?.find(r=>Number(r.id)===Number(b.dataset.calEdit));if(row?.status==='confirmed')openEditBookingDrawer(row);else msg('Prenotazione non più modificabile.','error')});
 $('#cal-new').onclick=()=>{state.date=c.selected;state.reservationService=c.service;state.opsService=c.service==='dinner'?'dinner':'lunch';state.agendaManualSelection=true;adminGoTo('reservations',true,true)};
 const events=async()=>{state.eventRange={start:c.selected,end:c.selected};await adminGoTo('events')};$('#cal-events').onclick=events;document.querySelectorAll('[data-cal-event]').forEach(b=>b.onclick=async()=>{await events();if(state.adminView==='events'){const e=state.privateEvents?.find(x=>String(x.id)===b.dataset.calEvent);if(e)eventDrawer(e);else msg('Evento non più disponibile nella lista.','error')}});$('#cal-rules').onclick=()=>adminGoTo('booking');
}

async function renderAdmin(syncSnapshot=null){if(!Array.isArray(syncSnapshot?.reservations))syncSnapshot=null;const serial=++oasiRenderSerial;oasiRenderPending=serial;closeFloorInspector();document.body.classList.remove('floor-mode-expanded');const tab=state.adminView,period=oasiSyncPeriod();let html='',renderedSnapshot=null;try{
if(tab==='calendar'){const data=syncSnapshot?.calendar?syncSnapshot:await oasiFetchSnapshot(period);if(serial!==oasiRenderSerial)return;state.calendarData=data;renderedSnapshot=data;html=calendarHTML(data);}
if(tab==='dashboard'){
 const service=state.opsService||'lunch';const data=syncSnapshot||await api('admin/operations?date='+encodeURIComponent(state.date)+'&service='+service);if(serial!==oasiRenderSerial)return;state.operations=data;renderedSnapshot=data;
 const stats=operationalStats(data,service),upcoming=[...stats.reservations].filter(r=>['expected','arrived'].includes(r.visit_state)).sort((a,b)=>a.time.localeCompare(b.time)).slice(0,8);
 html=heading('Centro di controllo','Il riepilogo operativo del ristorante, aggiornato direttamente da D1.')+opsDateControls(service)+opPills(stats)+`<div class="op-dashboard-grid"><section class="panel"><div class="op-panel-heading"><h3>Arrivi e prenotazioni</h3><button class="mini" data-quick="reservations">Agenda completa</button></div>${upcoming.length?upcoming.map(r=>`<div class="op-arrival"><time>${esc(r.time)}</time><div><strong>${esc(r.name)}</strong><small>${Number(r.party_size)} persone · ${esc(r.table_codes||(Number(r.room_id)===2?'Primo piano · senza tavolo assegnato':'Da assegnare'))}</small></div>${opSelect(r)}</div>`).join(''):'<p class="op-empty">Nessun arrivo in attesa per questo servizio.</p>'}</section><section class="panel"><div class="op-panel-heading"><h3>Stato del servizio</h3><button class="mini" data-quick="service">Apri sala</button></div><div class="op-service-stats"><div><span>Arrivati</span><strong>${stats.arrived}</strong></div><div><span>Ai tavoli</span><strong>${stats.seated}</strong></div><div><span>Terminati</span><strong>${stats.finished}</strong></div><div><span>Non presentati</span><strong>${stats.noShow}</strong></div></div>${stats.blocked.length?`<p class="op-warning">${stats.blocked.length} blocchi di disponibilità attivi per il servizio.</p>`:'<p class="op-muted">Nessun blocco di disponibilità per questo servizio.</p>'}<div class="op-action-row"><button class="mini" data-quick="service">Gestisci tavoli e blocchi</button><button class="mini" data-quick="reservations">Inserisci prenotazione</button></div></section></div><div class="op-action-grid">${[['calendar','Calendario generale','Prenotazioni, eventi e chiusure'],['service','Gestione servizio','Piantina, arrivi e blocchi'],['reservations','Prenotazioni','Elenco, modifica e stampa'],['events','Eventi privati','Cerimonie e sale riservate'],['floor','Piantina standard','Disegna e configura la sala'],['rooms','Sale e ambienti','Apertura online delle zone']].map(([id,title,sub])=>`<button class="op-quick" data-quick="${id}"><strong>${title}</strong><small>${sub}</small></button>`).join('')}</div>`;
}
if(tab==='service'){
 const service=state.opsService||'lunch';const data=syncSnapshot||await api('admin/operations?date='+encodeURIComponent(state.date)+'&service='+service);const zones=Array.isArray(data.zones)?data.zones:await api('admin/room-zones');if(serial!==oasiRenderSerial)return;state.operations=data;renderedSnapshot={...data,zones};
 const stats=operationalStats(data,service);const active=stats.reservations;const roomIds=[...new Set([...data.rooms.map(r=>r.id),...data.tables.map(t=>t.room_id)])];
 html=heading('Servizio e sala','Arrivi, disposizione tavoli e blocchi. Nessun tavolo si libera automaticamente durante il servizio.')+opsDateControls(service)+oasiServiceMobileCards(active)+opPills(stats)+`<div class="op-service-layout"><section class="panel"><div class="op-panel-heading"><h3>Piantina operativa · ${opServiceLabel(service)}</h3><div class="oasi-sala-head-actions"><button type="button" class="mini" id="oasi-partial-banquet">+ Banchetto condiviso</button><button type="button" class="mini" id="oasi-service-print">Stampa piantina</button><span class="op-muted">Tocca un tavolo per prenotare, modificare o bloccare</span></div></div><div class="op-legend"><span>● Disponibile</span><span>● Prenotato</span><span>● Al tavolo</span><span>● Non presentato</span></div>${data.rooms.filter(r=>roomIds.includes(r.id)&&data.tables.some(t=>t.room_id===r.id)).map(r=>`<div class="op-room"><h4>${esc(r.name)}</h4>${floorOpsSvg(data.tables.filter(t=>t.room_id===r.id),zones.filter(z=>z.room_id===r.id),active.filter(b=>b.room_id===r.id),r.internal_enabled?data.blocks:[...data.blocks,{scope:'room',target_id:r.id}],data.links||[])}</div>`).join('')}<div id="op-table-detail" class="op-table-detail"><p>Tocca un tavolo per aprire il pannello rapido a destra.</p></div></section><section class="panel"><div class="op-panel-heading"><h3>Blocchi disponibilità</h3></div><p class="op-muted">I blocchi impediscono solo <strong>nuove assegnazioni</strong>. Le prenotazioni confermate restano valide.</p><form id="op-block-form" class="op-block-form"><label>Cosa bloccare?<select name="scope"><option value="service">Intero servizio</option><option value="room">Una sala</option><option value="table">Un tavolo</option></select></label><label>Elemento<select name="target_id"><option value="0">Intero servizio</option></select></label><label>Motivo (facoltativo)<input name="reason" placeholder="Es. manutenzione"></label><button class="btn btn-dark" type="submit">Blocca disponibilità</button></form><h4>Blocchi attivi</h4><div class="op-blocks">${stats.blocked.length?stats.blocked.map(b=>`<div class="op-block"><div><strong>${b.scope==='service'?'Intero servizio':b.scope==='room'?(data.rooms.find(r=>r.id===b.target_id)?.name||'Sala'):('Tavolo '+(data.tables.find(t=>t.id===b.target_id)?.code||b.target_id))}</strong><small>${esc(b.reason||'Nessuna nota')}</small></div>${b.source==='event'?`<button type="button" class="mini" data-quick="events">Apri evento</button>`:`<button type="button" class="mini" data-remove-block="${b.id}">Sblocca</button>`}</div>`).join(''):'<p class="op-muted">Nessun blocco attivo.</p>'}</div></section></div><section class="panel op-service-list"><div class="op-panel-heading"><h3>Clienti del servizio</h3><button type="button" class="mini" data-quick="reservations">Apri prenotazioni</button></div>${operationalTable(active)}</section>`;
}
if(tab==='reservations'){
 const service=state.reservationService||'all';
 const arr=syncSnapshot?syncSnapshot.reservations:await api('admin/reservations?date='+encodeURIComponent(state.date)+'&service='+encodeURIComponent(service));if(serial!==oasiRenderSerial)return;state.reservations=arr;renderedSnapshot={reservations:arr};
 const active=arr.filter(r=>r.status==='confirmed');const people=active.reduce((n,r)=>n+Number(r.party_size||0),0);
 html=`<div class="oasi-agenda-page">
  <header class="oasi-agenda-main-head"><div><span class="eyebrow">RISTORANTE OASI / ADMIN</span><h1>Agenda</h1><p>Prenotazioni del ${esc(state.date.split('-').reverse().join('/'))}</p></div><div class="oasi-agenda-head-actions"><button type="button" class="mini" id="agenda-new-banquet">+ Banchetto condiviso</button><button type="button" class="mini" id="print-reservation-plan">Stampa piantina</button><button type="button" class="btn btn-dark" id="new-book">Nuova prenotazione</button></div></header>
  <div class="oasi-agenda-controls"><button type="button" class="mini" id="reservation-prev" aria-label="Giorno precedente">Giorno prima</button><label class="oasi-agenda-date-label">Data<input id="admin-date" type="date" value="${esc(state.date)}"></label><button type="button" class="mini" id="reservation-next" aria-label="Giorno successivo">Giorno dopo</button><button type="button" class="mini" id="reservation-today">Oggi · Tutti i servizi</button></div>
  <details class="oasi-agenda-filter" ${service==='all'?'':'open'}><summary>Filtra per servizio ${service==='all'?'':'· '+(service==='lunch'?'Pranzo':'Cena')}</summary><label>Mostra<select id="reservation-service"><option value="all" ${service==='all'?'selected':''}>Pranzo e cena</option><option value="lunch" ${service==='lunch'?'selected':''}>Solo pranzo</option><option value="dinner" ${service==='dinner'?'selected':''}>Solo cena</option></select></label></details>
  <div class="oasi-agenda-search"><label for="oasi-agenda-query">Cerca una prenotazione</label><input id="oasi-agenda-query" type="search" placeholder="Nome, telefono, tavolo o orario" autocomplete="off" value="${esc(state.agendaQuery||'')}"><span id="oasi-agenda-search-count" aria-live="polite"></span></div>
  <div id="edit-area"></div>
  <div class="oasi-agenda-groups">${service!=='dinner'?oasiAgendaGroup(arr,'lunch'):''}${service!=='lunch'?oasiAgendaGroup(arr,'dinner'):''}</div>
  <details class="oasi-agenda-print"><summary>Stampa e altre opzioni</summary><div><button class="mini" id="print-reservations" type="button">Stampa elenco</button></div></details>
 </div>`;
}
if(tab==='events'){
 const range=state.eventRange||{start:new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'}).slice(0,7)+'-01',end:''};state.eventRange=range;
 const params=new URLSearchParams();if(range.start)params.set('start',range.start);if(range.end)params.set('end',range.end);
 const [events,rooms]=await Promise.all([api('admin/events?'+params.toString()),api('admin/rooms')]);state.privateEvents=events;state.rooms=rooms;
 const statusNames={provisional:'Opzionato',confirmed:'Confermato',completed:'Concluso',cancelled:'Annullato'};
 const serviceNames={lunch:'Pranzo',dinner:'Cena',both:'Pranzo e cena'};
 const active=events.filter(e=>e.status!=='cancelled');
 const guestTotal=active.reduce((n,e)=>n+Number(e.guests||0),0);
 html=heading('Eventi e cerimonie','Organizzazione esclusivamente interna: nessun cliente può prenotare eventi online. Le sale selezionate vengono riservate automaticamente.')+
 `<section class="panel event-controls"><div class="event-controls-head"><div><span class="eyebrow">GESTIONE EVENTI PRIVATI</span><h3>Calendario eventi</h3><p>Gli eventi occupano le sale nelle date e nei servizi indicati, impedendo nuove prenotazioni su quei tavoli.</p></div><button type="button" class="btn btn-dark" id="event-create">+ Nuovo evento</button></div><form id="event-filter" class="event-filter"><label>Eventi dal<input type="date" name="start" value="${esc(range.start)}"></label><label>Fino al<input type="date" name="end" value="${esc(range.end)}"></label><button type="submit" class="mini">Applica filtri</button><button type="button" class="mini" id="event-all">Mostra tutti</button></form><div class="event-pills"><span><strong>${active.length}</strong> eventi attivi</span><span><strong>${guestTotal}</strong> invitati previsti</span><span><strong>${events.filter(e=>e.status==='cancelled').length}</strong> annullati</span></div></section>`+
 `<section class="panel event-list"><div class="event-list-heading"><h3>Eventi registrati</h3><small>${events.length} risultati</small></div>${events.length?events.map(e=>`<article class="event-row ${e.status==='cancelled'?'event-row-cancelled':''}"><div class="event-date"><strong>${esc(e.start_date.split('-').reverse().join('/'))}</strong>${e.end_date!==e.start_date?`<small>fino al ${esc(e.end_date.split('-').reverse().join('/'))}</small>`:''}</div><div class="event-details"><div class="event-title"><strong>${esc(e.title)}</strong><span class="event-status event-status-${esc(e.status)}">${statusNames[e.status]||esc(e.status)}</span></div><p>${esc(e.kind)} · ${serviceNames[e.service]||esc(e.service)} · ${Number(e.guests)} invitati</p><p><b>Sale:</b> ${esc(e.room_names||'—')}</p><small>${esc(e.contact_name)} · ${esc(e.phone)}</small></div><div class="event-row-actions"><button class="mini" data-event-edit="${esc(e.id)}">Apri / modifica</button>${e.status!=='cancelled'?`<button class="mini danger" data-event-cancel="${esc(e.id)}">Annulla</button>`:''}</div></article>`).join(''):'<p class="op-muted">Nessun evento presente nel periodo selezionato.</p>'}</section>`+
 `<section class="panel event-note"><h3>Regole di disponibilità</h3><p>Le sale riservate a un evento sono escluse automaticamente dalle nuove prenotazioni online e da quelle inserite dall’ADMIN per il servizio interessato. Le prenotazioni già confermate non vengono cancellate: se una sala risulta già assegnata, il salvataggio dell’evento viene rifiutato finché lo staff non risolve il conflitto.</p></section>`;
}
if(tab==='analytics'){
 const range=state.analyticsRange||(()=>{const end=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'});return {start:end.slice(0,8)+'01',end,service:'all',room:'0'}})();state.analyticsRange=range;
 const report=await api('admin/analytics?'+new URLSearchParams(range));state.analyticsReport=report;
 const k=report.summary,prev=report.previous_summary||{},format=n=>Number(n||0).toLocaleString('it-IT');
 const comparison=(value,old)=>{if(!old)return value?'Nuovo nel periodo':'—';const delta=Math.round((value-old)/old*100);return (delta>0?'+':'')+delta+'% rispetto al precedente'};
 const cards=[['Prenotazioni confermate',k.bookings,prev.bookings],['Coperti prenotati',k.covers,prev.covers],['Visite effettive',k.visits,prev.visits],['Coperti da visite registrate',k.visited_covers,prev.visited_covers],['Annullamenti',k.cancelled,prev.cancelled],['Non presentati',k.no_show,prev.no_show]];
 const rangeDays=report.days.length,chartRows=rangeDays>70?report.months:report.days;
 const max=Math.max(1,...chartRows.map(d=>d.covers));
 const percent=(part,total)=>total?Math.round(part/total*100)+'%':'—';
 html=heading('Statistiche e report','Tutti i valori derivano dalle prenotazioni salvate in D1. Confronto con il periodo precedente di uguale durata.')+
 `<section class="panel analytics-filters"><form id="analytics-filters"><label>Dal<input type="date" name="start" value="${esc(range.start)}" required></label><label>Al<input type="date" name="end" value="${esc(range.end)}" required></label><label>Servizio<select name="service"><option value="all" ${range.service==='all'?'selected':''}>Pranzo e cena</option><option value="lunch" ${range.service==='lunch'?'selected':''}>Pranzo</option><option value="dinner" ${range.service==='dinner'?'selected':''}>Cena</option></select></label><label>Sala<select name="room"><option value="0">Tutte le sale</option>${report.room_options.map(r=>`<option value="${Number(r.id)}" ${String(range.room)===String(r.id)?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label><button class="btn btn-dark" type="submit">Applica filtri</button></form><div class="analytics-actions"><button type="button" class="mini" id="analytics-month">Questo mese</button><button type="button" class="mini" id="analytics-year">Quest'anno</button><button type="button" class="mini" id="analytics-csv">Esporta dettagli CSV</button><button type="button" class="mini" id="analytics-csv-summary">Esporta riepilogo CSV</button><button type="button" class="mini" id="analytics-print">Stampa report PDF</button></div><p class="analytics-muted">Confronto: ${esc(report.previous_range.start.split('-').reverse().join('/'))} – ${esc(report.previous_range.end.split('-').reverse().join('/'))}</p></section>`+
 `<section class="analytics-stat-grid">${cards.map(([label,value,old])=>`<article class="panel analytics-stat"><small>${esc(label)}</small><strong>${format(value)}</strong><span class="analytics-delta">${esc(comparison(value,old))}</span></article>`).join('')}<article class="panel analytics-stat"><small>Media coperti per prenotazione</small><strong>${esc(String(k.avg_party).replace('.',','))}</strong></article><article class="panel analytics-stat"><small>Clienti con ≥2 visite nel periodo</small><strong>${format(k.repeat_customers)}</strong></article></section>`+
 `<section class="panel analytics-section"><h3>Andamento dei coperti prenotati</h3><p class="analytics-muted">${rangeDays>70?'Raggruppamento mensile per rendere leggibile il periodo.':'Ogni giorno del periodo è presente, inclusi quelli senza prenotazioni.'} ${k.bookings?'':'Nessuna prenotazione confermata nel periodo.'}</p><div class="analytics-chart" role="img" aria-label="Coperti prenotati nel periodo">${chartRows.map(d=>`<div class="analytics-bar-col" title="${esc(d.date)} · ${d.covers} coperti · ${d.bookings} prenotazioni"><span>${d.covers||''}</span><div class="analytics-bar" style="height:${d.covers?Math.max(2,Math.round(140*d.covers/max)):2}px"></div><small>${esc(d.date.length===7?d.date.slice(5)+'/'+d.date.slice(0,4):d.date.slice(5).split('-').reverse().join('/'))}</small></div>`).join('')}</div></section>`+
 `<div class="analytics-double"><section class="panel analytics-section"><h3>Pranzo e cena</h3><div class="table-scroll"><table><thead><tr><th>Servizio</th><th>Prenotazioni</th><th>Coperti</th><th>Visite</th></tr></thead><tbody>${[['Pranzo',report.services.lunch],['Cena',report.services.dinner]].map(([name,v])=>`<tr><td>${name}</td><td>${v.bookings}</td><td>${v.covers}</td><td>${v.visits}</td></tr>`).join('')}</tbody></table></div></section><section class="panel analytics-section"><h3>Sale utilizzate</h3><div class="table-scroll"><table><thead><tr><th>Sala</th><th>Prenotazioni</th><th>Coperti</th></tr></thead><tbody>${report.rooms.length?report.rooms.map(v=>`<tr><td>${esc(v.name)}</td><td>${v.bookings}</td><td>${v.covers}</td></tr>`).join(''):'<tr><td colspan="3">Nessuna prenotazione</td></tr>'}</tbody></table></div></section></div>`+
 `<div class="analytics-double"><section class="panel analytics-section"><h3>Origine prenotazioni</h3><div class="analytics-meter-list">${[['Sito web',report.sources.web],['Inserite dal personale',report.sources.staff],['Altre',report.sources.other]].map(([name,value])=>`<div class="analytics-meter-row"><div><strong>${esc(name)}</strong><span>${format(value)} · ${percent(value,k.bookings)}</span></div><div class="analytics-meter-track"><div style="width:${k.bookings?Math.min(100,Math.max(0,value/k.bookings*100)):0}%"></div></div></div>`).join('')}</div></section><section class="panel analytics-section"><h3>Giorni della settimana</h3><div class="table-scroll"><table><thead><tr><th>Giorno</th><th>Prenotazioni</th><th>Coperti</th></tr></thead><tbody>${report.weekdays.map(d=>`<tr><td>${d.name}</td><td>${d.bookings}</td><td>${d.covers}</td></tr>`).join('')}</tbody></table></div><p class="analytics-muted">Valori totali per giorno della settimana nel periodo, non medie.</p></section></div>`+
 `<section class="panel analytics-section"><h3>Orari di arrivo più richiesti</h3><div class="analytics-peaks">${report.peak_hours.length?report.peak_hours.map(d=>`<div><strong>${esc(d.hour)}</strong><span>${format(d.bookings)} prenotazioni</span></div>`).join(''):'Nessuna prenotazione confermata.'}</div><p class="analytics-muted">Numero di prenotazioni raggruppato per ora di arrivo, non durata della permanenza.</p></section>`+
 `<section class="panel analytics-section"><h3>Dettaglio per giorno</h3><div class="table-scroll"><table><thead><tr><th>Data</th><th>Prenotazioni</th><th>Coperti</th><th>Visite</th><th>Coperti delle visite</th><th>Annullamenti</th><th>Assenze</th></tr></thead><tbody>${report.days.map(d=>`<tr><td>${esc(d.date.split('-').reverse().join('/'))}</td><td>${d.bookings}</td><td>${d.covers}</td><td>${d.visits}</td><td>${d.visited_covers}</td><td>${d.cancelled}</td><td>${d.no_show}</td></tr>`).join('')}</tbody></table></div></section>`+
 `<p class="analytics-footnote">Le visite effettive richiedono lo stato “Al tavolo” o “Terminato” su una prenotazione confermata in data non futura. I coperti delle visite derivano dalle persone prenotate, non da un consuntivo. I clienti con più visite sono quelli con almeno due visite registrate nel periodo selezionato. Le statistiche storiche per sala non ricostruiscono capienze passate. Il report non calcola fatturato o margini.</p>`;
}
if(tab==='customers'){
 const q=state.customerQuery||'';const clients=await api('admin/customers?q='+encodeURIComponent(q));
 html=heading('Clienti','Anagrafiche collegate alle prenotazioni, visite effettive e prossimi arrivi.')+`<section class="panel customer-search"><form id="customer-search"><label>Cerca cliente<input name="q" placeholder="Nome, email o telefono" value="${esc(q)}"></label><button class="btn btn-dark">Cerca</button><button class="mini" type="button" id="customer-reset">Mostra tutti</button></form><p>${clients.length} clienti trovati. Le visite sono conteggiate solo quando il cliente è stato segnato Al tavolo o Terminato.</p></section><section class="panel"><div class="table-scroll"><table><thead><tr><th>Cliente</th><th>Telefono</th><th>Visite reali</th><th>Ultima visita</th><th>Prossima prenotazione</th><th></th></tr></thead><tbody>${clients.length?clients.map(c=>`<tr><td><strong>${esc(c.name)}</strong><br><small>${esc(c.email)}</small></td><td><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>${oasiWhatsAppHref(c.phone,c.name)?`<br><a class="mini customer-wa" target="_blank" rel="noopener noreferrer" href="${esc(oasiWhatsAppHref(c.phone,c.name))}">WhatsApp</a>`:''}</td><td><strong>${Number(c.actual_visits||0)}</strong><br><small>${Number(c.total_bookings||0)} prenotazioni</small></td><td>${esc(c.last_visit||'—')}</td><td>${esc(c.next_booking||'—')}</td><td><button class="mini" data-customer="${c.id}">Apri scheda</button></td></tr>`).join(''):'<tr><td colspan="6">Nessun cliente trovato.</td></tr>'}</tbody></table></div></section>`;
}
if(tab==='notifications'){
 const notices=await api('admin/notifications');const unread=notices.filter(n=>!n.seen).length;
 html=heading('Notifiche','Nuove prenotazioni, modifiche e annullamenti registrati nel gestionale.')+`<section class="panel"><div class="phase2-row"><strong>${unread} da leggere</strong><button class="mini" id="notice-read-all">Segna tutte come lette</button></div><div class="phase2-notices">${notices.length?notices.map(n=>`<article class="phase2-notice ${n.seen?'read':''}"><div><small>${esc(n.created_at)}</small><h3>${esc(n.title)}</h3><p>${esc(n.message)}</p>${n.reservation_id?`<button type="button" class="mini" data-notice-open="${n.id}" data-notice-date="${esc(n.book_date||'')}" data-notice-service="${esc(n.service||'all')}">Apri prenotazione #${n.reservation_id}</button>`:''}</div>${n.seen?'':`<button class="mini" data-notice="${n.id}">Segna letta</button>`}</article>`).join(''):'<p>Nessuna notifica.</p>'}</div></section>`;
}
if(tab==='emails'){
 const report=await api('admin/email-log');const items=report.items||[];
 html=heading('Comunicazioni email','Controllo tecnico dell’invio email. “Accettata” non significa che il destinatario l’abbia letta.')+`<section class="panel"><div class="phase2-row"><div><span class="eyebrow">STATO PROVIDER</span><h3>${report.configured?'Configurazione presente':'Configurazione non attiva'}</h3><p>${report.configured?'Mittente: '+esc(report.sender):'Configura RESEND_API_KEY come Secret ed EMAIL_FROM come variabile Cloudflare dopo aver verificato il dominio mittente.'}</p></div><button class="mini" id="email-refresh">Aggiorna</button></div><p>Gli invii falliti non invalidano la prenotazione: controlla i log e contatta il cliente se necessario.</p></section><section class="panel"><div class="table-scroll"><table><thead><tr><th>Data</th><th>Destinatario</th><th>Tipo</th><th>Stato</th><th>Dettaglio</th></tr></thead><tbody>${items.length?items.map(m=>`<tr><td>${esc(m.attempted_at||m.created_at)}</td><td>${esc(m.recipient)}</td><td>${esc(m.email_type)}</td><td><span class="phase2-email-state ${esc(m.status)}">${({sent:'Accettata',failed:'Fallita',unconfigured:'Non configurata',pending:'In corso'})[m.status]||esc(m.status)}</span></td><td>${esc(m.error||'—')}</td></tr>`).join(''):'<tr><td colspan="5">Nessun invio registrato.</td></tr>'}</tbody></table></div></section>`;
}
if(tab==='rooms'){state.rooms=await api('admin/rooms');html=heading('Sale e ambienti','Attiva il giardino online quando desideri aprirlo alle prenotazioni.')+`<div id="edit-area"></div><button class="btn btn-dark" id="new-room">+ Nuova sala</button><div class="room-cards">${state.rooms.map(r=>`<div class="panel room-card"><h3>${esc(r.name)}</h3><p>Online: <strong>${r.public_enabled?'Attivo':'Non attivo'}</strong></p><p>Interna: ${r.internal_enabled?'Sì':'No'}</p><button class="mini" data-edit-room="${r.id}">Modifica</button> <button class="mini danger" data-delete-room="${r.id}">Elimina</button></div>`).join('')}</div>`}
if(tab==='floor'){
 state.rooms=await api('admin/rooms');state.tables=await api('admin/tables');state.tableLinks=await api('admin/table-links');state.roomZones=await api('admin/room-zones');
 state.floorElements=await api('admin/floor-elements');
 const room=state.rooms.find(x=>x.id===state.room)||state.rooms[0];state.room=room?.id;
 const template=state.room?await api('admin/floor-template?room_id='+state.room):{found:false};
 const tableList=state.tables.filter(t=>t.room_id===state.room);
 const elementList=state.floorElements.filter(f=>f.room_id===state.room);const zones=state.roomZones.filter(z=>z.room_id===state.room);
 html=heading('Piantina tavoli','Sala standard e disposizione del servizio, in un unico spazio semplice da usare.')+
 `<div class="floor-topbar floor-topbar-premium"><label>Sala da modificare<select id="room-select">${state.rooms.map(r=>`<option value="${r.id}" ${r.id===state.room?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label><div class="floor-topbuttons"><button class="btn btn-dark" id="new-table">+ Tavolo</button><button class="btn btn-outline" id="new-structure">+ Elemento strutturale</button><button class="btn btn-outline" id="new-zone">+ Area / stanza</button></div></div>
 <div class="floor-summary"><span>${tableList.length} tavoli</span><span>${elementList.length} strutture</span><span>${zones.length||1} aree</span><span>${template?.found?'Standard salvata':'Nessuna standard salvata'}</span></div>
 <div class="floor-service-bar panel"><div><span class="eyebrow">GESTIONE PIANTINA</span><h3>${template?.found?'Piantina standard pronta':'Salva ora la tua piantina standard'}</h3><p>${template?.found?`Ultimo salvataggio standard: ${new Date(template.updated_at).toLocaleString('it-IT')}`:'Salva la configurazione base della sala. Durante il servizio potrai spostare i tavoli, stampare la piantina e poi tornare allo standard con un clic.'}</p></div><div class="floor-service-actions"><button class="mini" id="save-floor-standard">Imposta / aggiorna standard</button><button class="mini" id="restore-floor-standard">Piantina standard</button><button class="mini" id="print-floor">Stampa piantina</button><button class="mini" id="floor-expand">⛶ Area di lavoro grande</button></div></div>
 <div class="floor-layout floor-editor-layout"><section class="panel floor-canvas-panel"><button type="button" id="floor-close-large" class="floor-close-large">× Chiudi area grande</button><div class="floor-zoom-toolbar" aria-label="Zoom piantina"><span class="floor-zoom-caption">VISUALIZZAZIONE</span><button type="button" class="floor-zoom-btn" id="floor-zoom-out" aria-label="Riduci zoom">−</button><output id="floor-zoom-label">Adatta</output><button type="button" class="floor-zoom-btn" id="floor-zoom-in" aria-label="Aumenta zoom">+</button><button type="button" class="floor-zoom-fit" id="floor-zoom-fit">Adatta allo schermo</button><button type="button" class="floor-zoom-fit" id="floor-zoom-100">100%</button></div><div class="floor-board-scroll"><div id="floor-stage" class="floor-board-stage"><div class="floor-board ${zones.length?"floor-board-zoned":""}" id="floor-board"><div class="floor-zone-layer">${renderZones(zones)}</div><svg class="floor-links-svg" viewBox="0 0 1100 700" width="1100" height="700" aria-hidden="true">${state.tableLinks.filter(l=>tableList.some(t=>t.id===l.table_a)&&tableList.some(t=>t.id===l.table_b)).map(l=>{const a=tableList.find(t=>t.id===l.table_a),b=tableList.find(t=>t.id===l.table_b);return `<line x1="${a.x+a.w/2}" y1="${a.y+a.h/2}" x2="${b.x+b.w/2}" y2="${b.y+b.h/2}" stroke="#b08a5c" stroke-width="3" stroke-dasharray="7 5"/>`}).join('')}</svg>${elementList.map(f=>`<button type="button" class="floor-structure kind-${esc(f.kind)}" data-structure="${f.id}" style="left:${f.x}px;top:${f.y}px;width:${f.w}px;height:${f.h}px;transform:rotate(${f.rotation}deg)" title="Modifica ${esc(f.label||f.kind)}">${esc(f.label||({wall:'',column:'',door:'Ingresso',window:'Finestra'}[f.kind]||''))}</button>`).join('')}${tableList.map(renderFloorTable).join('')}</div></div></div><p class="floor-hint">Trascina le aree e ridimensionale dall'angolo inferiore destro. Quando si toccano, si uniscono visivamente in un unico ambiente. Trascina tavoli e ambienti, poi usa le maniglie in basso a destra per ridimensionarli. Le modifiche si salvano in D1.</p><div class="floor-legend"><span><i class="floor-dot table-dot"></i> Tavoli attivi</span><span><i class="floor-dot structure-dot"></i> Strutture</span><span><i class="floor-dot disabled-dot"></i> Disattivati</span></div></section><aside id="table-properties" class="panel floor-inspector"><span class="eyebrow">PROPRIETÀ</span><h3>Seleziona un elemento</h3><p>Tocca un tavolo oppure aggiungi ambienti, muri, colonne, ingressi e finestre. Aree sovrapposte o a contatto formano un'unica sagoma, senza linee divisorie interne.</p></aside></div>`;
}
if(tab==='security'){
 const [data,readiness]=await Promise.all([api('admin/security'),api('admin/readiness').catch(()=>null)]);
 const audit=data.audit||[], recent=data.login_attempts||[];
 html=heading('Sicurezza e registro','Un solo accesso ADMIN. Controllo degli accessi e delle modifiche, senza account separati.')+
 `<div class="security-grid"><section class="panel"><h3>Stato protezione</h3><div class="security-facts"><p><strong>Accesso</strong><span>Solo password ADMIN da Secret Cloudflare</span></p><p><strong>Sessioni attive</strong><span>${Number(data.active_sessions)} · scadenza dopo 24 ore</span></p><p><strong>Accessi non riusciti (24h)</strong><span>${Number(data.failed_login_24h)}</span></p><p><strong>Archivio D1</strong><span>${Number(data.reservation_count)} prenotazioni · ${Number(data.customer_count)} clienti</span></p></div><button id="security-revoke" class="btn btn-outline" type="button">Disconnetti tutte le sessioni</button><p class="op-muted">Disconnette anche questo dispositivo. Per entrare di nuovo serve la password ADMIN.</p></section><section class="panel"><h3>Backup e ripristino</h3><p>Le copie del database sono gestite in Cloudflare D1. Un registro operazioni <strong>non</strong> è un backup.</p><p>Prima di ogni aggiornamento esegui un backup D1 e conserva il codice GitHub dell'ultima versione stabile.</p><p><strong>Da verificare su Cloudflare:</strong> disponibilità di ripristino Point-in-Time, intervallo di conservazione e test di recupero su database separato.</p><a class="mini" href="https://developers.cloudflare.com/d1/reference/time-travel/" target="_blank" rel="noopener noreferrer">Documentazione backup D1</a></section></div>`+
 `<section class="panel oasi-readiness-panel"><div class="op-panel-heading"><h3>Verifica prima della consegna</h3><button class="mini" type="button" id="oasi-readiness-refresh">Aggiorna controlli</button></div>${readiness?`<div class="oasi-readiness-grid">${[['Database D1 e migrazioni',readiness.database_ready],['Password ADMIN',readiness.admin_password_configured],['Archivio immagini R2',readiness.media_bucket_configured],['Invio email configurato',readiness.email_configured],['Notifica email al ristorante',readiness.notify_email_configured],['Sale disponibili',readiness.rooms_enabled>0],['Tavoli attivi',readiness.tables_enabled>0]].map(([label,good])=>`<p><span>${esc(label)}</span><strong class="${good?'oasi-readiness-ok':'oasi-readiness-warning'}">${good?'Configurato':'Da verificare'}</strong></p>`).join('')}</div><p class="op-muted">${Number(readiness.rooms_enabled)} sale attive · ${Number(readiness.tables_enabled)} tavoli · ${Number(readiness.confirmed_bookings)} prenotazioni confermate · ${Number(readiness.email_failed_or_unconfigured)} email fallite o senza configurazione.</p><p><strong>Promemoria:</strong> ${esc(readiness.scheduled_reminders)}</p><p><strong>Backup:</strong> ${esc(readiness.backup)}</p>`:'<p>Impossibile leggere il controllo di consegna: verifica che sia stato pubblicato l\'ultimo Worker.</p>'}<p class="op-muted">Un controllo verde conferma la presenza della configurazione, non la riuscita di una prova reale. Prima della consegna verifica invio email, ripristino backup e stampa.</p></section>`+
 `<section class="panel"><div class="op-panel-heading"><h3>Registro modifiche</h3><span class="op-muted">Ultime 100 operazioni ADMIN</span></div><div class="table-scroll"><table><thead><tr><th>Quando</th><th>Operazione</th><th>Risorsa</th><th>Esito</th></tr></thead><tbody>${audit.length?audit.map(x=>`<tr><td>${esc(new Date(x.created_at).toLocaleString('it-IT'))}</td><td>${esc(x.method)}</td><td>${esc(x.resource)}${x.resource_id?' #'+esc(x.resource_id):''}</td><td>${Number(x.http_status)}</td></tr>`).join(''):'<tr><td colspan="4">Nessuna modifica registrata dopo l’attivazione.</td></tr>'}</tbody></table></div></section>`+
 `<section class="panel"><h3>Ultimi tentativi di accesso</h3><p class="op-muted">Per privacy il registro non conserva password né indirizzi IP in chiaro.</p><div class="table-scroll"><table><thead><tr><th>Quando</th><th>Esito</th></tr></thead><tbody>${recent.length?recent.map(x=>`<tr><td>${esc(new Date(x.created_at).toLocaleString('it-IT'))}</td><td>${x.success?'Riuscito':'Rifiutato'}</td></tr>`).join(''):'<tr><td colspan="2">Nessun tentativo registrato.</td></tr>'}</tbody></table></div></section>`;
}
if(tab==='menu'){const pdf=await api('admin/menu-pdf');html=heading('Menù PDF','Pubblica e sostituisci il documento del menù senza modificare il sito.')+`<section class="panel oasi-menu-admin"><h3>${pdf.available?'Menù pubblicato':'Nessun menù pubblicato'}</h3>${pdf.available?`<p>${(pdf.size/1024/1024).toFixed(2)} MB · Ultimo aggiornamento ${esc(pdf.updated?new Date(pdf.updated).toLocaleString('it-IT'):'')}</p><a class="mini" href="/api/menu-pdf" target="_blank" rel="noopener">Visualizza PDF attuale</a>`:'<p>Carica il primo documento per renderlo disponibile sul sito.</p>'}<form id="menu-pdf-form"><label>Seleziona il menù in PDF (max 15 MB)<input type="file" name="file" accept="application/pdf,.pdf" required></label><button class="btn btn-dark" type="submit">${pdf.available?'Sostituisci e pubblica':'Pubblica menù'}</button><p id="menu-pdf-status" role="status"></p></form><p>Il documento precedente resta disponibile fino al completamento del caricamento. I vecchi elementi del menù digitale restano nel database ma non sono mostrati sul sito.</p></section>`}

if(tab==='gallery'){state.gallery=await api('admin/gallery');html=heading('Galleria','Aggiungi fotografie e ambienti.')+`<button class="btn btn-dark" id="new-gallery">+ Aggiungi foto</button><div id="edit-area"></div><div class="gallery-admin">${state.gallery.map(x=>`<article class="panel"><img src="${esc(x.image_url)}" alt=""/><h3>${esc(x.caption)}</h3><button class="mini" data-edit-gallery="${x.id}">Modifica</button> <button class="mini danger" data-delete-gallery="${x.id}">Elimina</button></article>`).join('')}</div>`}
if(tab==='faq'){const cfg=await api('admin/settings');const configured=cfg.site?.faqs;state.settings=cfg;const items=Array.isArray(configured)?configured:defaultFaqs;html=heading('Domande frequenti','Aggiungi, modifica, riordina o elimina le risposte che compaiono nella homepage.')+`<section class="panel"><div class="faq-admin-toolbar"><h3>FAQ homepage</h3><button class="mini" id="faq-add">+ Aggiungi domanda</button></div><form id="faq-admin-form"><div id="faq-admin-items">${items.map((q,i)=>`<div class="faq-admin-row"><label>Domanda<input name="question" maxlength="220" required value="${esc(q.question)}"></label><label>Risposta<textarea name="answer" maxlength="1500" rows="3" required>${esc(q.answer)}</textarea></label><button type="button" class="mini danger faq-remove">Elimina</button></div>`).join('')}</div><button class="btn btn-dark" type="submit">Salva le FAQ</button></form></section>`}
if(tab==='site'||tab==='booking'){const cfg=await api('admin/settings');const d=cfg[tab];if(tab==='site'){const mediaGallery=await api('admin/gallery');html=heading('Contenuti e contatti','Personalizza la storia e le informazioni del ristorante.')+sectionForm('Contenuti del sito',fields([['subtitle','Sottotitolo homepage'],['story','La nostra storia','textarea'],['address','Indirizzo'],['phone','Telefono'],['instagram','Instagram'],['facebook','Facebook'],['tiktok','TikTok']],d)+`<div class="oasi-media-editor"><h2>Immagini e identità visiva</h2><p>Carica o sostituisci ogni fotografia in autonomia. Premi Salva per pubblicare tutte le modifiche. Le raccolte di fotografie restano nella sezione Galleria.</p>${mediaEditor(d,mediaGallery)}</div>`);}else html=heading('Orari e regole','Configura separatamente pranzo, cena e chiusure.')+sectionForm('Impostazioni prenotazione',fields([['lunchStart','Pranzo da','time'],['lunchLast','Pranzo ultimo arrivo','time'],['dinnerStart','Cena da','time'],['dinnerLast','Cena ultimo arrivo','time'],['maxOnline','Massimo persone online','number'],['maxDaysAhead','Giorni prenotabili in anticipo','number'],['minNoticeMinutes','Preavviso minimo (minuti)','number'],['closedDates','Date di chiusura (AAAA-MM-GG separate da virgola)'],['firstFloorOverflowEnabled','Consenti primo piano senza piantina in inverno','checkbox'],['firstFloorOverflowCapacity','Capienza massima primo piano (coperti per servizio)','number']],{lunchStart:d.lunch.start,lunchLast:d.lunch.last,dinnerStart:d.dinner.start,dinnerLast:d.dinner.last,maxOnline:d.maxOnline,maxDaysAhead:d.maxDaysAhead,minNoticeMinutes:d.minNoticeMinutes,closedDates:d.closedDates.join(', '),firstFloorOverflowEnabled:!!d.firstFloorOverflowEnabled,firstFloorOverflowCapacity:Number(d.firstFloorOverflowCapacity||0)} )+`<div class="panel oasi-season-panel"><h3>Gestione stagionale sale</h3><p>In inverno prima il piano terra; quando non ci sono più tavoli compatibili, il primo piano senza piantina. Imposta la capienza reale del primo piano prima di attivarlo. In estate puoi utilizzare piano terra e veranda (da abilitare in Sale).</p><label>Modalità del ristorante<select id="oasi-season-mode" form="editor-form" name="seasonMode"><option value="winter" ${d.seasonMode!=='summer'?'selected':''}>Inverno · Piano terra + primo piano</option><option value="summer" ${d.seasonMode==='summer'?'selected':''}>Estate · Piano terra + veranda</option></select></label><small>La modalità selezionata si applica alle nuove prenotazioni; quelle confermate restano registrate.</small></div>`);state.settings=cfg}
if(serial!==oasiRenderSerial||state.adminView!==tab)return;root.innerHTML=adminShell(html,tab);if(renderedSnapshot&&period){oasiReservationSync.key=period.key;oasiReservationSync.signature=oasiSyncSignature(renderedSnapshot);}bindAdmin();bindAdminTools();bindOasiSidebar();oasiSyncStatus('Sincronizzazione ogni 30 s');if(tab==='calendar')bindCalendar();if(tab==='analytics')bindAnalytics();if(tab==='events')bindEvents();if(tab==='security')$('#security-revoke')?.addEventListener('click',async()=>{if(!confirm('Disconnettere tutte le sessioni, inclusa questa?'))return;try{await api('admin/security/sessions','DELETE',{});location.href='/admin'}catch(e){msg(e.message,'error')}});api('admin/notifications?count=1').then(x=>{const count=Number(x.unread||0);const item=document.querySelector('.sidebar [data-tab="notifications"]');const mobile=document.querySelector('#mobile-tab [value="notifications"]');if(count&&item){const badge=document.createElement('span');badge.className='oasi-notification-count';badge.textContent=count>99?'99+':String(count);item.append(badge)}if(mobile)mobile.textContent='Notifiche'+(count?' ('+count+')':'')}).catch(()=>{});if(tab==='floor')bindFloorZoom();if(tab==='site')enableImageUpload($('#editor-form')?.closest('.panel'));}catch(e){if(serial!==oasiRenderSerial||state.adminView!==tab)return;oasiReservationSync.key='';oasiReservationSync.signature=null;root.innerHTML=adminShell(heading('Errore',esc(e.message))+'<button class="btn btn-dark" id="retry">Riprova</button>',tab);bindAdmin();bindAdminTools();bindOasiSidebar();$('#retry')?.addEventListener('click',()=>renderAdmin())}finally{if(oasiRenderPending===serial)oasiRenderPending=0}}

const menuFields=[['section','Sezione: piatti, pizze, vini'],['category','Categoria'],['name','Nome'],['description','Descrizione','textarea'],['price','Prezzo (es. € 12,00)'],['allergens','Allergeni'],['image_url','URL foto'],['region','Regione vino'],['winery','Cantina'],['vintage','Annata'],['sort_order','Ordine','number'],['available','Disponibile','checkbox']];
const galleryFields=[['image_url','URL immagine'],['caption','Didascalia'],['category','Categoria'],['sort_order','Ordine','number']];

// Editor immediato: pannello laterale su PC, bottom sheet su smartphone.
function closeFloorInspector(){
 document.body.classList.remove('floor-panel-open');
 document.querySelector('.floor-inspector-backdrop')?.remove();
 const zone=document.querySelector('#table-properties');
 if(zone){zone.removeAttribute('role');zone.removeAttribute('aria-modal')}
}
function openFloorInspector(zone){
 if(!zone)return;
 document.querySelector('.floor-inspector-backdrop')?.remove();
 const backdrop=document.createElement('button');
 backdrop.type='button';backdrop.className='floor-inspector-backdrop';backdrop.setAttribute('aria-label','Chiudi proprietà');
 backdrop.onclick=closeFloorInspector;
 document.body.append(backdrop);
 document.body.classList.add('floor-panel-open');
 zone.setAttribute('role','dialog');zone.setAttribute('aria-modal','true');zone.setAttribute('aria-label','Modifica elemento piantina');
 zone.insertAdjacentHTML('afterbegin','<div class="floor-inspector-header"><span class="eyebrow">MODIFICA ELEMENTO</span><button type="button" class="floor-inspector-close" aria-label="Chiudi pannello">×</button></div>');
 zone.querySelector('.floor-inspector-close').onclick=closeFloorInspector;
 zone.scrollTop=0;
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('floor-panel-open'))closeFloorInspector()});

function structureEditor(record={}){
 const zone=$('#table-properties');if(!zone)return;
 const r={kind:'wall',label:'',x:50,y:50,w:120,h:14,rotation:0,...record};
 zone.innerHTML=sectionForm(record.id?'Modifica elemento':'Nuovo elemento',`<label>Tipo<select name="kind">${[['wall','Muro'],['column','Colonna'],['door','Ingresso / Porta'],['window','Finestra'],['label','Etichetta']].map(([v,t])=>`<option value="${v}" ${r.kind===v?'selected':''}>${t}</option>`).join('')}</select></label>${fields([['label','Etichetta'],['x','Posizione X (px)','number'],['y','Posizione Y (px)','number'],['w','Larghezza (px)','number'],['h','Altezza (px)','number'],['rotation','Rotazione (gradi)','number']],r)}`,record.id?'Salva modifiche':'Aggiungi alla piantina');
 openFloorInspector(zone);zone.querySelector('#form-cancel').onclick=closeFloorInspector;
 if(record.id)zone.querySelector('.form-actions').insertAdjacentHTML('beforeend','<button class="mini danger" type="button" id="delete-structure">Elimina elemento</button>');
 $('#delete-structure')?.addEventListener('click',async()=>{if(!confirm('Eliminare questo elemento?'))return;try{await api('admin/floor-elements/'+record.id,'DELETE');renderAdmin()}catch(e){msg(e.message,'error')}});
 zone.querySelector('#editor-form').onsubmit=async e=>{e.preventDefault();try{await api('admin/floor-elements'+(record.id?'/'+record.id:''),record.id?'PUT':'POST',{...inputData(e.target),room_id:state.room});msg('Elemento salvato');renderAdmin()}catch(x){msg(x.message,'error')}};
}
function enableImageUpload(zone){
 if(!zone||!zone.querySelector('form'))return;
 const form=zone.querySelector('form');let pending=0;
 for(const target of zone.querySelectorAll('input[data-media-slot],input[name="image_url"]')){
 const block=document.createElement('div');block.className='admin-photo-upload oasi-media-upload';
 block.innerHTML='<div class="oasi-media-preview"><img alt="Anteprima immagine" hidden><span>Nessuna immagine</span></div><label>Seleziona dal dispositivo<input type="file" accept="image/jpeg,image/png,image/webp,image/avif"/></label><div class="oasi-media-actions"><button type="button" class="mini" data-upload>Carica foto</button><button type="button" class="mini" data-clear>Rimuovi</button></div><span class="upload-feedback" role="status" aria-live="polite"></span>';
 // Attach outside the enclosing label, avoiding nested labels and Safari input issues.
 target.closest('label').after(block);
 const image=block.querySelector('img'),empty=block.querySelector('.oasi-media-preview span'),feedback=block.querySelector('.upload-feedback'),fileInput=block.querySelector('input[type=file]'),button=block.querySelector('[data-upload]'),clear=block.querySelector('[data-clear]');
 const card=target.closest('.oasi-media-card'),focal=card?.querySelector('.oasi-focal-editor'),crop=focal?.querySelector('.oasi-focal-preview'),cropImage=crop?.querySelector('img'),cropEmpty=crop?.querySelector('.oasi-focal-placeholder');
 const axisX=focal?.querySelector('[data-focal-axis="X"]'),axisY=focal?.querySelector('[data-focal-axis="Y"]');
 const updateFocal=()=>{
  if(!focal)return;
  const x=Number(axisX.value),y=Number(axisY.value);
  focal.querySelector('[data-focal-output="X"]').textContent=x+'%';
  focal.querySelector('[data-focal-output="Y"]').textContent=y+'%';
  cropImage.style.objectPosition=x+'% '+y+'%';
  crop.style.setProperty('--focal-x',x+'%');
  crop.style.setProperty('--focal-y',y+'%');
 };
 const refreshCrop=()=>{
  if(!crop)return;
  const url=mediaUrl(target.value.trim());
  cropImage.hidden=!url;cropEmpty.hidden=!!url;
  if(url){if(cropImage.getAttribute('src')!==url)cropImage.src=url;}else cropImage.removeAttribute('src');
  updateFocal();
 };
 if(focal){
  axisX.addEventListener('input',updateFocal);
  axisY.addEventListener('input',updateFocal);
  focal.querySelector('.oasi-focal-reset')?.addEventListener('click',()=>{
   axisX.value='50';axisY.value='50';updateFocal();
  });
  // L'utente può indicare direttamente il punto da valorizzare con mouse o touch.
  let dragging=false;
  const moveFocal=e=>{
   const rect=crop.getBoundingClientRect();
   if(!rect.width||!rect.height)return;
   axisX.value=String(Math.min(100,Math.max(0,Math.round((e.clientX-rect.left)*100/rect.width))));
   axisY.value=String(Math.min(100,Math.max(0,Math.round((e.clientY-rect.top)*100/rect.height))));
   updateFocal();
  };
  crop.addEventListener('pointerdown',e=>{
   if(!mediaUrl(target.value.trim()))return;
   dragging=true;crop.setPointerCapture?.(e.pointerId);moveFocal(e);
  });
  crop.addEventListener('pointermove',e=>{if(dragging)moveFocal(e)});
  const endDrag=()=>{dragging=false};
  crop.addEventListener('pointerup',endDrag);
  crop.addEventListener('pointercancel',endDrag);
  cropImage.onerror=()=>{cropImage.hidden=true;cropEmpty.hidden=false;cropEmpty.textContent='Anteprima non disponibile'};
  cropImage.onload=()=>{cropImage.hidden=false;cropEmpty.hidden=true};
 }
 const refresh=()=>{const url=mediaUrl(target.value.trim());image.hidden=!url;empty.hidden=!!url;if(url)image.src=url;else image.removeAttribute('src');refreshCrop()};
 image.onerror=()=>{image.hidden=true;empty.hidden=false;empty.textContent='Anteprima non disponibile'};image.onload=()=>{image.hidden=false;empty.hidden=true;empty.textContent='Nessuna immagine'};
 target.addEventListener('input',refresh);refresh();
 clear.onclick=()=>{target.value='';fileInput.value='';empty.textContent='Nessuna immagine';refresh();feedback.textContent='Rimossa. Salva per pubblicare.'};
 button.onclick=async()=>{const file=fileInput.files[0];if(!file){feedback.textContent='Seleziona prima una fotografia.';return}if(file.size>7*1024*1024){feedback.textContent='Dimensione massima: 7 MB.';return}
 pending++;button.disabled=clear.disabled=fileInput.disabled=true;form.querySelectorAll('button[type=submit]').forEach(b=>b.disabled=true);feedback.textContent='Caricamento…';try{const payload=new FormData();payload.append('file',file);const response=await fetch('/api/admin/upload',{method:'POST',body:payload,credentials:'same-origin'});const result=await response.json();if(!response.ok||!result.url)throw Error(result.error||'Caricamento non riuscito');target.value=result.url;refresh();feedback.textContent='Caricata. Premi Salva per pubblicare.'}catch(e){feedback.textContent=e.message}finally{pending--;button.disabled=clear.disabled=fileInput.disabled=false;if(!pending)form.querySelectorAll('button[type=submit]').forEach(b=>b.disabled=false)}};
 }
 form.addEventListener('submit',e=>{if(pending){e.preventDefault();e.stopImmediatePropagation();msg('Attendi il completamento dei caricamenti','error')}},{capture:true});
}
function tableEditor(record={}){
 const zone=$('#table-properties');if(!zone)return;
 const inferredOrientation=floorOrientation(record);
 const v={shape:'square',module_count:1,min_seats:1,seats:4,rotation:0,enabled:1,orientation:inferredOrientation,x:75,y:75,w:78,h:78,...record};
 if(v.shape!=='rectangle')v.orientation='horizontal';
 const options=state.tables.filter(t=>t.room_id===state.room&&t.id!==v.id);
 const linked=state.tableLinks.filter(l=>l.table_a===v.id||l.table_b===v.id).map(l=>l.table_a===v.id?l.table_b:l.table_a);
 const form=`<label>Numero tavolo<input name="code" required maxlength="30" value="${esc(v.code||'')}"></label>
 <label>Forma<select name="shape">${[['square','Quadrato'],['rectangle','Rettangolare'],['circle','Rotondo']].map(([key,label])=>`<option value="${key}" ${key===v.shape?'selected':''}>${label}</option>`).join('')}</select></label>
 <label>Orientamento<select name="orientation">${[['horizontal','Orizzontale'],['vertical','Verticale']].map(([key,label])=>`<option value="${key}" ${key===v.orientation?'selected':''}>${label}</option>`).join('')}</select></label>
 <label>Quantità tavoli<input name="module_count" type="number" min="1" max="8" required value="${v.module_count}"></label>
 <label>Posti minimi<input name="min_seats" type="number" min="1" max="100" required value="${v.min_seats}"></label>
 <label>Posti massimi<input name="seats" type="number" min="1" max="100" required value="${v.seats}"></label><label>Larghezza tavolo (px)<input name="w" type="number" min="55" max="1100" required value="${Number(v.w)||78}"></label>
 <label>Altezza tavolo (px)<input name="h" type="number" min="55" max="700" required value="${Number(v.h)||78}"></label>
 <label>Rotazione (gradi)<input name="rotation" type="number" step="15" value="${v.rotation}"></label>
 <label class="table-enabled"><input name="enabled" type="checkbox" ${v.enabled?'checked':''}> Tavolo attivo</label>`;
 zone.innerHTML=sectionForm(v.id?'Tavolo '+esc(v.code):'Nuovo tavolo',form,v.id?'Salva tavolo':'Crea tavolo');
 const actions=zone.querySelector('.form-actions');
 if(v.id){actions.insertAdjacentHTML('beforeend','<button type="button" class="mini" id="duplicate-table">Duplica tavolo</button><button type="button" class="mini danger" id="remove-floor-table">Elimina</button>');
 const connect=`<section class="floor-connect"><h4>Collega o accosta altri tavoli</h4><p>Seleziona i tavoli che vuoi poter unire o avvicinare a questo tavolo.</p>${options.length?options.map(t=>`<label><input type="checkbox" data-link-target="${t.id}" ${linked.includes(t.id)?'checked':''}> ${esc(t.code)} · ${t.min_seats||1}-${t.seats} posti</label>`).join(''):'<small>Crea prima un altro tavolo nella stessa sala.</small>'}<button type="button" class="mini" id="save-table-links">Salva collegamenti</button> <button type="button" class="mini" id="attach-table-links">Attacca tavoli selezionati</button></section>`;
 zone.insertAdjacentHTML('beforeend',connect);
 $('#duplicate-table').onclick=async()=>{const codes=new Set(state.tables.filter(t=>t.room_id===state.room).map(t=>t.code));let n=2;let code=v.code+'-copia';while(codes.has(code))code=v.code+'-copia-'+n++;const copy={...v,id:undefined,code,x:Math.min(980,Number(v.x)+35),y:Math.min(620,Number(v.y)+35)};delete copy.id;try{await api('admin/tables','POST',{...copy,room_id:state.room});msg('Tavolo duplicato');renderAdmin()}catch(e){msg(e.message,'error')}};
 $('#remove-floor-table').onclick=()=>deleteEntity('tables',v.id);
 $('#attach-table-links').onclick=async()=>{const ids=[...zone.querySelectorAll('[data-link-target]:checked')].map(x=>+x.dataset.linkTarget);if(!ids.length)return msg('Seleziona almeno un tavolo da attaccare','error');let cursorX=Number(v.x)+Number(v.w)+8,cursorY=Number(v.y);try{for(const id of ids){const t=options.find(x=>x.id===id);if(!t)continue;const placeSide=floorOrientation(v)==='vertical'?'vertical':'horizontal';let newX=cursorX,newY=cursorY;if(placeSide==='vertical'){newX=Number(v.x);newY=cursorY+8}else if(cursorX+Number(t.w)>1100){newX=Math.max(0,Number(v.x));newY=Number(v.y)+Number(v.h)+8}await api('admin/tables/'+id,'PUT',{...t,x:newX,y:newY,orientation:floorOrientation(t)});cursorX=newX+Number(t.w);cursorY=newY+Number(t.h);await api('admin/table-links','POST',{table_a:v.id,table_b:id});}msg('Tavoli attaccati e collegati');renderAdmin();}catch(e){msg(e.message,'error')}};
 $('#save-table-links').onclick=async()=>{const checked=[...zone.querySelectorAll('[data-link-target]:checked')].map(x=>+x.dataset.linkTarget);try{for(const id of options.map(t=>t.id)){const was=linked.includes(id),want=checked.includes(id);if(was!==want)await api('admin/table-links',want?'POST':'DELETE',{table_a:v.id,table_b:id})}msg('Collegamenti salvati');renderAdmin()}catch(e){msg(e.message,'error')}};
 }
 openFloorInspector(zone);zone.querySelector('#form-cancel').onclick=closeFloorInspector;
 const moduleField=zone.querySelector('[name="module_count"]');
 const shapeField=zone.querySelector('[name="shape"]');
 const orientationField=zone.querySelector('[name="orientation"]');
 const minField=zone.querySelector('[name="min_seats"]');
 const maxField=zone.querySelector('[name="seats"]');
 const hint=document.createElement('small');hint.className='module-size-hint';moduleField.closest('label')?.append(hint);
 const dims=zone.querySelector('[name="w"]'),dimh=zone.querySelector('[name="h"]');
 const preset=document.createElement('button');preset.type='button';preset.className='mini';preset.textContent='Ripristina dimensioni suggerite';moduleField.closest('label')?.after(preset);
 preset.onclick=()=>{const n=Math.min(8,Math.max(1,+moduleField.value||1)),sh=shapeField.value,vertical=orientationField.value==='vertical';const g=sh==='circle'?{w:76+16*(n-1),h:76+16*(n-1)}:sh==='rectangle'?(vertical?{w:72,h:96+54*(n-1)}:{w:96+54*(n-1),h:72}):{w:78+16*(n-1),h:78+16*(n-1)};dims.value=g.w;dimh.value=g.h;};
 const setDefaultSeats=()=>{const n=Math.min(8,Math.max(1,+moduleField.value||1));if(shapeField.value==='rectangle'){minField.value=Math.max(1,Math.min(+minField.value||1,n));maxField.value=Math.max(+maxField.value||0,n*8)}else{minField.value=Math.max(1,Math.min(+minField.value||1,n));maxField.value=Math.max(+maxField.value||0,n*4)}};
 const updateModuleHint=()=>{const n=Math.min(8,Math.max(1,+moduleField.value||1));const sh=shapeField.value;const orientation=orientationField.value;const g=sh==='circle'?{w:76+16*(n-1),h:76+16*(n-1)}:sh==='rectangle'?(orientation==='vertical'?{w:72,h:96+54*(n-1)}:{w:96+54*(n-1),h:72}):{w:78+16*(n-1),h:78+16*(n-1)};hint.textContent=` Dimensione suggerita: ${Math.round(g.w)} × ${Math.round(g.h)} px`;
 const enableOrientation=sh==='rectangle';orientationField.disabled=!enableOrientation;orientationField.closest('label')?.classList.toggle('is-disabled',!enableOrientation)};
 moduleField?.addEventListener('change',()=>{setDefaultSeats();updateModuleHint()});
 shapeField?.addEventListener('change',()=>{setDefaultSeats();updateModuleHint()});
 orientationField?.addEventListener('change',updateModuleHint);updateModuleHint();
 zone.querySelector('#editor-form').onsubmit=async e=>{e.preventDefault();const b=parseForm(e.target);if(+b.min_seats>+b.seats)return msg('I posti minimi non possono superare quelli massimi','error');try{await api('admin/tables'+(v.id?'/'+v.id:''),v.id?'PUT':'POST',{...v,...b,room_id:state.room});msg('Tavolo salvato');renderAdmin()}catch(e){msg(e.message,'error')}};
}
function zoneEditor(record={}){
 const zone=$('#table-properties');if(!zone)return;const z={label:'Area principale',x:20,y:20,w:450,h:320,...record};
 const form=`<div class="zone-editor-instruction">Trascina l’area sulla piantina per spostarla. Usa il quadratino nell’angolo in basso a destra per cambiarne la dimensione. Le misure qui sotto sono facoltative per regolazioni precise.</div><label>Nome ambiente<input name="label" value="${esc(z.label)}" required></label><label>X iniziale<input type="number" name="x" value="${z.x}" required></label><label>Y iniziale<input type="number" name="y" value="${z.y}" required></label><label>Larghezza area<input type="number" name="w" min="70" value="${z.w}" required></label><label>Altezza area<input type="number" name="h" min="70" value="${z.h}" required></label><div class="zone-editor-note">Le aree possono sovrapporsi o toccarsi: in piantina verranno percepite come ambiente unico, utile per sale a L o ali aggiuntive.</div>`;
 zone.innerHTML=sectionForm(z.id?'Modifica ambiente':'Aggiungi ambiente',form,z.id?'Salva ambiente':'Crea ambiente');
 if(z.id){zone.querySelector('.form-actions').insertAdjacentHTML('beforeend','<button type="button" class="mini danger" id="delete-zone">Elimina area</button>');$('#delete-zone').onclick=async()=>{if(!confirm('Eliminare questa area? I tavoli resteranno al loro posto.'))return;try{await api('admin/room-zones/'+z.id,'DELETE');renderAdmin()}catch(e){msg(e.message,'error')}}}
 openFloorInspector(zone);zone.querySelector('#form-cancel').onclick=closeFloorInspector;zone.querySelector('#editor-form').onsubmit=async e=>{e.preventDefault();try{await api('admin/room-zones'+(z.id?'/'+z.id:''),z.id?'PUT':'POST',{...parseForm(e.target),room_id:state.room});msg('Ambiente salvato');renderAdmin()}catch(e){msg(e.message,'error')}};
}
function editEntity(type,record={}){if(type==='tables')return tableEditor(record);const form=type==='rooms'?[['name','Nome sala'],['sort_order','Ordine','number'],['public_enabled','Prenotabile online','checkbox'],['internal_enabled','Gestione interna attiva','checkbox']]:type==='menu'?menuFields:galleryFields;const zone=type==='tables'?$('#table-properties'):$('#edit-area');zone.innerHTML=sectionForm(record.id?'Modifica':'Nuovo elemento',fields(form,record),record.id?'Salva modifiche':'Crea');if(type==='gallery'||type==='menu'){zone.querySelector('#editor-form').insertAdjacentHTML('afterbegin','<div class="upload"><label>Carica fotografia da dispositivo<input type="file" id="upload-file" accept="image/png,image/jpeg,image/webp,image/avif" /></label><button type="button" class="mini" id="upload-action">Carica</button><span id="upload-status"></span></div>');$('#upload-action').onclick=async()=>{const file=$('#upload-file').files[0];if(!file)return msg('Scegli una foto','error');const f=new FormData();f.append('file',file);try{const r=await fetch('/api/admin/upload',{method:'POST',body:f});const o=await r.json();if(!r.ok)throw Error(o.error);zone.querySelector('[name="image_url"]').value=o.url;$('#upload-status').textContent='Foto caricata'}catch(e){msg(e.message,'error')}}}
zone.querySelector('#form-cancel').onclick=()=>{zone.innerHTML=''};zone.querySelector('#editor-form').onsubmit=async e=>{e.preventDefault();const b=parseForm(e.target);if(type==='tables'){b.room_id=state.room;b.x=Number(b.x??record.x??55);b.y=Number(b.y??record.y??55)}try{await api('admin/'+type+(record.id?'/'+record.id:''),record.id?'PUT':'POST',b);msg('Salvato correttamente');renderAdmin()}catch(e){msg(e.message,'error')}}}
async function deleteEntity(type,id){if(!confirm('Vuoi davvero eliminare questo elemento?'))return;try{await api('admin/'+type+'/'+id,'DELETE');msg('Elemento eliminato');renderAdmin()}catch(e){msg(e.message,'error')}}
// Stampa indipendente dal layout ADMIN: una pagina per sala e servizio.
// Le aree sovrapposte vengono fuse con un solo perimetro, senza bordi interni.
function printOasiReservations(mode='plan'){
 const day=state.date, selected=state.reservationService||'all';
 const dayLabel=day.split('-').reverse().join('/');
 const serviceLabel=s=>s==='lunch'?'Pranzo':'Cena';
 const services=selected==='all'?['lunch','dinner']:[selected];
 const booked=(state.reservations||[]).filter(r=>r.status==='confirmed');
 const cleanNumber=n=>Number.isFinite(Number(n))?Number(n):0;
 const rect=r=>({x:cleanNumber(r.x),y:cleanNumber(r.y),w:Math.max(1,cleanNumber(r.w)),h:Math.max(1,cleanNumber(r.h))});
 const boxOf=(rects,padding=16)=>{
  const rs=rects.length?rects:[{x:0,y:0,w:1100,h:700}];
  const x=Math.min(...rs.map(r=>r.x))-padding,y=Math.min(...rs.map(r=>r.y))-padding;
  const xmax=Math.max(...rs.map(r=>r.x+r.w))+padding,ymax=Math.max(...rs.map(r=>r.y+r.h))+padding;
  return {x,y,w:xmax-x,h:ymax-y};
 };
 // Restituisce un contorno per l'unione dei rettangoli: i lati condivisi spariscono.
 const unionOutline=zones=>{
  if(!zones.length)return '';
  const rs=zones.map(rect);
  const xs=[...new Set(rs.flatMap(r=>[r.x,r.x+r.w]))].sort((a,b)=>a-b);
  const ys=[...new Set(rs.flatMap(r=>[r.y,r.y+r.h]))].sort((a,b)=>a-b);
  const inside=(i,j)=>i>=0&&j>=0&&i<xs.length-1&&j<ys.length-1&&rs.some(r=>{
   const px=(xs[i]+xs[i+1])/2,py=(ys[j]+ys[j+1])/2;
   return px>=r.x&&px<r.x+r.w&&py>=r.y&&py<r.y+r.h;
  });
  const edges=[];
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++)if(inside(i,j)){
   const x1=xs[i],x2=xs[i+1],y1=ys[j],y2=ys[j+1];
   if(!inside(i,j-1))edges.push(`M ${x1} ${y1} H ${x2}`);
   if(!inside(i,j+1))edges.push(`M ${x1} ${y2} H ${x2}`);
   if(!inside(i-1,j))edges.push(`M ${x1} ${y1} V ${y2}`);
   if(!inside(i+1,j))edges.push(`M ${x2} ${y1} V ${y2}`);
  }
  return edges.join(' ');
 };
 const listTable=(items,withReferences=false)=>{const sorted=[...items].sort((a,b)=>String(a.time).localeCompare(String(b.time))||Number(a.id)-Number(b.id));return `<table class="bookings"><thead><tr>${withReferences?'<th>Rif.</th>':''}<th>Ora</th><th>Cliente</th><th>Persone</th><th>Tavoli</th><th>Telefono</th></tr></thead><tbody>${sorted.map((r,i)=>`<tr>${withReferences?`<td><span class="booking-ref">P${i+1}</span></td>`:''}<td>${esc(r.time)}</td><td><strong>${esc(r.name)}</strong></td><td class="bookings-party">${cleanNumber(r.party_size)}</td><td>${esc(r.table_codes||'Non assegnato')}</td><td>${esc(r.phone||'')}</td></tr>`).join('')||`<tr><td colspan="${withReferences?6:5}">Nessuna prenotazione confermata</td></tr>`}</tbody></table>`;};
 const svgRoom=(room,tables,zones,structures,items,links=[])=>{
  const roomTables=tables.filter(t=>Number(t.room_id)===Number(room.id)&&t.enabled!==0);
  const roomZones=zones.filter(z=>Number(z.room_id)===Number(room.id));
  const roomStructures=structures.filter(f=>Number(f.room_id)===Number(room.id));
  const zoneRects=roomZones.map(rect);
  // La cornice deve seguire la SALA, non l'intera area dell'editor.
  const bounds=boxOf(zoneRects.length?zoneRects:roomTables.map(rect),20);
  const roomBookings=items.filter(r=>Number(r.room_id)===Number(room.id)).sort((a,b)=>String(a.time).localeCompare(String(b.time))||Number(a.id)-Number(b.id));
  const assignment=new Map(),references=new Map();
  roomBookings.forEach((r,index)=>{references.set(Number(r.id),index+1);for(const id of String(r.table_ids||'').split(',').map(Number).filter(Boolean))assignment.set(id,r)});
  const byId=new Map(roomTables.map(t=>[Number(t.id),t]));
  // Unione esclusivamente per tavoli della stessa prenotazione, collegati fisicamente in verticale.
  const bridges=links.flatMap(link=>{
   const a=byId.get(Number(link.table_a)),b=byId.get(Number(link.table_b));
   if(!a||!b||!oasiNearbyTable(a,b))return [];
   const bookingA=assignment.get(Number(a.id)),bookingB=assignment.get(Number(b.id));
   if(!bookingA||!bookingB||Number(bookingA.id)!==Number(bookingB.id))return [];
   const ra=rect(a),rb=rect(b),top=ra.y<=rb.y?ra:rb,bottom=ra.y<=rb.y?rb:ra;
   const gap=bottom.y-(top.y+top.h);
   if(gap<0||gap>90)return [];
   const left=Math.max(top.x,bottom.x),right=Math.min(top.x+top.w,bottom.x+bottom.w);
   const center=(left+right)/2,barWidth=Math.max(12,(right-left)*.86);
   return ['<rect class="print-joined-bridge" x="'+(center-barWidth/2)+'" y="'+(top.y+top.h-3)+'" width="'+barWidth+'" height="'+(gap+6)+'" rx="3" fill="#d2e6d5" stroke="#396849" stroke-width="2.2"/>'];
  }).join('');
  const clipId='room-clip-'+room.id;
  const hasZones=zoneRects.length>0;
  const zoneShapes=zoneRects.map(r=>`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`).join('');
  const border=hasZones?`<path d="${unionOutline(roomZones)}" fill="none" stroke="#a78962" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`:`<rect x="${bounds.x+18}" y="${bounds.y+18}" width="${bounds.w-36}" height="${bounds.h-36}" rx="7" fill="none" stroke="#a78962" stroke-width="2.4"/>`;
  const cols=roomStructures.map(f=>{
   const r=rect(f),cx=r.x+r.w/2,cy=r.y+r.h/2;
   const shape=f.kind==='column'?`<ellipse cx="${cx}" cy="${cy}" rx="${r.w/2}" ry="${r.h/2}"/>`:`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${f.kind==='wall'?1:5}"/>`;
   return `<g fill="#a69e92" stroke="#685f54" stroke-width="1.4" transform="rotate(${cleanNumber(f.rotation)},${cx},${cy})">${shape}</g>`;
  }).join('');
  const tableSvg=roomTables.map(t=>{
   const r=rect(t),cx=r.x+r.w/2,cy=r.y+r.h/2;
   const booking=assignment.get(Number(t.id)),occupied=!!booking;
   const shape=t.shape==='circle'?`<ellipse cx="${cx}" cy="${cy}" rx="${r.w/2}" ry="${r.h/2}"/>`:`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="9"/>`;
   const small=Math.min(r.w,r.h)<62;
   const codeFont=small?18:24,refFont=small?10:11.5;
   const ref=booking?'P'+references.get(Number(booking.id)):'';
   const codeY=occupied?cy-3:cy+codeFont*.34;
   return `<g transform="rotate(${cleanNumber(t.rotation)},${cx},${cy})"><g fill="${occupied?'#d7e9dc':'#f2e9dc'}" stroke="${occupied?'#356546':'#957d5d'}" stroke-width="${occupied?'3':'2.2'}">${shape}</g><g fill="#1e3024" font-family="Arial,Helvetica,sans-serif" text-anchor="middle"><text x="${cx}" y="${codeY}" font-size="${codeFont}" font-weight="800">${esc(t.code)}</text>${occupied?`<text x="${cx}" y="${cy+refFont+4}" font-size="${refFont}" font-weight="800" letter-spacing=".7" fill="#315b40">${esc(ref)}</text>`:''}</g></g>`;
  }).join('');
  const clip=`<clipPath id="${clipId}">${hasZones?zoneShapes:`<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}"/>`}</clipPath>`;
  const drawing=`<defs>${clip}</defs><rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" fill="#fffdfa"/><g clip-path="url(#${clipId})"><g fill="#f1e6d5">${zoneShapes}</g>${cols}${bridges}${tableSvg}</g>${border}`;
  return {svg:`<svg class="room-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Piantina ${esc(room.name)}">${drawing}</svg>`,portrait:bounds.h>=bounds.w*1.05};
 };
 const buildPage=(heading,sub,content,landscape=false,kind='plan',svc='')=>`<section class="sheet ${landscape?'landscape':'portrait'} ${kind}"><header class="sheet-head"><div><div class="brand">L’OASI<span class="dot">.</span></div><div class="tagline">F.LLI FERA · DAL 1997</div></div><div class="head-right"><strong>${esc(dayLabel)}</strong><span>${esc(serviceLabel(svc || (selected==='all'?'lunch':selected)))}</span></div></header><div class="sheet-title"><div><span class="eyebrow">${kind==='plan'?'PIANTINA E PRENOTAZIONI':'ELENCO PRENOTAZIONI'}</span><h1>${kind==='plan'?esc(serviceLabel(svc)):esc(heading)}</h1>${kind==='plan'?`<p class="sheet-room-name">${esc(heading)}</p>`:''}</div><div class="sheet-counter">${esc(sub)}</div></div>${content}<footer class="sheet-foot"><span>RISTORANTE OASI · ROCCABERNARDA</span><span>Uso interno · ${esc(dayLabel)}</span></footer></section>`;
 const printCSS=`
 *{box-sizing:border-box}html,body{margin:0;background:#fff;color:#29231c;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
 .sheet{width:100%;height:100%;padding:0;display:flex;flex-direction:column;page-break-after:always;break-after:page;overflow:hidden}
 .sheet:last-child{break-after:auto;page-break-after:auto}
 .sheet-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1.6px solid #b2946e;padding:0 0 3mm;margin:0 0 3mm;flex-shrink:0}
 .brand{font:normal 27pt Georgia,serif;line-height:.9}.brand .dot{color:#b2956c}.tagline{font-size:7.5pt;letter-spacing:2px;margin-top:2mm}
 .head-right{text-align:right;font-size:10pt;display:grid;gap:1mm}.head-right span{color:#8b7457;font-size:9pt}
 .sheet-title{display:flex;align-items:end;justify-content:space-between;margin:1mm 0 3mm;flex-shrink:0}.eyebrow{display:block;font-size:7pt;color:#9b7950;letter-spacing:2px;font-weight:700}.sheet-title h1{margin:1mm 0 0;font:normal 22pt Georgia,serif}
 .sheet-room-name{font:normal 13pt Arial,sans-serif;margin:1.5mm 0 0;color:#514334}
 .sheet-counter{font-size:9pt;color:#75624d;text-align:right;align-self:end;max-width:48%}
 .room-figure{display:flex;align-items:center;justify-content:center;flex:1 1 auto;min-height:0;overflow:hidden;width:100%;background:#fffdfa;padding:1mm}
 .room-svg{display:block;width:100%;height:100%;min-height:0;max-width:100%;max-height:100%}
 .print-group-key{display:flex;align-items:center;flex-wrap:wrap;gap:1.5mm 3mm;margin:2mm 0 1mm;font-size:8.4pt;color:#315a3b;flex:0 0 auto}
 .print-group-key>strong{font-size:8pt;text-transform:uppercase;letter-spacing:.06em;margin-right:1mm}
 .print-group-key span{display:inline-block;padding:1.3mm 2.5mm;border:1.4px solid #62866a;background:#e5efe6;border-radius:4px;white-space:nowrap}
 .print-group-key b,.booking-ref{font-weight:800;color:#245337}
 .booking-ref{display:inline-block;border:1px solid #76947c;border-radius:3px;padding:1px 5px;background:#e5efe6}
 .plan-bookings{flex:0 0 auto;margin-top:2mm;break-inside:avoid}
 .plan-bookings-title{display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid #decdb7;padding-top:2.5mm;font-size:9pt;font-weight:700;letter-spacing:.02em}
 .plan-bookings-title small{font-size:8pt;color:#816d57;font-weight:400}
 .plan .bookings{margin:2mm 0 0;font-size:9.2pt;table-layout:fixed}
 .plan .bookings th{font-size:8pt}
 .plan .bookings th,.plan .bookings td{padding:1.65mm 1.4mm;line-height:1.25;vertical-align:middle}.plan .bookings td strong{font-weight:700}.plan .bookings-party{font-weight:800}
 .plan .bookings th:nth-child(1){width:9%}.plan .bookings th:nth-child(2){width:11%}.plan .bookings th:nth-child(4){width:10%}.plan .bookings th:nth-child(5){width:16%}.plan .bookings th:nth-child(6){width:23%}
 .sheet-foot{border-top:1px solid #e7d9c6;display:flex;justify-content:space-between;padding-top:2mm;margin-top:3mm;flex-shrink:0;color:#8b7457;font-size:7pt;letter-spacing:1px}
 .bookings{width:100%;border-collapse:collapse;margin-top:4mm;font-size:11pt;table-layout:fixed}.bookings th,.bookings td{border-bottom:1px solid #dfd4c4;padding:3mm 2mm;text-align:left;overflow-wrap:anywhere}.bookings th{background:#f5efe6;font-size:9pt;color:#7b6244}.bookings th:nth-child(1){width:13%}.bookings th:nth-child(3){width:14%}.bookings th:nth-child(4){width:14%}.bookings th:nth-child(5){width:22%}
 @page {size:A4 portrait;margin:8mm}
 @media print{html,body{height:auto}.sheet.portrait{height:281mm}.sheet.landscape{height:194mm} .sheet{break-inside:avoid}}
 `;
 const generated=[];
 (async()=>{
  try{
   const [rooms,tables,zones,structures,links]=mode==='plan'?await Promise.all([api('admin/rooms'),api('admin/tables'),api('admin/room-zones'),api('admin/floor-elements'),api('admin/table-links')]):[[],[],[],[],[]];
   for(const svc of services){
    const items=booked.filter(r=>r.service===svc);
    if(mode==='list'){
     generated.push(buildPage(serviceLabel(svc),serviceLabel(svc),listTable(items),false,'list',svc));
     continue;
    }
    const roomIds=[...new Set(items.map(r=>Number(r.room_id)).filter(Boolean))];
    for(const room of rooms.filter(r=>roomIds.includes(Number(r.id)))){
     const {svg,portrait}=svgRoom(room,tables,zones,structures,items,links);
     const roomBookings=items.filter(r=>Number(r.room_id)===Number(room.id));
     const count=roomBookings.length, totalGuests=roomBookings.reduce((n,r)=>n+Number(r.party_size||0),0);
     const tableHeight=Math.max(24,Math.min(85,12+count*6.5));
     const groups=roomBookings.filter(r=>String(r.table_ids||'').split(',').filter(Boolean).length>1).sort((a,b)=>String(a.time).localeCompare(String(b.time))||Number(a.id)-Number(b.id));const ordered=[...roomBookings].sort((a,b)=>String(a.time).localeCompare(String(b.time))||Number(a.id)-Number(b.id));const groupKey=groups.length?`<div class="print-group-key"><strong>Tavoli uniti</strong>${groups.map(r=>`<span><b>P${ordered.indexOf(r)+1}</b> · ${r.source==='staff_banquet'?'Banchetto · ':''}${esc(r.table_codes||'')} · ${Number(r.party_size)} ospiti</span>`).join('')}</div>`:'';const content=`<div class="room-figure" style="max-height:calc(100% - ${tableHeight+(groups.length?12:0)}mm)">${svg}</div>${groupKey}<div class="plan-bookings"><div class="plan-bookings-title"><span>Elenco prenotazioni · ${esc(serviceLabel(svc))}</span><small>${count} prenotazioni · ${totalGuests} coperti</small></div>${listTable(roomBookings,true)}</div>`;
     generated.push(buildPage(room.name,`${count} prenotazioni · ${totalGuests} coperti`,content,!portrait,'plan',svc));
    }
   }
   if(!generated.length){msg('Non ci sono prenotazioni con tavoli assegnati per il servizio selezionato','error');return}
   // Finestra di stampa isolata: non eredita NESSUNA regola CSS dell'editor.
   const landscape=generated.every(p=>p.includes('class="sheet landscape'));
   const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';document.body.appendChild(frame);
   const doc=frame.contentDocument;
   doc.open();doc.write(`<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Oasi · ${esc(dayLabel)} · ${esc(selected==='all'?'Pranzo e cena':serviceLabel(selected))}</title><style>${printCSS.replace('@page {size:A4 portrait;margin:8mm}',`@page {size:A4 ${landscape?'landscape':'portrait'};margin:8mm}`)}</style></head><body>${generated.join('')}</body></html>`);doc.close();
   const cleanup=()=>{frame.remove();window.removeEventListener('afterprint',cleanup)};
   window.addEventListener('afterprint',cleanup,{once:true});
   frame.contentWindow.addEventListener('afterprint',cleanup,{once:true});
   frame.contentWindow.focus();frame.contentWindow.print();
   setTimeout(()=>{if(frame.isConnected)cleanup()},60000);
  }catch(err){msg('Errore nella preparazione della stampa: '+err.message,'error')}
 })();
}
async function openCustomerCard(id){
 try{
  const result=await api('admin/customer-history/'+Number(id));const c=result.customer,history=result.bookings||[],stats=result.stats||{};
  const wrap=document.createElement('div');wrap.className='phase2-drawer-wrap';
  const contact=oasiWhatsAppHref(c.phone,c.name);
  const statusName=r=>r.status==='cancelled'?'Annullata':r.visit_state==='no_show'?'Non presentato':r.visit_state==='finished'?'Terminato':r.visit_state==='seated'?'Al tavolo':r.visit_state==='arrived'?'Arrivato':'In attesa';
  wrap.innerHTML=`<button class="phase2-drawer-scrim" type="button" aria-label="Chiudi"></button><aside class="phase2-drawer" role="dialog" aria-modal="true" aria-label="Scheda cliente"><div class="phase2-row"><span class="eyebrow">SCHEDA CLIENTE</span><button type="button" class="mini phase2-close">✕ Chiudi</button></div><h2>${esc(c.name)}</h2><p>${esc(c.email)}</p><div class="customer-card-stats"><span><strong>${Number(stats.visits||0)}</strong> Visite effettive</span><span><strong>${Number(stats.bookings||0)}</strong> Prenotazioni</span><span><strong>${Number(stats.cancelled||0)}</strong> Annullate</span><span><strong>${Number(stats.no_shows||0)}</strong> Assenze</span></div><p class="customer-last-visit">Ultima visita: <strong>${esc(stats.last_visit||'Non registrata')}</strong></p><div class="customer-contact-links"><a class="mini" href="tel:${esc(String(c.phone).replace(/[^+0-9]/g,''))}">Chiama</a>${contact?`<a class="mini customer-wa" target="_blank" rel="noopener noreferrer" href="${esc(contact)}">WhatsApp</a>`:''}</div><form id="customer-card-form"><label>Nome<input name="name" value="${esc(c.name)}" required maxlength="120"></label><label>Telefono<input type="tel" name="phone" value="${esc(c.phone)}" required maxlength="40"></label><label>Email<input type="email" name="email" value="${esc(c.email)}" required maxlength="180"></label><label>Nota interna dello staff (non inserire dati sanitari)<textarea name="staff_note" rows="3" maxlength="500">${esc(c.staff_note||'')}</textarea></label><button class="btn btn-dark">Salva scheda</button></form><h3>Storico prenotazioni</h3><div class="phase2-history">${history.length?history.map(r=>`<div><strong>${esc(r.book_date)} · ${r.service==='lunch'?'Pranzo':'Cena'}</strong><span>${esc(r.time)} · ${Number(r.party_size)} persone · Tavoli ${esc(r.table_codes||'—')} · ${statusName(r)}</span><button type="button" class="mini" data-customer-book-date="${esc(r.book_date)}" data-customer-book-service="${esc(r.service)}">Apri in agenda</button></div>`).join(''):'<p>Nessuna prenotazione trovata.</p>'}</div></aside>`;
  document.body.append(wrap);document.body.classList.add('phase2-drawer-open');
  const close=()=>{wrap.remove();document.body.classList.remove('phase2-drawer-open');document.removeEventListener('keydown',onEscape)};
  const onEscape=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',onEscape);
  wrap.querySelector('.phase2-drawer-scrim').onclick=close;wrap.querySelector('.phase2-close').onclick=close;
  wrap.querySelectorAll('[data-customer-book-date]').forEach(btn=>btn.addEventListener('click',()=>{state.date=btn.dataset.customerBookDate;state.reservationService=btn.dataset.customerBookService;state.adminView='reservations';close();renderAdmin()}));
  wrap.querySelector('#customer-card-form').onsubmit=async e=>{e.preventDefault();try{await api('admin/customers/'+id,'PATCH',inputData(e.target));msg('Scheda salvata senza perdere lo storico');close();renderAdmin()}catch(error){msg(error.message,'error')}};
 }catch(error){msg(error.message,'error')}
}
function analyticsDownloadCsv(filename,headers,data){
 const quoted=value=>{const text=String(value??'');const protectedText=/^[\s\uFEFF]*[=+@\-\t\r]/.test(text)?"'"+text:text;return '"'+protectedText.replace(/"/g,'""')+'"'};
 const csv='\uFEFF'+[headers.map(quoted).join(';'),...data.map(row=>row.map(quoted).join(';'))].join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function bindAnalytics(){
 const form=document.querySelector('#analytics-filters');
 form?.addEventListener('submit',e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form).entries());const days=(Date.parse(data.end+'T00:00Z')-Date.parse(data.start+'T00:00Z'))/86400000;if(data.start>data.end||days>366){msg('Scegli un intervallo valido di massimo 367 giorni','error');return}state.analyticsRange=data;renderAdmin()});
 document.querySelector('#analytics-month')?.addEventListener('click',()=>{const end=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'});state.analyticsRange={...state.analyticsRange,start:end.slice(0,8)+'01',end};renderAdmin()});
 document.querySelector('#analytics-year')?.addEventListener('click',()=>{const end=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'});state.analyticsRange={...state.analyticsRange,start:end.slice(0,4)+'-01-01',end};renderAdmin()});
 document.querySelector('#analytics-csv')?.addEventListener('click',()=>{
  const rows=state.analyticsReport?.rows||[],fields=['book_date','service','time','room_name','name','phone','email','party_size','status','visit_state','source','table_codes'];
  analyticsDownloadCsv(`oasi-dettagli-${state.analyticsRange.start}-${state.analyticsRange.end}.csv`,fields,rows.map(r=>fields.map(k=>r[k])));
 });
 document.querySelector('#analytics-csv-summary')?.addEventListener('click',()=>{
  const rows=state.analyticsReport?.days||[];const keys=['date','bookings','covers','visits','visited_covers','cancelled','no_show'];
  analyticsDownloadCsv(`oasi-riepilogo-${state.analyticsRange.start}-${state.analyticsRange.end}.csv`,keys,rows.map(r=>keys.map(k=>r[k])));
 });
 document.querySelector('#analytics-print')?.addEventListener('click',()=>{
  const r=state.analyticsReport;if(!r)return;
  document.querySelector('.oasi-analytics-print')?.remove();
  const sheet=document.createElement('div');sheet.className='oasi-analytics-print';const label=state.analyticsRange.service==='all'?'Pranzo e cena':state.analyticsRange.service==='lunch'?'Pranzo':'Cena';
  const table=(headers,data)=>`<table><thead><tr>${headers.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${data.map(row=>`<tr>${row.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const k=r.summary;
  sheet.innerHTML=`<div class="oasi-analytics-print-head"><div><strong>L’OASI</strong><small>F.LLI FERA · REPORT GESTIONALE</small></div><div>${esc(r.range.start)} – ${esc(r.range.end)}<br>${esc(label)} · ${esc(r.room_options.find(v=>Number(v.id)===Number(r.range.room))?.name||'Tutte le sale')}</div></div><h1>Statistiche e report</h1><p>Report creato il ${new Date().toLocaleString('it-IT',{timeZone:'Europe/Rome'})}</p><div class="oasi-analytics-print-kpis">${[['Prenotazioni',k.bookings],['Coperti',k.covers],['Visite registrate',k.visits],['Coperti delle visite',k.visited_covers],['Annullamenti',k.cancelled],['Assenze',k.no_show]].map(([l,v])=>`<div><small>${l}</small><strong>${v}</strong></div>`).join('')}</div><h2>Servizi</h2>${table(['Servizio','Prenotazioni','Coperti','Visite'],[['Pranzo',r.services.lunch.bookings,r.services.lunch.covers,r.services.lunch.visits],['Cena',r.services.dinner.bookings,r.services.dinner.covers,r.services.dinner.visits]])}<h2>Sale</h2>${table(['Sala','Prenotazioni','Coperti'],r.rooms.map(v=>[v.name,v.bookings,v.covers]))}<h2>Riepilogo giornaliero</h2>${table(['Data','Prenotazioni','Coperti','Visite','Annullate','Assenze'],r.days.map(d=>[d.date,d.bookings,d.covers,d.visits,d.cancelled,d.no_show]))}<p class="oasi-analytics-disclaimer">I coperti delle visite sono stimati dal numero di ospiti prenotati. Nessun dato economico è disponibile. Report ad uso interno.</p>`;
  document.body.append(sheet);document.body.classList.add('oasi-analytics-printing');
  const cleanup=()=>{document.body.classList.remove('oasi-analytics-printing');sheet.remove();window.removeEventListener('afterprint',cleanup)};
  window.addEventListener('afterprint',cleanup,{once:true});window.print();setTimeout(()=>{if(sheet.isConnected)cleanup()},60000);
 });
}
function eventDrawer(row=null){
 const existing=document.querySelector('.event-drawer-backdrop');if(existing)existing.remove();
 const edit=!!row,rooms=state.rooms||[],e=row||{};
 const selectedRooms=String(e.room_ids||'').split(',').map(Number);
 const statuses=[['provisional','Opzionato'],['confirmed','Confermato'],['completed','Concluso'],['cancelled','Annullato']];
 const options=(vals,current)=>vals.map(([v,t])=>`<option value="${v}" ${String(current)===v?'selected':''}>${t}</option>`).join('');
 const day=state.date;
 const overlay=document.createElement('div');overlay.className='event-drawer-backdrop';
 overlay.innerHTML=`<aside class="event-drawer" role="dialog" aria-modal="true" aria-labelledby="event-form-title"><div class="event-drawer-head"><div><span class="eyebrow">RISTORANTE OASI</span><h2 id="event-form-title">${edit?'Modifica evento':'Nuovo evento'}</h2><p>Esclusivo per il personale del ristorante</p></div><button type="button" class="event-close" aria-label="Chiudi">×</button></div><form id="event-editor" class="event-editor"><label>Nome evento *<input name="title" required maxlength="150" value="${esc(e.title||'')}" placeholder="Es. Comunione famiglia Rossi"></label><div class="event-two"><label>Tipologia<select name="kind">${options([['Matrimonio','Matrimonio'],['Battesimo','Battesimo'],['Comunione','Comunione'],['Cresima','Cresima'],['Compleanno','Compleanno'],['Cena di gruppo','Cena di gruppo'],['Evento privato','Evento privato'],['Altro','Altro']],e.kind||'Evento privato')}</select></label><label>Stato<select name="status">${options(statuses,e.status||'confirmed')}</select></label></div><div class="event-two"><label>Data inizio *<input type="date" name="start_date" required value="${esc(e.start_date||day)}"></label><label>Data fine *<input type="date" name="end_date" required value="${esc(e.end_date||day)}"></label></div><div class="event-two"><label>Servizio<select name="service">${options([['lunch','Pranzo'],['dinner','Cena'],['both','Pranzo e cena']],e.service||'lunch')}</select></label><label>Invitati previsti<input type="number" min="0" max="2000" name="guests" value="${Number(e.guests||0)}"></label></div><fieldset class="event-room-choices"><legend>Sale occupate * — seleziona una o più sale</legend>${rooms.map(r=>`<label class="event-room-option"><input type="checkbox" name="room_ids" value="${Number(r.id)}" ${selectedRooms.includes(Number(r.id))?'checked':''}><span>${esc(r.name)}</span></label>`).join('')}</fieldset><div class="event-two"><label>Referente *<input name="contact_name" required maxlength="120" value="${esc(e.contact_name||'')}"></label><label>Telefono *<input name="phone" type="tel" required maxlength="40" value="${esc(e.phone||'')}"></label></div><label>Email referente (facoltativa)<input name="email" type="email" maxlength="180" value="${esc(e.email||'')}"></label><div class="event-two"><label>Preventivo totale (€)<input type="number" name="estimated_total" min="0" step="0.01" value="${(Number(e.estimated_cents||0)/100).toFixed(2)}"></label><label>Acconto (€)<input type="number" name="deposit" min="0" step="0.01" value="${(Number(e.deposit_cents||0)/100).toFixed(2)}"></label></div><label>Note organizzative interne<textarea name="notes" rows="4" maxlength="3000" placeholder="Menù, allestimento, esigenze organizzative, saldo...">${esc(e.notes||'')}</textarea></label><p class="event-warning">Attenzione: prenotare una sala per un evento la rende indisponibile per nuove prenotazioni durante i servizi selezionati. Se ci sono già prenotazioni confermate, l'evento non potrà essere salvato finché non vengono gestite.</p><div class="event-form-actions"><button class="btn btn-dark" type="submit">${edit?'Salva modifiche':'Crea evento e blocca sale'}</button><button type="button" class="btn btn-outline event-close">Annulla</button></div></form></aside>`;
 document.body.append(overlay);
 const close=()=>overlay.remove();overlay.addEventListener('click',x=>{if(x.target===overlay||x.target.closest('.event-close'))close()});
 const form=overlay.querySelector('form');form.addEventListener('submit',async x=>{x.preventDefault();const submit=form.querySelector('[type="submit"]');const f=new FormData(form);const room_ids=f.getAll('room_ids').map(Number);
 if(!room_ids.length){msg('Seleziona almeno una sala','error');return}
 const payload={title:f.get('title'),kind:f.get('kind'),status:f.get('status'),start_date:f.get('start_date'),end_date:f.get('end_date'),service:f.get('service'),guests:Number(f.get('guests')||0),room_ids,contact_name:f.get('contact_name'),phone:f.get('phone'),email:f.get('email'),estimated_total:Number(f.get('estimated_total')||0),deposit:Number(f.get('deposit')||0),notes:f.get('notes')};
 if(payload.end_date<payload.start_date){msg('La data finale non può precedere quella iniziale','error');return}
 submit.disabled=true;try{await api(edit?'admin/events/'+encodeURIComponent(row.id):'admin/events',edit?'PUT':'POST',payload);close();state.eventRange={start:payload.start_date,end:''};msg(edit?'Evento aggiornato':'Evento creato e sale riservate');renderAdmin()}catch(err){msg(err.message,'error');submit.disabled=false}
 });
 overlay.querySelector('[name="title"]')?.focus();
}
function bindEvents(){
 document.querySelector('#event-create')?.addEventListener('click',()=>eventDrawer());
 document.querySelectorAll('[data-event-edit]').forEach(btn=>btn.addEventListener('click',()=>{const e=state.privateEvents.find(x=>x.id===btn.dataset.eventEdit);if(e)eventDrawer(e)}));
 document.querySelectorAll('[data-event-cancel]').forEach(btn=>btn.addEventListener('click',async()=>{const e=state.privateEvents.find(x=>x.id===btn.dataset.eventCancel);if(!e||!confirm(`Annullare l'evento «${e.title}» e rendere nuovamente disponibili le sale?`))return;try{await api('admin/events/'+encodeURIComponent(e.id),'DELETE',{});msg('Evento annullato: sale liberate');renderAdmin()}catch(err){msg(err.message,'error')}}));
 document.querySelector('#event-filter')?.addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.target);state.eventRange={start:String(data.get('start')||''),end:String(data.get('end')||'')};renderAdmin()});
 document.querySelector('#event-all')?.addEventListener('click',()=>{state.eventRange={start:'',end:''};renderAdmin()});
}
// Consiglio operativo, solo per il personale: non prenota e non modifica la piantina.
// Le unioni sono consentite solo attraverso collegamenti configurati in piantina.
const oasiConnectedTableIds=(ids,links)=>{
 if(ids.length<=1)return true;
 const allowed=new Set(ids.map(Number)),visited=new Set([Number(ids[0])]);
 let progress=true;
 while(progress){
  progress=false;
  for(const link of links||[]){
   const a=Number(link.table_a),b=Number(link.table_b);
   if(!allowed.has(a)||!allowed.has(b))continue;
   if(visited.has(a)&&!visited.has(b)){visited.add(b);progress=true}
   else if(visited.has(b)&&!visited.has(a)){visited.add(a);progress=true}
  }
 }
 return visited.size===allowed.size;
};
// In Oasi i tavoli si uniscono per colonna: niente collegamenti laterali o diagonali.
const oasiNearbyTable=(a,b)=>{
 const fields=[a.x,a.y,a.w,a.h,b.x,b.y,b.w,b.h].map(Number);
 if(!fields.every(Number.isFinite)||fields[2]<=0||fields[3]<=0||fields[6]<=0||fields[7]<=0)return false;
 const [ax,ay,aw,ah,bx,by,bw,bh]=fields;
 const horizontalOverlap=Math.min(ax+aw,bx+bw)-Math.max(ax,bx);
 const gap=Math.max(0,ay-(by+bh),by-(ay+ah));
 const overlapY=Math.min(ay+ah,by+bh)-Math.max(ay,by);
 return Math.abs(ax+aw/2-(bx+bw/2))<=Math.max(28,Math.min(aw,bw)*0.45)
  &&horizontalOverlap>=Math.min(aw,bw)*0.45
  &&overlapY<=0&&gap<=90
  &&Math.abs(ay+ah/2-(by+bh/2))>=Math.min(ah,bh)*0.55;
};
const oasiLinkedComponent=(start,availableIds,links)=>{
 const allowed=new Set(availableIds.map(Number)),seen=new Set([Number(start)]);
 let changed=true;
 while(changed){
  changed=false;
  for(const l of links||[]){
   const a=Number(l.table_a),b=Number(l.table_b);
   if(!allowed.has(a)||!allowed.has(b))continue;
   if(seen.has(a)&&!seen.has(b)){seen.add(b);changed=true}
   else if(seen.has(b)&&!seen.has(a)){seen.add(a);changed=true}
  }
 }
 return seen;
};
const oasiRecommendStaffTables=(tables,party,links=[])=>{
 if(!Number.isSafeInteger(party)||party<1||party>200)return [];
 const rooms=new Map();
 for(const t of tables){
  const id=Number(t.id),room=Number(t.room_id),min=Number(t.min_seats||1),max=Number(t.seats);
  if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(room)||!Number.isInteger(min)||!Number.isInteger(max)||min<1||max<min||min>party)continue;
  if(!rooms.has(room))rooms.set(room,[]);
  rooms.get(room).push({id,min,max,x:t.x,y:t.y,w:t.w,h:t.h});
 }
 let best=null,bestScore=null;
 for(const [room,arr] of rooms){
  const byId=new Map(arr.map(t=>[t.id,t])),adj=new Map(arr.map(t=>[t.id,new Set()]));
  for(const l of links){
   const a=Number(l.table_a),b=Number(l.table_b);
   if(byId.has(a)&&byId.has(b)&&oasiNearbyTable(byId.get(a),byId.get(b))){adj.get(a).add(b);adj.get(b).add(a)}
  }
  const seen=new Set();let explored=0;
  for(const root of arr){
   const queue=[{ids:[root.id],min:root.min,max:root.max}];
   while(queue.length&&explored<15000){
    const option=queue.shift();explored++;
    const key=[...option.ids].sort((a,b)=>a-b).join(',');
    if(seen.has(key))continue;seen.add(key);
    if(option.min<=party&&option.max>=party){
     const score=[option.ids.length,option.max-party,party-option.min,room,...[...option.ids].sort((a,b)=>a-b)];
     const different=bestScore?score.findIndex((n,i)=>n!==bestScore[i]):-1;
     if(!bestScore||(different>=0&&score[different]<bestScore[different])){bestScore=score;best=[...option.ids]}
    }
    if(option.ids.length>=8||option.min>=party)continue;
    const neighbors=new Set(option.ids.flatMap(id=>[...adj.get(id)||[]]));
    for(const id of neighbors){
     if(option.ids.includes(id))continue;
     const t=byId.get(id);
     if(option.min+t.min>party)continue;
     queue.push({ids:[...option.ids,id],min:option.min+t.min,max:option.max+t.max});
    }
   }
  }
 }
 return best?best.sort((a,b)=>a-b):[];
};
// Proposta non vincolante per i banchetti: gruppi anche separati nella stessa sala.
// L'operatore mantiene la scelta finale; il server verifica sempre la disponibilità.
const oasiRecommendBanquetTables=(tables,party,links=[])=>{
 if(!Number.isInteger(party)||party<1||party>200)return [];
 const eligible=tables.filter(t=>Number(t.enabled)!==0&&Number(t.seats)>0&&Number(t.min_seats||1)<=party);
 const rooms=[...new Set(eligible.map(t=>Number(t.room_id)))].filter(Number.isSafeInteger);
 let best=null,bestScore=null;
 for(const room of rooms){
  const arr=eligible.filter(t=>Number(t.room_id)===room);
  const trials=[
   [...arr].sort((a,b)=>Number(b.seats)-Number(a.seats)||Number(a.id)-Number(b.id)),
   [...arr].sort((a,b)=>Number(a.seats)-Number(b.seats)||Number(a.id)-Number(b.id)),
   [...arr].sort((a,b)=>Math.abs(Number(a.seats)-party)-Math.abs(Number(b.seats)-party))
  ];
  for(const ordered of trials){
   for(const root of ordered){
    const remaining=ordered.filter(t=>Number(t.id)!==Number(root.id));
    const picked=[root];let min=Number(root.min_seats||1),max=Number(root.seats);
    while(max<party&&picked.length<20){
     const choices=remaining.filter(t=>min+Number(t.min_seats||1)<=party);
     if(!choices.length)break;
     choices.sort((a,b)=>{
      const adjacent=t=>picked.some(p=>links.some(l=>(Number(l.table_a)===Number(p.id)&&Number(l.table_b)===Number(t.id))||(Number(l.table_b)===Number(p.id)&&Number(l.table_a)===Number(t.id))));
      const connectedA=adjacent(a)?1:0,connectedB=adjacent(b)?1:0;
      const capacityA=Number(a.seats),capacityB=Number(b.seats);
      const surplusA=Math.max(0,max+capacityA-party),surplusB=Math.max(0,max+capacityB-party);
      const finishA=max+capacityA>=party,finishB=max+capacityB>=party;
      if(finishA!==finishB)return finishA?-1:1;
      if(finishA&&surplusA!==surplusB)return surplusA-surplusB;
      if(!finishA&&capacityA!==capacityB)return capacityB-capacityA;
      return connectedB-connectedA||Number(a.id)-Number(b.id);
     });
     const chosen=choices[0];picked.push(chosen);remaining.splice(remaining.indexOf(chosen),1);
     min+=Number(chosen.min_seats||1);max+=Number(chosen.seats);
    }
    if(min>party||max<party)continue;
    const score=[picked.length,max-party,party-min,room];
    const differing=bestScore?score.findIndex((v,i)=>v!==bestScore[i]):-1;
    if(!bestScore||(differing>=0&&score[differing]<bestScore[differing])){bestScore=score;best=picked.map(t=>Number(t.id))}
   }
  }
 }
 return best||[];
};
function openEditBookingDrawer(row){if(row)openNewBookingDrawer(null,row)}
function openNewBookingDrawer(_event=null,editing=null){
 const banquet=!!_event?.banquet;
 // One drawer for the ADMIN agenda and the global quick-create shortcut.
 const old=document.querySelector('.oasi-booking-drawer-layer');
 if(old){old.querySelector('.oasi-booking-drawer-close')?.click();if(old.isConnected)return;}
 const layer=document.createElement('div');layer.className='oasi-booking-drawer-layer';
 const startService=editing?editing.service:(banquet?(state.adminView==='reservations'&&state.reservationService!=='all'?state.reservationService:state.opsService||oasiItalianService()):(state.reservationService==='all'?oasiItalianService():state.reservationService));
 layer.innerHTML=`<button type="button" class="oasi-booking-drawer-shade" aria-label="Chiudi nuova prenotazione"></button>
 <aside class="oasi-booking-drawer" role="dialog" aria-modal="true" aria-labelledby="oasi-new-book-title" tabindex="-1">
  <header class="oasi-booking-drawer-header"><div><span class="eyebrow">RISTORANTE OASI · ADMIN</span><h2 id="oasi-new-book-title">${editing?(editing.source==='staff_banquet'?'Modifica banchetto #':'Modifica prenotazione #')+Number(editing.id):banquet?'Nuovo banchetto condiviso':'Nuova prenotazione'}</h2><p>${editing?'Modifica tutti i dati e scegli i tavoli disponibili.':banquet?'Riserva soltanto i tavoli del banchetto: gli altri rimangono prenotabili.':'Inserisci una prenotazione telefonica. Il tavolo viene assegnato in base alla disponibilità.'}</p></div><button class="oasi-booking-drawer-close" type="button" aria-label="Chiudi pannello">×</button></header>
  <form id="oasi-booking-drawer-form" class="oasi-booking-drawer-form">
   <div class="oasi-booking-drawer-fields"><div class="oasi-booking-drawer-pair"><label>Data *<input name="date" type="date" value="${esc(state.date)}" required></label><label>Servizio *<select name="service"><option value="lunch" ${startService==='lunch'?'selected':''}>Pranzo</option><option value="dinner" ${startService==='dinner'?'selected':''}>Cena</option></select></label></div>
   <div class="oasi-booking-drawer-pair"><label>Ora di arrivo *<input name="time" type="time" required value="${startService==='lunch'?'12:30':'19:30'}"></label><label>Persone *<input name="party_size" type="number" min="1" max="200" required value="${banquet?12:2}"></label></div>
   <label>Telefono *<input name="phone" type="tel" required maxlength="40" autocomplete="tel" inputmode="tel" placeholder="Numero di telefono"></label>
   <label>Nome cliente *<input name="name" required maxlength="120" autocomplete="name" placeholder="Nome e cognome"></label>
   <label>Email *<input name="email" type="email" required maxlength="180" autocomplete="email" placeholder="nome@esempio.it"></label>
   ${banquet&&!editing?`<section class="oasi-banquet-tables"><h3>Tavoli del banchetto</h3><p>Seleziona fino a 20 tavoli: puoi riservare più gruppi verticali separati (es. 4 + 2 e 3 + 5 + 6). Gli altri tavoli restano prenotabili.</p><label>Sala<select id="oasi-banquet-room"></select></label><div id="oasi-banquet-list" aria-live="polite"></div><p id="oasi-banquet-capacity" aria-live="polite"></p><div class="oasi-banquet-actions"><button class="mini" type="button" id="oasi-banquet-suggest">Suggerisci tavoli</button><button class="mini" type="button" id="oasi-banquet-clear">Deseleziona tutti</button><button class="mini" type="button" id="oasi-banquet-refresh">Aggiorna disponibilità</button></div></section>`:editing?`<section class="oasi-edit-tables"><h3>Assegnazione tavoli</h3><label>Sala<select name="edit_room"></select></label><div id="oasi-edit-table-list" aria-live="polite"></div><div class="oasi-edit-recommend-tools"><button type="button" class="mini" id="oasi-edit-recommend">Suggerisci tavoli</button><button type="button" class="mini" id="oasi-edit-refresh">Aggiorna disponibilità</button></div><p id="oasi-edit-capacity" aria-live="polite"></p></section>`:`<section class="oasi-quick-suggestion"><h3>Assegnazione intelligente</h3><label>Scelta tavolo<select name="suggested_table"><option value="">Automatica · miglior tavolo disponibile</option></select></label><p id="oasi-suggestion-hint" role="status" aria-live="polite">Ricerca dei tavoli disponibili…</p><div class="oasi-large-party" id="oasi-large-party" hidden><p><strong>Gruppo oltre 9 persone</strong> · Seleziona una combinazione di tavoli collegati. Nessuna unione verrà effettuata senza la tua conferma.</p><label class="oasi-large-party-confirm"><input type="checkbox" id="oasi-join-confirm"> Confermo di voler unire i tavoli selezionati per questa prenotazione</label></div></section>`}
   <label>Note (facoltative)<textarea name="notes" rows="3" placeholder="Richieste particolari..."></textarea></label>
   <p class="oasi-booking-drawer-hint">Se il cliente è già registrato, selezionalo dai suggerimenti. Eventi privati, blocchi e tavoli occupati vengono verificati al salvataggio.</p></div>
   <footer class="oasi-booking-drawer-actions"><button type="button" class="btn btn-outline oasi-booking-drawer-cancel">Annulla</button><button type="submit" class="btn btn-dark oasi-booking-drawer-submit">${editing?'Salva modifiche':'Registra prenotazione'}</button></footer>
  </form>
 </aside>`;
 document.body.appendChild(layer);
 document.body.classList.add('oasi-booking-drawer-open');
 const panel=layer.querySelector('.oasi-booking-drawer'),form=layer.querySelector('form'),submit=layer.querySelector('.oasi-booking-drawer-submit');
 const focusBefore=document.activeElement;
 let saving=false;
 const onKey=e=>{
  if(e.key==='Escape'&&!saving){e.preventDefault();close()}
  if(e.key==='Tab'){
   const els=[...panel.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')].filter(el=>el.getClientRects().length);
   if(!els.length)return;
   if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els[els.length-1].focus()}
   else if(!e.shiftKey&&document.activeElement===els[els.length-1]){e.preventDefault();els[0].focus()}
  }
 };
 function close(){if(saving)return;document.removeEventListener('keydown',onKey);layer.remove();document.body.classList.remove('oasi-booking-drawer-open');if(focusBefore?.isConnected)focusBefore.focus()}
 layer.querySelector('.oasi-booking-drawer-shade').onclick=close;
 layer.querySelector('.oasi-booking-drawer-close').onclick=close;
 layer.querySelector('.oasi-booking-drawer-cancel').onclick=close;
 document.addEventListener('keydown',onKey);
 if(banquet&&!editing)form.elements.notes.value='Banchetto con sala condivisa. Riservare solo i tavoli assegnati.';
 const serviceInput=form.elements.service,timeInput=form.elements.time;
 serviceInput.addEventListener('change',()=>{const prev=timeInput.value;if(['12:30','19:30'].includes(prev))timeInput.value=serviceInput.value==='lunch'?'12:30':'19:30'});
 let selectedTables=[],available=[],freeTables=[],tableLinks=[],loading=false,loadVersion=0,expected=null;
 if(editing){
  for(const k of ['time','party_size','name','phone','email','notes'])form.elements[k].value=editing[k]??'';
  form.elements.date.value=editing.book_date;
  selectedTables=String(editing.table_ids||'').split(',').filter(Boolean).map(Number).sort((a,b)=>a-b);
  expected={...Object.fromEntries(['book_date','service','time','party_size','name','phone','email','notes','room_id','status'].map(k=>[k,editing[k]])),table_ids:[...selectedTables]};
  const room=form.elements.edit_room,list=form.querySelector('#oasi-edit-table-list'),capacity=form.querySelector('#oasi-edit-capacity');
  const update=()=>{const picked=available.filter(t=>selectedTables.includes(Number(t.id)));const min=picked.reduce((n,t)=>n+Number(t.min_seats||1),0),max=picked.reduce((n,t)=>n+Number(t.seats),0),party=Number(form.elements.party_size.value);const connected=editing.source==='staff_banquet'||oasiConnectedTableIds(selectedTables,tableLinks);const upstairs=Number(room.value)===2&&selectedTables.length===0&&editing.source!=='staff_banquet';const valid=!loading&&(upstairs&&Number.isInteger(party)&&party>0||picked.length===selectedTables.length&&picked.length>0&&picked.length<=(editing.source==='staff_banquet'?20:8)&&party>=min&&party<=max&&connected);capacity.textContent=upstairs?'Primo piano · Nessuna piantina necessaria. La capienza viene controllata dal sistema.':picked.length?`Capienza ${min}–${max} persone · ${picked.length} tavoli selezionati` :'Seleziona almeno un tavolo disponibile';if(picked.length>1&&!connected)capacity.textContent='I tavoli devono essere collegati in verticale. Seleziona una catena valida.';if(picked.length>0&&party<min||picked.length>0&&party>max)capacity.textContent=`Capienza richiesta: ${party} persone. Tavoli scelti: ${min}–${max} posti.`;submit.disabled=saving||!valid;return valid};
  // Tutti i tavoli liberi restano selezionabili: la capienza si valida sul gruppo,
  // non si nascondono tavoli grandi o piccoli prima della selezione.
  const refreshCapacity=()=>{available=freeTables;selectedTables=selectedTables.filter(id=>available.some(t=>Number(t.id)===id&&Number(t.room_id)===Number(room.value)));paint()};
  const paint=()=>{const tables=available.filter(t=>Number(t.room_id)===Number(room.value)).sort((a,b)=>String(a.code).localeCompare(String(b.code),'it',{numeric:true}));list.innerHTML=tables.length?tables.map(t=>`<label class="oasi-edit-table"><input type="checkbox" value="${Number(t.id)}" ${selectedTables.includes(Number(t.id))?'checked':''}><span><strong>Tavolo ${esc(t.code)}</strong> · ${Number(t.min_seats||1)}–${Number(t.seats)} posti</span></label>`).join(''):Number(room.value)===2?'<p>Primo piano: puoi registrare questa prenotazione senza assegnare tavoli. Il limite di coperti viene controllato dall’ADMIN.</p>':'<p>Nessun tavolo libero per questo servizio nella sala selezionata.</p>';update()};
  const load=async()=>{const version=++loadVersion;loading=true;submit.disabled=true;list.textContent='Verifica disponibilità…';try{const data=await api('admin/operations?date='+encodeURIComponent(form.elements.date.value)+'&service='+encodeURIComponent(form.elements.service.value));if(version!==loadVersion||!layer.isConnected)return;const busy=new Set(data.reservations.filter(r=>r.status==='confirmed'&&Number(r.id)!==Number(editing.id)).flatMap(r=>String(r.table_ids||'').split(',').filter(Boolean).map(Number)));const blocks=data.blocks;tableLinks=(data.links||[]).filter(l=>{const a=data.tables.find(t=>Number(t.id)===Number(l.table_a)),b=data.tables.find(t=>Number(t.id)===Number(l.table_b));return a&&b&&oasiNearbyTable(a,b)});const rooms=data.rooms.filter(r=>Number(r.internal_enabled)&&!blocks.some(b=>b.scope==='service'||(b.scope==='room'&&Number(b.target_id)===Number(r.id))));const prev=room.value||String(editing.room_id);freeTables=data.tables.filter(t=>Number(t.enabled)&&rooms.some(r=>Number(r.id)===Number(t.room_id))&&!busy.has(Number(t.id))&&!blocks.some(b=>b.scope==='table'&&Number(b.target_id)===Number(t.id)));available=freeTables;room.innerHTML=rooms.map(r=>`<option value="${Number(r.id)}">${esc(r.name)}</option>`).join('');if(rooms.some(r=>String(r.id)===prev))room.value=prev;selectedTables=selectedTables.filter(id=>available.some(t=>Number(t.id)===id&&Number(t.room_id)===Number(room.value)));loading=false;paint()}catch(e){if(version!==loadVersion)return;available=[];freeTables=[];loading=false;list.textContent=e.message;update()}};
  form.querySelector('#oasi-edit-recommend').onclick=()=>{
   if(loading)return;
   const party=Number(form.elements.party_size.value),pool=available.filter(t=>Number(t.room_id)===Number(room.value));
   let suggested=oasiRecommendStaffTables(pool,party,tableLinks);
   if(!suggested.length){
    const acrossRooms=oasiRecommendStaffTables(available,party,tableLinks);
    if(acrossRooms.length){
     const target=available.find(t=>Number(t.id)===Number(acrossRooms[0]));
     if(target){room.value=String(target.room_id);suggested=acrossRooms;}
    }
   }
   if(!suggested.length){msg('Nessuna combinazione in verticale compatibile: verifica i collegamenti e le disponibilità.','error');return}
   selectedTables=suggested;paint();msg('Combinazione proposta. Controlla e salva per confermare.');
  };
  room.onchange=()=>{selectedTables=[];paint()};list.onchange=e=>{if(e.target.type!=='checkbox')return;const id=Number(e.target.value);selectedTables=e.target.checked?[...selectedTables,id]:selectedTables.filter(x=>x!==id);update()};form.elements.party_size.addEventListener('input',refreshCapacity);form.elements.date.addEventListener('change',load);serviceInput.addEventListener('change',load);form.querySelector('#oasi-edit-refresh').onclick=load;load();
 }
 if(!editing&&!banquet){
  const suggestionSelect=form.elements.suggested_table,hint=form.querySelector('#oasi-suggestion-hint');
  let suggestionVersion=0,suggestedOptions=[],suggestionTimer;const largePanel=form.querySelector('#oasi-large-party'),largeCheck=form.querySelector('#oasi-join-confirm');
  const updateLargeParty=()=>{const large=Number(form.elements.party_size.value)>9;largePanel.hidden=!large;if(!large){largeCheck.checked=false;submit.disabled=false}else submit.disabled=!largeCheck.checked||suggestionSelect.value==='';};
  largeCheck.addEventListener('change',updateLargeParty);
  const refreshSuggestions=async()=>{
   const version=++suggestionVersion;
   suggestionSelect.replaceChildren(new Option('Automatica · miglior tavolo disponibile',''));
   suggestedOptions=[];updateLargeParty();
   const date=form.elements.date.value,service=form.elements.service.value,party=Number(form.elements.party_size.value);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(party)||party<1||party>200){hint.textContent='Seleziona una data e un numero di persone validi.';return}
   hint.textContent='Verifica tavoli disponibili…';
   try{
    const q=new URLSearchParams({date,service,party_size:String(party)});
    const result=await api('admin/suggestions?'+q);
    if(version!==suggestionVersion||!layer.isConnected)return;
    suggestedOptions=result.options||[];
    suggestedOptions.forEach((o,i)=>suggestionSelect.add(new Option((i===0?'Consigliato · ':'')+'Tavolo '+o.code+' · '+o.room_name+' · '+o.capacity+' posti',String(i))));
    hint.textContent=suggestedOptions.length?'Consigliato: '+suggestedOptions[0].code+' ('+suggestedOptions[0].room_name+'). Seleziona la combinazione desiderata.':'Nessuna combinazione disponibile. Da Servizio e sala, apri un tavolo e usa «Collega tavoli adiacenti», poi riprova.';updateLargeParty();
   }catch(e){if(version===suggestionVersion){hint.textContent='Suggerimenti non disponibili: il salvataggio verificherà comunque i tavoli.'}}
  };
  const scheduleSuggestions=()=>{clearTimeout(suggestionTimer);suggestionSelect.replaceChildren(new Option('Automatica · miglior tavolo disponibile',''));suggestedOptions=[];hint.textContent='Aggiornamento disponibilità…';updateLargeParty();suggestionTimer=setTimeout(refreshSuggestions,220)};
  form.elements.date.addEventListener('change',scheduleSuggestions);
  form.elements.service.addEventListener('change',scheduleSuggestions);
  form.elements.party_size.addEventListener('input',scheduleSuggestions);
  form.dataset.suggestedSelection='automatic';
  suggestionSelect.addEventListener('change',()=>{form.dataset.suggestedSelection=suggestionSelect.value===''?'automatic':'manual';updateLargeParty()});
  form._oasiSelectedRecommendation=()=>suggestionSelect.value===''?null:suggestedOptions[Number(suggestionSelect.value)]||null;
  form._oasiLargeValid=()=>Number(form.elements.party_size.value)<=9||(largeCheck.checked&&!!form._oasiSelectedRecommendation());
  refreshSuggestions();
 }
 if(banquet&&!editing){
  const roomEl=form.querySelector('#oasi-banquet-room'),list=form.querySelector('#oasi-banquet-list'),capacity=form.querySelector('#oasi-banquet-capacity');
  let tables=[],chosen=new Set(),banquetLinks=[],loading=false,version=0;
  const check=()=>{
   const selected=tables.filter(t=>chosen.has(Number(t.id))&&Number(t.room_id)===Number(roomEl.value));
   const min=selected.reduce((sum,t)=>sum+Number(t.min_seats||1),0),max=selected.reduce((sum,t)=>sum+Number(t.seats||0),0);
   const party=Number(form.elements.party_size.value);
   const valid=!loading&&selected.length>0&&selected.length<=20&&Number.isInteger(party)&&party>=min&&party<=max;
   const ids=selected.map(t=>Number(t.id)),remaining=new Set(ids),groups=[];
   const validLinks=banquetLinks.filter(l=>{const a=selected.find(t=>Number(t.id)===Number(l.table_a)),b=selected.find(t=>Number(t.id)===Number(l.table_b));return a&&b&&oasiNearbyTable(a,b)});
   while(remaining.size){const root=remaining.values().next().value;const component=oasiLinkedComponent(root,ids,validLinks);const group=selected.filter(t=>component.has(Number(t.id))).map(t=>t.code);groups.push(group.join(' + '));for(const id of component)remaining.delete(id)}
   capacity.textContent=selected.length?selected.length+' tavoli selezionati · '+min+'–'+max+' posti. '+(valid?'Capienza compatibile.':'Numero di ospiti non compatibile o limite di 20 tavoli superato.')+' Gruppi: '+groups.join(' | '):'Seleziona i tavoli da riservare al banchetto.';
   submit.disabled=saving||!valid;
   return {valid,selected};
  };
  const paint=()=>{
   const available=tables.filter(t=>Number(t.room_id)===Number(roomEl.value)).sort((a,b)=>String(a.code).localeCompare(String(b.code),'it',{numeric:true}));
   list.innerHTML=available.length?available.map(t=>'<label class="oasi-banquet-table"><input type="checkbox" value="'+Number(t.id)+'" '+(chosen.has(Number(t.id))?'checked':'')+'><span><strong>Tavolo '+esc(t.code)+'</strong> · '+Number(t.min_seats||1)+'–'+Number(t.seats)+' posti</span></label>').join(''):'<p>Nessun tavolo libero in questa sala per il servizio selezionato.</p>';
   check();
  };
  const load=async()=>{
   const sequence=++version;loading=true;submit.disabled=true;list.textContent='Verifica disponibilità…';
   try{
    const result=await api('admin/operations?'+new URLSearchParams({date:form.elements.date.value,service:form.elements.service.value}));
    if(sequence!==version||!layer.isConnected)return;
    const busy=new Set((result.reservations||[]).filter(r=>r.status==='confirmed').flatMap(r=>String(r.table_ids||'').split(',').map(Number)));
    const closed=new Set((result.blocks||[]).filter(b=>b.scope==='table').map(b=>Number(b.target_id)));
    const rooms=(result.rooms||[]).filter(r=>Number(r.internal_enabled)&&!(result.blocks||[]).some(b=>b.scope==='service'||(b.scope==='room'&&Number(b.target_id)===Number(r.id))));
    const prior=roomEl.value;
    roomEl.innerHTML=rooms.map(r=>'<option value="'+Number(r.id)+'">'+esc(r.name)+'</option>').join('');
    if(rooms.some(r=>String(r.id)===prior))roomEl.value=prior;
    banquetLinks=result.links||[];
    tables=(result.tables||[]).filter(t=>Number(t.enabled)&&rooms.some(r=>Number(r.id)===Number(t.room_id))&&!busy.has(Number(t.id))&&!closed.has(Number(t.id)));
    chosen=new Set([...chosen].filter(id=>tables.some(t=>Number(t.id)===id&&Number(t.room_id)===Number(roomEl.value))));
    loading=false;paint();
   }catch(err){if(sequence!==version)return;loading=false;tables=[];chosen.clear();list.textContent=err.message;check();}
  };
  roomEl.addEventListener('change',()=>{chosen.clear();paint()});
  list.addEventListener('change',e=>{if(!e.target.matches('input[type="checkbox"]'))return;const id=Number(e.target.value);if(e.target.checked)chosen.add(id);else chosen.delete(id);check()});
  form.elements.party_size.addEventListener('input',check);
  form.elements.date.addEventListener('change',load);
  form.elements.service.addEventListener('change',load);
  form.querySelector('#oasi-banquet-refresh').addEventListener('click',load);
  form.querySelector('#oasi-banquet-clear').addEventListener('click',()=>{chosen.clear();paint()});
  form.querySelector('#oasi-banquet-suggest').addEventListener('click',()=>{
   if(loading)return;
   const party=Number(form.elements.party_size.value),available=tables.filter(t=>Number(t.room_id)===Number(roomEl.value));
   const ids=oasiRecommendBanquetTables(available,party,banquetLinks);
   if(!ids.length){msg('Non ci sono tavoli liberi con capienza sufficiente in questa sala.','error');return}
   chosen=new Set(ids);paint();msg('Proposta pronta. Verifica i tavoli e salva per confermare.');
  });
  form._oasiBanquetSelection=()=>{const selected=check();return selected.valid?{table_ids:selected.selected.map(t=>Number(t.id)),room_id:Number(roomEl.value)}:null};
  load();
 }
 customerAutocomplete(form);
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(saving||submit.disabled)return;
  if(!editing&&!banquet&&!form._oasiLargeValid?.()){msg('Per gruppi oltre 9 persone scegli i tavoli collegati e conferma l’unione.','error');return}
  saving=true;submit.disabled=true;submit.textContent='Salvataggio...';
  let created=null;
  try{
   const payload=inputData(form);
   if(!editing){delete payload.suggested_table;delete payload.join_tables;const selection=banquet?form._oasiBanquetSelection?.():form._oasiSelectedRecommendation?.();if(banquet&&!selection)throw Error('Seleziona tavoli liberi con capienza compatibile per il banchetto.');if(selection){payload.room_id=selection.room_id;payload.table_ids=selection.table_ids}if(banquet)payload.banquet_shared=true;}
   if(editing)payload.room_id=Number(form.elements.edit_room.value);created=editing?await api('admin/reservations/'+editing.id,'PATCH',{...payload,action:'edit_full',table_ids:selectedTables,expected}):await api('admin/reservations','POST',payload);
   state.date=payload.date;state.reservationService='all';state.agendaManualSelection=payload.date!==oasiItalianToday();if(editing){state.adminView='reservations';}
   const savedRows=await api('admin/reservations?date='+encodeURIComponent(payload.date)+'&service='+encodeURIComponent(payload.service));
   if(!savedRows.some(r=>Number(r.id)===Number(created.id))){
    msg('Salvataggio confermato, ma prenotazione non ancora visibile nell’agenda. Non ripetere il salvataggio: verifica in D1.','error');
   }else msg(editing?'Prenotazione aggiornata':'Prenotazione registrata · tavolo assegnato');
   saving=false;close();await renderAdmin();
  }catch(err){
   if(created){msg('Salvataggio confermato, ma la verifica non è riuscita: non inviarlo di nuovo.','error');saving=false;close();await renderAdmin();return}
   msg(err.message,'error');saving=false;submit.disabled=editing&&(loading||(!selectedTables.length&&Number(form.elements.edit_room?.value)!==2));submit.textContent=editing?'Salva modifiche':'Registra prenotazione';
  }
 });
 requestAnimationFrame(()=>{if(matchMedia('(max-width:900px)').matches)panel.focus({preventScroll:true});else (editing?form.elements.name:form.elements.phone)?.focus()});
}

function bindAdmin(){
$('#menu-pdf-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,button=f.querySelector('button'),status=f.querySelector('#menu-pdf-status');button.disabled=true;oasiAdminWrites++;status.textContent='Caricamento in corso…';try{const r=await fetch('/api/admin/menu-pdf',{method:'POST',body:new FormData(f),credentials:'same-origin'});const o=await r.json();if(!r.ok)throw Error(o.error||'Caricamento non riuscito');msg('Menù pubblicato');if(state.adminView==='menu')await renderAdmin()}catch(x){status.textContent=x.message;msg(x.message,'error')}finally{oasiAdminWrites--;button.disabled=false}});

 document.querySelectorAll('#edit-area form,#op-new-reservation').forEach(customerAutocomplete);
 document.querySelectorAll('[data-notice-open]').forEach(btn=>btn.addEventListener('click',async()=>{try{await api('admin/notifications/'+btn.dataset.noticeOpen,'PATCH',{});state.date=btn.dataset.noticeDate||state.date;state.reservationService=btn.dataset.noticeService||'all';state.adminView='reservations';renderAdmin()}catch(e){msg(e.message,'error')}}));
 document.querySelectorAll('[data-customer]').forEach(b=>b.addEventListener('click',()=>openCustomerCard(b.dataset.customer)));
 $('#customer-search')?.addEventListener('submit',e=>{e.preventDefault();state.customerQuery=e.target.elements.q.value.trim();renderAdmin()});
 $('#customer-reset')?.addEventListener('click',()=>{state.customerQuery='';renderAdmin()});
 document.querySelectorAll('[data-notice]').forEach(b=>b.addEventListener('click',async()=>{try{await api('admin/notifications/'+b.dataset.notice,'PATCH',{});renderAdmin()}catch(e){msg(e.message,'error')}}));
 $('#notice-read-all')?.addEventListener('click',async()=>{try{await api('admin/notifications/mark-all','POST',{});renderAdmin()}catch(e){msg(e.message,'error')}});
 $('#email-refresh')?.addEventListener('click',renderAdmin);

 const refreshAfterAction=async()=>{const y=window.scrollY;await renderAdmin();window.scrollTo({top:y,behavior:'instant'})};
 $('#oasi-partial-banquet')?.addEventListener('click',()=>openNewBookingDrawer({banquet:true}));
 let oasiVisitSaving=false;
 const saveVisitState=async(id,value,control)=>{
  if(oasiVisitSaving||!Number.isSafeInteger(id)||id<=0||!Object.hasOwn(opLabel,value))return;
  oasiVisitSaving=true;
  const controls=[...document.querySelectorAll('[data-op-state],[data-op-step]')];
  controls.forEach(el=>el.disabled=true);
  if(control?.matches('[data-op-step]'))control.textContent='Aggiornamento…';
  try{await api('admin/visits/'+id,'PATCH',{state:value});msg('Stato aggiornato');await refreshAfterAction()}
  catch(e){msg(e.message,'error');if(control?.matches('[data-op-state]')){const row=(state.operations?.reservations||[]).find(r=>Number(r.id)===id);if(row)control.value=row.visit_state||'expected'}}
  finally{oasiVisitSaving=false;controls.forEach(el=>{if(el.isConnected)el.disabled=false});if(control?.isConnected&&control.matches('[data-op-step]'))control.textContent=oasiVisitNext[(state.operations?.reservations||[]).find(r=>Number(r.id)===id)?.visit_state||'expected']?.[1]||'Aggiorna'}
 };
 document.querySelectorAll('[data-op-state]').forEach(select=>select.addEventListener('change',()=>saveVisitState(Number(select.dataset.opState),select.value,select)));
 document.querySelectorAll('[data-op-step]').forEach(button=>button.addEventListener('click',()=>saveVisitState(Number(button.dataset.opStep),button.dataset.opNext,button)));
 document.querySelectorAll('[data-op-mobile-edit]').forEach(button=>button.addEventListener('click',()=>{const row=(state.operations?.reservations||[]).find(r=>Number(r.id)===Number(button.dataset.opMobileEdit));if(row?.status==='confirmed')openEditBookingDrawer(row);else msg('Prenotazione non più modificabile.','error')}));
 $('#ops-service')?.addEventListener('change',e=>{state.opsService=e.target.value;state.opsManualSelection=true;renderAdmin()});
 $('#op-today')?.addEventListener('click',()=>{state.date=oasiItalianToday();state.opsManualSelection=false;state.opsService=oasiItalianService();renderAdmin()});
 $('#op-refresh')?.addEventListener('click',renderAdmin);
 const opScope=$('#op-block-form [name="scope"]'),opTarget=$('#op-block-form [name="target_id"]');
 const refreshBlockOptions=()=>{if(!opScope||!opTarget)return;const scope=opScope.value,d=state.operations||{};const opts=scope==='service'?[{id:0,label:'Intero servizio'}]:scope==='room'?(d.rooms||[]).map(x=>({id:x.id,label:x.name})):(d.tables||[]).map(x=>({id:x.id,label:'Tavolo '+x.code+' · '+(d.rooms||[]).find(r=>r.id===x.room_id)?.name}));opTarget.innerHTML=opts.map(o=>`<option value="${o.id}">${esc(o.label)}</option>`).join('');};
 opScope?.addEventListener('change',refreshBlockOptions);refreshBlockOptions();
 $('#op-block-form')?.addEventListener('submit',async e=>{e.preventDefault();const v=inputData(e.target);try{await api('admin/blocks','POST',{date:state.date,service:state.opsService,scope:v.scope,target_id:Number(v.target_id),reason:v.reason});msg('Disponibilità bloccata');refreshAfterAction()}catch(x){msg(x.message,'error')}});
 document.querySelectorAll('[data-remove-block]').forEach(b=>b.addEventListener('click',async()=>{try{await api('admin/blocks/'+b.dataset.removeBlock,'DELETE');msg('Blocco rimosso');refreshAfterAction()}catch(e){msg(e.message,'error')}}));
 const mapClick=(el)=>{
  const id=Number(el.dataset.opTable),d=state.operations||{},table=(d.tables||[]).find(t=>Number(t.id)===id);if(!table)return;
  const booking=(d.reservations||[]).find(r=>r.status==='confirmed'&&r.service===state.opsService&&String(r.table_ids||'').split(',').map(Number).includes(id));
  const blocking=(d.blocks||[]).find(b=>b.scope==='table'&&Number(b.target_id)===id);
  const roomBlocked=!(d.rooms||[]).find(r=>Number(r.id)===Number(table.room_id))?.internal_enabled||(d.blocks||[]).some(b=>(b.scope==='room'&&Number(b.target_id)===Number(table.room_id))||b.scope==='service');
  const taken=new Set((d.reservations||[]).filter(r=>r.status==='confirmed'&&r.service===state.opsService).flatMap(r=>String(r.table_ids||'').split(',').map(Number)));
  const forbidden=new Set((d.blocks||[]).filter(b=>b.scope==='table').map(b=>Number(b.target_id)));
  const oasiLinkedOptions=(data)=>{const busy=new Set((data.reservations||[]).filter(r=>r.status==='confirmed'&&r.service===state.opsService).flatMap(r=>String(r.table_ids||'').split(',').map(Number)));const blocked=new Set((data.blocks||[]).filter(b=>b.scope==='table'&&b.service===state.opsService).map(b=>Number(b.target_id)));const free=(data.tables||[]).filter(t=>Number(t.room_id)===Number(table.room_id)&&Number(t.enabled)===1&&!busy.has(Number(t.id))&&!blocked.has(Number(t.id)));const permittedLinks=(data.links||[]).filter(l=>{const a=(data.tables||[]).find(t=>Number(t.id)===Number(l.table_a)),b=(data.tables||[]).find(t=>Number(t.id)===Number(l.table_b));return a&&b&&oasiNearbyTable(a,b)});const component=oasiLinkedComponent(id,[id,...free.map(t=>Number(t.id))],permittedLinks);return free.filter(t=>Number(t.id)!==id&&component.has(Number(t.id))).sort((a,b)=>String(a.code).localeCompare(String(b.code),'it',{numeric:true}));};let additional=oasiLinkedOptions(d);
  const nearTables=(d.tables||[]).filter(t=>Number(t.id)!==id&&Number(t.room_id)===Number(table.room_id)&&Number(t.enabled)&&oasiNearbyTable(table,t)).sort((a,b)=>String(a.code).localeCompare(String(b.code),'it',{numeric:true}));
  const bookIds=booking?String(booking.table_ids||'').split(',').map(Number).filter(Boolean):[];
  document.querySelector('.op-drawer-layer')?.remove();
  const wrap=document.createElement('div');wrap.className='op-drawer-layer';
  const linkPanel=`<details open class="oasi-operational-links"><summary>Collega tavoli in verticale</summary><p>Seleziona soltanto i tavoli sopra o sotto, allineati e accostabili. Il collegamento resta disponibile anche per le prossime prenotazioni.</p>${nearTables.length?nearTables.map(t=>`<label><input type="checkbox" data-near-link="${Number(t.id)}" ${(d.links||[]).some(l=>(Number(l.table_a)===id&&Number(l.table_b)===Number(t.id))||(Number(l.table_b)===id&&Number(l.table_a)===Number(t.id)))?'checked':''}><span>Tavolo ${esc(t.code)} · ${Number(t.seats)} posti</span></label>`).join(''):'<p>Nessun tavolo allineato verticalmente e abbastanza vicino. Controlla la Piantina standard.</p>'}<button type="button" class="mini" id="oasi-save-near-links" ${nearTables.length?'':'disabled'}>Salva collegamenti</button></details>`;
  const details=booking?`<div class="op-drawer-summary"><strong>${esc(booking.name)}</strong><span>${Number(booking.party_size)} ospiti · ${esc(booking.time)} · ${esc(opServiceLabel(booking.service))}</span>${bookIds.length>1?`<span class="op-multi-active">Prenotazione unica · ${esc(booking.table_codes||'Tavoli combinati')}</span>`:''}</div>
   <button type="button" class="btn btn-dark" id="op-full-edit">Modifica prenotazione</button>
   ${oasiVisitNext[booking.visit_state||'expected']?`<button type="button" class="btn btn-dark op-drawer-next" data-op-drawer-next="${oasiVisitNext[booking.visit_state||'expected'][0]}">${oasiVisitNext[booking.visit_state||'expected'][1]}</button>`:''}
   <label class="op-state-label">Stato servizio ${opSelect(booking)}</label>
   ${oasiWhatsAppHref(booking.phone,booking.name,state.date,booking.time)?`<a class="mini customer-wa" target="_blank" rel="noopener noreferrer" href="${esc(oasiWhatsAppHref(booking.phone,booking.name,state.date,booking.time))}">Contatta su WhatsApp</a>`:''}<button type="button" class="mini" id="op-open-agenda">Apri in Prenotazioni</button>`:
  `<p class="op-drawer-help">${!table.enabled?'Questo tavolo è disattivato nella piantina standard.':blocking?'Tavolo non disponibile per questo servizio.':roomBlocked?'La sala o il servizio è bloccato.':'Questo tavolo è libero per il servizio selezionato.'}</p>
   ${table.enabled&&!blocking&&!roomBlocked?`<form id="op-new-reservation" class="op-drawer-form"><label>Cliente<input name="name" maxlength="120" required placeholder="Nome e cognome"></label><label>Telefono<input name="phone" type="tel" required placeholder="Numero di telefono"></label><label>Ora di arrivo<input type="time" name="time" value="${state.opsService==='lunch'?'12:30':'19:30'}" required></label><label>Persone<input name="party_size" type="number" min="1" max="200" value="${Math.min(Number(table.seats),Math.max(2,Number(table.min_seats||1)))}" required></label><div class="op-multi-group"><div class="op-multi-heading"><strong>Tavoli della prenotazione</strong><small>Puoi aggiungere solo tavoli adiacenti a quelli già selezionati</small></div><label class="op-multi-option"><input type="checkbox" data-combine-table="${id}" checked disabled><span><strong>Tavolo ${esc(table.code)}</strong><small>${Number(table.min_seats||1)}–${Number(table.seats)} posti · selezionato</small></span></label><div id="oasi-linked-table-choices">${additional.map(t=>`<label class="op-multi-option"><input type="checkbox" data-combine-table="${Number(t.id)}"><span><strong>Tavolo ${esc(t.code)}</strong><small>${Number(t.min_seats||1)}–${Number(t.seats)} posti</small></span></label>`).join('')}</div><div class="oasi-join-actions"><button type="button" class="mini" id="oasi-pick-joined-tables">Proponi combinazione per gli ospiti</button><button type="button" class="mini" id="oasi-reload-linked-tables">Aggiorna tavoli collegati</button></div><div class="op-multi-capacity" id="op-multi-capacity" role="status" aria-live="polite"></div><p class="op-multi-hint">L’unione vale soltanto per questa prenotazione: la piantina standard non cambia. Tutti i tavoli restano riservati fino alla fine del servizio.</p></div><label>Email obbligatoria<input type="email" name="email" required></label><label>Note<textarea name="notes" rows="3"></textarea></label><p class="op-drawer-help">Prenotazione unica sul tavolo o sui tavoli selezionati. I gruppi da 10 persone in su possono essere inseriti solo dal personale.</p><button type="submit" class="btn btn-dark">Conferma prenotazione</button></form>`:''}
   ${blocking?'<button type="button" class="btn btn-outline" id="op-unblock-table">Rendi disponibile</button>':!booking&&!roomBlocked&&table.enabled?'<button type="button" class="btn btn-outline" id="op-block-table">Imposta non disponibile</button>':''}`;
  wrap.innerHTML=`<button type="button" class="op-drawer-scrim" aria-label="Chiudi pannello"></button><aside class="op-drawer" role="dialog" aria-modal="true" aria-label="Gestione tavolo ${esc(table.code)}"><div class="op-drawer-top"><div><span class="eyebrow">GESTIONE SERVIZIO</span><h2>Tavolo ${esc(table.code)}</h2><p>${Number(table.min_seats||1)}–${Number(table.seats)} posti · ${esc(opServiceLabel(state.opsService))} · ${esc(state.date)}</p></div><button type="button" class="op-drawer-close" aria-label="Chiudi">×</button></div>${linkPanel}${details}</aside>`;
  document.body.append(wrap);document.body.classList.add('op-drawer-open');
  let opSaving=false;const close=()=>{if(opSaving)return;wrap.remove();document.body.classList.remove('op-drawer-open');document.removeEventListener('keydown',keyClose)};
  const keyClose=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',keyClose);
  wrap.querySelector('.op-drawer-scrim').onclick=close;wrap.querySelector('.op-drawer-close').onclick=close;
  const execute=async work=>{if(opSaving)return;opSaving=true;try{await work();opSaving=false;close();await refreshAfterAction()}catch(e){msg(e.message,'error')}finally{opSaving=false;const select=wrap.querySelector('[data-op-state]');if(select)select.disabled=false}};
  wrap.querySelector('#oasi-save-near-links')?.addEventListener('click',async()=>{
   const button=wrap.querySelector('#oasi-save-near-links');button.disabled=true;
   try{
    const existing=d.links||[];
    for(const t of nearTables){
     const checked=!!wrap.querySelector('[data-near-link="'+t.id+'"]')?.checked;
     const linked=existing.some(l=>(Number(l.table_a)===id&&Number(l.table_b)===Number(t.id))||(Number(l.table_b)===id&&Number(l.table_a)===Number(t.id)));
     if(checked!==linked)await api('admin/table-links',checked?'POST':'DELETE',{table_a:id,table_b:Number(t.id)});
    }
    msg('Collegamenti aggiornati. Ora puoi unire i tavoli nelle prenotazioni.');
    close();await refreshAfterAction();
   }catch(e){msg(e.message,'error');button.disabled=false}
  });
  const creationForm=wrap.querySelector('#op-new-reservation');if(creationForm)customerAutocomplete(creationForm);
  if(creationForm){
   const selectedTables=()=>[table,...additional.filter(t=>wrap.querySelector(`[data-combine-table="${t.id}"]`)?.checked)];
   const optionsNode=wrap.querySelector('#oasi-linked-table-choices');
   const reloadLinkedTables=async()=>{const button=wrap.querySelector('#oasi-reload-linked-tables');if(button)button.disabled=true;try{const fresh=await api('admin/operations?'+new URLSearchParams({date:state.date,service:state.opsService}));if(!wrap.isConnected)return;d.links=fresh.links||[];d.tables=fresh.tables||[];d.reservations=fresh.reservations||[];d.blocks=fresh.blocks||[];const previous=new Set([...optionsNode.querySelectorAll('[data-combine-table]:checked')].map(x=>Number(x.dataset.combineTable)));additional=oasiLinkedOptions(d);optionsNode.innerHTML=additional.length?additional.map(t=>`<label class="op-multi-option"><input type="checkbox" data-combine-table="${Number(t.id)}" ${previous.has(Number(t.id))?'checked':''}><span><strong>Tavolo ${esc(t.code)}</strong><small>${Number(t.min_seats||1)}–${Number(t.seats)} posti</small></span></label>`).join(''):'<p class="op-multi-hint">Nessun tavolo collegato libero. Controlla i collegamenti, poi premi Aggiorna tavoli collegati.</p>';updateCapacity();}catch(err){msg(err.message,'error')}finally{if(button?.isConnected)button.disabled=false}};
   wrap.querySelector('#oasi-reload-linked-tables')?.addEventListener('click',reloadLinkedTables);
   wrap.querySelector('#oasi-pick-joined-tables')?.addEventListener('click',async()=>{
    await reloadLinkedTables();
    if(!wrap.isConnected)return;
    const party=Number(creationForm.elements.party_size.value);
    const ids=oasiRecommendStaffTables([table,...additional],party,d.links||[]);
    if(!ids.includes(id)||ids.length<2){msg('Nessuna combinazione collegata al tavolo scelto copre '+party+' persone.','error');return}
    optionsNode.querySelectorAll('[data-combine-table]').forEach(cb=>{cb.checked=ids.includes(Number(cb.dataset.combineTable))});
    updateCapacity();
   });
   const partyField=creationForm.querySelector('[name="party_size"]');
   const capacityNode=wrap.querySelector('#op-multi-capacity');
   const updateCapacity=()=>{
    const chosen=selectedTables();const min=chosen.reduce((n,t)=>n+Number(t.min_seats||1),0),max=chosen.reduce((n,t)=>n+Number(t.seats||0),0);
    const chosenIds=chosen.map(t=>Number(t.id));for(const cb of creationForm.querySelectorAll('#oasi-linked-table-choices [data-combine-table]')){const candidate=Number(cb.dataset.combineTable);cb.disabled=!cb.checked&&!((d.links||[]).some(l=>(Number(l.table_a)===candidate&&chosenIds.includes(Number(l.table_b)))||(Number(l.table_b)===candidate&&chosenIds.includes(Number(l.table_a)))))||chosen.length>=8;};const count=Number(partyField.value);const validLinks=(d.links||[]).filter(l=>{const a=(d.tables||[]).find(t=>Number(t.id)===Number(l.table_a)),b=(d.tables||[]).find(t=>Number(t.id)===Number(l.table_b));return a&&b&&oasiNearbyTable(a,b)});const connected=oasiConnectedTableIds(chosenIds,validLinks);const valid=Number.isInteger(count)&&count>=min&&count<=max&&connected;
    capacityNode.innerHTML=`<strong>${chosen.length} ${chosen.length===1?'tavolo':'tavoli'} · ${min}–${max} posti</strong><span>${!connected?'I tavoli selezionati non formano una combinazione collegata':valid?'Capienza compatibile':`Inserisci un numero di ospiti tra ${min} e ${max}`}</span>`;
    capacityNode.classList.toggle('invalid',!valid);creationForm.querySelector('[type="submit"]').disabled=!valid||chosen.length>8;
    return {chosen,min,max,valid};
   };
   optionsNode.addEventListener('change',e=>{if(e.target.matches('[data-combine-table]'))updateCapacity()});
   reloadLinkedTables();
   partyField.addEventListener('input',updateCapacity);updateCapacity();
   creationForm.addEventListener('submit',e=>{e.preventDefault();const check=updateCapacity();if(!check.valid)return msg('Capienza incompatibile oppure tavoli non adiacenti','error');
    const submit=creationForm.querySelector('[type="submit"]');submit.disabled=true;
    const payload={...inputData(creationForm),date:state.date,service:state.opsService,room_id:Number(table.room_id),table_ids:check.chosen.map(t=>Number(t.id))};
    execute(async()=>{const saved=await api('admin/reservations','POST',payload);if(!saved.id)throw Error('Il server non ha confermato la prenotazione');msg('Prenotazione unica su '+check.chosen.map(t=>t.code).join(' + '))}).finally(()=>{if(submit.isConnected)updateCapacity()});
   });
  }
  wrap.querySelector('#op-full-edit')?.addEventListener('click',()=>{close();openEditBookingDrawer(booking)});
  wrap.querySelector('#op-block-table')?.addEventListener('click',()=>execute(async()=>{await api('admin/blocks','POST',{date:state.date,service:state.opsService,scope:'table',target_id:id,reason:'Non disponibile da piantina operativa'});msg('Tavolo bloccato per questo servizio')}));
  wrap.querySelector('#op-unblock-table')?.addEventListener('click',()=>execute(async()=>{await api('admin/blocks/'+blocking.id,'DELETE');msg('Tavolo nuovamente disponibile')}));
  wrap.querySelector('#op-open-agenda')?.addEventListener('click',()=>{close();adminGoTo('reservations')});
  wrap.querySelector('[data-op-state]')?.addEventListener('change',e=>{const select=e.target;select.disabled=true;execute(async()=>{await api('admin/visits/'+booking.id,'PATCH',{state:select.value});msg('Stato aggiornato')})});
  wrap.querySelector('[data-op-drawer-next]')?.addEventListener('click',e=>{const button=e.currentTarget;button.disabled=true;execute(async()=>{await api('admin/visits/'+booking.id,'PATCH',{state:button.dataset.opDrawerNext});msg('Stato aggiornato')}).finally(()=>{if(button.isConnected)button.disabled=false})});
  wrap.querySelector('input')?.focus();
 };
 document.querySelectorAll('[data-op-table]').forEach(el=>{el.addEventListener('click',()=>mapClick(el));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();mapClick(el)}})});
document.querySelectorAll('[data-quick]').forEach(el=>el.addEventListener('click',()=>adminGoTo(el.dataset.quick)));if(state.adminView==='faq'){const wrap=$('#faq-admin-items');const add=()=>{const div=document.createElement('div');div.className='faq-admin-row';div.innerHTML='<label>Domanda<input name="question" maxlength="220" required></label><label>Risposta<textarea name="answer" maxlength="1500" rows="3" required></textarea></label><button type="button" class="mini danger faq-remove">Elimina</button>';wrap.append(div);div.querySelector('input')?.focus()};$('#faq-add')?.addEventListener('click',add);wrap?.addEventListener('click',e=>{if(e.target.closest('.faq-remove'))e.target.closest('.faq-admin-row')?.remove()});$('#faq-admin-form')?.addEventListener('submit',async e=>{e.preventDefault();const faqs=[...wrap.querySelectorAll('.faq-admin-row')].map(el=>({question:el.querySelector('[name="question"]').value.trim(),answer:el.querySelector('[name="answer"]').value.trim()})).filter(x=>x.question&&x.answer);try{await api('admin/settings/site','PUT',{...state.settings.site,faqs});state.settings.site.faqs=faqs;msg('FAQ salvate: ricarica la homepage per vedere le modifiche')}catch(x){msg(x.message,'error')}})}document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>adminGoTo(b.dataset.tab));$('#mobile-tab')?.addEventListener('change',e=>adminGoTo(e.target.value));$('#logout')?.addEventListener('click',async()=>{await api('admin/logout','POST',{});location.href='/admin'});$('#admin-date')?.addEventListener('change',e=>{state.date=e.target.value;if(state.adminView==='service')state.opsManualSelection=true;if(state.adminView==='reservations')state.agendaManualSelection=true;renderAdmin()});const oasiAgendaSearch=$('#oasi-agenda-query');const oasiApplyAgendaSearch=()=>{if(!oasiAgendaSearch)return;const q=oasiAgendaSearch.value.trim().toLocaleLowerCase('it-IT');state.agendaQuery=oasiAgendaSearch.value;let shown=0;document.querySelectorAll('.oasi-agenda-entry').forEach(el=>{const yes=!q||el.dataset.agendaSearch.includes(q);el.hidden=!yes;if(yes)shown++});const counter=$('#oasi-agenda-search-count');if(counter)counter.textContent=q?`${shown} risultati`:'';};oasiAgendaSearch?.addEventListener('input',oasiApplyAgendaSearch);oasiApplyAgendaSearch();$('#reservation-service')?.addEventListener('change',e=>{state.reservationService=e.target.value;state.agendaManualSelection=true;renderAdmin()});const moveReservationDay=(n)=>{const d=new Date(state.date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);state.date=d.toISOString().slice(0,10);state.agendaManualSelection=true;renderAdmin()};$('#reservation-prev')?.addEventListener('click',()=>moveReservationDay(-1));$('#reservation-next')?.addEventListener('click',()=>moveReservationDay(1));$('#reservation-today')?.addEventListener('click',()=>{state.date=oasiItalianToday();state.reservationService='all';state.agendaManualSelection=false;renderAdmin()});$('#print-reservations')?.addEventListener('click',()=>printOasiReservations('list'));$('#print-reservation-plan')?.addEventListener('click',()=>printOasiReservations('plan'));$('#oasi-service-print')?.addEventListener('click',async()=>{
  const button=$('#oasi-service-print');if(button)button.disabled=true;
  try{
   const rows=await api('admin/reservations?'+new URLSearchParams({date:state.date,service:state.opsService}));
   state.reservations=rows;
   const previous=state.reservationService;state.reservationService=state.opsService;
   try{printOasiReservations('plan')}finally{state.reservationService=previous}
  }catch(err){msg('Impossibile preparare la stampa: '+err.message,'error')}
  finally{if(button?.isConnected)button.disabled=false}
 });$('#new-room')?.addEventListener('click',()=>editEntity('rooms',{internal_enabled:1}));$('#new-menu')?.addEventListener('click',()=>editEntity('menu',{section:'piatti',available:1}));$('#new-gallery')?.addEventListener('click',()=>editEntity('gallery',{}));document.querySelectorAll('[data-edit-room]').forEach(b=>b.onclick=()=>editEntity('rooms',state.rooms.find(x=>x.id==b.dataset.editRoom)));document.querySelectorAll('[data-edit-menu]').forEach(b=>b.onclick=()=>editEntity('menu',state.menu.find(x=>x.id==b.dataset.editMenu)));document.querySelectorAll('[data-edit-gallery]').forEach(b=>b.onclick=()=>editEntity('gallery',state.gallery.find(x=>x.id==b.dataset.editGallery)));document.querySelectorAll('[data-delete-room]').forEach(b=>b.onclick=()=>deleteEntity('rooms',b.dataset.deleteRoom));document.querySelectorAll('[data-delete-menu]').forEach(b=>b.onclick=()=>deleteEntity('menu',b.dataset.deleteMenu));document.querySelectorAll('[data-delete-gallery]').forEach(b=>b.onclick=()=>deleteEntity('gallery',b.dataset.deleteGallery));$('#room-select')?.addEventListener('change',e=>{state.room=Number(e.target.value);renderAdmin()});$('#new-structure')?.addEventListener('click',()=>structureEditor());$('#new-zone')?.addEventListener('click',()=>{const zones=state.roomZones.filter(z=>z.room_id===state.room);zoneEditor(zones.length?{label:'Nuova ala',x:430,y:235,w:260,h:180}:{label:'Area principale',x:20,y:20,w:520,h:320})});$('#save-floor-standard')?.addEventListener('click',async()=>{try{await api('admin/floor-template','PUT',{room_id:state.room});msg('Piantina standard salvata');renderAdmin()}catch(e){msg(e.message,'error')}});$('#restore-floor-standard')?.addEventListener('click',async()=>{if(!confirm('Ripristinare la piantina standard della sala selezionata? Le modifiche correnti verranno annullate.'))return;try{await api('admin/floor-template','POST',{room_id:state.room});msg('Piantina standard ripristinata');renderAdmin()}catch(e){msg(e.message,'error')}});$('#print-floor')?.addEventListener('click',()=>window.print());const toggleFloorExpanded=()=>{const wrap=$('.floor-canvas-panel');const expanded=wrap?.classList.toggle('floor-expanded');document.body.classList.toggle('floor-mode-expanded',!!expanded);$('#floor-expand').textContent=expanded?'× Chiudi area grande':'⛶ Area di lavoro grande';requestAnimationFrame(applyFloorZoom);};$('#floor-expand')?.addEventListener('click',toggleFloorExpanded);$('#floor-close-large')?.addEventListener('click',toggleFloorExpanded);
 document.querySelectorAll('[data-zone]').forEach(el=>{
  const z=state.roomZones.find(x=>x.id===Number(el.dataset.zone));if(!z)return;
  let operation=null,suppressClick=false,saving=false;
  const snap=(v)=>Math.round(Math.max(0,v));
  el.addEventListener('pointerdown',e=>{
   if(e.pointerType==='mouse'&&e.button!==0)return;
   const resizing=!!e.target.closest('.floor-zone-resize');
   operation={pointerId:e.pointerId,kind:resizing?'resize':'move',startX:e.clientX,startY:e.clientY,x:Number(z.x),y:Number(z.y),w:Number(z.w),h:Number(z.h),moved:false};
   el.setPointerCapture(e.pointerId);el.classList.add('floor-zone-selected');
  });
  el.addEventListener('pointermove',e=>{
   if(!operation||e.pointerId!==operation.pointerId)return;
   const dx=(e.clientX-operation.startX)/floorZoom.scale,dy=(e.clientY-operation.startY)/floorZoom.scale;
   if(Math.hypot(dx,dy)>3)operation.moved=true;
   if(!operation.moved)return;
   if(operation.kind==='resize'){
    z.w=Math.max(70,Math.min(1100-Number(z.x),snap(operation.w+dx)));
    z.h=Math.max(70,Math.min(700-Number(z.y),snap(operation.h+dy)));
    el.style.width=z.w+'px';el.style.height=z.h+'px';
   }else{
    z.x=Math.max(0,Math.min(1100-Number(z.w),snap(operation.x+dx)));
    z.y=Math.max(0,Math.min(700-Number(z.h),snap(operation.y+dy)));
    el.style.left=z.x+'px';el.style.top=z.y+'px';
   }
   refreshZoneGeometry();
  });
  el.addEventListener('pointerup',async e=>{
   if(!operation||operation.pointerId!==e.pointerId)return;
   const moved=operation.moved;operation=null;
   if(!moved)return;
   suppressClick=true;
   if(saving)return;
   saving=true;
   try{await api('admin/room-zones/'+z.id,'PUT',{...z,room_id:state.room});msg('Ambiente aggiornato')}catch(err){msg('Salvataggio ambiente non riuscito: '+err.message,'error');renderAdmin();return}finally{saving=false}
   setTimeout(()=>{suppressClick=false},350);
  });
  el.addEventListener('pointercancel',()=>{if(operation){operation=null;renderAdmin()}});
  el.addEventListener('click',e=>{if(suppressClick){e.preventDefault();return}zoneEditor(z)});
 });;document.querySelectorAll('[data-structure]').forEach(el=>{
 const f=(state.floorElements||[]).find(x=>x.id===Number(el.dataset.structure));if(!f)return;
 let drag=null,suppress=false;
 el.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,ox:Number(f.x),oy:Number(f.y),moved:false};el.setPointerCapture(e.pointerId)});
 el.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=(e.clientX-drag.x)/floorZoom.scale,dy=(e.clientY-drag.y)/floorZoom.scale;if(Math.hypot(dx,dy)>5)drag.moved=true;if(!drag.moved)return;const board=$('#floor-board');f.x=Math.max(0,Math.min(board.clientWidth-Number(f.w),Math.round(drag.ox+dx)));f.y=Math.max(0,Math.min(board.clientHeight-Number(f.h),Math.round(drag.oy+dy)));el.style.left=f.x+'px';el.style.top=f.y+'px'});
 el.addEventListener('pointerup',async()=>{if(!drag)return;const moved=drag.moved;drag=null;if(!moved)return;suppress=true;try{await api('admin/floor-elements/'+f.id,'PUT',f);msg('Elemento spostato e salvato')}catch(e){msg(e.message,'error')}setTimeout(()=>suppress=false,250)});
 el.addEventListener('pointercancel',()=>drag=null);
 el.addEventListener('click',e=>{if(suppress){e.preventDefault();return}structureEditor(f)});
 });$('#new-table')?.addEventListener('click',()=>editEntity('tables',{shape:'square',seats:4,min_seats:1,module_count:1,orientation:'horizontal',x:75,y:75,w:78,h:78,enabled:1}));document.querySelectorAll('.floor-table').forEach(el=>{
 const t=state.tables.find(x=>x.id===Number(el.dataset.table));if(!t)return;
 let drag=null,suppress=false;
 el.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;const resizing=!!e.target.closest('.floor-table-resize');document.querySelectorAll('.floor-table.is-selected').forEach(x=>x.classList.remove('is-selected'));el.classList.add('is-selected');drag={id:e.pointerId,kind:resizing?'resize':'move',x:e.clientX,y:e.clientY,ox:Number(t.x),oy:Number(t.y),ow:Number(t.w),oh:Number(t.h),moved:false};el.setPointerCapture(e.pointerId)});
 el.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=(e.clientX-drag.x)/floorZoom.scale,dy=(e.clientY-drag.y)/floorZoom.scale;if(Math.hypot(dx,dy)>4)drag.moved=true;if(!drag.moved)return;const board=$('#floor-board');if(drag.kind==='resize'){t.w=Math.max(55,Math.min(board.clientWidth-Number(t.x),Math.round(drag.ow+dx)));t.h=Math.max(55,Math.min(board.clientHeight-Number(t.y),Math.round(drag.oh+dy)));el.style.width=t.w+'px';el.style.height=t.h+'px'}else{t.x=Math.max(0,Math.min(board.clientWidth-Number(t.w),Math.round(drag.ox+dx)));t.y=Math.max(0,Math.min(board.clientHeight-Number(t.h),Math.round(drag.oy+dy)));el.style.left=t.x+'px';el.style.top=t.y+'px'}el.classList.add('dragging')});
 el.addEventListener('pointerup',async e=>{if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;el.classList.remove('dragging');if(!moved)return;suppress=true;try{await api('admin/tables/'+t.id,'PUT',{...t,orientation:floorOrientation(t)});msg('Dimensioni e posizione salvate');renderAdmin()}catch(e){msg(e.message,'error');renderAdmin()}setTimeout(()=>suppress=false,350)});
 el.addEventListener('pointercancel',()=>{drag=null;el.classList.remove('dragging');renderAdmin()});
 el.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopPropagation();return}document.querySelectorAll('.floor-table.is-selected').forEach(x=>x.classList.remove('is-selected'));el.classList.add('is-selected');editEntity('tables',t)});
 });$('#editor-form')?.addEventListener('submit',async e=>{if(!['site','booking'].includes(state.adminView))return;e.preventDefault();const v=inputData(e.target);let obj=state.settings[state.adminView];if(state.adminView==='site')obj={...obj,...v};else obj={...obj,maxOnline:Number(v.maxOnline),maxDaysAhead:Number(v.maxDaysAhead),minNoticeMinutes:Number(v.minNoticeMinutes),seasonMode:v.seasonMode==='summer'?'summer':'winter',firstFloorOverflowEnabled:e.target.elements.firstFloorOverflowEnabled.checked,firstFloorOverflowCapacity:Number(v.firstFloorOverflowCapacity||0),closedDates:v.closedDates.split(',').map(x=>x.trim()).filter(Boolean),lunch:{...obj.lunch,start:v.lunchStart,last:v.lunchLast},dinner:{...obj.dinner,start:v.dinnerStart,last:v.dinnerLast}};try{await api('admin/settings/'+state.adminView,'PUT',obj);state.settings[state.adminView]=obj;msg('Impostazioni salvate')}catch(x){msg(x.message,'error')}});
$('#oasi-readiness-refresh')?.addEventListener('click',()=>renderAdmin());$('#new-book')?.addEventListener('click',openNewBookingDrawer);$('#agenda-new-banquet')?.addEventListener('click',()=>openNewBookingDrawer({banquet:true}));document.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=async()=>{if(!confirm('Annullare la prenotazione?'))return;try{await api('admin/reservations/'+b.dataset.cancel,'PATCH',{status:'cancelled'});renderAdmin()}catch(x){msg(x.message,'error')}});document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>openEditBookingDrawer(state.reservations.find(x=>x.id==b.dataset.move)))}
async function start(){if(location.pathname==='/admin'){await loadAdmin();return}try{state.data=await api('public')}catch(e){state.data={site:{address:'Contrada Serrarossa, 88835 Roccabernarda KR',phone:'338 703 6868'},booking:{lunch:{start:'12:30',last:'14:30'},dinner:{start:'19:30',last:'23:00'}},gallery:[],menu:[]};msg('Configura il database per attivare prenotazioni e contenuti.','error')}renderPublic()}
window.addEventListener('resize',()=>{if(floorZoom.mode==='fit')applyFloorZoom()});
start();
