-- Run inside BEGIN/ROLLBACK. Only synthetic email/token hashes, no sends or password changes.
DO $$
DECLARE sg uuid; fixture uuid; denied boolean; v_bucket text:=repeat('c',64);
BEGIN
 SELECT user_id INTO STRICT sg FROM public.usuarios_admin WHERE papel='secretario_geral' AND ativo;
 INSERT INTO public.rod27_recovery_emails(user_id,email) VALUES(sg,'rod27-proof-test@example.invalid') RETURNING id INTO fixture;
 IF EXISTS(SELECT 1 FROM public.rod27_recovery_lookup('rod27-proof-test@example.invalid')) THEN RAISE EXCEPTION 'Unverified email can recover'; END IF;
 PERFORM public.rod27_issue_recovery_confirmation(sg,fixture,repeat('a',64));
 IF public.rod27_confirm_recovery_email(repeat('a',64)) THEN RAISE EXCEPTION 'Unsent verification accepted'; END IF;
 denied:=false;
 BEGIN PERFORM public.rod27_issue_recovery_confirmation(sg,fixture,repeat('b',64)); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Confirmation send throttle missing'; END IF;
 UPDATE public.rod27_recovery_challenges SET send_accepted_at=now() WHERE recovery_email_id=fixture;
 IF NOT public.rod27_confirm_recovery_email(repeat('a',64)) THEN RAISE EXCEPTION 'Valid verification rejected'; END IF;
 IF public.rod27_confirm_recovery_email(repeat('a',64)) THEN RAISE EXCEPTION 'Verification reusable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.rod27_recovery_lookup('rod27-proof-test@example.invalid') WHERE user_id=sg) THEN RAISE EXCEPTION 'Verified alias cannot recover'; END IF;
 UPDATE public.rod27_recovery_emails SET verified_at=NULL WHERE id=fixture;
 INSERT INTO public.rod27_recovery_challenges(token_hash,recovery_email_id,created_at,expires_at,send_accepted_at)
 VALUES(repeat('b',64),fixture,now()-interval '20 minutes',now()-interval '5 minutes',now()-interval '20 minutes');
 IF public.rod27_confirm_recovery_email(repeat('b',64)) THEN RAISE EXCEPTION 'Expired verification accepted'; END IF;
 DELETE FROM public.rod27_recovery_emails WHERE id=fixture;
 IF EXISTS(SELECT 1 FROM public.rod27_recovery_challenges WHERE recovery_email_id=fixture)
 OR EXISTS(SELECT 1 FROM public.rod27_recovery_lookup('rod27-proof-test@example.invalid')) THEN RAISE EXCEPTION 'Removed alias remains usable'; END IF;
 IF NOT public.rod27_recovery_consume_rate(v_bucket) OR public.rod27_recovery_consume_rate(v_bucket) THEN RAISE EXCEPTION 'Initial rate test failed'; END IF;
 UPDATE public.rod27_recovery_rate SET last_at=now()-interval '61 seconds' WHERE rod27_recovery_rate.bucket=v_bucket;
 IF NOT public.rod27_recovery_consume_rate(v_bucket) THEN RAISE EXCEPTION 'Second request rejected'; END IF;
 UPDATE public.rod27_recovery_rate SET last_at=now()-interval '61 seconds' WHERE rod27_recovery_rate.bucket=v_bucket;
 IF NOT public.rod27_recovery_consume_rate(v_bucket) THEN RAISE EXCEPTION 'Third request rejected'; END IF;
 UPDATE public.rod27_recovery_rate SET last_at=now()-interval '61 seconds' WHERE rod27_recovery_rate.bucket=v_bucket;
 IF public.rod27_recovery_consume_rate(v_bucket) THEN RAISE EXCEPTION 'Hourly rate missing'; END IF;
 UPDATE public.rod27_recovery_rate SET started_at=now()-interval '2 hours' WHERE rod27_recovery_rate.bucket=v_bucket;
 IF NOT public.rod27_recovery_consume_rate(v_bucket) THEN RAISE EXCEPTION 'Hourly reset failed'; END IF;
 IF has_function_privilege('anon','public.rod27_confirm_recovery_email(text)','execute')
 OR has_function_privilege('authenticated','public.rod27_recovery_lookup(text)','execute') THEN RAISE EXCEPTION 'Unsafe function grants'; END IF;
END $$;
SELECT 'PASS verification proof, one-use, expiration, removal, lookup, rate limiting and service-only grants; no real email sent' result;
