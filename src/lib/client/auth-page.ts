import {supabase,base,user,check,status,safeNext,signOut} from './account';
const form=document.querySelector<HTMLFormElement>('#auth-form')!;
const message=document.querySelector<HTMLElement>('#auth-message')!;
const panel=document.querySelector<HTMLElement>('.auth-panel')!;
const password=form.elements.namedItem('password') as HTMLInputElement;
const email=form.elements.namedItem('email') as HTMLInputElement;
const toggle=document.querySelector<HTMLButtonElement>('.password-toggle')!;
let mode='signin';
function hidePassword(){password.type='password';toggle.textContent='Show';toggle.setAttribute('aria-label','Show password');toggle.setAttribute('aria-pressed','false');}
function setMode(value:string){
 mode=value;status('');form.hidden=false;
 document.querySelector('#auth-title')!.textContent=mode==='signup'?'Create your account':mode==='reset'?'Reset your password':mode==='recovery'?'Choose a new password':'Welcome back';
 document.querySelector('#auth-description')!.textContent=mode==='signup'?'Save articles, organize folders, and print a personal digest.':mode==='reset'?'Enter your email and we’ll send a reset link.':mode==='recovery'?'Choose a password with at least 10 characters.':'Sign in to your saved articles and folders.';
 document.querySelectorAll<HTMLButtonElement>('.auth-tabs [data-auth-mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.authMode===mode);b.setAttribute('aria-pressed',String(b.dataset.authMode===mode));});
 document.querySelector<HTMLElement>('.auth-password-field')!.hidden=mode==='reset';password.required=mode!=='reset';
 email.closest('label')!.hidden=mode==='recovery';email.required=mode!=='recovery';
 password.autocomplete=mode==='signin'?'current-password':'new-password';password.minLength=mode==='signin'?1:10;password.placeholder=mode==='signin'?'Your password':'At least 10 characters';hidePassword();
 document.querySelector<HTMLElement>('[data-auth-mode=reset]')!.hidden=mode!=='signin';
 document.querySelector<HTMLElement>('.auth-tabs')!.hidden=mode==='reset'||mode==='recovery';
 document.querySelector<HTMLElement>('.auth-back')!.hidden=mode==='signin'||mode==='signup'||mode==='recovery';
 form.querySelector('button[type=submit]')!.textContent=mode==='signup'?'Create account':mode==='reset'?'Send reset link':mode==='recovery'?'Save new password':'Sign in';
 message.textContent=mode==='signup'?'Free account · Email confirmation required.':'';
}
document.querySelectorAll<HTMLButtonElement>('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.authMode!)));
toggle.addEventListener('click',()=>{const show=password.type==='password';password.type=show?'text':'password';toggle.textContent=show?'Hide':'Show';toggle.setAttribute('aria-label',show?'Hide password':'Show password');toggle.setAttribute('aria-pressed',String(show));});
supabase.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')setMode('recovery');});
if(location.hash.includes('type=recovery')||new URLSearchParams(location.search).get('mode')==='recovery')setMode('recovery');
form.addEventListener('submit',async e=>{
 e.preventDefault();const button=form.querySelector<HTMLButtonElement>('button[type=submit]')!,requestMode=mode;button.disabled=true;
 const controls=[...document.querySelectorAll<HTMLButtonElement>('[data-auth-mode]')];controls.forEach(b=>b.disabled=true);status('Working…');panel.setAttribute('aria-busy','true');
 try{
  const address=email.value.trim(),secret=password.value;
  if(requestMode==='signup'){
   check(await supabase.auth.signUp({email:address,password:secret,options:{emailRedirectTo:location.origin+base+'/account/'}}));
   document.querySelector('#auth-title')!.textContent='Check your inbox';document.querySelector('#auth-description')!.textContent=`We sent a confirmation link to ${address}.`;
   form.hidden=true;document.querySelector<HTMLElement>('.auth-tabs')!.hidden=true;document.querySelector<HTMLElement>('.auth-back')!.hidden=false;message.textContent='';password.value='';
   status('Check your email to confirm your account, then sign in.');
  }else if(requestMode==='reset'){
   check(await supabase.auth.resetPasswordForEmail(address,{redirectTo:location.origin+base+'/account/?mode=recovery'}));
   form.hidden=true;document.querySelector('#auth-title')!.textContent='Check your inbox';document.querySelector('#auth-description')!.textContent='Follow the link in your email to choose a new password.';
   status('If an account exists for that email, a reset link has been sent.');
  }else if(requestMode==='recovery'){
   check(await supabase.auth.updateUser({password:secret}));status('Password updated.');location.assign(base+'/library/');
  }else{
   check(await supabase.auth.signInWithPassword({email:address,password:secret}));location.assign(safeNext(new URLSearchParams(location.search).get('next')));
  }
 }catch(error){status(error instanceof Error?error.message:'Unable to sign in. Please try again.',true);}
 finally{button.disabled=false;controls.forEach(b=>b.disabled=false);panel.setAttribute('aria-busy','false');}
});
document.querySelector('[data-sign-out]')?.addEventListener('click',async e=>{const b=e.currentTarget as HTMLButtonElement;b.disabled=true;try{await signOut();}catch(e){status((e as Error).message,true);b.disabled=false;}});
user().then(u=>{
 if(u&&mode!=='recovery'){
  const signed=document.querySelector<HTMLElement>('#signed-in')!;signed.hidden=false;panel.classList.add('is-signed-in');
  document.querySelector('#auth-title')!.textContent='Your account';document.querySelector('#auth-description')!.textContent='Your reading list is ready when you are.';
  signed.querySelector('[data-email]')!.textContent=u.email||'';signed.querySelector('[data-account-avatar]')!.textContent=(u.email||'R').slice(0,1).toUpperCase();
  form.hidden=true;document.querySelector<HTMLElement>('.auth-tabs')!.hidden=true;document.querySelector<HTMLElement>('.auth-back')!.hidden=true;message.textContent='';
 }
}).catch(e=>status(e.message,true)).finally(()=>panel.setAttribute('aria-busy','false'));
