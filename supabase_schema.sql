-- ============================================================
-- SUPABASE SCHEMA - Plan Hebdomadaire 2026 Filles
-- ============================================================
-- Exécuter ce script dans l'éditeur SQL de Supabase
-- via l'onglet "SQL Editor" dans le dashboard Supabase
-- ============================================================

-- Extension pour gérer les UUID si besoin
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLE: plans
-- Stocke les données du plan hebdomadaire (tableau principal)
-- Chaque ligne = une semaine avec un tableau JSON de lignes
-- ============================================================
create table if not exists plans (
  id            bigint generated always as identity primary key,
  week          integer not null unique,
  data          jsonb   not null default '[]',
  class_notes   jsonb   not null default '{}',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_plans_week on plans(week);

-- ============================================================
-- TABLE: lesson_plans
-- Stocke les plans de leçon IA générés (fichiers DOCX en base64)
-- ============================================================
create table if not exists lesson_plans (
  id            text primary key,          -- ex: "1_Enseignant_Classe_Matiere_Periode_Jour"
  week          integer not null,
  enseignant    text,
  classe        text,
  matiere       text,
  periode       text,
  jour          text,
  filename      text,
  file_buffer   text,                      -- DOCX encodé en base64
  row_data      jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_lesson_plans_week on lesson_plans(week);

-- ============================================================
-- TABLE: weekly_lesson_plans
-- Stocke les plans Word générés par classe (plan hebdomadaire)
-- ============================================================
create table if not exists weekly_lesson_plans (
  id            text primary key,          -- ex: "S1_Classe_A"
  week          integer not null,
  classe        text not null,
  filename      text,
  file_data     text,                      -- DOCX encodé en base64
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_weekly_lesson_plans_week on weekly_lesson_plans(week);

-- ============================================================
-- TABLE: push_subscriptions
-- Stocke les abonnements aux notifications push (web-push)
-- ============================================================
create table if not exists push_subscriptions (
  id            bigint generated always as identity primary key,
  username      text not null unique,
  subscription  jsonb not null,            -- objet PushSubscription du navigateur
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_push_subscriptions_username on push_subscriptions(username);

-- ============================================================
-- TABLE: subscriptions  (ancienne table MongoDB "subscriptions")
-- Stocke les abonnements par endpoint (pour /api/subscribe)
-- ============================================================
create table if not exists subscriptions (
  id            text primary key,          -- = endpoint de l'abonnement
  subscription  jsonb not null,
  username      text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_subscriptions_username on subscriptions(username);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- IMPORTANT: Désactiver RLS sur toutes les tables car le backend
-- utilise uniquement la clé SERVICE_ROLE côté serveur.
-- Cela est sécurisé : les tables ne sont jamais exposées au public.
-- ============================================================
alter table plans               disable row level security;
alter table lesson_plans        disable row level security;
alter table weekly_lesson_plans disable row level security;
alter table push_subscriptions  disable row level security;
alter table subscriptions       disable row level security;

-- ============================================================
-- Si vous préférez garder RLS activé, exécutez ces policies
-- pour autoriser toutes les opérations via service_role :
-- ============================================================
-- alter table plans               enable row level security;
-- alter table lesson_plans        enable row level security;
-- alter table weekly_lesson_plans enable row level security;
-- alter table push_subscriptions  enable row level security;
-- alter table subscriptions       enable row level security;
--
-- create policy "service_role full access plans"
--   on plans for all to service_role using (true) with check (true);
-- create policy "service_role full access lesson_plans"
--   on lesson_plans for all to service_role using (true) with check (true);
-- create policy "service_role full access weekly_lesson_plans"
--   on weekly_lesson_plans for all to service_role using (true) with check (true);
-- create policy "service_role full access push_subscriptions"
--   on push_subscriptions for all to service_role using (true) with check (true);
-- create policy "service_role full access subscriptions"
--   on subscriptions for all to service_role using (true) with check (true);
