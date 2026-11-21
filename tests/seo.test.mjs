import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PUBLIC_PAGE_META,enhancePageResponse} from '../server/seo.js';
const markup='<html><head><title>Ristorante Oasi · Dal 1997</title><meta name="description" content="Default"/></head><body>ok</body></html>';
test('Public page titles and descriptions are unique and server-rendered',async()=>{
 assert.ok(Object.keys(PUBLIC_PAGE_META).length>=7);
 for(const [path,[title,description]] of Object.entries(PUBLIC_PAGE_META)){
  const output=await enhancePageResponse(new Request('https://oasi.test'+path),new Response(markup,{headers:{'content-type':'text/html'}}));
  const html=await output.text();assert.ok(html.includes('<title>'+title+'</title>'),path);
  assert.ok(html.includes('content="'+description+'"'),path);
  assert.equal(output.headers.get('x-content-type-options'),'nosniff');
 }
});
test('ADMIN and cancellation pages cannot be indexed',async()=>{
 for(const path of ['/admin','/annulla?token=secret']){
  const output=await enhancePageResponse(new Request('https://oasi.test'+path),new Response(markup,{headers:{'content-type':'text/html'}}));
  assert.equal(output.headers.get('x-robots-tag'),'noindex, nofollow');
 }
});
