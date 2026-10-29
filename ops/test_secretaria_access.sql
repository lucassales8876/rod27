-- Run inside a transaction and roll back; never reset passwords/PINs.
DO $$
DECLARE sg uuid; top_admin uuid; ordinary uuid; g jsonb; rev integer; denied boolean;
BEGIN
 SELECT user_id INTO STRICT sg FROM public.usuarios_admin WHERE papel='secretario_geral' AND ativo;
 SELECT user_id INTO STRICT top_admin FROM public.usuarios_admin WHERE papel='superadmin1' AND ativo;
 SELECT user_id INTO STRICT ordinary FROM public.usuarios_admin WHERE papel='superadmin' AND ativo;
 IF NOT public.rod27_secretaria_can_access(sg) OR NOT public.rod27_secretaria_can_access(top_admin)
  OR public.rod27_secretaria_can_access(ordinary) THEN RAISE EXCEPTION 'Initial access failed'; END IF;
 SELECT revision INTO rev FROM public.rod27_secretaria_access_policy WHERE id=1;
 g:=jsonb_build_array(top_admin);
 PERFORM public.rod27_set_secretaria_access(sg,false,false,g,rev);
 IF public.rod27_secretaria_can_access(top_admin) OR public.rod27_secretaria_can_access(ordinary)
  OR NOT public.rod27_secretaria_can_access(sg) THEN RAISE EXCEPTION 'Master switch failed'; END IF;
 denied:=false;
 BEGIN PERFORM public.rod27_set_secretaria_access(top_admin,true,true,'[]',rev+1);
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'superadmin1 can change access'; END IF;
 PERFORM public.rod27_set_secretaria_access(sg,true,true,'[]',rev+1);
 IF NOT public.rod27_secretaria_can_access(ordinary) THEN RAISE EXCEPTION 'Allow all failed'; END IF;
 PERFORM public.rod27_set_secretaria_access(sg,true,false,jsonb_build_array(ordinary),rev+2);
 IF public.rod27_secretaria_can_access(top_admin) OR NOT public.rod27_secretaria_can_access(ordinary)
 THEN RAISE EXCEPTION 'Individual grants failed'; END IF;
 UPDATE public.usuarios_admin SET ativo=false WHERE user_id=ordinary;
 IF public.rod27_secretaria_can_access(ordinary) THEN RAISE EXCEPTION 'Inactive account bypass'; END IF;
 UPDATE public.usuarios_admin SET ativo=true WHERE user_id=ordinary;
 denied:=false;
 BEGIN PERFORM public.rod27_set_secretaria_access(sg,false,false,jsonb_build_array(sg),rev+3);
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Self grant must be rejected'; END IF;
 PERFORM public.rod27_set_secretaria_access(sg,false,false,'[]',rev+3);
 IF NOT public.rod27_secretaria_can_access(sg) THEN RAISE EXCEPTION 'Secretary locked out'; END IF;
 IF has_function_privilege('service_role','public.rod27_get_coordinator_pin(uuid,uuid)','execute')
  OR has_function_privilege('authenticated','public.rod27_set_secretaria_access(uuid,boolean,boolean,jsonb,integer)','execute')
  OR has_function_privilege('anon','public.rod27_secretaria_can_access(uuid)','execute')
 THEN RAISE EXCEPTION 'RPC grants unsafe'; END IF;
 denied:=false;
 BEGIN PERFORM * FROM public.rod27_get_coordinator_pin(NULL,top_admin);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Old PIN API not retired'; END IF;
END $$;
SELECT 'PASS: live DB roles, master switch, all, individual grants, inactive, self-protection, RPC grants and old PIN denial (rolled back)' result;
