import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {randomBytes,createHash} from "node:crypto";
import {fileURLToPath,pathToFileURL} from "node:url";
import {dirname,resolve,join} from "node:path";
import {tmpdir} from "node:os";
import {unlinkSync} from "node:fs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const key=randomBytes(32);
const secret=key.toString("base64");
globalThis.Deno={env:{get:k=>k==="ROD27_CONTENT_KEY_B64"?secret:undefined}};
const temp=join(tmpdir(),"rod27-test-crypto-"+process.pid+".mjs");
execFileSync("npx",["--yes","esbuild",join(root,"supabase/functions/_shared/rod27-content-crypto.ts"),"--bundle","--platform=node","--format=esm","--outfile="+temp],{cwd:root,stdio:"ignore"});
const cryptoMod=await import(pathToFileURL(temp).href);
const {encryptText,decryptText,encryptFile,decryptFile}=cryptoMod;
let checks=0;
function ok(cond,msg){assert.ok(cond,msg);checks++}
const samples=[
{v:"",label:"empty"},
{v:"Sim",label:"radio"},
{v:"Não",label:"unicode"},
{v:"✓ Respostas sobre fé, ministério, solidariedade e liderança 🤝\n行きます",label:"unicode + newline"},
{v:"A".repeat(12000),label:"max text answer"},
{v:"ç".repeat(4000),label:"max manifestation reason"},
{v:JSON.stringify({deseja_permanecer:false,opcao_movimentacao:null,justificativa:"teste, não permanecer"}),label:"manifest json"}
];
for (const {v,label} of samples){
 const scope=label==="manifest json"?"manifest:coord-test-uuid":"answer:eval-test-uuid:question-test-uuid";
 const cipher=await encryptText(v,scope);
 ok(cipher.startsWith("r27e1:")&&!cipher.includes(v)||v==="","cipher prefix "+label);
 ok(await decryptText(cipher,scope)===v,"roundtrip "+label);
 ok((await encryptText(v,scope))!==cipher,"unique nonce "+label);
 await assert.rejects(()=>decryptText(cipher,scope+":other"),"wrong scope "+label);checks++;
 const tampered=Buffer.from(cipher.slice(6),"base64");tampered[tampered.length-1]^=1;
 await assert.rejects(()=>decryptText("r27e1:"+tampered.toString("base64"),scope),"tampered cipher "+label);checks++;
 if(label==="max manifestation reason")ok(cipher.length<12000,"4000 unicode ciphertext fits 12k DB check");
}
for(const [name,header] of [["PDF",[37,80,68,70]],["JPG",[255,216,255,0]],["PNG",[137,80,78,71,13,10,26,10]]]){
 const data=new Uint8Array([...header,...randomBytes(1000)]);
 const p="document:test-"+name+"/file.r27";
 const cipher=await encryptFile(data,p);
 ok(cipher.length===data.length+35,name+" overhead");
 ok(new TextDecoder().decode(cipher.slice(0,7))==="R27ENC1",name+" envelope");
 ok(!cipher.slice(7,7+header.length).every((x,i)=>x===header[i]),name+" not clear header");
 ok(Buffer.from(await decryptFile(cipher,p)).equals(Buffer.from(data)),name+" roundtrip");
 await assert.rejects(()=>decryptFile(cipher,p+"WRONG"),name+" wrong path");checks++;
 await assert.rejects(()=>decryptFile(data,p),name+" denies raw doc");checks++;
}
const big=new Uint8Array(8388608);
big.set([37,80,68,70]);
const sealed=await encryptFile(big,"document:large.r27");
ok(sealed.length===8388643&&sealed.length<=8388672,"8MiB ciphertext fits bucket setting");
ok(Buffer.from(await decryptFile(sealed,"document:large.r27")).equals(Buffer.from(big)),"max document decrypted");
await assert.rejects(()=>decryptText("r27e1:AAAA","answer:x:y"));checks++;
await assert.rejects(()=>decryptText("r27e1:not base64","answer:x:y"));checks++;
const co=readFileSync(root+"/supabase/functions/rod27-coordinator/index.ts","utf8");
const ad=readFileSync(root+"/supabase/functions/rod27-admin/index.ts","utf8");
const frontend=readFileSync(root+"/secretaria.html","utf8");
const map=readFileSync(root+"/mapa-rodizio.js","utf8");
const invariants=[
["coordinator text encrypted",co.includes('payload.resposta_texto = await encryptText(value,"answer:"')],
["coordinator option encrypted",co.includes('payload.resposta_opcao = await encryptText(value,"answer:"')],
["coordinator answers decrypted",co.includes('answers: await unveilAnswers(answers??[],evaluation.id)')],
["manifest content encrypted",co.includes('payload.justificativa=await encryptText(JSON.stringify')],
["manifest boolean omitted in database",co.includes('payload.deseja_permanecer=null;')],
["manifest option omitted in database",co.includes('payload.opcao_movimentacao=null;')],
["manifest read decrypted",co.includes('return await unveilManifestation(data);')],
["admin answers decrypted",ad.includes('const clear=await Promise.all((a??[]).map((z:any)=>unveilAnswer(z,e.id)))')],
["admin export decrypted",ad.includes('resposta:await decryptText(answer?.resposta_texto??answer?.resposta_opcao')],
["classification memo encrypted",ad.includes('resumo_analitico:await encryptText(')],
["classification memo decrypted",ad.includes('resumo_analitico:await decryptText(')],
["transcription encrypted",ad.includes('resposta:value?await encryptText(value,"answer:"')],
["transcription draft decrypted",ad.includes('resposta:await decryptText(item.resposta')],
["coordinator PDF encrypted",ad.includes('const protectedBytes=await encryptFile(bytes,"document:"+path)')],
["admin PDF encrypted",ad.includes('const protectedBytes=await encryptFile(bytes,"document:"+path)')],
["protected doc read",ad.includes('const plain=await decryptFile(')],
["evaluation admin guard",ad.includes('case"evaluation":{if(!canOperate(ctx))')],
["coordinator own evaluation guard",co.includes('await getOwnedEvaluation(ctx, String(body?.avaliacao_id ?? ""))')],
["blob preview helper",frontend.includes('window.rod27DocumentObjectURL')],
["preview via authenticated api",map.includes('api("office_document_url"')],
["storage octet-stream",ad.includes('contentType:"application/octet-stream"')],
["storage no signed url disclosure",!ad.includes("createSignedUrl(")],
];
for(const [desc,condition] of invariants)ok(condition,desc);
key.fill(0);unlinkSync(temp);
console.log("PASS "+checks+" crypto+contract assertions (including random key, unicode, max 8 MiB, tamper, wrong scope and route coverage).");
