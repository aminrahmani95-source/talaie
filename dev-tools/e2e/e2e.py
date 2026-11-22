import asyncio, re
from playwright.async_api import async_playwright
import os
SEED=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'seed.js'),encoding='utf-8').read()
URL='http://localhost:5175/'
class S:
    pass
async def start(p, phone, vp=None):
    b=await p.chromium.launch(args=['--no-sandbox'])
    ctx=await b.new_context(viewport=vp or {'width':1440,'height':900})
    await ctx.add_init_script("try{if(!sessionStorage.getItem('s')){"+SEED+";sessionStorage.setItem('s','1')}}catch(e){}")
    pg=await ctx.new_page()
    s=S(); s.b=b; s.pg=pg; s.errs=[]
    pg.on('pageerror',lambda e:s.errs.append('PAGEERROR '+str(e)[:300]))
    pg.on('console',lambda m: s.errs.append('CONSOLE '+m.text[:300]) if m.type=='error' else None)
    pg.on('dialog', lambda d: (s.errs.append('DIALOG '+d.message[:200]), asyncio.ensure_future(d.accept())))
    await pg.goto(URL,wait_until='networkidle')
    ins=await pg.query_selector_all('input'); await ins[0].fill(phone); await ins[1].fill('x'); await pg.keyboard.press('Enter')
    await pg.wait_for_timeout(2000)
    return s
async def nav(s, label):
    loc=s.pg.locator('aside button, nav button').filter(has_text=label)
    if await loc.count()==0:
        more=s.pg.get_by_text('بیشتر',exact=True)
        if await more.count(): await more.last.click(); await s.pg.wait_for_timeout(500)
        loc=s.pg.get_by_role('button').filter(has_text=label)
    await loc.first.click(); await s.pg.wait_for_timeout(1200)
async def text(s):
    return await s.pg.evaluate("document.body.innerText")
async def toasts(s):
    return await s.pg.evaluate("[...document.querySelectorAll('[role=status],[role=alert]')].map(e=>e.innerText.trim()).filter(Boolean).join(' || ')")
async def state(s, key='talaie_projects_v6'):
    return await s.pg.evaluate(f"(()=>{{const out={{}};for(const k of Object.keys(localStorage)){{if(k.startsWith('{key}'))out[k]=JSON.parse(localStorage.getItem(k)||'null')}};return out}})()")
