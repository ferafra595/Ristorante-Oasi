"""Local Chromium UI regression of the real compiled frontend, with mocked API.
Run after npm run build, using Python playwright and a local Chromium executable.
Uses accelerated 30 s polling only for this test, never changes deployed code.
"""
from pathlib import Path
import os, json
from urllib.parse import urlsplit, parse_qs
from playwright.sync_api import sync_playwright
BASE=Path(__file__).resolve().parent.parent/'dist'
fixture={"reservations":[],"rooms":[{"id":1,"name":"Sala piano terra","public_enabled":1,"internal_enabled":1}],"tables":[{"id":1,"room_id":1,"code":"1","shape":"square","seats":8,"min_seats":1,"enabled":1,"x":20,"y":20,"w":80,"h":80,"rotation":0},{"id":2,"room_id":1,"code":"2","shape":"square","seats":8,"min_seats":1,"enabled":1,"x":120,"y":20,"w":80,"h":80,"rotation":0}],"blocks":[],"zones":[{"id":1,"room_id":1,"label":"Sala","x":0,"y":0,"w":250,"h":150}]}
errors=[]
def response(route):
    url=urlsplit(route.request.url)
    if url.netloc!='localhost:8765':return route.abort()
    path=url.path
    if path.startswith('/api/'):
        q=parse_qs(url.query)
        if path=='/api/admin/me':data={'user':{'id':1}}
        elif path=='/api/admin/operations':data={**fixture,'date':q.get('date',['2099-01-01'])[0],'service':q.get('service',['lunch'])[0]}
        elif path=='/api/admin/reservations':data=fixture['reservations']
        elif path=='/api/admin/notifications':data={'unread':0}
        elif path=='/api/admin/room-zones':data=fixture['zones']
        elif path=='/api/public':data={'site':{},'booking':{'weekdays':[0,1,2,3,4,5,6],'lunch':{'enabled':True,'start':'12:30','last':'14:30'},'dinner':{'enabled':True,'start':'19:30','last':'23:00'}},'rooms':fixture['rooms'],'menu':[],'gallery':[]}
        else:data=[]
        return route.fulfill(status=200,content_type='application/json',body=json.dumps(data))
    file=BASE/(path.lstrip('/') or 'index.html')
    if not file.is_file():file=BASE/'index.html'
    typ={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png'}.get(file.suffix,'application/octet-stream')
    route.fulfill(status=200,content_type=typ,body=file.read_bytes())

def booking(id,name,table_id):
    return {'id':id,'name':name,'book_date':'2099-01-01','service':'lunch','time':'12:30','status':'confirmed','visit_state':'expected','party_size':2,'room_id':1,'table_ids':str(table_id),'table_codes':str(table_id),'phone':'0000000000','email':'test@example.invalid','notes':'','source':'web'}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':1280,'height':900})
    ctx.route('**/*',response)
    ctx.add_init_script("""const orig=window.setInterval.bind(window);window.setInterval=(fn,ms,...args)=>orig(fn,ms===30000?300:ms,...args);""")
    a=ctx.new_page();b=ctx.new_page()
    for page in [a,b]:page.on('pageerror',lambda e:errors.append(str(e)))
    a.goto('http://localhost:8765/admin');a.locator('.admin-head h1').wait_for();assert a.locator('.admin-head h1').inner_text()=='Centro di controllo'
    b.goto('http://localhost:8765/admin');b.locator('.admin-head h1').wait_for();b.locator('.sidebar [data-tab="service"]').click();b.get_by_text('Piantina operativa',exact=False).first.wait_for()
    fixture['reservations']=[booking(1,'Nuovo cliente test',1)]
    a.get_by_text('Nuovo cliente test',exact=True).first.wait_for(timeout=5000)
    b.get_by_text('Nuovo cliente test',exact=True).first.wait_for(timeout=5000)
    print('PASS: new reservation synchronizes in two independent pages')
    fixture['blocks']=[{'id':1,'scope':'table','target_id':2,'reason':'Blocco test','service':'lunch'}]
    b.get_by_text('Blocco test',exact=True).wait_for(timeout=5000)
    a.get_by_text('1 blocchi di disponibilità attivi',exact=False).wait_for(timeout=5000)
    print('PASS: manual block changes synchronize without a reservation change')
    fixture['blocks']=[{'id':'event:e:1:lunch','scope':'room','target_id':1,'reason':'Sala riservata per evento privato','service':'lunch','event_id':'e','source':'event'}]
    b.get_by_text('Sala riservata per evento privato',exact=True).wait_for(timeout=5000)
    print('PASS: event changes synchronize')
    b.locator('#admin-shortcut-new').click();form=b.locator('#oasi-booking-drawer-form');form.wait_for();form.locator('[name=name]').fill('Bozza da preservare');fixture['reservations'].append(booking(2,'Secondo cliente test',2));b.wait_for_timeout(1200)
    assert form.locator('[name=name]').input_value()=='Bozza da preservare'
    assert b.get_by_text('Secondo cliente test',exact=True).count()==0
    b.locator('.oasi-booking-drawer-cancel').click();b.get_by_text('Secondo cliente test',exact=True).first.wait_for(timeout=5000)
    print('PASS: pending booking form is untouched; deferred synchronization resumes after closing')
    c=ctx.new_page();c.on('pageerror',lambda e:errors.append(str(e)));c.goto('http://localhost:8765/');c.locator('.hero h1').wait_for(timeout=5000)
    assert not errors,errors
    print('PASS: no uncaught JavaScript errors during tested admin flows and public homepage')
    browser.close()
