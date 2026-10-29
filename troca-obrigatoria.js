// This screen is reached after a valid sign-in. No password is persisted by this script.
window.rod27RequirePasswordChange=function(){
 closeM();
 app.innerHTML='<div class="login"><h2>Troca obrigatória de senha</h2><p>Antes de acessar a administração, escolha sua nova senha pessoal com pelo menos 12 caracteres.</p><div class="field"><label>Nova senha</label><input id="required_pw" type="password" autocomplete="new-password" minlength="12" maxlength="128"></div><div class="field"><label>Confirmar nova senha</label><input id="required_pw2" type="password" autocomplete="new-password" minlength="12" maxlength="128"></div><div id="required_msg" class="error" aria-live="polite"></div><div class="actions"><button id="required_save" class="btn primary" onclick="rod27CompletePasswordChange()">Salvar nova senha</button><button class="btn ghost" onclick="logout()">Sair</button></div></div>';
};
window.rod27CompletePasswordChange=async function(){
 var a=document.getElementById('required_pw'),b=document.getElementById('required_pw2'),m=document.getElementById('required_msg'),button=document.getElementById('required_save');
 if(a.value!==b.value){m.textContent='As senhas não coincidem.';return}
 if(a.value.length<12||a.value.length>128||a.value.trim()!==a.value){m.textContent='Use de 12 a 128 caracteres, sem espaços nas extremidades.';return}
 button.disabled=true;m.textContent='Atualizando…';
 try{
  var token=S.access||S.a;
  var r=await fetch('https://zrjxxcytgtjuuinhkfux.supabase.co/functions/v1/rod27-admin',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'change_required_password',password:a.value})});
  var d=await r.json();
  if(!r.ok||!d.ok)throw Error(d.error||'Não foi possível atualizar a senha.');
  a.value='';b.value='';logout();toast('Senha atualizada. Entre novamente com sua nova senha.');
 }catch(error){a.value='';b.value='';m.textContent=error.message;button.disabled=false}
};
