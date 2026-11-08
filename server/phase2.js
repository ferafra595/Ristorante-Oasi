// Supporto cliente/email Oasi: D1 + Resend, senza segreti nel frontend.
const timestamp=()=>new Date().toISOString();
const clean=(s,n=250)=>String(s??'').trim().slice(0,n);
const htmlEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const validEmail=s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s||''))&&String(s).length<=180;
export async function ensurePhase2(db){
 await db.prepare(`CREATE TABLE IF NOT EXISTS oasi_customers(id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT NOT NULL COLLATE NOCASE UNIQUE,name TEXT NOT NULL,phone TEXT NOT NULL,staff_note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`).run();
 await db.prepare(`CREATE INDEX IF NOT EXISTS idx_oasi_customers_phone ON oasi_customers(phone)`).run();
 await db.prepare(`CREATE TABLE IF NOT EXISTS oasi_email_log(id INTEGER PRIMARY KEY AUTOINCREMENT,event_key TEXT NOT NULL UNIQUE,reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,recipient TEXT NOT NULL,email_type TEXT NOT NULL,subject TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','sent','failed','unconfigured')) DEFAULT 'pending',error TEXT NOT NULL DEFAULT '',provider_id TEXT NOT NULL DEFAULT '',attempted_at TEXT,created_at TEXT NOT NULL)`).run();
 await db.prepare(`CREATE INDEX IF NOT EXISTS idx_oasi_email_log_reservation ON oasi_email_log(reservation_id,created_at)`).run();
 await db.prepare(`CREATE TABLE IF NOT EXISTS oasi_staff_notifications(id INTEGER PRIMARY KEY AUTOINCREMENT,reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,event_type TEXT NOT NULL,title TEXT NOT NULL,message TEXT NOT NULL,seen INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)`).run();
 await db.prepare(`CREATE INDEX IF NOT EXISTS idx_oasi_staff_notifications_recent ON oasi_staff_notifications(seen,created_at DESC)`).run();
}
export async function syncCustomer(db,booking){
 const mail=clean(booking.email,180).toLowerCase();if(!validEmail(mail))return;
 await ensurePhase2(db);
 await db.prepare(`INSERT INTO oasi_customers(email,name,phone,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,phone=excluded.phone,updated_at=excluded.updated_at`).bind(mail,clean(booking.name,120),clean(booking.phone,40),timestamp(),timestamp()).run();
}
export async function alertStaff(db,reservationId,eventType,title,message){
 await ensurePhase2(db);
 await db.prepare('INSERT INTO oasi_staff_notifications(reservation_id,event_type,title,message,created_at) VALUES(?,?,?,?,?)').bind(reservationId||null,clean(eventType,40),clean(title,160),clean(message,600),timestamp()).run();
}
const emailLayout=(title,body)=>`<!doctype html><html lang="it"><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;background:#f6f3ef;padding:32px;color:#292622"><div style="max-width:620px;margin:auto;background:#fff;padding:36px;border-radius:24px"><p style="letter-spacing:.20em;color:#ac8e68;font-size:11px">RISTORANTE OASI · DAL 1997</p><h1 style="font-family:Georgia,serif;font-size:31px;font-weight:400">${htmlEscape(title)}</h1>${body}<hr style="border:0;border-top:1px solid #e8dfd3;margin:28px 0"><p style="font-size:12px;color:#847b70">Contrada Serrarossa · Roccabernarda (KR) · 338 703 6868</p></div></body></html>`;
export const mailContent=(event,booking,cancelUrl='')=>{
 const name=htmlEscape(booking.name),date=htmlEscape(booking.book_date||booking.date),time=htmlEscape(booking.time),party=Number(booking.party_size||0),service=booking.service==='lunch'?'pranzo':'cena';
 if(event==='cancel')return {subject:'Prenotazione annullata · Ristorante Oasi',html:emailLayout('Prenotazione annullata',`<p>Gentile ${name}, la tua prenotazione per il ${service} del <strong>${date}</strong> è stata annullata.</p><p>Per ulteriori informazioni chiamaci al <a href="tel:+393387036868">338 703 6868</a>.</p>`)};
 if(event==='reminder')return {subject:'Ti aspettiamo domani · Ristorante Oasi',html:emailLayout('A domani!',`<p>Ciao ${name}, ti ricordiamo la prenotazione per il <strong>${date}</strong> alle <strong>${time}</strong>, ${party} ${party===1?'persona':'persone'}.</p><p>Per variazioni chiamaci al 338 703 6868.</p>`)};
 const change=event==='change';
 return {subject:`${change?'Prenotazione aggiornata':'Prenotazione confermata'} · Ristorante Oasi`,html:emailLayout(change?'Prenotazione aggiornata':'Prenotazione confermata',`<p>Ciao ${name}, la tua prenotazione è ${change?'stata aggiornata':'confermata'}.</p><p><strong>${date}</strong> · ${service} alle <strong>${time}</strong> · <strong>${party}</strong> ${party===1?'persona':'persone'}.</p>${cancelUrl?`<p><a href="${htmlEscape(cancelUrl)}" style="color:#916d46">Annulla la prenotazione</a></p>`:''}<p>A presto, il team dell’Oasi.</p>`)};
};
export async function sendEmailRecorded(ctx,{eventKey,reservationId=null,to,type,subject,html}){
 const db=ctx.env.DB;await ensurePhase2(db);
 const recipient=clean(to,180).toLowerCase();if(!validEmail(recipient))return {status:'failed',error:'Indirizzo email non valido'};
 const key=clean(eventKey,190);
 await db.prepare(`INSERT OR IGNORE INTO oasi_email_log(event_key,reservation_id,recipient,email_type,subject,status,created_at) VALUES(?,?,?,?,?,'pending',?)`).bind(key,reservationId,recipient,clean(type,30),clean(subject,200),timestamp()).run();
 const row=await db.prepare('SELECT id,status FROM oasi_email_log WHERE event_key=?').bind(key).first();
 if(row?.status==='sent')return {status:'sent',already:true};
 if(!ctx.env.RESEND_API_KEY||!ctx.env.EMAIL_FROM){await db.prepare(`UPDATE oasi_email_log SET status='unconfigured',error='Configurare RESEND_API_KEY e EMAIL_FROM',attempted_at=? WHERE id=?`).bind(timestamp(),row.id).run();return {status:'unconfigured'}};
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${ctx.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:ctx.env.EMAIL_FROM,to:[recipient],subject,html})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.id)throw Error(`Resend HTTP ${response.status}: ${String(result.message||result.error||'risposta non valida').slice(0,220)}`);
  await db.prepare(`UPDATE oasi_email_log SET status='sent',error='',provider_id=?,attempted_at=? WHERE id=?`).bind(String(result.id),timestamp(),row.id).run();
  return {status:'sent',provider_id:result.id};
 }catch(error){console.error('Oasi email:',error.message);await db.prepare(`UPDATE oasi_email_log SET status='failed',error=?,attempted_at=? WHERE id=?`).bind(clean(error.message,350),timestamp(),row.id).run();return {status:'failed',error:'Invio non riuscito: controlla configurazione email e registro ADMIN'}}
}
export async function emailForBooking(ctx,booking,event,cancelUrl='',eventKeyOverride=''){
 if(!validEmail(booking.email))return {status:'failed',error:'Email non valida'};
 const contents=mailContent(event,booking,cancelUrl),key=eventKeyOverride||`${event}:${booking.id}`;
 return sendEmailRecorded(ctx,{eventKey:key,reservationId:booking.id,to:booking.email,type:event,subject:contents.subject,html:contents.html});
}
export async function emailStaff(ctx,booking,event){
 const to=ctx.env.ADMIN_NOTIFY_EMAIL;if(!validEmail(to))return {status:'unconfigured'};
 return sendEmailRecorded(ctx,{eventKey:`staff:${event}:${booking.id}:${booking.time||''}`,reservationId:booking.id,to,type:'staff',subject:`Oasi · ${event==='cancel'?'Prenotazione annullata':'Nuova prenotazione'} #${booking.id}`,html:emailLayout('Aggiornamento prenotazioni',`<p>Cliente: <strong>${htmlEscape(booking.name)}</strong></p><p>${htmlEscape(booking.book_date||booking.date)} · ${htmlEscape(booking.time)} · ${Number(booking.party_size)} ospiti</p>`)});
}
// Ogni esecuzione controlla il prossimo giorno locale. Invia un solo promemoria per prenotazione.
export async function sendDueReminders(env){
 if(!env.DB)return;const db=env.DB;await ensurePhase2(db);
 const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
 const hour=Number(local.slice(11,13));if(hour<17||hour>17)return; // 17:00–17:59 italiane
 const today=local.slice(0,10),tomorrow=new Date(today+'T12:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);const d=tomorrow.toISOString().slice(0,10);
 const rows=(await db.prepare(`SELECT * FROM reservations WHERE book_date=? AND status='confirmed' AND email LIKE '%@%'`).bind(d).all()).results||[];
 const ctx={env};for(const row of rows){try{await emailForBooking(ctx,row,'reminder')}catch(e){console.error('Oasi reminder',row.id,e.message)}}
}
