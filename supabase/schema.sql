-- ============================================================
-- Sartu · Kundenportal — Datenbank-Schema (Stufe 1)
-- Im Supabase SQL-Editor ausführen (Projekt-Region: Frankfurt/eu-central-1).
-- Sicherheit kommt aus Row Level Security (RLS) + Spalten-Grants,
-- NICHT aus Frontend-Logik. Frontend nutzt ausschließlich den anon key.
-- ============================================================

-- gen_random_uuid()
create extension if not exists pgcrypto;

-- ============================================================
-- 1) TABELLEN
-- ============================================================

create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid unique references auth.users(id) on delete cascade,
  email       text,
  name        text,
  firma       text,
  telefon     text,
  role        text not null default 'customer' check (role in ('customer','admin'))
);
comment on table public.profiles is 'Kundenstammdaten; user_id wird beim ersten Login per Trigger über die E-Mail verknüpft.';

create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  customer_id  uuid references public.profiles(id) on delete cascade,
  titel        text,
  paket        text,
  care_stufe   text,
  phase        text not null default 'angebot_bestaetigt'
               check (phase in ('angebot_bestaetigt','inhalte_liefern','design_laeuft',
                                'korrektur_1','korrektur_2','korrektur_3','korrektur_4',
                                'finalisierung','live')),
  notiz_kunde  text,   -- für den Kunden sichtbar
  notiz_intern text,   -- NUR Admin (über Spalten-Grant + admin_projects() geschützt)
  liefertermin date
);

create table if not exists public.briefings (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  payload       jsonb,  -- komplettes Lumi-collect()-Objekt
  status        text not null default 'neu' check (status in ('neu','in_bearbeitung','umgewandelt','abgelehnt')),
  kontakt_email text,
  kontakt_name  text
);

-- Stufe 2 (nur Schema)
create table if not exists public.uploads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  project_id      uuid references public.projects(id) on delete cascade,
  typ             text,
  storage_path    text,
  original_name   text,
  hochgeladen_von uuid
);

create table if not exists public.feedback_rounds (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  project_id    uuid references public.projects(id) on delete cascade,
  runde         int,
  inhalt        text,
  eingereicht_am timestamptz
);

-- Stufe 3 (nur Schema)
create table if not exists public.care_entries (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  customer_id  uuid references public.profiles(id) on delete cascade,
  datum        date,
  beschreibung text,
  minuten      int
);

create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  customer_id  uuid references public.profiles(id) on delete cascade,
  project_id   uuid references public.projects(id) on delete cascade,
  typ          text,
  storage_path text,
  titel        text
);

-- ============================================================
-- 2) HILFSFUNKTIONEN (security definer)
-- ============================================================

-- Prüft, ob der eingeloggte Nutzer Admin ist. security definer + festes search_path,
-- damit die Funktion die profiles-Zeile unabhängig von RLS lesen kann.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- Liefert die profiles.id des eingeloggten Nutzers (für die Besitz-Prüfungen).
create or replace function public.my_profile_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.profiles where user_id = auth.uid();
$$;

-- ============================================================
-- 3) RLS AKTIVIEREN
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.projects        enable row level security;
alter table public.briefings       enable row level security;
alter table public.uploads         enable row level security;
alter table public.feedback_rounds enable row level security;
alter table public.care_entries    enable row level security;
alter table public.documents       enable row level security;

-- ============================================================
-- 4) POLICIES
-- (Jede Policy schützt genau das im Kommentar Beschriebene.)
-- ============================================================

-- ---- profiles ----
-- Schützt: Jeder sieht nur die eigene Profilzeile; Admins sehen alle.
create policy profiles_select on public.profiles
  for select using (user_id = auth.uid() or public.is_admin());
-- Schützt: Kunde darf seine eigene Zeile ändern (Spalten via Grant auf name/firma/telefon begrenzt),
--          Admin darf alle Zeilen ändern.
create policy profiles_update on public.profiles
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
-- Schützt: Neue Profile (z. B. „In Projekt umwandeln") und Löschen nur durch Admin.
create policy profiles_insert on public.profiles
  for insert with check (public.is_admin());
create policy profiles_delete on public.profiles
  for delete using (public.is_admin());

-- ---- projects ----
-- Schützt: Kunde sieht nur Projekte, die zu seiner Profilzeile gehören; Admin alle.
-- (notiz_intern wird zusätzlich per Spalten-Grant unten entzogen.)
create policy projects_select on public.projects
  for select using (customer_id = public.my_profile_id() or public.is_admin());
-- Schützt: Projekte anlegen/ändern/löschen ausschließlich Admin.
create policy projects_insert on public.projects
  for insert with check (public.is_admin());
create policy projects_update on public.projects
  for update using (public.is_admin()) with check (public.is_admin());
create policy projects_delete on public.projects
  for delete using (public.is_admin());

-- ---- briefings ----
-- Schützt: ÖFFENTLICHER Lumi-Eingang — anon UND authenticated dürfen INSERTen …
create policy briefings_insert on public.briefings
  for insert to anon, authenticated with check (true);
-- … aber NUR Admins dürfen Anfragen lesen/ändern/löschen (kein Fremd-Lesen!).
create policy briefings_select on public.briefings
  for select using (public.is_admin());
create policy briefings_update on public.briefings
  for update using (public.is_admin()) with check (public.is_admin());
create policy briefings_delete on public.briefings
  for delete using (public.is_admin());

-- ---- uploads (Stufe 2) ----
-- Schützt: Kunde sieht Uploads nur seiner eigenen Projekte; Admin alle.
create policy uploads_select on public.uploads
  for select using (
    public.is_admin() or
    project_id in (select id from public.projects where customer_id = public.my_profile_id())
  );
-- Schützt: Schreiben vorerst nur Admin (Stufe 2 erweitert dies um Kunden-Uploads).
create policy uploads_write on public.uploads
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- feedback_rounds (Stufe 2) ----
-- Schützt: Kunde sieht Korrekturrunden nur seiner Projekte; Admin alle.
create policy feedback_select on public.feedback_rounds
  for select using (
    public.is_admin() or
    project_id in (select id from public.projects where customer_id = public.my_profile_id())
  );
-- Schützt: Schreiben vorerst nur Admin.
create policy feedback_write on public.feedback_rounds
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- care_entries (Stufe 3) ----
-- Schützt: Kunde sieht nur seine eigenen Care-Einträge; Admin alle.
create policy care_select on public.care_entries
  for select using (customer_id = public.my_profile_id() or public.is_admin());
-- Schützt: Schreiben vorerst nur Admin.
create policy care_write on public.care_entries
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- documents (Stufe 3) ----
-- Schützt: Kunde sieht nur seine eigenen Dokumente; Admin alle.
create policy documents_select on public.documents
  for select using (customer_id = public.my_profile_id() or public.is_admin());
-- Schützt: Schreiben vorerst nur Admin.
create policy documents_write on public.documents
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 5) GRANTS — Rollen anon / authenticated
--    RLS filtert ZEILEN, Grants filtern SPALTEN/Operationen. Beides wirkt zusammen.
-- ============================================================
grant usage on schema public to anon, authenticated;

-- Standard: authenticated darf lesen/schreiben (RLS gated), anon nur sehr begrenzt.
grant select, insert, update, delete on
  public.uploads, public.feedback_rounds,
  public.care_entries, public.documents
  to authenticated;

-- profiles: WICHTIG — UPDATE spaltenweise begrenzen, sonst könnte ein Kunde
-- seine eigene Zeile auf role='admin' setzen (Rechteausweitung!). Über die API
-- sind nur name/firma/telefon änderbar; role/email/user_id ändert man per SQL.
grant select, insert, delete on public.profiles to authenticated;
grant update (name, firma, telefon) on public.profiles to authenticated;

-- briefings: anon + authenticated dürfen INSERT (Lumi). Kein SELECT für anon!
grant insert on public.briefings to anon, authenticated;
grant select, update, delete on public.briefings to authenticated; -- SELECT/UPDATE/DELETE per RLS nur Admin

-- projects: SPALTEN-SCHUTZ für notiz_intern.
-- Wir entziehen authenticated das pauschale SELECT und geben es spaltenweise OHNE notiz_intern zurück.
-- → Eine direkte REST-Abfrage `projects?select=notiz_intern` schlägt für JEDEN
--   authenticated-Nutzer fehl (auch Admin); Admin liest die Spalte ausschließlich
--   über die security-definer-Funktion admin_projects() (siehe unten).
grant insert, update, delete on public.projects to authenticated; -- Schreiben per RLS nur Admin
revoke select on public.projects from authenticated, anon;
grant select (id, created_at, customer_id, titel, paket, care_stufe, phase, notiz_kunde, liefertermin)
  on public.projects to authenticated;

-- Funktions-Ausführung
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.my_profile_id() to anon, authenticated;

-- ============================================================
-- 6) KUNDEN-VIEW & ADMIN-FUNKTION (notiz_intern-Trennung)
-- GEWÄHLTE LÖSUNG: Spalten-Grant (oben) ist die HARTE Absicherung von notiz_intern.
-- Die View ist bequemer Lese-Pfad fürs Kundenportal; admin_projects() der Voll-Lesepfad.
-- ============================================================

-- Kunden-Frontend liest hierüber: security_invoker => RLS des Aufrufers greift,
-- die View enthält notiz_intern gar nicht erst.
create or replace view public.projects_customer
with (security_invoker = true) as
  select id, created_at, customer_id, titel, paket, care_stufe, phase, notiz_kunde, liefertermin
  from public.projects;
grant select on public.projects_customer to authenticated;

-- Admin-Voll-Lesepfad inkl. notiz_intern. Läuft als Owner, prüft aber strikt is_admin().
create or replace function public.admin_projects()
returns setof public.projects
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query select * from public.projects order by created_at desc;
end;
$$;
grant execute on function public.admin_projects() to authenticated;

-- ============================================================
-- 7) TRIGGER — Profil bei Signup über die E-Mail verknüpfen
-- Beim Invite/ersten Login matcht dieser Trigger die vorab vom Admin angelegte
-- profiles-Zeile (user_id IS NULL) per E-Mail und setzt user_id.
-- ============================================================
create or replace function public.link_profile_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set user_id = new.id
   where user_id is null
     and lower(email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_profile_on_signup();

-- ============================================================
-- 8) ERSTEN ADMIN ANLEGEN  (E-Mail ANPASSEN, dann ausführen)
-- Reihenfolge: (a) diese Zeile mit deiner E-Mail einfügen, (b) dich in Supabase
-- Authentication → Users → "Invite user" mit derselben E-Mail einladen.
-- Der Trigger oben verknüpft user_id automatisch beim ersten Login.
-- ============================================================
-- insert into public.profiles (email, name, role)
-- values ('DEINE-ADMIN-EMAIL@example.com', 'Sartu Admin', 'admin')
-- on conflict do nothing;
