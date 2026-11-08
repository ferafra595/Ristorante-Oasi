// Security operations – single ADMIN identity only. No separate users or roles.
const now=()=>new Date().toISOString();
const response=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const ipHash=async(req)=>{
 const ip=req.headers.get('CF-Connecting-IP')||'unknown';
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
};
export function verifyAdminOrigin(req){
 const url=new URL(req.url),origin=req.headers.get('Origin'),site=req.headers.get('Sec-Fetch-Site');
 if(site&& !['same-origin','none'].includes(site))return false;
 if(origin&&origin!==url.origin)return false;
 return true;
}
// Uses a small D1 rolling window. Cloudflare edge rate limiting remains recommended too.
export async function loginGuard(db,req){
 const hash=await ipHash(req),from=new Date(Date.now()-15*60*1000).toISOString();
 const row=await db.prepare('SELECT COUNT(*) n FROM oasi_login_attempts WHERE ip_hash=? AND created_at>=? AND success=0').bind(hash,from).first();
 return Number(row?.n||0)<8;
}
export async function recordLogin(db,req,success){
 const hash=await ipHash(req);
 await db.prepare('INSERT INTO oasi_login_attempts(ip_hash,success,created_at) VALUES(?,?,?)').bind(hash,success?1:0,now()).run();
 // Periodically purge old records to minimize retention.
 await db.prepare("DELETE FROM oasi_login_attempts WHERE created_at<datetime('now','-30 days')").run();
}
export async function auditAction(db,method,parts,status,req){
 const resource=(parts[1]||'other').slice(0,40),id=/^\d+$/.test(parts[2]||'')?parts[2]:'';
 try{await db.prepare('INSERT INTO oasi_admin_audit(method,resource,resource_id,http_status,created_at) VALUES(?,?,?,?,?)').bind(method,resource,id,status,now()).run()}
 catch(error){console.error('Oasi audit insert failed',error)}
}
export async function securityRoute(ctx,parts,method,body,user){
 const db=ctx.env.DB;
 if(method==='GET'&&parts.length===2){
  const [sessions,failed,bookings,customers,audit,attempts]=await Promise.all([
   db.prepare('SELECT COUNT(*) n FROM sessions WHERE expires_at>? AND user_id=?').bind(now(),user.id).first(),
   db.prepare('SELECT COUNT(*) n FROM oasi_login_attempts WHERE success=0 AND created_at>=?').bind(new Date(Date.now()-86400000).toISOString()).first(),
   db.prepare('SELECT COUNT(*) n FROM reservations').first(),
   db.prepare('SELECT COUNT(*) n FROM oasi_customers').first(),
   db.prepare('SELECT method,resource,resource_id,http_status,created_at FROM oasi_admin_audit ORDER BY id DESC LIMIT 100').all(),
   db.prepare('SELECT success,created_at FROM oasi_login_attempts ORDER BY id DESC LIMIT 25').all()
  ]);
  return response({active_sessions:Number(sessions?.n||0),failed_login_24h:Number(failed?.n||0),reservation_count:Number(bookings?.n||0),customer_count:Number(customers?.n||0),audit:audit.results||[],login_attempts:attempts.results||[]});
 }
 if(method==='DELETE'&&parts[2]==='sessions'){
  await db.prepare('INSERT INTO oasi_admin_audit(method,resource,resource_id,http_status,created_at) VALUES(?,?,?,?,?)').bind('DELETE','security.sessions','',200,now()).run();
  await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id).run();
  return response({ok:true});
 }
 return response({error:'Operazione non consentita'},405);
}
