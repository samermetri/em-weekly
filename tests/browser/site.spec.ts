import {test,expect} from '@playwright/test';
test('overview and subpath navigation work for a signed-out reader',async({page})=>{await page.goto('./');await expect(page.getByRole('heading',{name:'Emergency medicine literature'})).toBeVisible();await page.getByRole('searchbox',{name:'Search the evidence library'}).fill('airway');await page.getByRole('button',{name:'Search',exact:true}).click();await expect(page).toHaveURL(/\/articles\//);});
test('search, topic, online-date filters and empty reset',async({page})=>{await page.goto('articles/');await page.getByRole('searchbox').fill('OCAFE');await expect(page.locator('.search-result:visible')).toHaveCount(1);await page.getByRole('button',{name:'Reset',exact:true}).click();await page.getByLabel('Topic',{exact:true}).selectOption('resuscitation');expect(await page.locator('.search-result:visible').evaluateAll(rows=>rows.every(row=>(row as HTMLElement).dataset.topics?.split(',').includes('resuscitation')))).toBe(true);await page.getByText('More filters',{exact:false}).click();await page.getByLabel('First online, from').fill('2100-01-01');await expect(page.getByRole('heading',{name:'No matching articles'})).toBeVisible();await page.getByRole('button',{name:'Clear filters'}).click();await expect(page.locator('.search-result:visible')).not.toHaveCount(0);});
test('topic shortcut preserves selected topic',async({page})=>{await page.goto('articles/?topic=cardiology');await expect(page.getByLabel('Topic',{exact:true})).toHaveValue('cardiology');expect(await page.locator('.search-result:visible').evaluateAll(rows=>rows.every(row=>(row as HTMLElement).dataset.topics?.split(',').includes('cardiology')))).toBe(true);});
test('mobile navigation and content fit the screen',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('./');await page.getByRole('button',{name:'Toggle navigation'}).click();await page.getByRole('link',{name:'Sources & Methods'}).click();await expect(page.getByRole('heading',{name:'Collected and reviewed with AI.'})).toBeVisible();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);expect(overflow).toBe(false);});
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

test('all publication years share one library, with shareable date and sort filters',async({page})=>{
 await page.goto('historical/');await expect(page).toHaveURL(/\/articles\/$/);await expect(page.getByRole('heading',{name:'Articles',exact:true})).toBeVisible();
 await expect(page.getByLabel('Collection',{exact:true})).toHaveCount(0);await expect(page.getByText('Historical collection',{exact:true})).toHaveCount(0);
 await page.getByLabel('Publication year').selectOption('2025');await expect(page).toHaveURL(/year=2025/);expect(await page.locator('.search-result:visible').count()).toBeGreaterThan(0);
 expect(await page.locator('.search-result:visible').evaluateAll(rows=>rows.every(r=>(r as HTMLElement).dataset.date?.startsWith('2025')&&(r as HTMLElement).dataset.sample==='false'))).toBe(true);
 await page.getByLabel('Sort by').selectOption('oldest');await page.reload();await expect(page.getByLabel('Publication year')).toHaveValue('2025');await expect(page.getByLabel('Sort by')).toHaveValue('oldest');
 const dates=await page.locator('.search-result:visible').evaluateAll(rows=>rows.map(r=>(r as HTMLElement).dataset.date!));expect(dates).toEqual([...dates].sort());
 await page.getByRole('button',{name:'Reset',exact:true}).click();await page.getByLabel('Sort by').selectOption('added');const added=await page.locator('.search-result:visible').evaluateAll(rows=>rows.map(r=>(r as HTMLElement).dataset.added!));expect(added).toEqual([...added].sort().reverse());
 await page.getByRole('button',{name:'Next →'}).click();await expect(page.locator('#page-count')).toHaveText(/Page 2/);
});

test('unified library and homepage fit mobile and contain no collection promotion',async({page})=>{
 await page.goto('./');await expect(page.locator('nav a[href*="historical"]')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Browse by year'})).toBeVisible();await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'tmp/unified-home-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/unified-home-mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('articles/?year=2025');await expect(page.getByLabel('Publication year')).toHaveValue('2025');await page.screenshot({path:'tmp/unified-articles-mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'tmp/unified-articles-desktop.png',fullPage:true});
});

test('methods are concise and topics only show available articles',async({page})=>{await page.goto('methods/');await expect(page.getByRole('heading',{name:'Collected and reviewed with AI.'})).toBeVisible();await expect(page.getByRole('link',{name:'Suggest a correction'})).toHaveCount(0);await expect(page.locator('main a[href*="github.com"]')).toHaveCount(0);await page.goto('topics/');const cards=page.locator('.topic-card');expect(await cards.count()).toBeGreaterThan(0);for(const card of await cards.all()){const text=await card.innerText();const count=text.match(/(\d+) summaries/);expect(Number(count?.[1])).toBeGreaterThan(0);}await cards.first().click();await expect(page.locator('.search-result:visible')).not.toHaveCount(0);});

test('long guidance keeps paragraphs and recommendations in compact and expanded digests',async({page})=>{
 const guide=JSON.parse((await import('node:fs')).readFileSync('content/articles/sccm-heat-stroke-guideline-2025.json','utf8'));
 // Synthetic layout fixture only; never written to the publication database or content.
 guide.summary=Array.from({length:8},(_,i)=>`Layout paragraph ${i+1}. `+'This neutral fixture checks readable multi-page guidance without shortening its content. '.repeat(9)).join('\n\n');
 guide.findings=Array.from({length:9},(_,i)=>`Recommendation marker ${i+1}. This is a layout fixture, not clinical advice.`);
 guide.guidelineStrength='Strength marker. Evidence certainty and exceptions must be retained.\n\nFinal strength paragraph.';
 await page.route('**/data/digest.json',r=>r.fulfill({json:[guide]}));
 await page.goto('library/digest/#articles='+guide.id);
 await expect(page.locator('.digest-entry.guidance-entry')).toHaveCount(1);
 await expect(page.locator('.digest-copy').first().locator('p')).toHaveCount(8);
 await expect(page.getByRole('heading',{name:'Key recommendations'})).toBeVisible();
 await expect(page.getByText('Final strength paragraph.',{exact:true})).toBeVisible();
 await expect(page.locator('.digest-findings li')).toHaveCount(9);
 await page.getByLabel('Format').selectOption('expanded');await expect(page.locator('.digest-findings')).toBeVisible();
 await page.getByLabel('Format').selectOption('compact');await page.emulateMedia({media:'print'});
 expect(await page.locator('.guidance-entry').evaluate(e=>getComputedStyle(e).breakInside)).toBe('auto');
 await page.pdf({path:'tmp/long-guidance-digest.pdf',format:'Letter',printBackground:true});
 await page.emulateMedia({media:'screen'});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
