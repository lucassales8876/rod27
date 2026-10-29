// Live database authorization: never derive permission from cached JWT role claims.
export async function secretariaAllowed(db:any,userId:string):Promise<boolean>{
  const {data,error}=await db.rpc('rod27_secretaria_can_access',{p_actor:userId});
  if(error)throw new Error('Não foi possível verificar a autorização da Secretaria.');
  return data===true;
}
