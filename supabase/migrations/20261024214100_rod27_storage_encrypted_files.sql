-- Bucket privado de documentos aceita somente tipos originais anteriores
-- e ciphertext opaco .r27. AES-GCM inclui 7 bytes de cabecalho, nonce e tag.
do $$
begin
 if not exists(select 1 from storage.buckets
    where id='rod27-documentos' and public=false
      and allowed_mime_types @> array['application/pdf','image/jpeg','image/png']::text[])
 then raise exception 'Bucket rod27-documentos fora da configuracao esperada';end if;
end $$;
update storage.buckets
set allowed_mime_types=array['application/pdf','image/jpeg','image/png','application/octet-stream']::text[],
    file_size_limit=greatest(coalesce(file_size_limit,8388608),8388672),
    updated_at=now()
where id='rod27-documentos' and public=false;
