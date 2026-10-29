const {chromium}=require('/tmp/rod27-playwright-e2e/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();let confirmed=0,verified=0,updated=0;const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/functions/v1/rod27-recovery',async route=>{
   const b=route.request().postDataJSON();assert.equal(b.action,'confirm_secondary');assert.equal(b.token,'v'.repeat(43));confirmed++;
   await route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
  });
  await page.goto('https://rod27-ieadern.pages.dev/confirmar-email#token='+'v'.repeat(43));
  assert.equal(confirmed,0);assert.equal(await page.evaluate(()=>location.hash),'');
  await page.getByRole('button',{name:'Confirmar meu e-mail',exact:true}).click();
  await page.getByText(/Endereço confirmado/).waitFor();assert.equal(confirmed,1);
  await page.goto('https://rod27-ieadern.pages.dev/confirmar-email');
  assert.equal(await page.getByRole('button',{name:'Confirmar meu e-mail',exact:true}).isDisabled(),true);
  await page.route('**/auth/v1/verify',async route=>{
   const b=route.request().postDataJSON();assert.equal(b.type,'recovery');assert.equal(b.token_hash,'a'.repeat(64));verified++;
   await route.fulfill({status:200,contentType:'application/json',body:'{"access_token":"synthetic-only"}'});
  });
  await page.route('**/auth/v1/user',async route=>{
   assert.equal(route.request().headers().authorization,'Bearer synthetic-only');assert.equal(route.request().postDataJSON().password,'synthetic-new-password-A1!');updated++;
   await route.fulfill({status:200,contentType:'application/json',body:'{}'});
  });
  await page.goto('https://rod27-ieadern.pages.dev/redefinir-senha#type=recovery&token_hash='+'a'.repeat(64));
  assert.equal(verified,0);assert.equal(updated,0);assert.equal(await page.evaluate(()=>location.hash),'');
  await page.locator('#pw').fill('synthetic-new-password-A1!');await page.locator('#pw2').fill('synthetic-new-password-A1!');
  await page.getByRole('button',{name:'Confirmar',exact:true}).click();await page.getByText('Senha atualizada. Retorne à tela de acesso.',{exact:true}).waitFor();
  assert.equal(verified,1);assert.equal(updated,1);assert.equal(await page.locator('#pw').inputValue(),'');assert.deepEqual(errors,[]);
  console.log('PASS published email proof and recovery: no token consumed on page open; fragment removed; explicit confirmation and password submission; no real email/password used.');
  for(const [body,expected] of [[{action:'request',email:'synthetic@example.invalid'},503],[{action:'confirm_secondary',token:'v'.repeat(43)},400],[null,400]]){
   const r=await fetch('https://zrjxxcytgtjuuinhkfux.supabase.co/functions/v1/rod27-recovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   assert.equal(r.status,expected);const d=await r.json();assert.equal(d.ok,false);
  }
  console.log('PASS live Edge: delivery explicitly unavailable; invalid proof and malformed body rejected. No real email sent.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
