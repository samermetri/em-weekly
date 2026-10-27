import {test,expect} from '@playwright/test';
test('overview and subpath navigation work for a signed-out reader',async({page})=>{await page.goto('./');await expect(page.getByRole('heading',{name:'Emergency medicine literature'})).toBeVisible();await page.getByRole('link',{name:'Explore the literature'}).click();await expect(page).toHaveURL(/\/articles\//);});
test('search, topic, online-date filters and empty reset',async({page})=>{await page.goto('articles/');await page.getByRole('searchbox').fill('PREOXI');await expect(page.locator('.search-result:visible')).toHaveCount(1);await page.getByRole('button',{name:'Reset',exact:true}).click();await page.getByLabel('Topic',{exact:true}).selectOption('resuscitation');expect(await page.locator('.search-result:visible').evaluateAll(rows=>rows.every(row=>(row as HTMLElement).dataset.topics?.split(',').includes('resuscitation')))).toBe(true);await page.getByLabel('First online, from').fill('2100-01-01');await expect(page.getByRole('heading',{name:'No matching articles'})).toBeVisible();await page.getByRole('button',{name:'Clear filters'}).click();await expect(page.locator('.search-result:visible')).not.toHaveCount(0);});
test('topic shortcut preserves selected topic',async({page})=>{await page.goto('articles/?topic=cardiology');await expect(page.getByLabel('Topic',{exact:true})).toHaveValue('cardiology');expect(await page.locator('.search-result:visible').evaluateAll(rows=>rows.every(row=>(row as HTMLElement).dataset.topics?.split(',').includes('cardiology')))).toBe(true);});
test('mobile navigation and content fit the screen',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('./');await page.getByRole('button',{name:'Toggle navigation'}).click();await page.getByRole('link',{name:'Sources & Methods'}).click();await expect(page.getByRole('heading',{name:'Sources & methods'})).toBeVisible();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);expect(overflow).toBe(false);});
test('weekly issue has browser printing and a readable print layout',async({page})=>{await page.addInitScript(()=>{(window as any).__printCalls=0;window.print=()=>{(window as any).__printCalls++;};});await page.goto('weekly/2024-06-17/');await expect(page.getByRole('button',{name:'Print / Save as PDF',exact:true})).toBeVisible();await page.getByRole('button',{name:'Print / Save as PDF',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).__printCalls)).toBe(1);await page.goto('weekly/2024-06-17/?print=1');await expect.poll(()=>page.evaluate(()=>(window as any).__printCalls)).toBe(1);await expect(page).toHaveURL(/\/weekly\/2024-06-17\/$/);await page.emulateMedia({media:'print'});await expect(page.locator('.sidebar')).toBeHidden();await expect(page.locator('.print-header')).toBeVisible();await expect(page.getByRole('heading',{name:'Clinical Takeaways'})).toBeVisible();await expect(page.locator('.print-button')).toBeHidden();await expect(page.getByRole('heading',{name:'Why it matters',exact:true})).toBeVisible();});

test('article links, compact review metadata, print filename and native sharing',async({page})=>{
 await page.addInitScript(()=>{(window as any).__printedTitle='';window.print=()=>{(window as any).__printedTitle=document.title;};Object.defineProperty(navigator,'share',{value:async(data:ShareData)=>{(window as any).__shared=data;},configurable:true});});
 await page.goto('articles/preoxi/');
 await expect(page.getByRole('link',{name:'Original source',exact:true})).toHaveAttribute('target','_blank');
 await expect(page.getByRole('link',{name:'Original source',exact:true})).toHaveAttribute('rel',/noopener/);
 await expect(page.locator('.detail-dates .review-status')).toContainText('AI-generated');
 await expect(page.locator('.review-banner')).toHaveCount(0);
 await expect(page.getByText('IN THE EMERGENCY DEPARTMENT',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Print / Save as PDF',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__printedTitle)).toBe('EM Weekly - PREOXI - 2024-06-13');
 await page.getByRole('button',{name:'Share',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__shared?.url)).toBe('https://emweekly.samermetri.com/articles/preoxi/');
});
test('sharing copies a clean link when native sharing is unavailable',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});Object.defineProperty(navigator,'clipboard',{value:{writeText:async(value:string)=>{(window as any).__copied=value;}},configurable:true});});
 await page.goto('articles/device/');await page.getByRole('button',{name:'Share',exact:true}).click();await expect(page.locator('.share-status')).toHaveText('Link copied');await expect.poll(()=>page.evaluate(()=>(window as any).__copied)).toBe('https://emweekly.samermetri.com/articles/device/');
});
test('weekly preview includes all three articles and uses a dated print filename',async({page})=>{
 await page.addInitScript(()=>{window.print=()=>{(window as any).__printedTitle=document.title;};});
 await page.goto('weekly/2026-10-26/');await expect(page.locator('.brief-entry')).toHaveCount(3);await page.getByRole('button',{name:'Print / Save as PDF',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).__printedTitle)).toBe('EM Weekly - Weekly Brief - 2026-10-26 to 2026-11-01');
});
