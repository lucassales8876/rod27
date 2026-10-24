// Rod27 - cifragem autenticada de conteudos e anexos sensiveis (AES-256-GCM).
// Chave SOMENTE em secrets Edge, nunca no frontend, banco ou repositorio.
const TEXT_PREFIX="r27e1:";
const BIN_HEADER=new TextEncoder().encode("R27ENC1");
const te=new TextEncoder(),td=new TextDecoder();
let keyPromise:Promise<CryptoKey>|null=null;
function contentKey():Promise<CryptoKey>{
 if(!keyPromise)keyPromise=(async()=>{
  const secret=Deno.env.get("ROD27_CONTENT_KEY_B64");
  if(!secret)throw new Error("Chave criptografica Rod27 indisponivel: gravacao bloqueada.");
  let raw:Uint8Array;
  try{raw=Uint8Array.from(atob(secret),c=>c.charCodeAt(0));}catch{throw new Error("Chave criptografica invalida.");}
  if(raw.length!==32)throw new Error("Chave criptografica invalida.");
  return crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["encrypt","decrypt"]);
 })();
 return keyPromise;
}
function asBase64(bytes:Uint8Array):string{
 let str="";for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(str);
}
function fromBase64(value:string):Uint8Array{return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
async function seal(plain:Uint8Array,scope:string):Promise<Uint8Array>{
 const nonce=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:nonce,additionalData:te.encode("rod27:"+scope)},await contentKey(),plain));
 const result=new Uint8Array(12+ciphertext.length);result.set(nonce);result.set(ciphertext,12);return result;
}
async function unseal(data:Uint8Array,scope:string):Promise<Uint8Array>{
 if(data.length<28)throw new Error("Conteudo cifrado incompleto.");
 try{
  const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:data.slice(0,12),additionalData:te.encode("rod27:"+scope)},await contentKey(),data.slice(12));
  return new Uint8Array(plain);
 }catch{throw new Error("Falha de integridade ou chave ao abrir conteudo protegido.");}
}
export async function encryptText(value:string|null|undefined,scope:string):Promise<string|null>{
 if(value===null||value===undefined)return null;
 return TEXT_PREFIX+asBase64(await seal(te.encode(String(value)),scope));
}
export async function decryptText(value:string|null|undefined,scope:string):Promise<string|null>{
 if(value===null||value===undefined)return null;
 if(!value.startsWith(TEXT_PREFIX))return value; // Leitura legada.
 return td.decode(await unseal(fromBase64(value.slice(TEXT_PREFIX.length)),scope));
}
export async function encryptFile(bytes:Uint8Array,scope:string):Promise<Uint8Array>{
 const cipher=await seal(bytes,scope);const result=new Uint8Array(BIN_HEADER.length+cipher.length);
 result.set(BIN_HEADER);result.set(cipher,BIN_HEADER.length);return result;
}
export async function decryptFile(bytes:Uint8Array,scope:string):Promise<Uint8Array>{
 const encrypted=BIN_HEADER.every((b,i)=>bytes[i]===b);
 if(!encrypted)throw new Error("Arquivo sem protecao criptografica; acesso direto negado.");
 return unseal(bytes.subarray(BIN_HEADER.length),scope);
}
export function encodeBase64(bytes:Uint8Array):string{return asBase64(bytes);}
