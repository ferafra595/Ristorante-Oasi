// Fase 4 — eventi privati, gestibili esclusivamente dalle rotte ADMIN autenticate.
const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const fail=(message,status=400)=>respond({error:message},status);
const trim=(x,max=255)=>String(x??'').trim().slice(0,max);
const isDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const asDay=v=>Date.parse(v+'T12:00:00Z');
const validStates=['provisional','confirmed','completed','cancelled'];
const validServices=['lunch','dinner','both'];
const dateList=(start,end)=>{const span=Math.round((asDay(end)-asDay(start))/86400000);if(span<0||span>365)throw Error('Un evento può durare al massimo 366 giorni, con data finale non precedente alla iniziale');return Array.from({length:span+1},(_,i)=>new Date(asDay(start)+i*86400000).toISOString().slice(0,10))};
const serviceList=s=>s==='both'?['lunch','dinner']:[s];
const money=v=>{if(v===undefined||v===null||v==='')return 0;const n=Number(v);if(!Number.isFinite(n)||n<0||n>10000000)throw Error('Importo non valido');return Math.round(n*100)};
const uniqRooms=arr=>{if(!Array.isArray(arr)||!arr.length||arr.length>30)throw Error('Seleziona almeno una sala (massimo 30)');const ids=arr.map(Number);if(ids.some(n=>!Number.isSafeInteger(n)||n<=0)||new Set(ids).size!==ids.length)throw Error('Sale selezionate non valide');return ids};
const normalize=b=>{
 const title=trim(b.title,150),kind=trim(b.kind||'Evento privato',70),contact=trim(b.contact_name,120),phone=trim(b.phone,40),email=trim(b.email,180).toLowerCase();
 const start=trim(b.start_date,10),end=trim(b.end_date||start,10),service=trim(b.service,10),status=trim(b.status||'confirmed',20);
 if(!title||!contact||!phone)throw Error('Titolo evento, referente e telefono sono obbligatori');
 if(!isDate(start)||!isDate(end))throw Error('Date evento non valide');
 if(!validServices.includes(service)||!validStates.includes(status))throw Error('Servizio o stato non valido');
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Email referente non valida');
 const rooms=uniqRooms(b.room_ids);
 const guests=Number(b.guests||0);if(!Number.isSafeInteger(guests)||guests<0||guests>2000)throw Error('Numero invitati non valido');
 const estimate=money(b.estimated_total),deposit=money(b.deposit);if(deposit>estimate&&estimate!==0)throw Error('Acconto superiore all’importo previsto');
 return {title,kind,contact,phone,email,start,end,service,status,rooms,guests,estimate,deposit,notes:trim(b.notes,3000),days:dateList(start,end)};
};
const eventListSQL=`SELECT e.*, (SELECT GROUP_CONCAT(r.name, ', ') FROM oasi_event_rooms er JOIN rooms r ON r.id=er.room_id WHERE er.event_id=e.id) room_names,
 (SELECT GROUP_CONCAT(er.room_id) FROM oasi_event_rooms er WHERE er.event_id=e.id) room_ids
 FROM oasi_private_events e`;
export async function eventsAdmin(ctx,parts,method,body){
 const db=ctx.env.DB,id=parts[2];
 try{
  if(method==='GET'){
   const params=new URL(ctx.request.url).searchParams;
   const start=params.get('start'),end=params.get('end');
   if(start&&!isDate(start)||end&&!isDate(end)||start&&end&&start>end)return fail('Intervallo date non valido');
   const cond=[],args=[];
   if(start){cond.push('e.end_date>=?');args.push(start)}if(end){cond.push('e.start_date<=?');args.push(end)}
   if(id){cond.push('e.id=?');args.push(id)}
   const results=await db.prepare(eventListSQL+(cond.length?' WHERE '+cond.join(' AND '):'')+' ORDER BY e.start_date DESC,e.created_at DESC LIMIT 500').bind(...args).all();
   return respond(id?(results.results?.[0]||null):(results.results||[]));
  }
  if(!['POST','PUT','DELETE'].includes(method))return fail('Metodo non consentito',405);
  const old=id?await db.prepare('SELECT * FROM oasi_private_events WHERE id=?').bind(id).first():null;
  if(id&&!old)return fail('Evento non trovato',404);
  if(method==='DELETE'){
   // Cancellazione logica: conserva storico e libera solo gli slot dell'evento.
   await db.batch([
    db.prepare("UPDATE oasi_private_events SET status='cancelled',updated_at=? WHERE id=?").bind(new Date().toISOString(),id),
    db.prepare('DELETE FROM oasi_event_room_slots WHERE event_id=?').bind(id)
   ]);
   return respond({ok:true,cancelled:true});
  }
  const e=normalize(body);
  const rooms=(await db.prepare('SELECT id FROM rooms WHERE id IN ('+e.rooms.map(()=>'?').join(',')+')').bind(...e.rooms).all()).results||[];
  if(rooms.length!==e.rooms.length)return fail('Una sala selezionata non esiste più');
  const active=e.status!=='cancelled';
  const slots=active?e.days.flatMap(date=>serviceList(e.service).flatMap(service=>e.rooms.map(room_id=>({date,service,room_id})))):[];
  if(slots.length>3000)return fail('Troppi blocchi per un singolo evento');
  // Controllo preventivo con due query: non una query per ogni singolo giorno/sala.
  // La garanzia contro le operazioni simultanee è nei trigger SQL della migrazione.
  if(active){
   const allowedServices=serviceList(e.service);
   const roomMarks=e.rooms.map(()=>'?').join(',');
   const serviceMarks=allowedServices.map(()=>'?').join(',');
   const conflictingEvent=await db.prepare(`SELECT e.title, s.book_date, s.service FROM oasi_event_room_slots s
     JOIN oasi_private_events e ON e.id=s.event_id
     WHERE s.book_date BETWEEN ? AND ? AND s.service IN (${serviceMarks})
     AND s.room_id IN (${roomMarks}) AND s.event_id<>? LIMIT 1`).bind(e.start,e.end,...allowedServices,...e.rooms,id||'').first();
   if(conflictingEvent)return fail(`Sala già impegnata per «${conflictingEvent.title}» il ${conflictingEvent.book_date} (${conflictingEvent.service==='lunch'?'pranzo':'cena'}).`);
   const previousBooking=await db.prepare(`SELECT r.id,r.book_date,r.service FROM reservations r
     JOIN reservation_tables rt ON rt.reservation_id=r.id JOIN tables t ON t.id=rt.table_id
     WHERE r.status='confirmed' AND r.book_date BETWEEN ? AND ?
     AND r.service IN (${serviceMarks}) AND t.room_id IN (${roomMarks}) LIMIT 1`).bind(e.start,e.end,...allowedServices,...e.rooms).first();
   if(previousBooking)return fail(`La sala ha già la prenotazione #${previousBooking.id} il ${previousBooking.book_date} (${previousBooking.service==='lunch'?'pranzo':'cena'}). Spostala o annullala prima di impegnare la sala per l'evento.`);
  }
  const timestamp=new Date().toISOString(),eventId=id||crypto.randomUUID();
  const actions=[];
  if(old){
   actions.push(db.prepare(`UPDATE oasi_private_events SET title=?,kind=?,contact_name=?,phone=?,email=?,start_date=?,end_date=?,service=?,status=?,guests=?,estimated_cents=?,deposit_cents=?,notes=?,updated_at=? WHERE id=?`).bind(e.title,e.kind,e.contact,e.phone,e.email,e.start,e.end,e.service,e.status,e.guests,e.estimate,e.deposit,e.notes,timestamp,eventId));
   actions.push(db.prepare('DELETE FROM oasi_event_room_slots WHERE event_id=?').bind(eventId));
   actions.push(db.prepare('DELETE FROM oasi_event_rooms WHERE event_id=?').bind(eventId));
  }else{
   actions.push(db.prepare(`INSERT INTO oasi_private_events(id,title,kind,contact_name,phone,email,start_date,end_date,service,status,guests,estimated_cents,deposit_cents,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(eventId,e.title,e.kind,e.contact,e.phone,e.email,e.start,e.end,e.service,e.status,e.guests,e.estimate,e.deposit,e.notes,timestamp,timestamp));
  }
  for(const room_id of e.rooms)actions.push(db.prepare('INSERT INTO oasi_event_rooms(event_id,room_id) VALUES(?,?)').bind(eventId,room_id));
  for(const slot of slots)actions.push(db.prepare('INSERT INTO oasi_event_room_slots(event_id,room_id,book_date,service) VALUES(?,?,?,?)').bind(eventId,slot.room_id,slot.date,slot.service));
  await db.batch(actions);
  return respond({ok:true,id:eventId,blocked_slots:slots.length},old?200:201);
 }catch(err){
  const m=String(err?.message||err);
  if(/UNIQUE|SQLITE_CONSTRAINT|oasi_event_slot_conflict/i.test(m))return fail('La sala è stata occupata da un altro evento durante il salvataggio. Aggiorna l’agenda e riprova.',409);
  if(/oasi_event_existing_reservations/.test(m))return fail('La sala ha già una prenotazione confermata. Non è possibile salvarla come riservata per l’evento.',409);
  return fail(m,400);
 }
}
