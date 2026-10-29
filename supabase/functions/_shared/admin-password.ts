// Call only after Auth.getUser has validated this exact bearer token.
export async function adminSessionActive(db:any,user:any,req:Request):Promise<boolean>{
 try{
  const token=(req.headers.get('authorization')??'').replace(/^Bearer\s+/,'');
  const raw=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
  const sid=JSON.parse(atob(raw)).session_id;
  if(typeof sid!=='string'||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(sid))return false;
  const {data,error}=await db.rpc('rod27_admin_session_active',{p_user:user.id,p_session:sid});
  return !error&&data===true;
 }catch{return false}
}
export function passwordChangeRequired(user:any):boolean{
 return user?.app_metadata?.rod27_password_change_required===true;
}
export async function completeRequiredPasswordChange(db:any,user:any,req:Request,body:any){
 if(!passwordChangeRequired(user))throw Error('Não há troca obrigatória pendente.');
 const password=body.password;
 if(typeof password!=='string'||password.length<12||password.length>128||password.trim()!==password)
  throw Error('Escolha uma nova senha de 12 a 128 caracteres, sem espaços nas extremidades.');
 // Revoke first: Auth password updates can already invalidate the calling session.
 // The service client can then atomically update password and the protected flag.
 const token=(req.headers.get('authorization')??'').replace(/^Bearer\s+/,'');
 const revoked=await db.auth.admin.signOut(token,'global');
 if(revoked.error)throw Error('Não foi possível encerrar as sessões. A administração permanece bloqueada. Entre novamente para concluir.');
 const done=await db.auth.admin.updateUserById(user.id,{password,app_metadata:{...user.app_metadata,rod27_password_change_required:false}});
 if(done.error)throw Error('Não foi possível atualizar a senha. Entre novamente e escolha outra senha.');
 const {error}=await db.from('auditoria_sistema').insert({user_id:user.id,papel:'self',acao:'required_password_change_completed',entidade:'usuarios_admin',entidade_id:user.id,detalhes:{sessions_revoked:true}});
 if(error)throw Error('Senha atualizada. Entre novamente para verificar a liberação.');
 return{ok:true,reauthenticate:true};
}
