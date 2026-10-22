-- TAVIKU: prueba de roles con identidades sintéticas, solo para STAGING.
-- Todo se realiza dentro de una transacción que se revierte. NO ejecutar en producción.
BEGIN;
INSERT INTO auth.users (id,aud,role,email,created_at,updated_at) VALUES
('00000000-0000-4000-8000-000000000021','authenticated','authenticated','taviku-buyer@example.invalid',now(),now()),
('00000000-0000-4000-8000-000000000022','authenticated','authenticated','taviku-admin@example.invalid',now(),now()),
('00000000-0000-4000-8000-000000000023','authenticated','authenticated','taviku-seller@example.invalid',now(),now());
UPDATE public.perfiles SET rol='admin' WHERE id='00000000-0000-4000-8000-000000000022';
UPDATE public.perfiles SET rol='vendedor' WHERE id='00000000-0000-4000-8000-000000000023';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000021',true);
DO $test$ BEGIN
 IF public.es_admin() OR public.es_vendedor() THEN RAISE EXCEPTION 'Buyer role incorrectly elevated'; END IF;
 IF (SELECT count(*) FROM public.perfiles)<>2 THEN RAISE EXCEPTION 'Buyer RLS leaked other profiles'; END IF;
 BEGIN
  PERFORM public.tembora_admin_cambiar_rol('00000000-0000-4000-8000-000000000023'::uuid,'admin');
  RAISE EXCEPTION 'Buyer changed seller role';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $test$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000022',true);
DO $test$ BEGIN
 IF NOT public.es_admin() OR (SELECT count(*) FROM public.perfiles WHERE id IN ('00000000-0000-4000-8000-000000000021'::uuid,'00000000-0000-4000-8000-000000000022'::uuid,'00000000-0000-4000-8000-000000000023'::uuid))<>3
 THEN RAISE EXCEPTION 'Admin RLS denied authorized access'; END IF;
END $test$;
ROLLBACK;
