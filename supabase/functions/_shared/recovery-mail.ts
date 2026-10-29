export const RECOVERY_ORIGIN='https://rod27-ieadern.pages.dev';
export function recoveryMailReady(){
 return Deno.env.get('ROD27_RECOVERY_DELIVERY_ENABLED')==='true'&&!!Deno.env.get('ROD27_RECOVERY_RESEND_KEY')&&!!Deno.env.get('ROD27_RECOVERY_FROM');
}
export async function digestRecovery(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('')}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))}
export async function sendRecoveryMail(to:string,subject:string,explanation:string,url:string,idempotency:string){
 if(!recoveryMailReady())throw Error('O envio de e-mails adicionais ainda não está configurado.');
 const from=Deno.env.get('ROD27_RECOVERY_FROM')!;
 if(/[\r\n]/.test(from)||!/^\S+@\S+\.\S+$/.test(to))throw Error('Configuração de envio inválida.');
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+Deno.env.get('ROD27_RECOVERY_RESEND_KEY'),'Content-Type':'application/json','Idempotency-Key':idempotency},
  body:JSON.stringify({from,to:[to],subject,html:'<h2>Rod27</h2><p>'+escapeHtml(explanation)+'</p><p><a href="'+escapeHtml(url)+'">Continuar</a></p><p>Se você não solicitou esta mensagem, ignore-a.</p>',text:'Rod27\n\n'+explanation+'\n\n'+url+'\n\nSe você não solicitou esta mensagem, ignore-a.'}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('O serviço de envio não aceitou a mensagem. Tente novamente mais tarde.');
 const data=await r.json();if(typeof data.id!=='string')throw Error('O serviço de envio não confirmou o recebimento da mensagem.');
 return data.id as string; // Provider acceptance is not proof of inbox delivery.
}
export async function requestRecoveryConfirmation(db:any,ctx:any,emailId:string){
 if(ctx.admin.papel!=='secretario_geral')throw Error('Acesso exclusivo do secretário-geral.');
 if(!recoveryMailReady())throw Error('O envio ao endereço secundário aguarda a configuração do remetente.');
 const {data:email,error}=await db.from('rod27_recovery_emails').select('id,email,verified_at').eq('id',emailId).eq('user_id',ctx.user.id).maybeSingle();
 if(error||!email||email.verified_at)throw Error('Endereço indisponível para confirmação.');
 const raw=crypto.getRandomValues(new Uint8Array(32));
 const token=btoa(String.fromCharCode(...raw)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const hash=await digestRecovery(token);
 const issued=await db.rpc('rod27_issue_recovery_confirmation',{p_actor:ctx.user.id,p_email_id:email.id,p_hash:hash});
 if(issued.error)throw Error('Não foi possível solicitar a confirmação. Aguarde um minuto antes de tentar novamente.');
 await sendRecoveryMail(email.email,'Confirme seu endereço de recuperação do Rod27','Confirme que este endereço pertence a você. Este link expira em 15 minutos e não altera sua senha.',RECOVERY_ORIGIN+'/confirmar-email#token='+token,'verify-'+hash);
 const accepted=await db.from('rod27_recovery_challenges').update({send_accepted_at:new Date().toISOString()}).eq('token_hash',hash);
 if(accepted.error)throw Error('Não foi possível ativar a confirmação. Solicite um novo link.');
 const audit=await db.from('auditoria_sistema').insert({user_id:ctx.user.id,papel:ctx.admin.papel,acao:'recovery_confirmation_send_accepted',entidade:'rod27_recovery_emails',entidade_id:email.id,detalhes:{delivery_confirmed:false}});
 if(audit.error)throw Error('Envio aceito. Atualize o perfil para consultar o estado da confirmação.');
 return{ok:true,provider_accepted:true,delivery_confirmed:false};
}
