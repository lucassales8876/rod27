import { sql,apply,fixtures,repo,cwd } from './common.mjs';
import { resolve } from 'node:path';
import { mkdirSync,readFileSync,existsSync,copyFileSync } from 'node:fs';
if(sql("select to_regclass('public.avaliacoes_dirigente') is not null")!=='t'){
 for(const file of ['fixture-schema.sql','source-functions.sql','fixture-triggers.sql','fixture-verify-pin.sql'])apply(resolve(fixtures,file));
 apply(resolve(repo,'supabase/migrations/20261012210000_coordinator_pin_vault.sql'));
}
apply(resolve(fixtures,'fixture-extension.sql'));
if(sql("select count(*) from pg_trigger where tgname='trg_validar_envio_avaliacao'")==='0')apply(resolve(fixtures,'fixture-locks.sql'));
apply(resolve(repo,'supabase/migrations/20261012230000_recalculate_coordinator_draft.sql'));
if(sql("select to_regclass('public.avaliacoes_especiais') is null")==='t')apply(resolve(repo,'supabase/migrations/20261013173138_special_evaluations_preparation.sql'));
else {
 // Reaplica somente as funções durante desenvolvimento, sem apagar tabelas/histórico.
 const source=readFileSync(resolve(repo,'supabase/migrations/20261013173138_special_evaluations_preparation.sql'),'utf8');
 sql(source.slice(source.indexOf('create or replace function public.rod27_special_command'),source.indexOf('create trigger rod27_special_reclassification')));
}
for(const name of ['rod27-admin','rod27-special','rod27-coordinator']){
 mkdirSync(resolve(cwd,'supabase/functions',name),{recursive:true});
 for(const file of ['index.ts','deno.json','deno.lock']){
  const from=name==='rod27-coordinator'?resolve(fixtures,'functions',name,file):resolve(repo,'supabase/functions',name,file),to=resolve(cwd,'supabase/functions',name,file);
  if(existsSync(from)&&(!existsSync(to)||!readFileSync(from).equals(readFileSync(to))))copyFileSync(from,to);
 }
}
console.log('PASS preparação local; nenhuma conexão de produção');
