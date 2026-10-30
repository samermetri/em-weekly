import {test,expect,type Page} from '@playwright/test';import fs from 'node:fs';
const uid='00000000-0000-4000-a000-000000000099';const origin='https://vbzmghfxaorxlvoebgbj.supabase.co';
const person={id:uid,aud:'authenticated',role:'authenticated',email:'reader@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-27T00:00:00Z'};
const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.qa-only';
async function session(page:Page){await page.addInitScript(({person,token})=>localStorage.setItem('sb-vbzmghfxaorxlvoebgbj-auth-token',JSON.stringify({access_token:token,refresh_token:'qa-only',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:person})),{person,token});}
async function selectAll(page:Page){await page.getByLabel('Library actions',{exact:true}).click();await page.getByRole('button',{name:'Select all shown'}).click();}
test('public reading makes no Supabase requests and saving asks for sign-in',async({page})=>{let calls=0;await page.route(origin+'/**',route=>{calls++;return route.abort();});await page.goto('articles/preoxi/',{waitUntil:'networkidle'});expect(calls).toBe(0);await expect(page.getByRole('button',{name:'Save article',exact:true})).toBeVisible();await page.getByRole('button',{name:'Save article',exact:true}).click();await expect(page).toHaveURL(/\/account\/\?next=/);expect(calls).toBe(0);});
test('signup requests confirmation and reset does not disclose account existence',async({page})=>{let signup:any;await page.route(origin+'/**',async route=>{const url=route.request().url();if(url.includes('/signup')){signup=route.request().postDataJSON();await route.fulfill({json:person});}else if(url.includes('/recover'))await route.fulfill({json:{}});else await route.abort();});await page.goto('account/');await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill(person.email);await page.getByLabel('Password',{exact:true}).fill('QA-only-password-123!');await page.locator('#auth-form button[type=submit]').click();await expect(page.getByRole('status')).toContainText('Check your email');expect(signup.email).toBe(person.email);expect(signup.password).toBe('QA-only-password-123!');await page.getByRole('button',{name:'← Back to sign in',exact:true}).click();await page.getByRole('button',{name:'Forgot password?',exact:true}).click();await page.getByRole('button',{name:'Send reset link'}).click();await expect(page.getByRole('status')).toContainText('If an account exists');});
test('library saves a private folder, organizes an article, and reuses its local cache',async({page})=>{await session(page);let gets=0;let membership:any;const folders:any[]=[];await page.route(origin+'/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname;if(path.endsWith('/em_my_role'))return route.fulfill({json:'reader'});if(req.method()==='GET')gets++;if(path.endsWith('/em_folders')){if(req.method()==='POST'){folders.push({...req.postDataJSON(),id:'00000000-0000-4000-b000-000000000099'});return route.fulfill({json:folders[0]});}return route.fulfill({json:folders});}if(path.endsWith('/em_bookmarks'))return route.fulfill({json:[{user_id:uid,article_id:'preoxi',created_at:'2026-10-27T00:00:00Z'}]});if(path.endsWith('/em_folder_items')){if(req.method()==='POST')membership=req.postDataJSON();return route.fulfill({json:[]});}return route.abort();});await page.goto('library/');await expect(page.locator('#saved-articles .saved-card')).toHaveCount(1);await page.getByRole('button',{name:'New folder',exact:true}).click();await page.getByLabel('Folder name',{exact:true}).fill('Airway reading');await page.getByRole('button',{name:'Create folder',exact:true}).click();await page.getByRole('button',{name:'Favorites (1)',exact:true}).click();await page.getByRole('button',{name:'Organize',exact:true}).click();await page.getByRole('checkbox',{name:'Airway reading'}).check();await page.getByRole('button',{name:'Save folders',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(membership[0]).toMatchObject({user_id:uid,article_id:'preoxi'});const previous=gets;await page.reload();await expect(page.locator('#saved-articles .saved-card')).toHaveCount(1);expect(gets).toBe(previous);await expect(page.locator('#admin-link')).toBeHidden();await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'tmp/library-redesign-desktop.png',fullPage:true});await page.getByRole('searchbox',{name:'Search saved articles'}).fill('not present anywhere');await expect(page.getByRole('heading',{name:'No matching saved articles'})).toBeVisible();await page.getByRole('button',{name:'Clear search'}).click();await expect(page.locator('#saved-articles .saved-card')).toHaveCount(1);await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/library-redesign-mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);});
test('reader cannot open the admin workspace',async({page})=>{await session(page);await page.route(origin+'/**',route=>route.request().url().endsWith('/em_my_role')?route.fulfill({json:'reader'}):route.abort());await page.goto('admin/');await expect(page.getByRole('status')).toContainText('Administrator access is required');await expect(page.locator('#admin-workspace')).toBeHidden();});
test('admin edits are revision-checked and withdrawal is recoverable',async({page})=>{await session(page);let body=JSON.parse(fs.readFileSync('content/articles/preoxi.json','utf8'));let revision=1;const saves:any[]=[];await page.route(origin+'/**',async route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith('/em_admin_publication'))return route.fulfill({json:{status:'success',adminDispatch:{status:'queued'}}});if(path.endsWith('/em_admin_request_publication'))return route.fulfill({json:{status:'queued'}});if(path.endsWith('/em_my_role'))return route.fulfill({json:'admin'});if(path.endsWith('/em_admin_articles'))return route.fulfill({json:[{id:body.id,body,revision}]});if(path.endsWith('/em_admin_save_article')){const request=route.request().postDataJSON();saves.push(request);body=request.article;return route.fulfill({json:{id:body.id,body,revision:++revision}});}return route.abort();});await page.goto('admin/');await page.locator('.admin-article').click();await page.locator('[name=reason]').fill('Verified source details.');await page.getByRole('button',{name:'Save article',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved revision 2');await expect(page.getByRole('status')).toContainText('Publication requested');await page.getByRole('button',{name:'Publish now',exact:true}).click();await expect(page.getByRole('status')).toContainText('Publication requested');expect(saves[0].expected_revision).toBe(1);await page.getByRole('button',{name:'Mark human-reviewed'}).click();await expect(page.getByRole('status')).toContainText('Saved revision 3');expect(saves[1].article.humanReview).toBe('Human-reviewed');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete / withdraw'}).click();await expect(page.getByRole('button',{name:'Restore article'})).toBeVisible();expect(saves[2].article.excluded).toBe(true);await page.getByRole('button',{name:'Restore article'}).click();await expect(page.getByRole('status')).toContainText('Saved revision 5');expect(saves[3].article.status).toBe('published');expect(saves[3].article.excluded).toBe(false);});
test('admin can add a fully structured article and account layouts fit mobile',async({page})=>{
 await session(page);let saved:any;
 await page.route(origin+'/**',route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith('/em_my_role'))return route.fulfill({json:'admin'});if(path.endsWith('/em_admin_articles'))return route.fulfill({json:[]});if(path.endsWith('/em_admin_save_article')){saved=route.request().postDataJSON();return route.fulfill({json:{id:saved.article.id,body:saved.article,revision:1}});}return route.abort();});
 await page.goto('admin/');await page.getByRole('button',{name:'Add article',exact:true}).click();
 const sample=JSON.parse(fs.readFileSync('content/articles/preoxi.json','utf8'));sample.id='qa-new-article';
 for(const key of ['id','title','shortTitle','source','summary','whyItMatters','limitations'])await page.locator(`[name=${key}]`).fill(sample[key]);
 for(const key of ['authors','findings'])await page.locator(`[name=${key}]`).fill(sample[key].join('\n'));
 await page.getByText('Study details, source access & ranking',{exact:true}).click();
 for(const key of ['population','intervention','comparator','primaryEndpoint','canonicalUrl','evidenceNotes'])await page.locator(`[name=${key}]`).fill(sample[key]);
 await page.locator('[name=topic][value=airway]').check();await page.locator('[name=reason]').fill('Added from verified primary material.');
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'tmp/admin-desktop.png',fullPage:false});
 await page.getByRole('button',{name:'Save article',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved revision 1');expect(saved.expected_revision).toBeNull();expect(saved.article.aiGenerated).toBe(false);expect(saved.article.status).toBe('held');expect(saved.article.topics).toContain('airway');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'tmp/admin-mobile.png',fullPage:false});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('account/');await page.screenshot({path:'tmp/account-mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('account design fits desktop and mobile without starting a session',async({page})=>{await page.route(origin+'/**',r=>r.abort());await page.setViewportSize({width:1440,height:1000});await page.goto('account/');await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();await page.screenshot({path:'tmp/account-redesign-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/account-redesign-mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);});
test('readers select across saved searches and folders and print one local digest',async({page,context})=>{
 await session(page);await context.addInitScript(()=>{window.print=()=>{(window as any).__digestPrintedTitle=document.title;};});let calls=0;
 const folder='00000000-0000-4000-b000-000000000099';
 await context.route(origin+'/**',route=>{calls++;const path=new URL(route.request().url()).pathname;if(path.endsWith('/em_my_role'))return route.fulfill({json:'reader'});if(path.endsWith('/em_folders'))return route.fulfill({json:[{id:folder,user_id:uid,name:'Airway reading'}]});if(path.endsWith('/em_bookmarks'))return route.fulfill({json:['preoxi','device','clovers','unavailable-qa'].map((article_id,i)=>({user_id:uid,article_id,created_at:`2026-10-${27-i}T00:00:00Z`}))});if(path.endsWith('/em_folder_items'))return route.fulfill({json:['preoxi','device'].map(article_id=>({user_id:uid,article_id,folder_id:folder}))});return route.abort();});
 await page.goto('library/');await expect(page.locator('.saved-card')).toHaveCount(4);await expect(page.getByRole('checkbox')).toHaveCount(3);await expect(page.locator('#print-selection')).toHaveAttribute('aria-disabled','true');await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'tmp/library-populated-desktop.png',fullPage:true});
 await page.getByRole('checkbox',{name:/Select PREOXI/}).check();await page.getByRole('searchbox',{name:'Search saved articles'}).fill('DEVICE');await expect(page.locator('.saved-card')).toHaveCount(1);await selectAll(page);await expect(page.locator('#selection-summary')).toContainText('2 selected');
 await page.getByRole('searchbox',{name:'Search saved articles'}).fill('');await page.locator('#folder-list').getByRole('button',{name:/Airway reading/}).click();await expect(page.locator('.saved-card')).toHaveCount(2);await expect(page.getByRole('checkbox',{checked:true})).toHaveCount(2);await page.getByRole('button',{name:'Clear',exact:true}).click();await expect(page.locator('#selection-summary')).toHaveText('0 selected');await selectAll(page);
 const previous=calls;const [digest]=await Promise.all([page.waitForEvent('popup'),page.getByRole('link',{name:'Print selected'}).click()]);await expect(digest.locator('.digest-entry')).toHaveCount(2);expect(new URL(digest.url()).search).toBe('');expect(new URL(digest.url()).hash).toContain('articles=');expect(calls).toBe(previous);
 await expect(digest.locator('.digest-findings').first()).toBeHidden();await digest.getByLabel('Format').selectOption('expanded');await expect(digest.locator('.digest-findings').first()).toBeVisible();await digest.getByRole('button',{name:'Print / Save as PDF',exact:true}).click();await expect.poll(()=>digest.evaluate(()=>(window as any).__digestPrintedTitle)).toMatch(/^EM Weekly - Reading Digest - 2 articles - /);
 await digest.emulateMedia({media:'print'});await expect(digest.locator('.sidebar')).toBeHidden();await expect(digest.locator('.digest-preview-tools')).toBeHidden();await expect(digest.locator('.digest-entry')).toHaveCount(2);await expect(digest.locator('.digest-entry').first()).toContainText('AI-generated');await digest.emulateMedia({media:'screen'});await digest.setViewportSize({width:1440,height:1000});await digest.screenshot({path:'tmp/digest-desktop.png',fullPage:true});await digest.setViewportSize({width:390,height:844});expect(await digest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await digest.screenshot({path:'tmp/digest-mobile.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'tmp/library-multiselect-mobile.png',fullPage:true});
});
test('digest handles empty and withdrawn selections without database access',async({page})=>{let calls=0;await page.route(origin+'/**',route=>{calls++;return route.abort();});await page.goto('library/digest/');await expect(page.getByRole('status')).toContainText('Select articles in My Library');await expect(page.getByRole('button',{name:'Print / Save as PDF'})).toBeDisabled();await page.goto('library/digest/#articles=preoxi,not-published,preoxi');await expect(page.locator('.digest-entry')).toHaveCount(1);await expect(page.getByRole('status')).toContainText('1 unavailable article was omitted');expect(calls).toBe(0);});

test('account has a focused signed-in view and password visibility is accessible',async({page})=>{
 await page.route(origin+'/**',r=>r.abort());await page.goto('account/');
 await page.getByLabel('Password',{exact:true}).fill('Local-fixture-only-123!');
 await page.getByRole('button',{name:'Show password',exact:true}).click();await expect(page.getByLabel('Password',{exact:true})).toHaveAttribute('type','text');
 await page.getByRole('button',{name:'Hide password',exact:true}).click();await expect(page.getByLabel('Password',{exact:true})).toHaveAttribute('type','password');
 await session(page);await page.reload();await expect(page.getByRole('heading',{name:'Your account',exact:true})).toBeVisible();
 await expect(page.locator('#auth-form')).toBeHidden();await expect(page.getByRole('link',{name:'Open My Library'})).toBeVisible();
 await page.screenshot({path:'tmp/account-signed-in-desktop.png',fullPage:true});
});
test('sign-in returns to the selected article and invalid credentials remain actionable',async({page})=>{
 let success=false;await page.route(origin+'/**',route=>{
  if(route.request().url().includes('/token'))return route.fulfill(success?{json:{access_token:token,refresh_token:'qa-only',expires_in:3600,token_type:'bearer',user:person}}:{status:400,json:{error:'invalid_grant',error_description:'Invalid login credentials'}});
  return route.abort();
 });
 await page.goto('account/?next=%2Farticles%2Fpreoxi%2F');await page.getByLabel('Email',{exact:true}).fill(person.email);await page.getByLabel('Password',{exact:true}).fill('QA-only-password-123!');
 await page.locator('#auth-form button[type=submit]').click();await expect(page.locator('[data-account-status]')).toContainText('Invalid login credentials');await expect(page.locator('#auth-form button[type=submit]')).toBeEnabled();
 success=true;await page.locator('#auth-form button[type=submit]').click();await expect(page).toHaveURL(/\/articles\/preoxi\/$/);
});
test('folder dialogs, removal undo, and selection toolbar work as one library flow',async({page})=>{
 await session(page);const folder={id:'00000000-0000-4000-b000-000000000099',user_id:uid,name:'Airway'};
 let restored:any,restoredMembership:any;
 await page.route(origin+'/**',route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(path.endsWith('/em_my_role'))return route.fulfill({json:'reader'});
  if(path.endsWith('/em_folders')){if(req.method()==='PATCH')folder.name=req.postDataJSON().name;return route.fulfill({json:[folder]});}
  if(path.endsWith('/em_bookmarks')){if(req.method()==='POST')restored=req.postDataJSON();return route.fulfill({json:req.method()==='GET'?[{user_id:uid,article_id:'preoxi',created_at:'2026-10-27T00:00:00Z'}]:[]});}
  if(path.endsWith('/em_folder_items')){if(req.method()==='POST')restoredMembership=req.postDataJSON();return route.fulfill({json:req.method()==='GET'?[{user_id:uid,article_id:'preoxi',folder_id:folder.id}]:[]});}
  return route.abort();
 });
 await page.goto('library/');await expect(page.locator('.saved-card')).toHaveCount(1);await expect(page.locator('#digest-selection')).toBeHidden();
 await selectAll(page);await expect(page.locator('#digest-selection')).toBeVisible();await page.getByRole('button',{name:'Clear',exact:true}).click();await expect(page.locator('#digest-selection')).toBeHidden();
 await page.locator('#folder-list').getByRole('button',{name:/Airway/}).click();await page.getByLabel('Library actions',{exact:true}).click();await page.getByRole('button',{name:'Rename folder'}).click();
 await page.getByLabel('Folder name',{exact:true}).fill('Airway & procedures');await page.getByRole('button',{name:'Save name'}).click();await expect(page.getByRole('heading',{name:'Airway & procedures',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Organize',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByLabel(/More actions for PREOXI/).click();await page.getByRole('button',{name:/Remove PREOXI/}).click();await expect(page.locator('.saved-card')).toHaveCount(0);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('.saved-card')).toHaveCount(1);expect(restored).toMatchObject({user_id:uid,article_id:'preoxi'});expect(restoredMembership[0]).toMatchObject({folder_id:folder.id,article_id:'preoxi'});
 await page.setViewportSize({width:1440,height:1000});expect((await page.locator('.saved-card').first().boundingBox())!.y).toBeLessThan(180);await page.screenshot({path:'tmp/library-reading-list-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#folder-list')).toBeHidden();expect((await page.locator('.saved-card').first().boundingBox())!.y).toBeLessThan(220);await page.screenshot({path:'tmp/library-compact-mobile.png',fullPage:true});await page.getByRole('button',{name:'Open folders',exact:true}).click();await expect(page.locator('#folder-list')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#folder-list')).toBeHidden();await expect(page.getByRole('button',{name:'Open folders',exact:true})).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'tmp/library-reading-list-mobile.png',fullPage:true});
});

test('private notes save only on request, remain plain text, and survive removal Undo',async({page})=>{
 await session(page);let writes=0,restored:any;let bookmark:any={user_id:uid,article_id:'preoxi',created_at:'2026-10-27T00:00:00Z',note:'',note_revision:0};
 await page.route(origin+'/**',route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(path.endsWith('/em_my_role'))return route.fulfill({json:'reader'});
  if(path.endsWith('/em_folders')||path.endsWith('/em_folder_items'))return route.fulfill({json:[]});
  if(path.endsWith('/em_save_article_note')){writes++;const body=req.postDataJSON();expect(body.expected_revision).toBe(bookmark.note_revision);expect(req.url()).not.toContain('private-marker');bookmark={...bookmark,note:body.note_text,note_revision:bookmark.note_revision+1};return route.fulfill({json:bookmark});}
  if(path.endsWith('/em_bookmarks')){if(req.method()==='POST')restored=req.postDataJSON();return route.fulfill({json:req.method()==='GET'?[bookmark]:[]});}
  return route.abort();
 });
 await page.goto('library/');await page.getByRole('button',{name:/Add note to PREOXI/}).click();const text='private-marker: Revisit this paper.\n<img src=x onerror="alert(1)">';
 await page.getByLabel('Private note',{exact:true}).fill(text);expect(writes).toBe(0);await page.getByRole('button',{name:'Save note',exact:true}).click();
 await expect(page.locator('.note-dialog')).toHaveCount(0);await expect(page.locator('.saved-note-preview')).toHaveText(text);await expect(page.locator('.saved-note-preview img')).toHaveCount(0);expect(writes).toBe(1);
 await page.getByRole('button',{name:/Edit note for PREOXI/}).click();await expect(page.getByLabel('Private note',{exact:true})).toHaveValue(text);await page.getByLabel('Private note',{exact:true}).fill('Unsaved draft');await page.keyboard.press('Escape');await expect(page.getByText('Discard your unsaved changes?',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(page.getByLabel('Private note',{exact:true})).toHaveValue('Unsaved draft');await page.keyboard.press('Escape');await page.getByRole('button',{name:'Discard changes',exact:true}).click();expect(writes).toBe(1);
 await page.getByLabel(/More actions for PREOXI/).click();await page.getByRole('button',{name:/Remove PREOXI/}).click();await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('.saved-note-preview')).toHaveText(text);expect(restored.note).toBe(text);expect(restored.note_revision).toBe(1);
 await page.getByRole('button',{name:/Edit note for PREOXI/}).click();await page.getByLabel('Private note',{exact:true}).fill('');await page.getByRole('button',{name:'Save note',exact:true}).click();await expect(page.locator('.saved-note-preview')).toHaveCount(0);await expect(page.locator('.saved-card')).toHaveCount(1);expect(writes).toBe(2);
});

test('a stale note save preserves the draft and does not retry or overwrite',async({page})=>{
 await session(page);let writes=0;
 await page.route(origin+'/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/em_my_role'))return route.fulfill({json:'reader'});
  if(path.endsWith('/em_bookmarks'))return route.fulfill({json:[{user_id:uid,article_id:'preoxi',created_at:'2026-10-27T00:00:00Z',note:'Original note',note_revision:2}]});
  if(path.endsWith('/em_folders')||path.endsWith('/em_folder_items'))return route.fulfill({json:[]});
  if(path.endsWith('/em_save_article_note')){writes++;return route.fulfill({status:409,json:{code:'40001',message:'This saved article changed on another device. Refresh before saving your note.'}});}return route.abort();
 });
 await page.goto('library/');await page.getByRole('button',{name:/Edit note for PREOXI/}).click();await page.getByLabel('Private note',{exact:true}).fill('My draft is retained');await page.getByRole('button',{name:'Save note',exact:true}).click();await expect(page.getByRole('alert')).toContainText('changed on another device');await expect(page.getByLabel('Private note',{exact:true})).toHaveValue('My draft is retained');await expect(page.getByRole('button',{name:'Save note',exact:true})).toBeEnabled();expect(writes).toBe(1);
});

test('digest notes are optional and reuse only the signed-in library cache',async({page,context})=>{
 await session(page);let calls=0;
 const longNote='Personal reminder: verify the population before applying these findings.\n\n'+('My own reading note. '.repeat(120));
 await context.route(origin+'/**',route=>{calls++;const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/em_my_role'))return route.fulfill({json:'reader'});
  if(path.endsWith('/em_bookmarks'))return route.fulfill({json:[{user_id:uid,article_id:'preoxi',created_at:'2026-10-27T00:00:00Z',note:longNote,note_revision:1},{user_id:uid,article_id:'device',created_at:'2026-10-26T00:00:00Z',note:'Ask journal club about external validity.',note_revision:1}]});
  if(path.endsWith('/em_folders')||path.endsWith('/em_folder_items'))return route.fulfill({json:[]});return route.abort();
 });
 await page.goto('library/');await expect(page.locator('.saved-card')).toHaveCount(2);await selectAll(page);const previous=calls;
 const [digest]=await Promise.all([page.waitForEvent('popup'),page.getByRole('link',{name:'Print selected'}).click()]);await expect(digest.locator('.digest-entry')).toHaveCount(2);await expect(digest.getByLabel('Include my notes in print / PDF',{exact:true})).not.toBeChecked();await expect(digest.locator('.personal-note-print')).toHaveCount(0);
 await digest.getByLabel('Include my notes in print / PDF',{exact:true}).check();await expect(digest.locator('.personal-note-print')).toHaveCount(2);await expect(digest.locator('.personal-note-print').first()).toContainText('Personal reminder');expect(calls).toBe(previous);expect(digest.url()).not.toContain('Personal');
 await digest.emulateMedia({media:'print'});await expect(digest.locator('.personal-note-print').first()).toBeVisible();await expect(digest.getByLabel('Include my notes in print / PDF',{exact:true})).toBeHidden();await digest.pdf({path:'tmp/private-notes-digest.pdf',format:'Letter',printBackground:true});
 await digest.emulateMedia({media:'screen'});await digest.getByLabel('Include my notes in print / PDF',{exact:true}).uncheck();await digest.emulateMedia({media:'print'});await expect(digest.locator('.personal-note-print')).toHaveCount(0);
 await digest.emulateMedia({media:'screen'});await digest.getByLabel('Include my notes in print / PDF',{exact:true}).check();await expect(digest.locator('.personal-note-print')).toHaveCount(2);expect(calls).toBe(previous);await digest.screenshot({path:'tmp/private-notes-digest.png',fullPage:true});
 await page.getByRole('button',{name:/Edit note for PREOXI/}).click();await page.screenshot({path:'tmp/private-note-editor.png',fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'tmp/private-note-editor-mobile.png',fullPage:true});
});

test('single article notes load only on opt-in and never use another account cache',async({page})=>{
 await session(page);let reads=0;await page.addInitScript(()=>localStorage.setItem('em-weekly:library:other-user',JSON.stringify({version:2,at:Date.now(),data:{bookmarks:[{article_id:'preoxi',note:'OTHER ACCOUNT SECRET'}]}})));
 await page.route(origin+'/**',route=>{if(new URL(route.request().url()).pathname.endsWith('/em_bookmarks')){reads++;return route.fulfill({json:[{article_id:'preoxi',note:'My own article note',note_revision:1}]});}return route.abort();});
 await page.goto('articles/preoxi/');expect(reads).toBe(0);await expect(page.locator('#article-private-note')).toBeHidden();
 await page.getByLabel('Include my notes in print / PDF',{exact:true}).check();await expect(page.locator('#article-private-note')).toContainText('My own article note');expect(reads).toBe(1);await expect(page.getByText('OTHER ACCOUNT SECRET',{exact:true})).toHaveCount(0);
 await page.emulateMedia({media:'print'});await expect(page.locator('#article-private-note')).toBeVisible();await page.pdf({path:'tmp/private-note-article.pdf',format:'Letter',printBackground:true});await page.emulateMedia({media:'screen'});
 await page.getByLabel('Include my notes in print / PDF',{exact:true}).uncheck();await expect(page.locator('#article-private-note')).toBeHidden();await page.getByLabel('Include my notes in print / PDF',{exact:true}).check();await expect(page.locator('#article-private-note')).toBeVisible();expect(reads).toBe(1);
});

test('signed-out note printing requests sign-in without fetching private data',async({page})=>{
 let calls=0;await page.route(origin+'/**',r=>{calls++;return r.abort();});await page.goto('articles/preoxi/');await page.getByLabel('Include my notes in print / PDF',{exact:true}).check();await expect(page.locator('.note-print-status')).toContainText('Sign in');await expect(page.getByLabel('Include my notes in print / PDF',{exact:true})).not.toBeChecked();await expect(page.getByRole('button',{name:'Print / Save as PDF',exact:true})).toBeEnabled();expect(calls).toBe(0);
});

test('a note on an unsaved article creates its favorite and is immediately printable',async({page})=>{
 await session(page);let reads=0,writes=0;
 await page.route(origin+'/**',route=>{const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/em_bookmarks')){reads++;return route.fulfill({json:[]});}
  if(path.endsWith('/em_save_article_note')){writes++;const b=route.request().postDataJSON();expect(b.expected_revision).toBeNull();return route.fulfill({json:{article_id:b.article,note:b.note_text,note_revision:1}});}return route.abort();
 });
 await page.goto('articles/preoxi/');await page.getByRole('button',{name:'Open notes',exact:true}).click();await expect(page.getByLabel('Private note',{exact:true})).toHaveAttribute('maxlength','4000');await page.getByLabel('Private note',{exact:true}).fill('My new article reminder');expect(writes).toBe(0);await page.getByRole('button',{name:'Save note',exact:true}).click();await expect(page.getByRole('button',{name:'Saved ✓',exact:true})).toBeVisible();expect(writes).toBe(1);expect(reads).toBe(1);
 await page.getByLabel('Include my notes in print / PDF',{exact:true}).check();await expect(page.locator('#article-private-note')).toContainText('My new article reminder');expect(reads).toBe(1);
});

test('desktop notes split reading space and keep drafts when closed without database writes',async({page})=>{
 await session(page);let reads=0,writes=0;
 await page.route(origin+'/**',route=>{const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/em_bookmarks')){reads++;return route.fulfill({json:[]});}
  if(path.endsWith('/em_save_article_note')){writes++;const b=route.request().postDataJSON();return route.fulfill({json:{article_id:b.article,note:b.note_text,note_revision:writes}});}return route.abort();
 });
 await page.setViewportSize({width:1440,height:1000});await page.goto('articles/preoxi/');expect(reads).toBe(0);
 await page.getByRole('button',{name:'Open notes',exact:true}).click();await expect(page.getByLabel('Private note',{exact:true})).toBeEditable();
 const panel=await page.locator('#notes-panel').boundingBox(),article=await page.locator('.article-detail').boundingBox();expect(panel!.width/1440).toBeGreaterThan(.30);expect(panel!.width/1440).toBeLessThan(.37);expect(article!.x+article!.width).toBeLessThanOrEqual(panel!.x);
 await page.getByLabel('Private note',{exact:true}).fill('Review the study population and external validity.');expect(writes).toBe(0);
 await page.getByRole('button',{name:'Close notes',exact:true}).click();await expect(page.locator('#notes-panel')).toBeHidden();await expect(page.locator('#notes-draft-badge')).toBeVisible();
 await page.getByRole('button',{name:'Open notes',exact:true}).click();await expect(page.getByLabel('Private note',{exact:true})).toHaveValue('Review the study population and external validity.');expect(reads).toBe(1);
 await page.mouse.move(180,500);await page.mouse.wheel(0,550);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(0);await expect(page.locator('#notes-panel')).toBeVisible();
 await page.getByRole('button',{name:'Save note',exact:true}).click();await expect(page.locator('#side-note-status')).toHaveText('Note saved.');expect(writes).toBe(1);await expect(page.getByRole('button',{name:'Save note',exact:true})).toBeDisabled();
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'tmp/article-notes-split-desktop.png',fullPage:false});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/article-notes-sheet-mobile.png',fullPage:false});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.emulateMedia({media:'print'});await expect(page.locator('#notes-panel')).toBeHidden();await expect(page.locator('#notes-launcher')).toBeHidden();await expect(page.locator('#article-private-note')).toBeHidden();
 await page.emulateMedia({media:'screen'});await page.getByLabel('Include my notes in print / PDF',{exact:true}).check();await expect(page.locator('#article-private-note')).toContainText('Review the study population');expect(reads).toBe(1);await page.emulateMedia({media:'print'});await page.pdf({path:'tmp/side-notes-article.pdf',format:'Letter',printBackground:true});
});

test('weekly brief notes share article records, preserve per-article drafts, and print only by choice',async({page})=>{
 await session(page);const issue=JSON.parse(fs.readFileSync('content/issues/2026-10-26.json','utf8'));const ids=issue.items.map((i:any)=>i.articleId);let reads=0,writes=0;const saved=new Map();
 await page.route(origin+'/**',route=>{const req=route.request(),url=new URL(req.url()),path=url.pathname;
  if(path.endsWith('/em_bookmarks')){reads++;const selected=(url.searchParams.get('article_id')||'').match(/\((.*)\)/)?.[1].split(',')||[];return route.fulfill({json:selected.flatMap(id=>saved.has(id)?[saved.get(id)]:[])});}
  if(path.endsWith('/em_save_article_note')){writes++;const b=req.postDataJSON(),note={article_id:b.article,note:b.note_text,note_revision:(saved.get(b.article)?.note_revision||0)+1};saved.set(b.article,note);return route.fulfill({json:note});}return route.abort();
 });
 await page.setViewportSize({width:1440,height:1000});await page.goto('weekly/2026-10-26/');expect(reads).toBe(0);await page.locator(`[data-open-note="${ids[0]}"]`).click();await expect(page.getByLabel('Article for notes')).toHaveValue(ids[0]);await page.getByLabel('Private note',{exact:true}).fill('My first article draft.');
 await page.getByLabel('Article for notes').selectOption(ids[1]);await page.getByLabel('Private note',{exact:true}).fill('My second article note.');await page.getByRole('button',{name:'Save note',exact:true}).click();await expect(page.locator('#side-note-status')).toHaveText('Note saved.');
 await page.getByLabel('Article for notes').selectOption(ids[0]);await expect(page.getByLabel('Private note',{exact:true})).toHaveValue('My first article draft.');expect(reads).toBe(2);await page.getByRole('button',{name:'Save note',exact:true}).click();await expect(page.locator('#side-note-status')).toHaveText('Note saved.');expect(writes).toBe(2);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'tmp/weekly-notes-split-desktop.png',fullPage:false});await expect(page.locator('.personal-note-print:visible')).toHaveCount(0);
 await page.getByLabel('Include my notes in print / PDF',{exact:true}).check();await expect(page.locator('.personal-note-print:visible')).toHaveCount(2);await page.emulateMedia({media:'print'});await expect(page.locator('#notes-panel')).toBeHidden();await expect(page.locator('.personal-note-print:visible')).toHaveCount(2);await page.pdf({path:'tmp/weekly-with-private-notes.pdf',format:'Letter',printBackground:true});
 await page.emulateMedia({media:'screen'});await page.getByLabel('Include my notes in print / PDF',{exact:true}).uncheck();await expect(page.locator('.personal-note-print:visible')).toHaveCount(0);
});

test('signed-out weekly notes offer sign-in without fetching data or covering the reading pane',async({page})=>{
 let calls=0;await page.route(origin+'/**',r=>{calls++;return r.abort();});await page.goto('weekly/2026-10-26/');expect(calls).toBe(0);await page.getByRole('button',{name:'Open notes',exact:true}).click();await expect(page.locator('#notes-signin')).toBeVisible();await expect(page.locator('#notes-signin-link')).toHaveAttribute('href',/account\/\?next=/);await expect(page.locator('.issue-detail')).toBeVisible();expect(calls).toBe(0);await page.keyboard.press('Escape');await expect(page.locator('#notes-panel')).toBeHidden();await expect(page.getByRole('button',{name:'Open notes',exact:true})).toBeFocused();
});
