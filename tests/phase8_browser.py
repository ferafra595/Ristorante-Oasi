"""Test compiled frontend with mocked API. Requires playwright + Chromium; npm run build first."""
from pathlib import Path
import os,json
from urllib.parse import urlsplit,parse_qs
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parent.parent/'dist'
day='2026-11-20'
fixture={'reservations':[{'book_date':day,'service':'lunch','status':'confirmed','bookings':2,'covers':10}], 'events':[{'id':'e1','title':'Cerimonia di prova','start_date':'2026-11-19','end_date':'2026-11-21','service':'both','status':'confirmed','guests':30,'room_names':'Sala'}], 'blocks':[{'id':1,'book_date':day,'service':'dinner','scope':'service','target_id':0,'reason':'Chiusura test'}], 'weekdays':[0,2,3,4,5,6], 'closedDates':[], 'serviceEnabled':{'lunch':True,'dinner':True}}
errors=[]
def respond(route):
    u=urlsplit(route.request.url);q=parse_qs(u.query)
    if u.netloc!='localhost:8765':return route.abort()
    if u.path.startswith('/api/'):
        data={'/api/admin/me':{'user':{'id':1}},'/api/admin/operations':{'reservations':[],'rooms':[],'tables':[],'blocks':[],'zones':[]},'/api/admin/calendar':{**fixture,'start':q.get('start',[''])[0],'end':q.get('end',[''])[0]},'/api/admin/reservations':[],'/api/admin/notifications':{'unread':0}}.get(u.path,[])
        return route.fulfill(status=200,content_type='application/json',body=json.dumps(data))
    f=base/(u.path.lstrip('/') or 'index.html');f=f if f.is_file() else base/'index.html'
    route.fulfill(status=200,content_type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png'}.get(f.suffix,'application/octet-stream'),body=f.read_bytes())
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for width in [1280,390,320]:
        ctx=browser.new_context(viewport={'width':width,'height':900});ctx.route('**/*',respond);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:8765/admin');page.locator('.admin-head h1').wait_for()
        if width>900:page.locator('.sidebar [data-tab="calendar"]').click()
        else:page.locator('#mobile-tab').select_option('calendar')
        page.locator('#cal-jump').fill(day);page.locator('#cal-jump').dispatch_event('change');page.locator('[data-cal-date="'+day+'"]').wait_for()
        assert page.locator('.cal-day').count()==42
        page.locator('#cal-mode').select_option('week');page.wait_for_function('document.querySelectorAll(".cal-day").length===7')
        page.locator('#cal-mode').select_option('day');page.locator('.cal-event-detail').wait_for();page.wait_for_function('document.querySelectorAll(".cal-day").length===0')
        assert 'Cerimonia di prova' in page.locator('.cal-event-detail').inner_text()
        assert 'Chiusura test' in page.locator('.cal-block-list').inner_text()
        page.locator('#cal-mode').select_option('month');page.wait_for_function('document.querySelectorAll(".cal-day").length===42')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),f'Horizontal overflow at {width}'
        page.locator('#cal-service').select_option('dinner');page.wait_for_function('document.querySelectorAll(".cal-service-card").length===1')
        page.locator('#cal-new').click();page.locator('#oasi-booking-drawer-form').wait_for();assert page.locator('#oasi-booking-drawer-form [name=date]').input_value()==day;assert page.locator('#oasi-booking-drawer-form [name=service]').input_value()=='dinner'
        print(f'PASS {width}px: month/week/day, filters, navigation, booking prefill, no horizontal overflow');ctx.close()
    assert not errors, errors
    browser.close()
