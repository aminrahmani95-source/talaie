# تست مرورگری (Playwright) — حالت کاملاً محلی

ابزار کمکی Claude برای تست «مثل کاربر واقعی». روی سایت اصلی اثری ندارد.

```bash
pip install playwright && python -m playwright install chromium
# در یک کپی از پروژه (نه پروژه‌ی اصلی) اول getClient() در src/utils/supabase.ts:
#   if (import.meta.env.VITE_SUPABASE_URL === 'none') return null;
VITE_SUPABASE_URL=none npx vite --port 5175
```

نمونه:
```python
import asyncio
from playwright.async_api import async_playwright
from e2e import start, nav, text, toasts

async def main():
    async with async_playwright() as p:
        s = await start(p, '09124339038')          # مدیر QC
        await nav(s, 'پرسنل و اکیپ‌ها')
        print(await text(s))
        await s.b.close()
asyncio.run(main())
```

- `seed.js`: کاربران، اکیپ‌ها و پروژه‌های نمونه (شماره‌ها در CLAUDE.md).
- `crawl.py`: روی همه‌ی دکمه‌های هر نقش کلیک می‌کند و خطاها را گزارش می‌دهد (پورت 5173 در فایل).
