import asyncio, json, os, sys
from playwright.async_api import async_playwright
SEED=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'seed.js'),encoding='utf-8').read()
SKIP=['خروج','حذف','بازنشانی','ریست','پاکسازی','Reset','ورود و بازرسی','بازگشت','پاک','لغو درخواست','تغییر به حالت']
async def run(phone, tabs, vp):
    out=[]
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await b.new_context(viewport=vp)
        await ctx.add_init_script("try{if(!sessionStorage.getItem('s')){"+SEED+";sessionStorage.setItem('s','1')}}catch(e){}")
        pg=await ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(('pageerror',str(e)[:300])))
        pg.on('console',lambda m: errs.append(('console',m.text[:300])) if m.type=='error' and 'ERR_' not in m.text and 'Failed to load resource' not in m.text and 'WebSocket' not in m.text else None)
        pg.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))
        async def login():
            await pg.goto('http://localhost:5173/',wait_until='networkidle')
            ins=await pg.query_selector_all('input'); await ins[0].fill(phone); await ins[1].fill('x'); await pg.keyboard.press('Enter')
            await pg.wait_for_timeout(2500)
        await login()
        for tab in tabs:
            async def go():
                if tab:
                    loc=pg.locator('aside button, nav button').filter(has_text=tab)
                    if await loc.count()==0: return False
                    await loc.first.click(timeout=4000); await pg.wait_for_timeout(1000)
                return True
            if not await go(): out.append((tab,'tab-missing')); continue
            labels=await pg.evaluate("""()=>[...document.querySelectorAll('main button, main [role=button]')].filter(b=>b.offsetParent&&!b.disabled).map(b=>(b.getAttribute('aria-label')||b.innerText||'').trim().slice(0,40)).filter(Boolean)""")
            seen=set(); n=0
            for lab in labels:
                if lab in seen or any(s in lab for s in SKIP): continue
                seen.add(lab); n+=1
                if n>35: break
                before=len(errs)
                try:
                    el=pg.locator('main button, main [role=button]').filter(has_text=lab).first if not lab.startswith('افزودن') else pg.locator(f'[aria-label="{lab}"]').first
                    if await el.count()==0: continue
                    await el.click(timeout=1500); await pg.wait_for_timeout(450)
                except Exception as e:
                    pass
                if len(errs)>before:
                    for e in errs[before:]: out.append((tab,lab,e))
                # close any modal / sheet
                for _ in range(2):
                    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(120)
                closes=pg.locator('[aria-label*="بستن"]:visible')
                if await closes.count():
                    try: await closes.first.click(timeout=800)
                    except: pass
                dlg=pg.locator('[role=dialog]:visible, .fixed.inset-0:visible')
                if await dlg.count():
                    title=(await dlg.first.inner_text())[:80].replace('\n',' / ')
                    out.append((tab,lab,'STUCK-DIALOG',title))
                    await login()
                try:
                    await go()
                except Exception as e:
                    out.append((tab,'nav-fail',str(e)[:80]))
            out.append((tab,'clicked',n))
        await b.close()
    return out
phone=sys.argv[1]; tabs=json.loads(sys.argv[2]); vp=json.loads(sys.argv[3])
res=asyncio.run(run(phone,tabs,vp))
for r in res: print(r)
