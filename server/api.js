import {eventsAdmin} from './phase4.js';
import {ensurePhase2,syncCustomer,alertStaff,emailForBooking,emailStaff,sendEmailRecorded,validEmail} from './phase2.js';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const fail=(message,status=400)=>json({error:message},status);
const now=()=>new Date().toISOString();
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'});
const rand=()=>{const x=crypto.getRandomValues(new Uint8Array(32));return Array.from(x,b=>b.toString(16).padStart(2,'0')).join('')};
const digest=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),b=>b.toString(16).padStart(2,'0')).join('');
async function passwordHash(p,salt=rand().slice(0,32)){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']);const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},k,256);return salt+':'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}
async function verifyPassword(p,h){const [s]=h.split(':');return (await passwordHash(p,s))===h}
// Compara segreti senza fermarsi alla prima differenza.
async function equalSecret(a,b){
 const [ha,hb]=await Promise.all([crypto.subtle.digest('SHA-256',new TextEncoder().encode(a)),crypto.subtle.digest('SHA-256',new TextEncoder().encode(b))]);
 const x=new Uint8Array(ha),y=new Uint8Array(hb);let diff=0;
 for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;
}

const read=async r=>{try{return await r.json()}catch{return {}}};
const config=async(db,k)=>{const x=await db.prepare('SELECT value FROM settings WHERE key=?').bind(k).first();return x?JSON.parse(x.value):{}};
const dateOk=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const timeOk=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const weekday=d=>new Date(d+'T12:00:00Z').getUTCDay();
const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
const cookie=(token,secure)=>`oasi_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure?'; Secure':''}`;
async function currentUser(db,req){const token=(req.headers.get('cookie')||'').match(/(?:^|; )oasi_session=([a-f0-9]{64})/)?.[1];if(!token)return null;return db.prepare('SELECT users.id,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?').bind(await digest(token),now()).first()}
const clean=(s,n=1000)=>String(s??'').trim().slice(0,n);

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function ensureFloorV3(db){
 await db.prepare(`CREATE TABLE IF NOT EXISTS table_details (table_id INTEGER PRIMARY KEY REFERENCES tables(id) ON DELETE CASCADE,min_seats INTEGER NOT NULL DEFAULT 1,module_count INTEGER NOT NULL DEFAULT 1)`).run();
 await db.prepare(`CREATE TABLE IF NOT EXISTS table_links (table_a INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,table_b INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,PRIMARY KEY(table_a,table_b),CHECK(table_a<table_b))`).run();
 await db.prepare(`CREATE TABLE IF NOT EXISTS room_zones (id INTEGER PRIMARY KEY AUTOINCREMENT,room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,label TEXT NOT NULL DEFAULT '',x REAL NOT NULL,y REAL NOT NULL,w REAL NOT NULL,h REAL NOT NULL)`).run();
 await db.prepare(`CREATE TABLE IF NOT EXISTS floor_plan_templates (room_id INTEGER PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,data TEXT NOT NULL,updated_at TEXT NOT NULL)`).run();
}
const geometry=(shape,n,orientation='horizontal')=>{const modules=Math.max(1,Math.min(8,Math.trunc(+n||1)));if(shape==='circle'){const d=Math.round(76+16*(modules-1));return {w:d,h:d}}if(shape==='rectangle'){const long=Math.round(96+54*(modules-1)),short=72;return orientation==='vertical'?{w:short,h:long}:{w:long,h:short}}const side=Math.round(78+16*(modules-1));return {w:side,h:side}};
const tableDetail=async(db,id)=>await db.prepare('SELECT min_seats,module_count FROM table_details WHERE table_id=?').bind(id).first();
async function roomSnapshot(db,roomId){
 await ensureFloorV3(db);
 const [tables,elements,zones,links]=await Promise.all([
  db.prepare('SELECT t.*,COALESCE(d.min_seats,1) min_seats,COALESCE(d.module_count,1) module_count FROM tables t LEFT JOIN table_details d ON d.table_id=t.id WHERE t.room_id=? ORDER BY t.id').bind(roomId).all(),
  db.prepare('SELECT * FROM floor_elements WHERE room_id=? ORDER BY id').bind(roomId).all(),
  db.prepare('SELECT * FROM room_zones WHERE room_id=? ORDER BY id').bind(roomId).all(),
  db.prepare('SELECT l.* FROM table_links l JOIN tables a ON a.id=l.table_a JOIN tables b ON b.id=l.table_b WHERE a.room_id=? AND b.room_id=? ORDER BY l.table_a,l.table_b').bind(roomId,roomId).all()
 ]);
 return {tables:tables.results||[],elements:elements.results||[],zones:zones.results||[],links:links.results||[]};
}
async function saveRoomTemplate(db,roomId){const data=JSON.stringify(await roomSnapshot(db,roomId));await db.prepare('INSERT INTO floor_plan_templates(room_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(room_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(roomId,data,now()).run();return {ok:true}}
async function loadRoomTemplate(db,roomId){await ensureFloorV3(db);const row=await db.prepare('SELECT data,updated_at FROM floor_plan_templates WHERE room_id=?').bind(roomId).first();return row?{found:true,updated_at:row.updated_at,data:JSON.parse(row.data)}:{found:false,data:null}}
async function restoreRoomTemplate(db,roomId){
 const tpl=await loadRoomTemplate(db,roomId);if(!tpl.found||!tpl.data)return false;const data=tpl.data;const tableIds=(data.tables||[]).map(t=>Number(t.id)).filter(Boolean);
 for(const t of data.tables||[]){await db.prepare('UPDATE tables SET code=?,shape=?,seats=?,x=?,y=?,w=?,h=?,rotation=?,enabled=?,group_code=? WHERE id=? AND room_id=?').bind(clean(t.code,30),['circle','square','rectangle'].includes(t.shape)?t.shape:'square',Math.trunc(Number(t.seats)||1),Number(t.x)||0,Number(t.y)||0,Number(t.w)||60,Number(t.h)||60,Number(t.rotation)||0,t.enabled?1:0,clean(t.group_code||'',80),Number(t.id),roomId).run();await db.prepare('INSERT INTO table_details(table_id,min_seats,module_count) VALUES(?,?,?) ON CONFLICT(table_id) DO UPDATE SET min_seats=excluded.min_seats,module_count=excluded.module_count').bind(Number(t.id),Math.max(1,Math.trunc(Number(t.min_seats)||1)),Math.max(1,Math.trunc(Number(t.module_count)||1))).run();}
 const existing=(await db.prepare('SELECT id FROM tables WHERE room_id=?').bind(roomId).all()).results||[];for(const row of existing){if(!tableIds.includes(Number(row.id))){await db.prepare('UPDATE tables SET enabled=0 WHERE id=?').bind(Number(row.id)).run();}}
 await db.prepare('DELETE FROM table_links WHERE table_a IN (SELECT id FROM tables WHERE room_id=?) OR table_b IN (SELECT id FROM tables WHERE room_id=?)').bind(roomId,roomId).run();
 for(const l of data.links||[]){if(tableIds.includes(Number(l.table_a))&&tableIds.includes(Number(l.table_b))){const one=Math.min(Number(l.table_a),Number(l.table_b)),two=Math.max(Number(l.table_a),Number(l.table_b));if(one>0&&two>0&&one!==two)await db.prepare('INSERT OR IGNORE INTO table_links(table_a,table_b) VALUES(?,?)').bind(one,two).run();}}
 await db.prepare('DELETE FROM floor_elements WHERE room_id=?').bind(roomId).run();
 for(const e of data.elements||[]){await db.prepare('INSERT INTO floor_elements(room_id,kind,label,x,y,w,h,rotation) VALUES(?,?,?,?,?,?,?,?)').bind(roomId,clean(e.kind,20),clean(e.label,80),Number(e.x)||0,Number(e.y)||0,Math.max(8,Number(e.w)||30),Math.max(8,Number(e.h)||30),Number(e.rotation)||0).run();}
 await db.prepare('DELETE FROM room_zones WHERE room_id=?').bind(roomId).run();
 for(const z of data.zones||[]){await db.prepare('INSERT INTO room_zones(room_id,label,x,y,w,h) VALUES(?,?,?,?,?,?)').bind(roomId,clean(z.label,80),Number(z.x)||0,Number(z.y)||0,Math.max(70,Number(z.w)||120),Math.max(70,Number(z.h)||120)).run();}
 return true;
}

async function ensureOperations(db){
 await db.prepare(`CREATE TABLE IF NOT EXISTS service_visits(reservation_id INTEGER PRIMARY KEY REFERENCES reservations(id) ON DELETE CASCADE, state TEXT NOT NULL DEFAULT 'expected' CHECK(state IN ('expected','arrived','seated','finished','no_show')), updated_at TEXT NOT NULL, note TEXT NOT NULL DEFAULT '')`).run();
 await db.prepare(`CREATE TABLE IF NOT EXISTS service_blocks(id INTEGER PRIMARY KEY AUTOINCREMENT,book_date TEXT NOT NULL,service TEXT NOT NULL CHECK(service IN ('lunch','dinner')),scope TEXT NOT NULL CHECK(scope IN ('service','room','table')),target_id INTEGER NOT NULL DEFAULT 0,reason TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,UNIQUE(book_date,service,scope,target_id))`).run();
}
async function serviceBlocks(db,date,service){
 await ensureOperations(db);
 const [blocks,events]=await Promise.all([
  db.prepare('SELECT * FROM service_blocks WHERE book_date=? AND service=? ORDER BY scope,id').bind(date,service).all(),
  db.prepare("SELECT er.room_id, e.id event_id FROM oasi_event_rooms er JOIN oasi_private_events e ON e.id=er.event_id WHERE e.status<>'cancelled' AND ? BETWEEN e.start_date AND e.end_date AND (e.service='both' OR e.service=?)").bind(date,service).all()
 ]);
 return [...(blocks.results||[]),...(events.results||[]).map(x=>({scope:'room',target_id:x.room_id,reason:'Riservata per evento privato',event_id:x.event_id,source:'event'}))];
}
// Fonte autorevole: date/servizi/sale della cerimonia, indipendente dagli slot materializzati.
async function eventRoomBlocked(db,date,service,roomId){
 const row=await db.prepare(`SELECT e.id,e.title FROM oasi_private_events e
 JOIN oasi_event_rooms er ON er.event_id=e.id
 WHERE er.room_id=? AND e.status<>'cancelled'
 AND ? BETWEEN e.start_date AND e.end_date
 AND (e.service='both' OR e.service=?) LIMIT 1`).bind(roomId,date,service).first();
 return row;
}
async function operationsData(db,date,service){
 await ensureOperations(db);await ensureFloorV3(db);
 const filter=service==='all'?'':' AND r.service=?';const params=service==='all'?[date]:[date,service];
 const [reservations,rooms,tables,blocks]=await Promise.all([
  db.prepare(`SELECT r.*,COALESCE(v.state,'expected') visit_state,COALESCE(v.note,'') visit_note,GROUP_CONCAT(t.id) table_ids,GROUP_CONCAT(t.code,', ') table_codes FROM reservations r LEFT JOIN service_visits v ON v.reservation_id=r.id LEFT JOIN reservation_tables rt ON rt.reservation_id=r.id LEFT JOIN tables t ON t.id=rt.table_id WHERE r.book_date=?${filter} GROUP BY r.id ORDER BY CASE r.service WHEN 'lunch' THEN 0 ELSE 1 END,r.time,r.id`).bind(...params).all(),
  db.prepare('SELECT id,name,public_enabled,internal_enabled FROM rooms ORDER BY sort_order,id').all(),
  db.prepare('SELECT t.*,COALESCE(d.min_seats,1) min_seats FROM tables t LEFT JOIN table_details d ON d.table_id=t.id ORDER BY t.room_id,t.id').all(),
  db.prepare("SELECT * FROM service_blocks WHERE book_date=? "+(service==='all'?'':'AND service=? ')+"ORDER BY service,scope,id").bind(...params).all()
 ]);
 const eventRows=await db.prepare(`SELECT e.id event_id,er.room_id,e.service event_service
 FROM oasi_event_rooms er JOIN oasi_private_events e ON e.id=er.event_id
 WHERE e.status<>'cancelled' AND ? BETWEEN e.start_date AND e.end_date
 AND (?='all' OR e.service='both' OR e.service=?)`).bind(date,service,service).all();
 const eventBlocks=(eventRows.results||[]).flatMap(x=>(x.event_service==='both'?['lunch','dinner']:[x.event_service])
  .filter(s=>service==='all'||service===s).map(s=>({id:'event:'+x.event_id+':'+x.room_id+':'+s,scope:'room',target_id:x.room_id,service:s,reason:'Sala riservata per evento privato',event_id:x.event_id,source:'event'})));
 return {date,service,reservations:reservations.results||[],rooms:rooms.results||[],tables:tables.results||[],blocks:[...(blocks.results||[]),...eventBlocks]};
}
async function candidates(db,roomIds,date,service,party){
 if(!roomIds.length)return [];
 await ensureFloorV3(db);
 const currentBlocks=await serviceBlocks(db,date,service);
 if(currentBlocks.some(b=>b.scope==='service'))return [];
 const blockedRooms=new Set(currentBlocks.filter(b=>b.scope==='room').map(b=>Number(b.target_id)));
 const blockedTables=new Set(currentBlocks.filter(b=>b.scope==='table').map(b=>Number(b.target_id)));
 roomIds=roomIds.filter(id=>!blockedRooms.has(Number(id)));if(!roomIds.length)return [];
 const ts=await db.prepare(`SELECT t.*,COALESCE(d.min_seats,1) min_seats FROM tables t LEFT JOIN table_details d ON d.table_id=t.id WHERE t.room_id IN (${roomIds.map(()=>'?').join(',')}) AND t.enabled=1 AND NOT EXISTS(SELECT 1 FROM reservation_tables rt WHERE rt.table_id=t.id AND rt.book_date=? AND rt.service=?) ORDER BY t.seats,t.id`).bind(...roomIds,date,service).all();
 const free=(ts.results||[]).filter(t=>!blockedTables.has(Number(t.id)));
 const options=free.filter(t=>t.seats>=party&&t.min_seats<=party).map(t=>({ids:[t.id],room_id:t.room_id,capacity:t.seats,code:t.code}));
 if(!free.length)return options;
 const allLinks=(await db.prepare('SELECT table_a,table_b FROM table_links').all()).results;
 const byId=new Map(free.map(t=>[t.id,t]));const adj=new Map(free.map(t=>[t.id,[]]));
 for(const link of allLinks){const a=byId.get(link.table_a),b=byId.get(link.table_b);if(a&&b&&a.room_id===b.room_id){adj.get(a.id).push(b.id);adj.get(b.id).push(a.id)}}
 const seen=new Set();
 for(const root of free){const queue=[[root.id]];while(queue.length){const group=queue.shift();if(group.length>=6)continue;const next=new Set(group.flatMap(id=>adj.get(id)||[]));for(const id of next){if(group.includes(id))continue;const ids=[...group,id].sort((a,b)=>a-b);const key=ids.join('-');if(seen.has(key))continue;seen.add(key);const members=ids.map(i=>byId.get(i));const capacity=members.reduce((s,t)=>s+t.seats,0),minimum=members.reduce((s,t)=>s+Number(t.min_seats||1),0);if(capacity>=party&&minimum<=party)options.push({ids,room_id:root.room_id,capacity,code:members.map(t=>t.code).join('+')});if(ids.length<6)queue.push(ids)}}}
 return options.sort((a,b)=>a.capacity-b.capacity||a.ids.length-b.ids.length);
}
// Staff-only choice: a temporary group of free tables in the same room.
// Does NOT modify the standard floor plan or allow public customers to bypass linked-table rules.
async function manualTableCandidate(db,roomIds,date,service,party,selected){
 await ensureFloorV3(db);
 if(!Array.isArray(selected)||selected.length<1||selected.length>8)return null;
 const ids=selected.map(Number);
 if(ids.some(id=>!Number.isSafeInteger(id)||id<=0)||new Set(ids).size!==ids.length)return null;
 const blocked=await serviceBlocks(db,date,service);
 if(blocked.some(x=>x.scope==='service'))return null;
 const roomBlocks=new Set(blocked.filter(x=>x.scope==='room').map(x=>Number(x.target_id)));
 const tableBlocks=new Set(blocked.filter(x=>x.scope==='table').map(x=>Number(x.target_id)));
 if(ids.some(id=>tableBlocks.has(id)))return null;
 const result=await db.prepare(`SELECT t.id,t.code,t.room_id,t.seats,COALESCE(d.min_seats,1) min_seats
 FROM tables t LEFT JOIN table_details d ON d.table_id=t.id
 WHERE t.id IN (${ids.map(()=>'?').join(',')}) AND t.enabled=1
 AND NOT EXISTS(SELECT 1 FROM reservation_tables rt WHERE rt.table_id=t.id AND rt.book_date=? AND rt.service=?)`).bind(...ids,date,service).all();
 const tables=result.results||[];
 if(tables.length!==ids.length)return null;
 const roomId=Number(tables[0].room_id);
 if(!roomIds.includes(roomId)||roomBlocks.has(roomId)||tables.some(t=>Number(t.room_id)!==roomId))return null;
 const max=tables.reduce((n,t)=>n+Number(t.seats),0);
 const min=tables.reduce((n,t)=>n+Number(t.min_seats),0);
 if(party<min||party>max)return null;
 return {ids,room_id:roomId,capacity:max,code:tables.map(t=>t.code).join('+')};
}
// Analizza le cause reali di indisponibilità, senza confondere cerimonie,
// blocchi operativi, capienza e tavoli già prenotati.
const serviceIt=s=>s==='lunch'?'pranzo':'cena';
const dateIt=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):d;
async function bookingUnavailableReason(db,roomIds,date,service,party,admin=false){
 const when=`${serviceIt(service)} del ${dateIt(date)}`;
 const rooms=[...new Set(roomIds.map(Number).filter(n=>Number.isSafeInteger(n)&&n>0))];
 if(!rooms.length)return 'Nessuna sala abilitata alle prenotazioni. Contatta il ristorante.';
 const blocks=await serviceBlocks(db,date,service);
 const serviceBlock=blocks.find(x=>x.scope==='service');
 if(serviceBlock)return `Prenotazioni non disponibili per il ${when}: il servizio è stato chiuso dall’ADMIN${admin&&serviceBlock.reason?' ('+clean(serviceBlock.reason,120)+')':''}.`;
 const eventRooms=new Set(blocks.filter(x=>x.scope==='room'&&x.source==='event').map(x=>Number(x.target_id)));
 const manualRooms=new Set(blocks.filter(x=>x.scope==='room'&&x.source!=='event').map(x=>Number(x.target_id)));
 const usable=rooms.filter(id=>!eventRooms.has(id)&&!manualRooms.has(id));
 if(!usable.length){
  if(rooms.every(id=>eventRooms.has(id)))return `Prenotazione non consentita per il ${when}: tutte le sale sono riservate per una cerimonia o un evento privato.`;
  if(rooms.every(id=>manualRooms.has(id)))return `Prenotazioni non disponibili per il ${when}: tutte le sale sono state bloccate dall’ADMIN.`;
  return `Prenotazioni non disponibili per il ${when}: le sale sono riservate per eventi privati oppure bloccate dall’ADMIN.`;
 }
 const eventNote=rooms.some(id=>eventRooms.has(id))?' Alcune sale sono riservate per una cerimonia o un evento privato.':'';
 const blockedNote=rooms.some(id=>manualRooms.has(id))?' Alcune sale sono bloccate dall’ADMIN.':'';
 const data=await db.prepare(`SELECT t.id,t.room_id,t.seats,COALESCE(d.min_seats,1) min_seats,
 EXISTS(SELECT 1 FROM reservation_tables rt WHERE rt.table_id=t.id AND rt.book_date=? AND rt.service=?) busy
 FROM tables t LEFT JOIN table_details d ON d.table_id=t.id
 WHERE t.enabled=1 AND t.room_id IN (${usable.map(()=>'?').join(',')})`).bind(date,service,...usable).all();
 const configured=data.results||[];
 const blockedTables=new Set(blocks.filter(x=>x.scope==='table').map(x=>Number(x.target_id)));
 const unblocked=configured.filter(t=>!blockedTables.has(Number(t.id)));
 if(!configured.length)return `Nessun tavolo attivo nelle sale disponibili per il ${when}.${eventNote}${blockedNote}`;
 if(!unblocked.length)return `Tutti i tavoli delle sale disponibili sono stati bloccati per il ${when}.${eventNote}${blockedNote}`;
 const possibleByRoom=new Map();
 for(const t of unblocked)possibleByRoom.set(Number(t.room_id),(possibleByRoom.get(Number(t.room_id))||0)+Number(t.seats||0));
 if(Math.max(...possibleByRoom.values(),0)<party)return `Capienza insufficiente: nessuna sala disponibile può accogliere ${party} persone per il ${when}.${eventNote}${blockedNote}`;
 const free=unblocked.filter(t=>!t.busy);
 if(!free.length)return `Nessun tavolo libero per il ${when}: tutti i tavoli utilizzabili sono già prenotati.${eventNote}${blockedNote}`;
 if(!free.some(t=>Number(t.seats)>=party&&Number(t.min_seats)<=party)){
  const roomFree=new Map();for(const t of free)roomFree.set(Number(t.room_id),(roomFree.get(Number(t.room_id))||0)+Number(t.seats||0));
  if(Math.max(...roomFree.values(),0)<party)return `Non ci sono abbastanza posti liberi per ${party} persone durante il ${when}.${eventNote}${blockedNote}`;
 }
 return `Nessun tavolo compatibile e disponibile per ${party} persone durante il ${when}.${eventNote}${blockedNote}`;
}
async function manualTableUnavailableReason(db,roomIds,date,service,party,selected){
 const when=`${serviceIt(service)} del ${dateIt(date)}`;
 const ids=selected.map(Number);
 if(ids.some(id=>!Number.isSafeInteger(id)||id<=0)||ids.length>8||new Set(ids).size!==ids.length)return 'Selezione tavoli non valida: scegli da 1 a 8 tavoli diversi.';
 const marks=ids.map(()=>'?').join(',');
 const data=await db.prepare(`SELECT t.id,t.code,t.room_id,t.seats,t.enabled,COALESCE(d.min_seats,1) min_seats
 FROM tables t LEFT JOIN table_details d ON d.table_id=t.id WHERE t.id IN (${marks})`).bind(...ids).all();
 const tables=data.results||[];
 if(tables.length!==ids.length)return 'Uno dei tavoli selezionati non esiste più: aggiorna la piantina.';
 if(tables.some(t=>!t.enabled))return 'Uno dei tavoli selezionati è disattivato nella piantina.';
 if(tables.some(t=>Number(t.room_id)!==Number(tables[0].room_id))||!roomIds.includes(Number(tables[0].room_id)))return 'I tavoli selezionati devono appartenere alla stessa sala abilitata.';
 const blocks=await serviceBlocks(db,date,service);
 if(blocks.some(b=>b.scope==='service'))return `Il servizio di ${when} è chiuso: non puoi aggiungere prenotazioni.`;
 const ev=await eventRoomBlocked(db,date,service,tables[0].room_id);
 if(ev)return `Prenotazione non consentita: la sala è riservata per «${clean(ev.title,100)}» durante il ${when}. Scegli un'altra sala o un altro servizio.`;
 if(blocks.some(b=>b.scope==='room'&&Number(b.target_id)===Number(tables[0].room_id)))return `La sala selezionata è stata bloccata dall’ADMIN per il ${when}.`;
 const blocked=new Set(blocks.filter(b=>b.scope==='table').map(b=>Number(b.target_id)));
 const blockedCodes=tables.filter(t=>blocked.has(Number(t.id))).map(t=>t.code);
 if(blockedCodes.length)return `Tavolo ${blockedCodes.join(', ')} non disponibile: bloccato dall’ADMIN per il ${when}.`;
 const occupied=await db.prepare(`SELECT DISTINCT t.code FROM reservation_tables rt JOIN tables t ON t.id=rt.table_id
 WHERE rt.book_date=? AND rt.service=? AND rt.table_id IN (${marks})`).bind(date,service,...ids).all();
 if(occupied.results?.length)return `Tavolo ${occupied.results.map(t=>t.code).join(', ')} già prenotato per il ${when}.`;
 const max=tables.reduce((n,t)=>n+Number(t.seats),0),min=tables.reduce((n,t)=>n+Number(t.min_seats),0);
 if(party>max||party<min)return `Capienza non compatibile: i tavoli selezionati accolgono da ${min} a ${max} persone, mentre la prenotazione è per ${party}.`;
 return `Impossibile assegnare i tavoli scelti per il ${when}. Aggiorna la piantina e riprova.`;
}
async function validateBooking(db,b,admin=false){const cfg=await config(db,'booking');const d=clean(b.date,10),tm=clean(b.time,5),svc=clean(b.service,10);if(!dateOk(d)||!timeOk(tm)||!['lunch','dinner'].includes(svc))throw Error('Data, servizio o orario non validi');if(!admin){if(d<today())throw Error('La data selezionata è passata');const max=new Date();max.setDate(max.getDate()+(Number(cfg.maxDaysAhead)||90));if(d>max.toLocaleDateString('en-CA',{timeZone:'Europe/Rome'}))throw Error('Data troppo lontana');if(!cfg.weekdays.includes(weekday(d))||cfg.closedDates?.includes(d))throw Error('Ristorante chiuso nella data selezionata')}
const hours=cfg[svc]||{};if(!admin){if(!hours.enabled||minutes(tm)<minutes(hours.start||'00:00')||minutes(tm)>minutes(hours.last||hours.end||'23:59'))throw Error('Orario non prenotabile');const italyNow=new Date(Date.now()+(Number(cfg.minNoticeMinutes)||0)*60000).toLocaleString('sv-SE',{timeZone:'Europe/Rome'}).replace(' ','T');if(d===today()&&(d+'T'+tm)<italyNow)throw Error('Prenotazione troppo vicina all’orario attuale')}const party=Number(b.party_size);if(!Number.isInteger(party)||party<1||party>(admin?200:Number(cfg.maxOnline||9)))throw Error(admin?'Numero persone non valido':'Per gruppi da 10 persone chiamaci direttamente');const rooms=await db.prepare(`SELECT id FROM rooms WHERE ${admin?'internal_enabled=1':'public_enabled=1'} ORDER BY sort_order,id`).all();const ids=rooms.results.map(r=>r.id).filter(id=>admin||!cfg.disabledDatesByRoom?.[String(id)]?.includes(d));return {cfg,d,tm,svc,party,ids}}
async function saveBooking(ctx,b,admin=false){const db=ctx.env.DB;const {d,tm,svc,party,ids}=await validateBooking(db,b,admin);const name=clean(b.name,120),phone=clean(b.phone,40),mail=clean(b.email,180).toLowerCase(),notes=clean(b.notes,600);if(!name||!phone||!validEmail(mail))throw Error('Nome, telefono ed email valida sono obbligatori');const usable=(admin&&b.room_id)?[Number(b.room_id)]:ids;let opts;
if(admin&&Array.isArray(b.table_ids)&&b.table_ids.length){
 const requested=b.table_ids.map(Number);
 const explicit=await manualTableCandidate(db,usable,d,svc,party,requested);
 if(!explicit)throw Error(await manualTableUnavailableReason(db,usable,d,svc,party,requested));
 opts=[explicit]; // Never silently assign different tables when staff requested exact IDs.
}else{opts=await candidates(db,usable,d,svc,party)}
if(!opts.length)throw Error(await bookingUnavailableReason(db,usable,d,svc,party,admin));const token=rand(),hashed=await digest(token);let lastError;for(const o of opts){try{if(await eventRoomBlocked(db,d,svc,o.room_id)){if(admin)throw Error(await bookingUnavailableReason(db,usable,d,svc,party,admin));continue}const insert=db.prepare('INSERT INTO reservations(book_date,service,time,party_size,name,email,phone,notes,source,room_id,cancel_token_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(d,svc,tm,party,name,mail,phone,notes,admin?'staff':'web',o.room_id,hashed);const seq=await db.batch([insert]);const id=seq[0].meta.last_row_id;try{await db.batch(o.ids.map(tid=>db.prepare('INSERT INTO reservation_tables(reservation_id,table_id,book_date,service) VALUES(?,?,?,?)').bind(id,tid,d,svc)))}catch(e){await db.prepare('DELETE FROM reservations WHERE id=?').bind(id).run();throw e}const origin=ctx.env.PUBLIC_URL||new URL(ctx.request.url).origin;const cancellation=origin+'/annulla?token='+token;
const booking={id,book_date:d,service:svc,time:tm,party_size:party,name,phone,email:mail,source:admin?'staff':'web'};
let mailResult={status:'unconfigured'};
try{await syncCustomer(db,booking);await alertStaff(db,id,'new','Nuova prenotazione #'+id,`${d} ${svc==='lunch'?'Pranzo':'Cena'} · ${tm} · ${name} · ${party} persone`)}catch(e){console.error('Oasi fase2 post-book',e)}
try{mailResult=await emailForBooking(ctx,booking,'confirm',cancellation);await emailStaff(ctx,booking,'new')}catch(e){console.error('Oasi email confirm',e)}
return {id,date:d,service:svc,time:tm,party_size:party,room_id:o.room_id,table_ids:o.ids,cancel_url:cancellation,email_status:mailResult.status,email_sent_configured:!!(ctx.env.RESEND_API_KEY&&ctx.env.EMAIL_FROM)};
}catch(e){lastError=e;const detail=String(e);if(detail.includes('oasi_event_room_reserved')){if(admin)throw Error(await bookingUnavailableReason(db,usable,d,svc,party,admin));continue}if(!detail.includes('UNIQUE constraint failed'))throw e}}throw Error('Disponibilità appena esaurita: '+await bookingUnavailableReason(db,usable,d,svc,party,admin))}
async function adminRoute(ctx,parts,method){const db=ctx.env.DB,b=(method==='GET'||parts[1]==='upload')?{}:await read(ctx.request),resource=parts[1]||'';if(resource==='login'&&method==='POST'){
 // Accesso unico: l'utente inserisce solo la password impostata come Secret su Cloudflare.
 const configuredPass=ctx.env.ADMIN_PASSWORD;
 if(typeof configuredPass!=='string'||configuredPass.length===0)return fail('Configurazione ADMIN incompleta: aggiungi ADMIN_PASSWORD come Secret di produzione su Cloudflare',503);
 const supplied=String(b.password||'');
 if(!supplied||!(await equalSecret(supplied,configuredPass)))return fail('Password non valida',401);
 const internalEmail='oasi-admin@internal.invalid'; // solo identificatore tecnico D1, non email di accesso
 // Deriva una sola volta una nuova impronta compatibile con Cloudflare (max 100.000 iterazioni).
 // Il segreto di Cloudflare e' gia' stato verificato: non occorre ricalcolare la password
 // una seconda volta. Se l'account usa ancora l'hash precedente, aggiorna e invalida
 // le sessioni esistenti, senza cancellare dati o modificare le credenziali.
 const rowBefore=await db.prepare('SELECT * FROM users WHERE email=?').bind(internalEmail).first();
 const storedSalt=rowBefore?.password_hash?.split(':')[0];
 const hashed=await passwordHash(configuredPass,storedSalt&&/^[a-f0-9]{32}$/.test(storedSalt)?storedSalt:undefined);
 if(!rowBefore){
  await db.prepare('INSERT INTO users(email,password_hash) VALUES(?,?)').bind(internalEmail,hashed).run();
 }else if(rowBefore.password_hash!==hashed){
  await db.batch([db.prepare('DELETE FROM sessions WHERE user_id=?').bind(rowBefore.id),db.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(hashed,rowBefore.id)]);
 }
 const row=await db.prepare('SELECT id FROM users WHERE email=?').bind(internalEmail).first();
 // Un solo account autorizzato: le vecchie sessioni email non danno accesso all'ADMIN.
 await db.prepare('DELETE FROM sessions WHERE user_id<>?').bind(row.id).run();
 const token=rand(),exp=new Date(Date.now()+7*86400000).toISOString();
 await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),row.id,exp).run();
 return json({ok:true},200,{'set-cookie':cookie(token,new URL(ctx.request.url).protocol==='https:')});
}
const user=await currentUser(db,ctx.request);
if(!user||user.email!=='oasi-admin@internal.invalid')return fail('Accesso richiesto',401);
if(resource==='events')return eventsAdmin(ctx,parts,method,b);
if(resource==='me')return json({user});
if(resource==='logout'&&method==='POST'){const token=(ctx.request.headers.get('cookie')||'').match(/oasi_session=([a-f0-9]+)/)?.[1];if(token)await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();return json({ok:true},200,{'set-cookie':'oasi_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'})}
if(resource==='analytics'&&method==='GET'){
 const q=new URL(ctx.request.url).searchParams;
 const start=q.get('start')||today(),end=q.get('end')||today();
 const service=q.get('service')||'all',roomId=Number(q.get('room')||0);
 if(!dateOk(start)||!dateOk(end)||start>end)return fail('Intervallo date non valido');
 const days=Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000);
 if(days>366)return fail('Seleziona al massimo 367 giorni per report');
 if(!['all','lunch','dinner'].includes(service)||!Number.isInteger(roomId)||roomId<0)return fail('Filtri non validi');
 await ensureOperations(db);
 const baseQuery=`SELECT r.id,r.book_date,r.service,r.time,r.room_id,r.party_size,r.status,r.source,r.name,r.phone,r.email,
 COALESCE(v.state,'expected') visit_state,
 (SELECT cr.customer_id FROM oasi_customer_reservations cr WHERE cr.reservation_id=r.id LIMIT 1) customer_id,
 (SELECT GROUP_CONCAT(t.code,', ') FROM reservation_tables rt JOIN tables t ON t.id=rt.table_id WHERE rt.reservation_id=r.id) table_codes
 FROM reservations r LEFT JOIN service_visits v ON v.reservation_id=r.id WHERE `;
 const getRows=async(from,to)=>{const args=[from,to];let clause='r.book_date>=? AND r.book_date<=?';if(service!=='all'){clause+=' AND r.service=?';args.push(service)}if(roomId){clause+=' AND r.room_id=?';args.push(roomId)}return (await db.prepare(baseQuery+clause+' ORDER BY r.book_date,r.service,r.time,r.id').bind(...args).all()).results||[]};
 const shift=(iso,n)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 const previous={start:shift(start,-(days+1)),end:shift(start,-1)};
 const [original,prior,rs]=await Promise.all([getRows(start,end),getRows(previous.start,previous.end),db.prepare('SELECT id,name FROM rooms ORDER BY sort_order,id').all()]);
 const rooms=rs.results||[];const roomName=id=>rooms.find(z=>Number(z.id)===Number(id))?.name||'Sala non specificata';
 const rows=original.map(r=>({...r,room_name:roomName(r.room_id)}));
 const currentDay=today();const isVisit=r=>r.status==='confirmed'&&['seated','finished'].includes(r.visit_state)&&r.book_date<=currentDay;
 const summarize=records=>{const valid=records.filter(r=>r.status==='confirmed'),visits=valid.filter(isVisit),cancelled=records.filter(r=>r.status==='cancelled');return {bookings:valid.length,covers:valid.reduce((n,r)=>n+Number(r.party_size||0),0),visits:visits.length,visited_covers:visits.reduce((n,r)=>n+Number(r.party_size||0),0),cancelled:cancelled.length,no_show:valid.filter(r=>r.visit_state==='no_show').length,avg_party:valid.length?Number((valid.reduce((n,r)=>n+Number(r.party_size||0),0)/valid.length).toFixed(1)):0}};
 const summary=summarize(rows),previousSummary=summarize(prior);
 const visits=rows.filter(isVisit);const visitCounts=new Map();for(const r of visits){if(r.customer_id)visitCounts.set(r.customer_id,(visitCounts.get(r.customer_id)||0)+1)}
 summary.repeat_customers=[...visitCounts.values()].filter(n=>n>=2).length;
 const services={lunch:{bookings:0,covers:0,visits:0},dinner:{bookings:0,covers:0,visits:0}},roomsMap=new Map(),sources={web:0,staff:0,other:0},hourMap=new Map();
 const dayMap=new Map();for(let i=0;i<=days;i++){const date=shift(start,i);dayMap.set(date,{date,bookings:0,covers:0,visits:0,visited_covers:0,cancelled:0,no_show:0})}
 for(const row of rows){const active=row.status==='confirmed',real=isVisit(row),covers=Number(row.party_size||0),d=dayMap.get(row.book_date);if(!d)continue;
  if(active){d.bookings++;d.covers+=covers;const svc=services[row.service];if(svc){svc.bookings++;svc.covers+=covers;if(real)svc.visits++}sources[row.source==='web'?'web':row.source==='staff'?'staff':'other']++;
   const hour=String(row.time||'').slice(0,2);if(/^\d{2}$/.test(hour))hourMap.set(hour,(hourMap.get(hour)||0)+1);
  }
  if(real){d.visits++;d.visited_covers+=covers}if(row.status==='cancelled')d.cancelled++;if(active&&row.visit_state==='no_show')d.no_show++;
  const room=roomsMap.get(row.room_id)||{id:row.room_id,name:row.room_name,bookings:0,covers:0,visits:0};if(active){room.bookings++;room.covers+=covers;if(real)room.visits++}roomsMap.set(row.room_id,room);
 }
 const dayRows=[...dayMap.values()];
 const monthly=new Map();for(const d of dayRows){const month=d.date.slice(0,7);const m=monthly.get(month)||{date:month,bookings:0,covers:0,visits:0,visited_covers:0,cancelled:0,no_show:0};for(const k of ['bookings','covers','visits','visited_covers','cancelled','no_show'])m[k]+=d[k];monthly.set(month,m)}
 const weekdayNames=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];const weekdays=weekdayNames.map(name=>({name,bookings:0,covers:0,visits:0}));for(const d of dayRows){const idx=new Date(d.date+'T12:00:00Z').getUTCDay();weekdays[idx].bookings+=d.bookings;weekdays[idx].covers+=d.covers;weekdays[idx].visits+=d.visits}
 return json({range:{start,end,service,room:roomId},previous_range:previous,summary,previous_summary:previousSummary,days:dayRows,months:[...monthly.values()],weekdays,peak_hours:[...hourMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([hour,bookings])=>({hour:hour+':00',bookings})),services,rooms:[...roomsMap.values()].filter(r=>r.bookings).sort((a,b)=>b.covers-a.covers),sources,room_options:rooms,rows});
}
if(resource==='customers'){
 await ensurePhase2(db);
 if(method==='GET'){
  const url=new URL(ctx.request.url),q=clean(url.searchParams.get('q')||'',100);
  const lookup=url.searchParams.get('lookup')==='1';
  if(lookup){
   const mail=clean(url.searchParams.get('email')||'',180).toLowerCase();
   const digits=String(url.searchParams.get('phone')||'').replace(/\D/g,'').slice(-15);
   if(!mail&&!digits)return json([]);
   const sql=`SELECT id,name,email,phone FROM oasi_customers WHERE (?<>'' AND lower(email)=?) OR (?<>'' AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,' ',''),'+',''),'-',''),'(',''),')','') LIKE ?) ORDER BY CASE WHEN lower(email)=? THEN 0 ELSE 1 END,id LIMIT 8`;
   const found=await db.prepare(sql).bind(mail,mail,digits,'%'+digits,mail).all();
   return json(found.results||[]);
  }
  const sql=`SELECT c.*,
   (SELECT COUNT(*) FROM oasi_customer_reservations cr JOIN reservations r ON r.id=cr.reservation_id WHERE cr.customer_id=c.id) total_bookings,
   (SELECT COUNT(*) FROM oasi_customer_reservations cr JOIN reservations r ON r.id=cr.reservation_id LEFT JOIN service_visits v ON v.reservation_id=r.id WHERE cr.customer_id=c.id AND r.status='confirmed' AND COALESCE(v.state,'expected') IN ('seated','finished') AND r.book_date<=?) actual_visits,
   (SELECT MAX(r.book_date) FROM oasi_customer_reservations cr JOIN reservations r ON r.id=cr.reservation_id WHERE cr.customer_id=c.id) last_booking,
   (SELECT MAX(r.book_date) FROM oasi_customer_reservations cr JOIN reservations r ON r.id=cr.reservation_id LEFT JOIN service_visits v ON v.reservation_id=r.id WHERE cr.customer_id=c.id AND r.status='confirmed' AND COALESCE(v.state,'expected') IN ('seated','finished') AND r.book_date<=?) last_visit,
   (SELECT MIN(r.book_date) FROM oasi_customer_reservations cr JOIN reservations r ON r.id=cr.reservation_id WHERE cr.customer_id=c.id AND r.status='confirmed' AND r.book_date>=?) next_booking
   FROM oasi_customers c WHERE (?='' OR c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?) ORDER BY COALESCE(last_booking,'') DESC,c.name LIMIT 250`;
  const results=await db.prepare(sql).bind(today(),today(),today(),q,'%'+q+'%','%'+q+'%','%'+q+'%').all();
  return json(results.results||[]);
 }
 if(method==='PATCH'){
  const id=Number(parts[2]);if(!Number.isInteger(id)||id<1)return fail('Cliente non valido');
  const row=await db.prepare('SELECT * FROM oasi_customers WHERE id=?').bind(id).first();if(!row)return fail('Cliente non trovato',404);
  const name=clean(b.name,120),phone=clean(b.phone,40),email=clean(b.email,180).toLowerCase(),staff_note=clean(b.staff_note,500);
  if(!name||!phone||!validEmail(email))return fail('Nome, telefono ed email valida sono obbligatori');
  const other=await db.prepare('SELECT id FROM oasi_customers WHERE email=? AND id<>?').bind(email,id).first();
  if(other)return fail('Email già associata a un altro cliente. Verifica la scheda, non creare duplicati.',409);
  await db.prepare('UPDATE oasi_customers SET name=?,phone=?,email=?,staff_note=?,updated_at=? WHERE id=?').bind(name,phone,email,staff_note,now(),id).run();return json({ok:true})
 }
 if(method==='DELETE'){
  const id=Number(parts[2]);await db.prepare('DELETE FROM oasi_customers WHERE id=?').bind(id).run();return json({ok:true,note:'Le prenotazioni restano conservate secondo le regole di gestione.'})
 }
 return fail('Metodo non consentito',405)
}
if(resource==='customer-history'&&method==='GET'){
 await ensurePhase2(db);const id=Number(parts[2]),customer=await db.prepare('SELECT * FROM oasi_customers WHERE id=?').bind(id).first();
 if(!customer)return fail('Cliente non trovato',404);
 const sql=`SELECT r.id,r.book_date,r.service,r.time,r.party_size,r.status,r.source,COALESCE(v.state,'expected') visit_state,
 (SELECT GROUP_CONCAT(t.code,', ') FROM reservation_tables rt JOIN tables t ON t.id=rt.table_id WHERE rt.reservation_id=r.id) table_codes
 FROM oasi_customer_reservations cr JOIN reservations r ON r.id=cr.reservation_id LEFT JOIN service_visits v ON v.reservation_id=r.id WHERE cr.customer_id=? ORDER BY r.book_date DESC,r.time DESC LIMIT 200`;
 const result=await db.prepare(sql).bind(id).all();
 const bookings=result.results||[];
 const stats=await db.prepare(`SELECT COUNT(*) bookings,
 SUM(CASE WHEN r.status='confirmed' AND r.book_date<=? AND COALESCE(v.state,'expected') IN ('seated','finished') THEN 1 ELSE 0 END) visits,
 SUM(CASE WHEN r.status='cancelled' THEN 1 ELSE 0 END) cancelled,
 SUM(CASE WHEN COALESCE(v.state,'expected')='no_show' THEN 1 ELSE 0 END) no_shows,
 MAX(CASE WHEN r.status='confirmed' AND r.book_date<=? AND COALESCE(v.state,'expected') IN ('seated','finished') THEN r.book_date END) last_visit
 FROM oasi_customer_reservations cr JOIN reservations r ON r.id=cr.reservation_id LEFT JOIN service_visits v ON v.reservation_id=r.id WHERE cr.customer_id=?`).bind(today(),today(),id).first();
 return json({customer,bookings,stats:stats||{}})
}
if(resource==='notifications'){
 await ensurePhase2(db);
 if(method==='GET'){
  if(new URL(ctx.request.url).searchParams.get('count')==='1'){const found=await db.prepare('SELECT COUNT(*) unread FROM oasi_staff_notifications WHERE seen=0').first();return json({unread:Number(found?.unread||0)})}
  const found=await db.prepare(`SELECT n.*,r.book_date,r.service FROM oasi_staff_notifications n LEFT JOIN reservations r ON r.id=n.reservation_id ORDER BY n.created_at DESC,n.id DESC LIMIT 100`).all();return json(found.results||[]);
 }
 if(method==='PATCH'){const id=Number(parts[2]);if(!Number.isInteger(id)||id<1)return fail('ID non valido');await db.prepare('UPDATE oasi_staff_notifications SET seen=1 WHERE id=?').bind(id).run();return json({ok:true})}
 if(method==='POST'&&parts[2]==='mark-all'){await db.prepare('UPDATE oasi_staff_notifications SET seen=1 WHERE seen=0').run();return json({ok:true})}
 return fail('Metodo non consentito',405)
}
if(resource==='email-log'){
 await ensurePhase2(db);
 if(method==='GET')return json({configured:!!(ctx.env.RESEND_API_KEY&&ctx.env.EMAIL_FROM),sender:ctx.env.EMAIL_FROM||'',items:(await db.prepare('SELECT id,reservation_id,recipient,email_type,subject,status,error,created_at,attempted_at FROM oasi_email_log ORDER BY id DESC LIMIT 100').all()).results||[]});
 return fail('Metodo non consentito',405)
}
if(resource==='operations'){
 if(method!=='GET')return fail('Metodo non valido',405);
 const query=new URL(ctx.request.url).searchParams,date=query.get('date')||today(),service=query.get('service')||'all';
 if(!dateOk(date)||!['all','lunch','dinner'].includes(service))return fail('Data o servizio non valido');
 return json(await operationsData(db,date,service));
}
if(resource==='visits'){
 if(method!=='PATCH')return fail('Metodo non valido',405);
 await ensureOperations(db);
 const id=Number(parts[2]),state=clean(b.state,30),note=clean(b.note,500);
 if(!Number.isInteger(id)||id<=0||!['expected','arrived','seated','finished','no_show'].includes(state))return fail('Stato non valido');
 const res=await db.prepare('SELECT id,status FROM reservations WHERE id=?').bind(id).first();
 if(!res)return fail('Prenotazione inesistente',404);
 if(res.status!=='confirmed')return fail('Non puoi aggiornare una prenotazione annullata',409);
 await db.prepare(`INSERT INTO service_visits(reservation_id,state,updated_at,note) VALUES(?,?,?,?) ON CONFLICT(reservation_id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at,note=excluded.note`).bind(id,state,now(),note).run();
 return json({ok:true,reservation_id:id,state});
}
if(resource==='blocks'){
 await ensureOperations(db);
 if(method==='GET'){
  const q=new URL(ctx.request.url).searchParams,date=q.get('date')||today(),service=q.get('service')||'all';
  if(!dateOk(date)||!['all','lunch','dinner'].includes(service))return fail('Data o servizio non valido');
  const args=service==='all'?[date]:[date,service];
  const rows=await db.prepare('SELECT * FROM service_blocks WHERE book_date=? '+(service==='all'?'':'AND service=? ')+'ORDER BY service,scope,id').bind(...args).all();return json(rows.results||[]);
 }
 if(method==='POST'){
  const date=clean(b.date,10),service=clean(b.service,8),scope=clean(b.scope,10),target=scope==='service'?0:Number(b.target_id);
  if(!dateOk(date)||!['lunch','dinner'].includes(service)||!['service','room','table'].includes(scope)||!Number.isInteger(target)||target<0||(scope!=='service'&&target<1))return fail('Dati blocco non validi');
  if(scope==='room'&&!(await db.prepare('SELECT id FROM rooms WHERE id=?').bind(target).first()))return fail('Sala inesistente',404);
  if(scope==='table'&&!(await db.prepare('SELECT id FROM tables WHERE id=?').bind(target).first()))return fail('Tavolo inesistente',404);
  await db.prepare(`INSERT INTO service_blocks(book_date,service,scope,target_id,reason,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(book_date,service,scope,target_id) DO UPDATE SET reason=excluded.reason`).bind(date,service,scope,target,clean(b.reason,200),now()).run();
  return json({ok:true});
 }
 if(method==='DELETE'){
  const id=Number(parts[2]);if(!Number.isInteger(id)||id<1)return fail('Blocco non valido');
  await db.prepare('DELETE FROM service_blocks WHERE id=?').bind(id).run();return json({ok:true});
 }
 return fail('Metodo non valido',405);
}
if(resource==='dashboard'){const date=clean(new URL(ctx.request.url).searchParams.get('date')||today());const bookings=await db.prepare("SELECT service,COUNT(*) bookings,COALESCE(SUM(party_size),0) guests FROM reservations WHERE book_date=? AND status='confirmed' GROUP BY service").bind(date).all();const month=await db.prepare("SELECT substr(book_date,1,7) month,COUNT(*) bookings,COALESCE(SUM(party_size),0) guests FROM reservations WHERE status='confirmed' GROUP BY substr(book_date,1,7) ORDER BY month DESC LIMIT 12").all();return json({bookings:bookings.results,months:month.results})}
if(resource==='settings'){if(method==='GET')return json({site:await config(db,'site'),booking:await config(db,'booking')});if(method==='PUT'){const key=parts[2];if(!['site','booking'].includes(key))return fail('Impostazione non valida');await db.prepare('UPDATE settings SET value=? WHERE key=?').bind(JSON.stringify(b),key).run();return json({ok:true})}}
if(resource==='floor-elements'){
 // Schema idempotente: evita errori 500 quando la migrazione 0002 non e' stata eseguita.
 await db.prepare(`CREATE TABLE IF NOT EXISTS floor_elements (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('wall','column','door','window','label')),
 label TEXT NOT NULL DEFAULT '',
 x REAL NOT NULL DEFAULT 0, y REAL NOT NULL DEFAULT 0,
 w REAL NOT NULL DEFAULT 80, h REAL NOT NULL DEFAULT 20, rotation REAL NOT NULL DEFAULT 0
 )`).run();

 const allowed=['wall','column','door','window','label'];
 if(method==='GET')return json((await db.prepare('SELECT * FROM floor_elements ORDER BY room_id,id').all()).results);
 if(method==='POST'||method==='PUT'){
  const roomId=Number(b.room_id),kind=clean(b.kind,20),label=clean(b.label,80);
  if(!allowed.includes(kind))return fail('Tipo elemento non valido');
  const room=await db.prepare('SELECT id FROM rooms WHERE id=?').bind(roomId).first();if(!room)return fail('Sala non trovata');
  const numbers=['x','y','w','h','rotation'].map(k=>Number(b[k]));
  if(numbers.some(n=>!Number.isFinite(n)))return fail('Coordinate non valide');
  let [x,y,w,h,rotation]=numbers; x=Math.max(0,Math.min(2000,x));y=Math.max(0,Math.min(2000,y));w=Math.max(8,Math.min(2000,w));h=Math.max(8,Math.min(2000,h));
  if(method==='POST'){
   const r=await db.prepare('INSERT INTO floor_elements(room_id,kind,label,x,y,w,h,rotation) VALUES(?,?,?,?,?,?,?,?)').bind(roomId,kind,label,x,y,w,h,rotation).run();return json({ok:true,id:r.meta.last_row_id});
  }
  await db.prepare('UPDATE floor_elements SET room_id=?,kind=?,label=?,x=?,y=?,w=?,h=?,rotation=? WHERE id=?').bind(roomId,kind,label,x,y,w,h,rotation,Number(parts[2])).run();return json({ok:true});
 }
 if(method==='DELETE'){await db.prepare('DELETE FROM floor_elements WHERE id=?').bind(Number(parts[2])).run();return json({ok:true})}
}
if(resource==='rooms'){if(method==='GET')return json((await db.prepare('SELECT * FROM rooms ORDER BY sort_order,id').all()).results);if(method==='POST'){await db.prepare('INSERT INTO rooms(name,public_enabled,internal_enabled,sort_order) VALUES(?,?,?,?)').bind(clean(b.name,80),b.public_enabled?1:0,1,Number(b.sort_order)||0).run();return json({ok:true})}if(method==='PUT'){await db.prepare('UPDATE rooms SET name=?,public_enabled=?,internal_enabled=?,sort_order=? WHERE id=?').bind(clean(b.name,80),b.public_enabled?1:0,b.internal_enabled?1:0,Number(b.sort_order)||0,Number(parts[2])).run();return json({ok:true})}if(method==='DELETE'){const n=await db.prepare('SELECT COUNT(*) n FROM tables WHERE room_id=?').bind(Number(parts[2])).first();if(n.n)return fail('Elimina prima i tavoli della sala');await db.prepare('DELETE FROM rooms WHERE id=?').bind(Number(parts[2])).run();return json({ok:true})}}
if(resource==='floor-template'){
 await ensureFloorV3(db);
 const roomId=Number(new URL(ctx.request.url).searchParams.get('room_id')||b.room_id||parts[2]);
 if(!Number.isInteger(roomId)||roomId<=0)return fail('Sala non valida');
 if(method==='GET')return json(await loadRoomTemplate(db,roomId));
 if(method==='PUT'){await saveRoomTemplate(db,roomId);return json({ok:true,message:'Piantina standard salvata'})}
 if(method==='POST'){const ok=await restoreRoomTemplate(db,roomId);if(!ok)return fail('Nessuna piantina standard salvata per questa sala',404);return json({ok:true,message:'Piantina standard ripristinata'})}
 if(method==='DELETE'){await db.prepare('DELETE FROM floor_plan_templates WHERE room_id=?').bind(roomId).run();return json({ok:true})}
 return fail('Operazione non consentita',405);
}
if(['table-links','room-zones'].includes(resource)){
 await ensureFloorV3(db);
 if(resource==='table-links'){
   if(method==='GET')return json((await db.prepare('SELECT * FROM table_links ORDER BY table_a,table_b').all()).results);
   const a=Number(b.table_a),z=Number(b.table_b);const one=Math.min(a,z),two=Math.max(a,z);
   if(!Number.isInteger(one)||!Number.isInteger(two)||one===two||one<=0)return fail('Seleziona due tavoli diversi');
   const rows=(await db.prepare('SELECT id,room_id FROM tables WHERE id IN (?,?)').bind(one,two).all()).results;
   if(rows.length!==2||rows[0].room_id!==rows[1].room_id)return fail('I tavoli devono appartenere alla stessa sala');
   if(method==='POST'){await db.prepare('INSERT OR IGNORE INTO table_links(table_a,table_b) VALUES(?,?)').bind(one,two).run();return json({ok:true})}
   if(method==='DELETE'){await db.prepare('DELETE FROM table_links WHERE table_a=? AND table_b=?').bind(one,two).run();return json({ok:true})}
 }
 if(resource==='room-zones'){
   if(method==='GET')return json((await db.prepare('SELECT * FROM room_zones ORDER BY room_id,id').all()).results);
   if(method==='POST'||method==='PUT'){
     const roomId=Number(b.room_id),x=Number(b.x),y=Number(b.y),w=Number(b.w),h=Number(b.h);if(!Number.isInteger(roomId)||![x,y,w,h].every(Number.isFinite)||w<70||h<70||x<0||y<0||x+w>1100||y+h>700)return fail('La zona deve restare nella piantina (1100 × 700) e misurare almeno 70 × 70');
     const room=await db.prepare('SELECT id FROM rooms WHERE id=?').bind(roomId).first();if(!room)return fail('Sala non trovata');
     if(method==='POST'){const r=await db.prepare('INSERT INTO room_zones(room_id,label,x,y,w,h) VALUES(?,?,?,?,?,?)').bind(roomId,clean(b.label,80),x,y,w,h).run();return json({ok:true,id:r.meta.last_row_id})}
     await db.prepare('UPDATE room_zones SET label=?,x=?,y=?,w=?,h=? WHERE id=? AND room_id=?').bind(clean(b.label,80),x,y,w,h,Number(parts[2]),roomId).run();return json({ok:true});
   }
   if(method==='DELETE'){await db.prepare('DELETE FROM room_zones WHERE id=?').bind(Number(parts[2])).run();return json({ok:true})}
 }
 return fail('Operazione non consentita',405);
}
if(resource==='tables'){
 await ensureFloorV3(db);
 if(method==='GET')return json((await db.prepare('SELECT t.*,COALESCE(d.min_seats,1) min_seats,COALESCE(d.module_count,1) module_count FROM tables t LEFT JOIN table_details d ON d.table_id=t.id ORDER BY t.room_id,t.id').all()).results);
 if(method==='POST'||method==='PUT'){
  const shape=['circle','square','rectangle'].includes(b.shape)?b.shape:'square';const modules=Math.max(1,Math.min(8,Math.trunc(Number(b.module_count)||1)));
  const max=Math.trunc(Number(b.seats)),min=Math.trunc(Number(b.min_seats));
  if(!Number.isInteger(max)||!Number.isInteger(min)||min<1||max<min||max>100)return fail('Imposta posti minimi e massimi validi');
  const inferredOrientation=shape==='rectangle'?(String(b.orientation||'').toLowerCase()==='vertical'||((Number(b.h)||0)>(Number(b.w)||0))?'vertical':'horizontal'):'horizontal';
  const proposed=geometry(shape,modules,inferredOrientation);
  const customW=b.w==null?proposed.w:Number(b.w),customH=b.h==null?proposed.h:Number(b.h);
  if(!Number.isFinite(customW)||!Number.isFinite(customH)||customW<55||customH<55||customW>1100||customH>700)return fail('Le dimensioni del tavolo non sono valide');
  const g={w:Math.round(customW),h:Math.round(customH)}, code=clean(b.code,30);if(!code)return fail('Inserisci il numero tavolo');
  const x=Number(b.x),y=Number(b.y);if(!Number.isFinite(x)||!Number.isFinite(y))return fail('Posizione tavolo non valida');
  const xx=Math.max(0,Math.min(1100-g.w,Math.round(x))),yy=Math.max(0,Math.min(700-g.h,Math.round(y)));
  const rot=Number(b.rotation)||0, enabled=b.enabled?1:0;
  if(method==='POST'){
   const r=await db.prepare('INSERT INTO tables(room_id,code,shape,seats,x,y,w,h,rotation,enabled,group_code) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(Number(b.room_id),code,shape,max,xx,yy,g.w,g.h,rot,enabled,'').run();
   await db.prepare('INSERT INTO table_details(table_id,min_seats,module_count) VALUES(?,?,?)').bind(r.meta.last_row_id,min,modules).run();return json({ok:true,id:r.meta.last_row_id});
  }
  const id=Number(parts[2]);const prior=await db.prepare('SELECT id,room_id FROM tables WHERE id=?').bind(id).first();if(!prior)return fail('Tavolo non trovato',404);
  await db.prepare('UPDATE tables SET code=?,shape=?,seats=?,x=?,y=?,w=?,h=?,rotation=?,enabled=?,group_code=? WHERE id=?').bind(code,shape,max,xx,yy,g.w,g.h,rot,enabled,'',id).run();
  await db.prepare('INSERT INTO table_details(table_id,min_seats,module_count) VALUES(?,?,?) ON CONFLICT(table_id) DO UPDATE SET min_seats=excluded.min_seats,module_count=excluded.module_count').bind(id,min,modules).run();
  return json({ok:true});
 }
 if(method==='DELETE'){const id=Number(parts[2]);const count=await db.prepare('SELECT COUNT(*) n FROM reservation_tables WHERE table_id=?').bind(id).first();if(count.n)return fail('Questo tavolo ha prenotazioni storiche: disattivalo invece di eliminarlo');await db.prepare('DELETE FROM table_links WHERE table_a=? OR table_b=?').bind(id,id).run();await db.prepare('DELETE FROM table_details WHERE table_id=?').bind(id).run();await db.prepare('DELETE FROM tables WHERE id=?').bind(id).run();return json({ok:true})}
}
if(resource==='reservations'){if(method==='GET'){await ensureOperations(db);const q=new URL(ctx.request.url).searchParams;const date=q.get('date')||today(),service=q.get('service')||'all';if(!dateOk(date))return fail('Data non valida');if(!['all','lunch','dinner'].includes(service))return fail('Servizio non valido');const sql="SELECT r.*,COALESCE(v.state,'expected') visit_state,GROUP_CONCAT(t.code, ', ') table_codes,GROUP_CONCAT(t.id) table_ids FROM reservations r LEFT JOIN service_visits v ON v.reservation_id=r.id LEFT JOIN reservation_tables rt ON rt.reservation_id=r.id LEFT JOIN tables t ON t.id=rt.table_id WHERE r.book_date=? "+(service==='all'?'':'AND r.service=? ')+"GROUP BY r.id ORDER BY CASE r.service WHEN 'lunch' THEN 0 ELSE 1 END,r.time,r.id";const statement=db.prepare(sql);const rows=await (service==='all'?statement.bind(date):statement.bind(date,service)).all();return json(rows.results)}if(method==='POST'){try{return json(await saveBooking(ctx,b,true),201)}catch(e){return fail(e.message)}}if(method==='PATCH'){const id=+parts[2];const old=await db.prepare('SELECT * FROM reservations WHERE id=?').bind(id).first();if(!old)return fail('Prenotazione non trovata',404);if(b.action==='edit_details'){
 if(old.status!=='confirmed')return fail('Prenotazione annullata: impossibile modificare',409);
 const name=clean(b.name,120),phone=clean(b.phone,40),email=clean(b.email,180).toLowerCase(),notes=clean(b.notes,600),time=clean(b.time,5),party=Number(b.party_size);
 if(!name||!phone||!validEmail(email)||!timeOk(time)||!Number.isInteger(party)||party<1||party>200)return fail('Inserisci nome, telefono ed email valida, oltre ai dati della prenotazione',400);
 await ensureFloorV3(db);
 const assigned=(await db.prepare('SELECT t.id,t.seats,COALESCE(d.min_seats,1) min_seats FROM reservation_tables rt JOIN tables t ON t.id=rt.table_id LEFT JOIN table_details d ON d.table_id=t.id WHERE rt.reservation_id=?').bind(id).all()).results||[];
 if(!assigned.length)return fail('La prenotazione non ha tavoli assegnati',409);
 const minimum=assigned.reduce((n,t)=>n+Number(t.min_seats||1),0),maximum=assigned.reduce((n,t)=>n+Number(t.seats||0),0);
 if(party<minimum||party>maximum)return fail(`Il tavolo assegnato accetta da ${minimum} a ${maximum} persone`,409);
 await db.prepare('UPDATE reservations SET name=?,phone=?,email=?,notes=?,time=?,party_size=? WHERE id=?').bind(name,phone,email,notes,time,party,id).run();
 const changed={...old,name,phone,email,notes,time,party_size:party};let status='unconfigured';
 try{await syncCustomer(db,changed);await alertStaff(db,id,'edit','Prenotazione modificata #'+id,`${old.book_date} · ${name}`);if(old.email!==email||old.time!==time||Number(old.party_size)!==party){const result=await emailForBooking(ctx,changed,'change','',`change:${id}:${Date.now()}`);status=result.status}}catch(e){console.error('Oasi fase2 edit',e)}
 return json({ok:true,id,email_status:status});
} if(b.status==='cancelled'){
 if(old.status==='cancelled')return json({ok:true,already:true});
 await db.batch([db.prepare("UPDATE reservations SET status='cancelled' WHERE id=?").bind(id),db.prepare('DELETE FROM reservation_tables WHERE reservation_id=?').bind(id)]);
 let mailStatus='unconfigured';try{await alertStaff(db,id,'cancel','Prenotazione annullata #'+id,`${old.book_date} · ${old.name}`);mailStatus=(await emailForBooking(ctx,old,'cancel')).status;await emailStaff(ctx,old,'cancel')}catch(e){console.error('Oasi cancel',e)}return json({ok:true,email_status:mailStatus});
}const tableIds=Array.isArray(b.table_ids)?b.table_ids.map(Number):[];if(!tableIds.length)return fail('Indica i tavoli da assegnare');const existing=(await db.prepare('SELECT id,room_id,seats FROM tables WHERE id IN ('+tableIds.map(()=>'?').join(',')+')').bind(...tableIds).all()).results;if(existing.length!==tableIds.length||existing.some(t=>t.room_id!==existing[0].room_id)||existing.reduce((n,t)=>n+t.seats,0)<old.party_size)return fail('Tavoli incompatibili');if(await eventRoomBlocked(db,old.book_date,old.service,existing[0].room_id))return fail('Sala riservata per evento: impossibile spostare qui la prenotazione.',409);try{await db.batch([db.prepare('DELETE FROM reservation_tables WHERE reservation_id=?').bind(id),...tableIds.map(t=>db.prepare('INSERT INTO reservation_tables(reservation_id,table_id,book_date,service) VALUES(?,?,?,?)').bind(id,t,old.book_date,old.service)),db.prepare("UPDATE reservations SET room_id=?,status='confirmed' WHERE id=?").bind(existing[0].room_id,id)]);return json({ok:true})}catch(e){return fail(String(e.message).includes('oasi_event_room_reserved')?'Sala riservata per evento: spostamento non consentito.':'Tavoli già occupati: '+e.message,409)}}}
if(['menu','gallery'].includes(resource)){const table=resource==='menu'?'menu_items':'gallery';if(method==='GET')return json((await db.prepare(`SELECT * FROM ${table} ORDER BY sort_order,id`).all()).results);if(method==='POST'||method==='PUT'){const fields=table==='menu_items'?['section','category','name','description','price','allergens','image_url','region','winery','vintage','available','sort_order']:['image_url','caption','category','sort_order'];const values=fields.map(k=>['available','sort_order'].includes(k)?Number(b[k]??(k==='available'?1:0)):clean(b[k],k==='description'?1400:600));if(method==='POST'){const r=await db.prepare(`INSERT INTO ${table}(${fields.join(',')}) VALUES(${fields.map(()=>'?').join(',')})`).bind(...values).run();return json({ok:true,id:r.meta.last_row_id})}await db.prepare(`UPDATE ${table} SET ${fields.map(f=>f+'=?').join(',')} WHERE id=?`).bind(...values,Number(parts[2])).run();return json({ok:true})}if(method==='DELETE'){await db.prepare(`DELETE FROM ${table} WHERE id=?`).bind(Number(parts[2])).run();return json({ok:true})}}
if(resource==='upload'&&method==='POST'){if(!ctx.env.MEDIA)return fail('Bucket R2 non configurato',503);const form=await ctx.request.formData(),file=form.get('file');if(!file||typeof file==='string'||!file.type.startsWith('image/')||file.size>7*1024*1024)return fail('Carica un’immagine valida fino a 7MB');const ext=({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'})[file.type];if(!ext)return fail('Formato non supportato');const key=rand()+'.'+ext;await ctx.env.MEDIA.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});return json({url:'/api/media/'+key})}
return fail('Rotta non trovata',404)}
export async function onRequest(ctx){try{const url=new URL(ctx.request.url),parts=url.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean),method=ctx.request.method,db=ctx.env.DB;if(parts[0]==='admin'&&parts[1]==='status'&&method==='GET')return json({ok:true,api:true,database:!!ctx.env.DB,password_configured:typeof ctx.env.ADMIN_PASSWORD==='string'&&ctx.env.ADMIN_PASSWORD.length>0});if(!ctx.env.DB)return fail('Database D1 non configurato',503);if(parts[0]==='media'&&method==='GET'){if(!ctx.env.MEDIA)return fail('Bucket non configurato',503);const obj=await ctx.env.MEDIA.get(parts[1]);if(!obj)return fail('Immagine non trovata',404);return new Response(obj.body,{headers:{'content-type':obj.httpMetadata?.contentType||'image/jpeg','cache-control':'public, max-age=86400'}})}
if(parts[0]==='setup')return fail('Configurazione iniziale disabilitata: usa ADMIN_PASSWORD',404);
if(parts[0]==='admin')return adminRoute(ctx,parts,method);
if(parts[0]==='public'&&method==='GET'){const [site,booking,rooms,menu,gallery]=await Promise.all([config(db,'site'),config(db,'booking'),db.prepare('SELECT id,name,public_enabled FROM rooms ORDER BY sort_order,id').all(),db.prepare('SELECT * FROM menu_items WHERE available=1 ORDER BY sort_order,id').all(),db.prepare('SELECT * FROM gallery ORDER BY sort_order,id').all()]);return json({site,booking,rooms:rooms.results,menu:menu.results,gallery:gallery.results,email_enabled:!!(ctx.env.RESEND_API_KEY&&ctx.env.EMAIL_FROM)})}
if(parts[0]==='availability'&&method==='GET'){const p=Object.fromEntries(url.searchParams);const state=await validateBooking(db,{...p,name:'x',phone:'x',email:'x'},false);const options=await candidates(db,state.ids,state.d,state.svc,state.party);return json({available:options.length>0,message:options.length?'':await bookingUnavailableReason(db,state.ids,state.d,state.svc,state.party,false),rooms:(await db.prepare('SELECT id,name FROM rooms WHERE public_enabled=1').all()).results.filter(r=>options.some(o=>o.room_id===r.id))})}
if(parts[0]==='book'&&method==='POST'){try{return json(await saveBooking(ctx,await read(ctx.request),false),201)}catch(e){return fail(e.message||'Impossibile registrare la prenotazione',409)}}
if(parts[0]==='cancel'&&method==='POST'){const b=await read(ctx.request);if(!/^[a-f0-9]{64}$/.test(b.token||''))return fail('Link non valido');const hashed=await digest(b.token),r=await db.prepare('SELECT id,status FROM reservations WHERE cancel_token_hash=?').bind(hashed).first();if(!r)return fail('Prenotazione non trovata',404);if(r.status==='cancelled')return json({ok:true,already:true});await db.batch([db.prepare("UPDATE reservations SET status='cancelled' WHERE id=?").bind(r.id),db.prepare('DELETE FROM reservation_tables WHERE reservation_id=?').bind(r.id)]);
 try{const old=await db.prepare('SELECT * FROM reservations WHERE id=?').bind(r.id).first();await alertStaff(db,r.id,'cancel','Prenotazione annullata #'+r.id,`${old.book_date} · ${old.name}`);await emailForBooking(ctx,old,'cancel');await emailStaff(ctx,old,'cancel')}catch(e){console.error('Oasi public cancel',e)}return json({ok:true})}
return fail('Rotta non trovata',404)}catch(e){console.error(e);return fail(/UNIQUE constraint/.test(e.message||'')?'Elemento già presente': 'Errore server. Controlla i registri Cloudflare.', /UNIQUE constraint/.test(e.message||'')?409:500)}}
