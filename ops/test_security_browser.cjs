const {chromium}=require('/tmp/rod27-playwright-e2e/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();const errors=[];let role='secretario_geral',saved=null,pinResets=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/functions/v1/**',async route=>{
   const b=route.request().postDataJSON()||{};
   let data={ok:true};
   if(b.action==='secretaria_access_get')data={ok:true,policy:{enabled:true,allow_all:false,revision:0},grants:['synthetic-top'],accounts:[{user_id:'synthetic-secretary',papel:'secretario_geral',nome_exibicao:'Secretaria de teste'},{user_id:'synthetic-top',papel:'superadmin1',nome_exibicao:'Administrador de teste'},{user_id:'synthetic-ordinary',papel:'superadmin',nome_exibicao:'Controle de teste'}]};
   if(b.action==='secretaria_access_set'){saved=b;data={ok:true}}
   if(b.action==='my_profile')data={ok:true,primary_email:'primary@example.invalid',secondary_emails:[{id:'pending',email:'secondary@example.invalid',verified_at:null}],delivery_available:false,delivery_status:'Provedor transacional não configurado. Confirmação e recuperação pendentes.'};
   if(b.action==='reset_coordinator_pin'){pinResets++;data={ok:true,rol:'SYNTHETIC',pin:'SYNTHETIC-ONE-TIME'}}
   if(b.action==='bootstrap')data={ok:true,sectors:[{setor:1,coordenador:'Teste sintético',rol:'SYNTHETIC',credencial_status:'ativa'}]};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('https://rod27-ieadern.pages.dev/secretaria');
  await page.waitForFunction(()=>typeof openAccessControl==='function');
  await page.evaluate(()=>{S.access='synthetic-only';S.data={admin:{papel:'secretario_geral',nome_exibicao:'Secretaria de teste'},sectors:[],summary:{setores:0,total:0,enviadas:0,em_preenchimento:0,nao_iniciadas:0,credenciais_ativas:0}};render()});
  assert.equal(await page.getByRole('button',{name:'Controle de acesso',exact:true}).count(),1);
  await page.getByRole('button',{name:'Controle de acesso',exact:true}).click();
  await page.locator('[name=access_account]').first().waitFor();
  assert.equal(await page.locator('[name=access_account]').count(),2);
  assert.equal(await page.locator('[name=access_account][value=synthetic-secretary]').count(),0);
  await page.locator('#access_enabled').uncheck();await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await page.waitForFunction(()=>!document.getElementById('back').classList.contains('show'));
  assert.equal(saved.enabled,false);assert.deepEqual(saved.grants,['synthetic-top']);
  await page.getByRole('button',{name:'Meu perfil',exact:true}).click();
  await page.getByText('primary@example.invalid',{exact:true}).waitFor();
  assert.match(await page.locator('#modal').innerText(),/Pendente de comprovação/);
  assert.equal(await page.locator('#modal input[type=email]').count(),1);
  await page.getByRole('button',{name:'Alterar minha senha',exact:true}).click();
  await page.getByRole('heading',{name:'Alterar minha senha',exact:true}).waitFor();
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Controle de acesso',exact:true}).count(),1);
  await page.evaluate(()=>{closeM();S.data.admin.papel='superadmin1';render()});
  assert.equal(await page.getByRole('button',{name:'Controle de acesso',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Meu perfil',exact:true}).count(),0);
  await page.goto('https://rod27-ieadern.pages.dev/controle');
  await page.evaluate(()=>{S.access='synthetic-only';S.data={admin:{papel:'superadmin1'}};S.coordData={sectors:[{setor:1,coordenador:'Teste sintético',rol:'SYNTHETIC',credencial_status:'ativa'}]};app.innerHTML=tabs()+credentialsHtml()});
  assert.equal(await page.getByRole('button',{name:'Contas',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'Mostrar PIN',exact:true}).count(),0);
  page.on('dialog',d=>d.accept());
  await page.getByRole('button',{name:'Redefinir PIN',exact:true}).click();
  await page.getByText('SYNTHETIC-ONE-TIME',{exact:true}).waitFor();
  assert.equal(pinResets,1);await page.getByRole('button',{name:'Fechar',exact:true}).click();
  assert.equal(await page.evaluate(()=>window._latestPinInfo),undefined);
  assert.equal(await page.getByText('SYNTHETIC-ONE-TIME',{exact:true}).count(),0);
  await page.evaluate(()=>{S.data.admin.papel='superadmin';app.innerHTML=tabs()});
  assert.equal(await page.getByRole('button',{name:'Contas',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: published UI with synthetic API: secretary controls, self-protection, pending email, accounts roles, single PIN display and removal. No real account or PIN used.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
