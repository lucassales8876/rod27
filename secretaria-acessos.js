// Only the secretary's own authenticated API can read or change these controls.
var accessRevision=null;
window.openAccessControl=async function(){
 try{
  var d=await api('secretaria_access_get');accessRevision=d.policy.revision;
  box.innerHTML='<h2>Controle de acesso</h2><p>O secretário-geral sempre mantém o próprio acesso.</p>'+
   '<div class="field"><label><input id="access_enabled" type="checkbox" '+(d.policy.enabled?'checked':'')+'> Liberar acesso à Secretaria</label></div>'+
   '<p class="muted">Desligado: somente o secretário-geral acessa dados e operações, inclusive bloqueando superadmin1.</p>'+
   '<div class="field"><label><input id="access_all" type="checkbox" '+(d.policy.allow_all?'checked':'')+'> Todos os administradores ativos</label></div>'+
   d.accounts.filter(function(a){return a.papel!=='secretario_geral'}).map(function(a){return '<div class="field"><label><input type="checkbox" name="access_account" value="'+e(a.user_id)+'" '+(d.grants.includes(a.user_id)?'checked':'')+'> '+e(a.nome_exibicao||a.papel)+' · '+e(a.papel)+'</label></div>'}).join('')+
   '<p class="muted">Com o acesso ligado e “Todos” desmarcado, somente as contas selecionadas são autorizadas. Todas as mudanças são auditadas.</p><div class="actions"><button class="btn primary" id="access_save" onclick="saveAccessControl()">Salvar</button><button class="btn ghost" onclick="closeM()">Fechar</button></div>';
  back.classList.add('show');
 }catch(x){toast(x.message)}
};
window.saveAccessControl=async function(){
 var b=document.getElementById('access_save');b.disabled=true;
 try{await api('secretaria_access_set',{enabled:document.getElementById('access_enabled').checked,allow_all:document.getElementById('access_all').checked,
  grants:Array.from(document.querySelectorAll('[name="access_account"]:checked')).map(function(x){return x.value}),revision:accessRevision});
  closeM();toast('Controle de acesso atualizado e auditado.');
 }catch(x){toast(x.message);b.disabled=false}
};
window.openMyProfile=async function(){
 try{
  var d=await api('my_profile');
  box.innerHTML='<h2>Meu perfil</h2><button class="btn ghost" onclick="rod27RequirePasswordChange(true)">Alterar minha senha</button><div class="field"><label>E-mail principal</label><div>'+e(d.primary_email)+'</div></div>'+
   '<h3>E-mails secundários de recuperação</h3>'+d.secondary_emails.map(function(x){return '<div class="answer"><b>'+e(x.email)+'</b><p>'+(x.verified_at?'Titularidade confirmada':'Pendente de comprovação de titularidade; não recebe recuperação')+'</p><button class="btn ghost small" onclick="removeRecoveryEmail(&quot;'+e(x.email)+'&quot;)">Remover</button></div>'}).join('')+
   '<div class="warning">'+e(d.delivery_status)+'</div><div class="field"><label>Novo e-mail secundário</label><input id="recovery_email" type="email" maxlength="254" autocomplete="email"></div>'+
   '<div class="actions"><button class="btn primary" onclick="saveRecoveryEmail()">Cadastrar como pendente</button><button class="btn ghost" onclick="closeM()">Fechar</button></div>';
  back.classList.add('show');
 }catch(x){toast(x.message)}
};
window.saveRecoveryEmail=async function(){try{await api('recovery_email_save',{email:document.getElementById('recovery_email').value});await openMyProfile()}catch(x){toast(x.message)}};
window.removeRecoveryEmail=async function(email){if(!confirm('Remover este endereço secundário?'))return;try{await api('recovery_email_save',{email:email,remove:true});await openMyProfile()}catch(x){toast(x.message)}};
document.addEventListener('visibilitychange',function(){if(document.hidden)closeM()});
window.addEventListener('pagehide',closeM);
