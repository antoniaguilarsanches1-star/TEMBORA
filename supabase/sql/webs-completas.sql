-- Galería exclusiva de TAVIKU. No modifica tablas ni políticas del marketplace.
begin;
create table public.webs_completas (
    id uuid primary key default gen_random_uuid(),
    nombre text not null check (length(trim(nombre)) between 1 and 160),
    tipo_negocio text not null check (tipo_negocio in ('Barbería','Restaurante','Tienda','Hospedaje','Consultorio','Otro negocio')),
    descripcion text not null check (length(trim(descripcion)) between 1 and 1200),
    funciones text[] not null default '{}' check (cardinality(funciones) <= 30),
    portada text check (portada ~ '^[a-f0-9-]+[.](jpg|png|webp)$'),
    descripcion_panel text not null default '' check (length(descripcion_panel) <= 1600),
    imagenes_admin text[] not null default '{}' check (cardinality(imagenes_admin) <= 6),
    demo_url text not null default '' check (demo_url = '' or demo_url ~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?
    estado text not null default 'borrador' check (estado in ('borrador','publicada','oculta')),
    posicion integer not null default 0 check (posicion >= 0),
    created_at timestamptz not null default now(),
    constraint publicacion_completa check (estado <> 'publicada' or (portada is not null and demo_url <> '' and cardinality(funciones) > 0))
);
create index webs_completas_publicadas_orden on public.webs_completas(estado,posicion,nombre);
alter table public.webs_completas enable row level security;
revoke all on public.webs_completas from anon, authenticated;
grant select on public.webs_completas to anon, authenticated;
grant insert, update on public.webs_completas to authenticated;
create policy webs_publicadas on public.webs_completas for select to anon, authenticated using (estado = 'publicada');
create policy webs_admin_lectura on public.webs_completas for select to authenticated using ((select public.es_admin()));
create policy webs_admin_crear on public.webs_completas for insert to authenticated with check ((select public.es_admin()));
create policy webs_admin_editar on public.webs_completas for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('webs-completas','webs-completas',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy webs_portadas_lectura on storage.objects for select to anon, authenticated
using (
    bucket_id = 'webs-completas'
    and exists (
        select 1 from public.webs_completas w
        where w.estado = 'publicada'
          and (w.portada = name or name = any(w.imagenes_admin))
    )
);
create policy webs_portadas_admin_lectura on storage.objects for select to authenticated
using (bucket_id = 'webs-completas' and (select public.es_admin()));
create policy webs_portadas_crear on storage.objects for insert to authenticated
with check (bucket_id = 'webs-completas' and (select public.es_admin()) and name ~ '^[a-f0-9-]+[.](jpg|png|webp)$');
create policy webs_portadas_eliminar on storage.objects for delete to authenticated
using (bucket_id = 'webs-completas' and (select public.es_admin()));
commit;
),
    estado text not null default 'borrador' check (estado in ('borrador','publicada','oculta')),
    posicion integer not null default 0 check (posicion >= 0),
    created_at timestamptz not null default now(),
    constraint publicacion_completa check (estado <> 'publicada' or (portada is not null and demo_url <> '' and cardinality(funciones) > 0))
);
create index webs_completas_publicadas_orden on public.webs_completas(estado,posicion,nombre);
alter table public.webs_completas enable row level security;
revoke all on public.webs_completas from anon, authenticated;
grant select on public.webs_completas to anon, authenticated;
grant insert, update on public.webs_completas to authenticated;
create policy webs_publicadas on public.webs_completas for select to anon, authenticated using (estado = 'publicada');
create policy webs_admin_lectura on public.webs_completas for select to authenticated using ((select public.es_admin()));
create policy webs_admin_crear on public.webs_completas for insert to authenticated with check ((select public.es_admin()));
create policy webs_admin_editar on public.webs_completas for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('webs-completas','webs-completas',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy webs_portadas_lectura on storage.objects for select to anon, authenticated
using (bucket_id = 'webs-completas' and exists (select 1 from public.webs_completas w where w.portada = name));
create policy webs_portadas_admin_lectura on storage.objects for select to authenticated
using (bucket_id = 'webs-completas' and (select public.es_admin()));
create policy webs_portadas_crear on storage.objects for insert to authenticated
with check (bucket_id = 'webs-completas' and (select public.es_admin()) and name ~ '^[a-f0-9-]+[.](jpg|png|webp)$');
create policy webs_portadas_eliminar on storage.objects for delete to authenticated
using (bucket_id = 'webs-completas' and (select public.es_admin()));
commit;
