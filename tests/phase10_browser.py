from pathlib import Path
import json
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parent.parent/'dist'
def route(r):
 u=urlsplit(r.request.url)
 if u.netloc!='localhost:8765':return r.abort()
 if u.path=='/api/public':return r.fulfill(status=200,json={'site':{},'gallery':[],'menuPdf':True,'booking':{'lunch':{'start':'12:30','last':'14:30'},'dinner':{'start':'19:30','last':'23:00'}}})
 f=base/(u.path.lstrip('/') or 'index.html');f=f if f.is_file() else base/'index.html'
 return r.fulfill(status=200,content_type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png'}.get(f.suffix,'application/octet-stream'),body=f.read_bytes())
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in [1440,390,320]:
  page=b.new_page(viewport={'width':width,'height':850});page.route('**/*',route);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  for path in ['/','/chi-siamo','/menu','/galleria','/eventi-cerimonie','/prenota']:
   page.goto('http://localhost:8765'+path,wait_until='domcontentloaded',timeout=8000);page.locator('main h1').wait_for(timeout=5000)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,path)
   if path=='/menu':assert page.locator('a[download]').count()==1
   if path=='/' and width==390:page.locator('#hamburger').click();assert page.locator('#links').is_visible();page.keyboard.press('Escape');assert not page.locator('#links').is_visible()
  assert not errors,errors
  print('PASS',width,flush=True);page.close()
 b.close()
