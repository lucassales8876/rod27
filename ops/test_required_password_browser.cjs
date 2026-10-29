const {chromium}=require('/tmp/rod27-playwright-e2e/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 try{
  for(const url of ['secretaria','controle']){
   const page=await browser.newPage();let changes=0;const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/functions/v1/**',async route=>{
    const b=route.request().postDataJSON();
    if(b.action==='bootstrap')return route.fulfill({status:428,contentType:'application/json',body:JSON.stringify({ok:false,password_change_required:true,error:'Troca obrigatória de senha.'})});
    assert.equal(b.action,'change_required_password');changes++;
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,reauthenticate:true})});
   });
   await page.goto('https://rod27-ieadern.pages.dev/'+url);
   await page.waitForFunction(()=>typeof rod27RequirePasswordChange==='function');
   await page.evaluate(async()=>{S.access='synthetic-token';S.a='synthetic-token';await boot()});
   await page.getByRole('heading',{name:'Troca obrigatória de senha',exact:true}).waitFor();
   await page.locator('#required_pw').fill('synthetic-new-password-A1!');
   await page.locator('#required_pw2').fill('different');
   await page.getByRole('button',{name:'Salvar nova senha',exact:true}).click();
   assert.match(await page.locator('#required_msg').innerText(),/não coincidem/);assert.equal(changes,0);
   await page.locator('#required_pw2').fill('synthetic-new-password-A1!');
   await page.getByRole('button',{name:'Salvar nova senha',exact:true}).click();
   await page.getByRole('heading',{name:'Acesso',exact:true}).waitFor();assert.equal(changes,1);
   assert.equal(await page.locator('#required_pw').count(),0);assert.deepEqual(errors,[]);
   console.log('PASS published required password screen, mismatch validation, one submission and logout:',url);
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
