import {supabase,base,user,check,status,safeNext,signOut} from './account';
const form=document.querySelector<HTMLFormElement>('#auth-form')!;
let mode='signin';const message=document.querySelector<HTMLElement>('#auth-message')!;
function setMode(value:string){mode=value;document.querySelectorAll<HTMLButtonElement>('[data-auth-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.authMode===mode));const password=form.elements.namedItem('password') as HTMLInputElement;password.closest('label')!.hidden=mode==='reset';password.required=mode!=='reset';const email=form.elements.namedItem('email') as HTMLInputElement;email.closest('label')!.hidden=mode==='recovery';email.required=mode!=='recovery';password.autocomplete=mode==='signin'?'current-password':'new-password';password.minLength=mode==='signin'?1:10;form.querySelector('button[type=submit]')!.textContent=mode==='signup'?'Create account':mode==='reset'?'Send reset link':mode==='recovery'?'Save new password':'Sign in';message.textContent=mode==='signup'?'Confirm your email to activate your account.':mode==='recovery'?'Choose a new password for your account.':'';}
document.querySelectorAll<HTMLButtonElement>('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.authMode!)));
supabase.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')setMode('recovery');});
if(location.hash.includes('type=recovery')||new URLSearchParams(location.search).get('mode')==='recovery')setMode('recovery');
form.addEventListener('submit',async e=>{e.preventDefault();const button=form.querySelector<HTMLButtonElement>('button[type=submit]')!;button.disabled=true;status('Working…');try{
 const email=(form.elements.namedItem('email') as HTMLInputElement).value.trim();const password=(form.elements.namedItem('password') as HTMLInputElement).value;
 if(mode==='signup'){check(await supabase.auth.signUp({email,password,options:{emailRedirectTo:location.origin+base+'/account/'}}));status('Check your email to confirm your account, then sign in.');}
 else if(mode==='reset'){check(await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+base+'/account/?mode=recovery'}));status('If an account exists for that email, a reset link has been sent.');}
 else if(mode==='recovery'){check(await supabase.auth.updateUser({password}));status('Password updated.');location.assign(base+'/library/');}
 else{check(await supabase.auth.signInWithPassword({email,password}));location.assign(safeNext(new URLSearchParams(location.search).get('next')));}
 }catch(error){status(error instanceof Error?error.message:'Unable to sign in. Please try again.',true);}finally{button.disabled=false;}});
document.querySelector('[data-sign-out]')?.addEventListener('click',()=>signOut().catch(e=>status(e.message,true)));
user().then(u=>{if(u&&mode!=='recovery'){const signed=document.querySelector<HTMLElement>('#signed-in')!;signed.hidden=false;signed.querySelector('[data-email]')!.textContent=u.email||'';form.hidden=true;document.querySelector<HTMLElement>('.auth-tabs')!.hidden=true;document.querySelector<HTMLElement>('[data-auth-mode=reset]')!.hidden=true;}}).catch(e=>status(e.message,true));
