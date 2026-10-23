# Rod27 - tres consultas reais ao Postgres, sem alterar dados ou usar token privilegiado.
$ErrorActionPreference="Stop"
$dir="C:\Users\secre\Documents\Rod27-Monitor"
$pagina="C:\Users\secre\Documents\Rod27-Fixes-20261017\frontend\primeiro-acesso.html"
$statePath=Join-Path $dir "status.json"
$panelPath=Join-Path $dir "monitor.html"
$history=Join-Path $dir "historico.csv"
$last=$null;$count=0;$errors=@()
if(Test-Path $statePath){
 try{$old=Get-Content -Raw $statePath|ConvertFrom-Json;$last=$old.ultima_atividade_confirmada_utc}catch{}
}
try{
 $content=Get-Content -Raw -LiteralPath $pagina
 $key=[regex]::Match($content,'sb_publishable_[A-Za-z0-9_-]+').Value
 if(-not $key){throw "Chave publicavel nao localizada no HTML local"}
 $headers=@{apikey=$key;Accept="application/json"}
 for($i=1;$i -le 3;$i++){
  try{
   $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 -Uri "https://zrjxxcytgtjuuinhkfux.supabase.co/rest/v1/rpc/rod27_heartbeat" -Headers $headers
   $res=@($r.Content|ConvertFrom-Json)[0]
   if([int]$r.StatusCode -eq 200 -and $res.ok -eq $true -and $res.checked_at){
    $last=([DateTimeOffset]::Parse([string]$res.checked_at)).ToUniversalTime().ToString("o")
    $count++
   }else{$errors+=("Consulta "+$i+": resposta nao confirmada")}
  }catch{$errors+=("Consulta "+$i+": "+$_.Exception.Message)}
  if($i -lt 3){Start-Sleep -Milliseconds 850}
 }
}catch{$errors+=("Configuracao: "+$_.Exception.Message)}
$at=[DateTimeOffset]::UtcNow.ToString("o")
$status=if($count -eq 3){"CONFIRMADO"}elseif($count -gt 0){"PARCIAL"}else{"FALHA"}
$deadline=$null
if($last){$deadline=([DateTimeOffset]::Parse($last)).AddDays(7).ToString("o")}
$s=[ordered]@{
 projeto="Rod27"; status=$status; ultima_verificacao_utc=$at;
 ultima_atividade_confirmada_utc=$last; janela_preventiva_ate_utc=$deadline;
 consultas_confirmadas=$count; consultas_tentadas=3; erro=($errors -join " | ");
 aviso="Estimativa de 7 dias, nao corresponde a data oficial de pausa."
}
$s|ConvertTo-Json -Depth 3|Set-Content -LiteralPath $statePath -Encoding UTF8
if(-not(Test-Path $history)){"horario_utc,status,consultas_ok"|Set-Content -LiteralPath $history -Encoding UTF8}
("{0},{1},{2}" -f $at,$status,$count)|Add-Content -LiteralPath $history -Encoding UTF8
$json=$s|ConvertTo-Json -Compress -Depth 3
$json=$json.Replace("<","\u003c").Replace(">","\u003e").Replace("&","\u0026")
$web=@'
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rod27 | Monitor do Supabase</title>
<style>body{background:#f4f6fa;color:#17223b;font:16px/1.5 system-ui,Segoe UI,sans-serif;padding:22px}main{max-width:720px;margin:auto}
article{background:white;border:1px solid #dde3ed;border-radius:18px;padding:22px;margin:14px 0}
.big{font-size:clamp(26px,5vw,47px);font-weight:800}.ok{color:#137752}.warn{color:#ad6d12}.bad{color:#ba3e4a}
small{color:#59677d}button{background:#17223b;color:white;border:0;border-radius:10px;padding:11px 15px;cursor:pointer}</style></head>
<body><main><small>SECRETARIA IEADERN</small><h1>Rod27 · Monitor de atividade</h1>
<article><b>Tempo restante na janela preventiva</b><div id="timer" class="big">Calculando...</div>
<small>Estimativa de sete dias desde a última consulta confirmada. NÃO é o horário oficial de pausa.</small></article>
<article><b>Última consulta ao banco confirmada</b><p id="last">-</p>
<b>Última execução</b><p id="checked">-</p>
<b>Resultado</b><p id="state">-</p><small id="error"></small></article>
<article><b>Execução automática</b><p>Diariamente às 11h e após o usuário entrar no Windows.</p>
<p><small>Se o Lenovo permanecer desligado, nenhuma consulta automática será feita. Abrir apenas o site no Cloudflare não conta como consulta ao banco.</small></p>
<button onclick="location.reload()">Atualizar painel</button></article>
</main><script>
const s=__STATE__;
function date(x){return x?new Date(x).toLocaleString("pt-BR"):"Nenhuma confirmação";}
document.getElementById("last").textContent=date(s.ultima_atividade_confirmada_utc);
document.getElementById("checked").textContent=date(s.ultima_verificacao_utc);
document.getElementById("state").textContent=s.status+" · "+s.consultas_confirmadas+"/"+s.consultas_tentadas+" consultas";
document.getElementById("error").textContent=s.erro||"Nenhum erro.";
function tick(){
 const el=document.getElementById("timer");
 if(!s.janela_preventiva_ate_utc){el.textContent="Sem estimativa";el.className="big bad";return;}
 const ms=new Date(s.janela_preventiva_ate_utc).getTime()-Date.now(),h=Math.floor(Math.max(0,ms)/3600000);
 el.textContent=ms<=0?"Janela preventiva vencida":Math.floor(h/24)+" dias, "+h%24+" h e "+Math.floor((Math.max(0,ms)%3600000)/60000)+" min";
 el.className="big "+(ms<172800000?"bad":ms<345600000?"warn":"ok");
}
tick();setInterval(tick,1000);setTimeout(()=>location.reload(),60000);
</script></body></html>
'@
$web=$web.Replace("__STATE__",$json)
$web|Set-Content -LiteralPath $panelPath -Encoding UTF8
Write-Output ("STATUS="+$status)
Write-Output ("CONSULTAS="+$count+"/3")
Write-Output ("ULTIMA_ATIVIDADE="+$last)
Write-Output ("PAINEL="+$panelPath)
if($count -eq 0){exit 2}