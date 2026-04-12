-- ============================================
-- Nex Digital — Supabase Schema
-- ============================================

-- 1. LEADS
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null,
  telefono text,
  tipo_necesidad text,
  objetivo_principal text,
  situacion_web text,
  urgencia text,
  presupuesto_orientativo text,
  plazo_lanzamiento text,
  mensaje text,
  lead_score integer default 0,
  lead_priority text default 'pendiente',
  lead_bucket text default 'sin-clasificar',
  source text default 'web_form',
  created_at timestamptz default now()
);

-- 2. POSTS (blog automatizado)
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text,
  description text,
  category text,
  category_id text,
  keywords text[] default '{}',
  content_html text,
  reading_time text,
  featured boolean default false,
  priority integer default 5,
  relevance_score integer default 0,
  utility_score integer default 0,
  evergreen_score integer default 0,
  audience_level text default 'fundamentos',
  intent text,
  content_type text,
  workflow_stage text default 'idea' check (workflow_stage in ('idea','draft','review','scheduled','published','refresh_pending')),
  draft_source text default 'gemini-auto',
  social_hook text,
  key_takeaways text[] default '{}',
  social_formats text[] default '{}',
  repurpose_priority text default 'media',
  related text[] default '{}',
  published boolean default false,
  published_at timestamptz,
  last_reviewed date,
  next_review_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. KEYWORD RESEARCH (planificación SEO)
create table public.keyword_research (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  search_volume integer,
  difficulty integer,
  intent text,
  cluster text,
  assigned_post_id uuid references public.posts(id) on delete set null,
  status text default 'pending' check (status in ('pending','assigned','published')),
  created_at timestamptz default now()
);

-- 4. PUBLISH LOG (historial de publicaciones)
create table public.publish_log (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  action text not null,
  details jsonb default '{}',
  created_at timestamptz default now()
);

-- ============================================
-- INDEXES
-- ============================================
create index idx_posts_slug on public.posts(slug);
create index idx_posts_stage on public.posts(workflow_stage);
create index idx_posts_published on public.posts(published);
create index idx_posts_category on public.posts(category_id);
create index idx_keywords_status on public.keyword_research(status);
create index idx_leads_created on public.leads(created_at desc);

-- ============================================
-- AUTO-UPDATE updated_at
-- ============================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Leads: solo insert desde anon (el worker), lectura solo autenticado
alter table public.leads enable row level security;

create policy "leads_insert_anon"
  on public.leads for insert
  to anon
  with check (true);

create policy "leads_read_auth"
  on public.leads for select
  to authenticated
  using (true);

-- Posts: lectura pública de publicados, escritura solo autenticado
alter table public.posts enable row level security;

create policy "posts_read_published"
  on public.posts for select
  to anon
  using (published = true);

create policy "posts_full_auth"
  on public.posts for all
  to authenticated
  using (true)
  with check (true);

-- Posts: permitir insert desde service_role (n8n)
create policy "posts_insert_service"
  on public.posts for insert
  to service_role
  with check (true);

create policy "posts_update_service"
  on public.posts for update
  to service_role
  using (true);

-- Keywords: lectura pública, escritura autenticado
alter table public.keyword_research enable row level security;

create policy "keywords_read_anon"
  on public.keyword_research for select
  to anon
  using (true);

create policy "keywords_full_auth"
  on public.keyword_research for all
  to authenticated
  using (true)
  with check (true);

-- Publish log: solo autenticado
alter table public.publish_log enable row level security;

create policy "log_full_auth"
  on public.publish_log for all
  to authenticated
  using (true)
  with check (true);

create policy "log_insert_service"
  on public.publish_log for insert
  to service_role
  with check (true);

-- ============================================
-- SEED: migrar posts existentes
-- ============================================
insert into public.posts (slug, title, excerpt, description, category, category_id, keywords, reading_time, featured, priority, relevance_score, utility_score, evergreen_score, audience_level, intent, content_type, workflow_stage, draft_source, social_hook, key_takeaways, social_formats, repurpose_priority, related, published, published_at, last_reviewed, next_review_date) values
('cuando-una-landing-basta',
 'Cuando una landing basta (y cuando ya necesitas una web completa)',
 'Marco practico para decidir si empezar por una landing o pasar a una web completa segun el objetivo comercial y el tipo de servicio.',
 'Guia para decidir entre landing y web completa segun complejidad comercial, madurez del negocio y capacidad de seguimiento.',
 'Webs y captacion', 'webs-y-captacion',
 array['landing','web comercial','captacion','conversion','estructura digital'],
 '10 min', true, 10, 94, 92, 90, 'fundamentos', 'decision', 'guia', 'published', 'manual_v1',
 'No siempre necesitas una web completa para empezar a captar mejor.',
 array['La eleccion depende del proceso de compra, no del tamano de la web.','Una landing funciona bien cuando hay un objetivo unico y mensaje claro.','La web completa conviene cuando necesitas educar y generar confianza.'],
 array['carousel_instagram','video_tiktok','post_linkedin'],
 'alta', array['errores-en-una-web-que-no-genera-contactos','chatbot-formulario-o-whatsapp'],
 true, '2026-04-04'::timestamptz, '2026-04-12', '2026-05-12'),

('automatizaciones-pequenas-que-ahorran-tiempo',
 'Automatizaciones pequenas que ahorran tiempo sin complicar tu negocio',
 'Cuatro automatizaciones realistas para ordenar el seguimiento comercial y reducir tareas repetitivas sin sobreingenieria.',
 'Ejemplos practicos de automatizacion util para captacion y seguimiento comercial con enfoque incremental.',
 'Automatizacion util', 'automatizacion-util',
 array['automatizacion','leads','seguimiento','priorizacion','eficiencia operativa'],
 '11 min', false, 8, 89, 93, 88, 'intermedio', 'optimizacion', 'guia', 'published', 'manual_v1',
 'Automatizar bien es quitar friccion, no meter complejidad.',
 array['Empieza por automatizaciones pequenas y medibles.','Ordenar el canal principal suele dar mas impacto que ampliar herramientas.','No conviene automatizar fases que aun requieren criterio comercial.'],
 array['carousel_instagram','video_tiktok'],
 'alta', array['chatbot-formulario-o-whatsapp','cuando-una-landing-basta'],
 true, '2026-04-07'::timestamptz, '2026-04-12', '2026-05-12'),

('errores-en-una-web-que-no-genera-contactos',
 '8 errores en una web que no genera contactos (y como corregirlos)',
 'Checklist editorial para detectar bloqueos de conversion en propuesta de valor, estructura, formularios y confianza.',
 'Errores comunes en webs de negocio que frenan solicitudes y como corregirlos con cambios concretos.',
 'Atencion al cliente y leads', 'atencion-al-cliente-y-leads',
 array['leads','formulario','conversion','propuesta de valor','web de negocio'],
 '12 min', false, 9, 91, 95, 93, 'fundamentos', 'diagnostico', 'checklist', 'published', 'manual_v1',
 'Tu web puede verse bien y aun asi perder contactos cada semana.',
 array['El problema suele estar en estructura y mensaje, no solo en trafico.','Un CTA principal claro mejora la conversion de forma inmediata.','Pequenos ajustes por fases pueden desbloquear resultados sin rehacer todo.'],
 array['carousel_instagram','video_tiktok','email_snippet'],
 'alta', array['cuando-una-landing-basta','automatizaciones-pequenas-que-ahorran-tiempo'],
 true, '2026-04-09'::timestamptz, '2026-04-12', '2026-05-12'),

('chatbot-formulario-o-whatsapp',
 'Chatbot, formulario o WhatsApp: que canal conviene segun tu tipo de negocio',
 'Comparativa practica para elegir canal principal de contacto sin perder calidad de lead ni orden operativo.',
 'Como decidir entre chatbot, formulario o mensajeria segun complejidad del servicio y proceso comercial.',
 'Comparativas y decisiones', 'comparativas-y-decisiones',
 array['chatbot','formulario','canales de contacto','captacion','respuesta comercial'],
 '9 min', false, 7, 86, 88, 86, 'fundamentos', 'decision', 'comparativa', 'published', 'manual_v1',
 'El mejor canal no es el mas moderno: es el que encaja con tu operativa.',
 array['Formulario para cualificar; chat para orientar; mensajeria como apoyo controlado.','Definir un canal principal evita dispersion y mejora trazabilidad.','La eleccion debe responder al proceso de venta, no a la moda de herramientas.'],
 array['video_tiktok','carousel_instagram'],
 'media', array['errores-en-una-web-que-no-genera-contactos','automatizaciones-pequenas-que-ahorran-tiempo'],
 true, '2026-04-11'::timestamptz, '2026-04-12', '2026-05-12'),

('de-blog-a-instagram-y-tiktok-sin-perder-calidad',
 'De un articulo del blog a Instagram y TikTok sin perder calidad',
 'Metodo para convertir una pieza larga en contenido social util sin perder el enfoque comercial.',
 'Guia para reaprovechar articulos del blog en redes sociales con criterio editorial y continuidad.',
 'Redes sociales para negocio', 'redes-sociales',
 array['instagram','tiktok','reaprovechar contenido','blog','contenido social'],
 '9 min', false, 8, 90, 91, 89, 'fundamentos', 'implementacion', 'guia', 'published', 'manual_v1',
 'No necesitas inventar contenido diario si ya tienes base editorial.',
 array['Un articulo largo puede convertirse en varias piezas cortas con sentido.','El formato cambia por red, pero el criterio editorial se mantiene.','La clave es traducir contenido, no simplificarlo en exceso.'],
 array['carousel_instagram','video_tiktok','story_script'],
 'alta', array['plan-editorial-realista-para-instagram-y-tiktok','chatbot-formulario-o-whatsapp'],
 true, '2026-04-12'::timestamptz, '2026-04-12', '2026-05-12'),

('plan-editorial-realista-para-instagram-y-tiktok',
 'Plan editorial realista para Instagram y TikTok en negocios B2B',
 'Estructura de publicacion sostenible para redes sociales sin publicar por publicar.',
 'Como crear un plan editorial simple y mantenible para Instagram y TikTok con enfoque comercial.',
 'Redes sociales para negocio', 'redes-sociales',
 array['plan editorial','instagram','tiktok','contenido b2b','calendario de contenidos'],
 '10 min', false, 8, 88, 90, 87, 'fundamentos', 'planificacion', 'guia', 'published', 'manual_v1',
 'Un plan realista vale mas que una frecuencia imposible de sostener.',
 array['La continuidad editorial importa mas que la cantidad puntual.','Conviene trabajar por bloques semanales con objetivos claros.','Conectar blog y redes reduce friccion y mejora coherencia.'],
 array['carousel_instagram','video_tiktok','caption_pack'],
 'alta', array['de-blog-a-instagram-y-tiktok-sin-perder-calidad','automatizaciones-pequenas-que-ahorran-tiempo'],
 true, '2026-04-12'::timestamptz, '2026-04-12', '2026-05-12');
