# Sartu Kundenportal — Setup (Stufe 1)

Statisches Frontend (`login.html`, `portal.html`, `admin.html`) + Supabase (Auth, Postgres, Storage).
Frontend nutzt **nur** den `anon` key. Der `service_role` key lebt ausschließlich in der Edge Function.

---

## 1. Supabase-Projekt

1. Neues Projekt anlegen, **Region: Frankfurt (eu-central-1)**.
2. **Project Settings → API**: `Project URL` und `anon public` key kopieren.
3. In **`portal-config.js`** eintragen (ersetzt die Platzhalter):
   ```js
   var SUPABASE_URL = 'https://DEINPROJEKT.supabase.co';
   var SUPABASE_ANON_KEY = 'eyJ…';   // anon public — NICHT der service_role!
   ```
   (Dieselben Werte trägst du in `briefing.js → CONFIG.supabaseUrl/supabaseKey` ein, damit Lumi-Anfragen in `briefings` landen.)

## 2. Schema einspielen

**SQL Editor** öffnen → kompletten Inhalt von **`supabase/schema.sql`** einfügen → **Run**.
Legt Tabellen, RLS-Policies, Spalten-Grants (schützt `notiz_intern`), View `projects_customer`,
Funktionen `is_admin()` / `my_profile_id()` / `admin_projects()` und den Signup-Trigger an.

### Ersten Admin anlegen
Am Ende von `schema.sql` den auskommentierten Block anpassen und ausführen:
```sql
insert into public.profiles (email, name, role)
values ('deine-admin@example.com', 'Sartu Admin', 'admin')
on conflict do nothing;
```
Dann **Authentication → Users → „Invite user"** mit **derselben E-Mail**.
Beim ersten Login verknüpft der Trigger `user_id` automatisch über die E-Mail.

## 3. Auth-Einstellungen

- **Authentication → Providers → Email**: „Email OTP" aktiv lassen (Magic Link + 6-stelliger Code).
- **URL Configuration → Site URL**: deine Vercel-Domain (z. B. `https://sartu.de`).
  **Redirect URLs** zusätzlich: `https://sartu.de/portal.html`, `https://sartu.de/admin.html`.
- **E-Mail-Template „Magic Link"**: Der Code steckt im Token-Hash; Standard-Template enthält sowohl
  Link als auch (über `{{ .Token }}`) den 6-stelligen Code. Falls der Code fehlt, im Template
  `{{ .Token }}` ergänzen — die Login-Seite verweist auf „Link **und** Code".
- **Wichtig:** Selbst-Registrierung bleibt aus — das Frontend ruft `signInWithOtp({ shouldCreateUser:false })`.
  Optional zusätzlich absichern: **Authentication → „Allow new users to sign up" = off**.

## 4. Edge Function `invite_customer` deployen

Service_role-Einladung serverseitig (nur hier liegt der service_role key):
```bash
supabase login
supabase link --project-ref DEIN_REF
supabase functions deploy invite_customer
# service_role als Secret setzen (URL/anon sind in Functions schon vorhanden):
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ…service_role…
```
Der Admin-Bereich ruft sie über `sb.functions.invoke('invite_customer', …)` auf.
Ist sie (noch) nicht deployt, zeigt „In Projekt umwandeln" eine Anleitung zum manuellen
„Invite user" — das Projekt wird trotzdem angelegt.

## 5. Storage (Stufe 2 — optional jetzt)

Bucket `uploads` (privat) anlegen. Tabellen `uploads`/`documents` sind im Schema vorbereitet;
RLS-Schreibrechte für Kunden kommen in Stufe 2.

## 6. Vercel-Deploy

Statisch — alle Dateien liegen im Repo-Root, kein Build-Step. `git push` → Vercel deployt.
Aufrufbar: `/login.html`, `/portal.html`, `/admin.html`. Alle drei sind `noindex,nofollow`.

---

## 7. Pflicht-Tests (mit erwartetem Ergebnis)

> Vorbereitung: 1 Admin (s. o.) + 1 Test-Kunde A (Profil anlegen + invite) + 1 Projekt für A.
> Browser-Konsole auf `portal.html` nutzt das bereits initialisierte `window.sb`.

| # | Test | Vorgehen | Erwartet |
|---|------|----------|----------|
| **1** | RLS-Kern (Kunde sieht nur Eigenes) | Als Kunde **A** eingeloggt, Konsole:<br>`await sb.from('projects_customer').select('*')`<br>`await sb.from('profiles').select('*')`<br>`await sb.from('briefings').select('*')` | `projects_customer`: **nur Projekte von A**. `profiles`: **nur A's Zeile**. `briefings`: **leer** (`data: []`). |
| **2** | Anon-Eingang | **Ohne Login** den Lumi-Flow auf `briefing.html` absenden (Supabase konfiguriert). Dann Konsole ohne Session:<br>`await sb.from('briefings').select('*')` | INSERT **klappt** (Anfrage erscheint später in der Admin-Inbox). SELECT liefert **`[]`** (kein Fremd-Lesen). |
| **3** | Admin | Als **Admin** `admin.html` öffnen. In **Projekte** Phase eines Projekts von A weiterschalten. | Admin sieht **alle** Tabellen. Nach Reload von A's `portal.html` ist die **neue Phase sofort** in der Timeline. |
| **4** | `notiz_intern` dicht | Als Kunde **A** in der Konsole:<br>`await sb.from('projects').select('notiz_intern')`<br>`await sb.from('projects_customer').select('*')` | Erste Abfrage: **Fehler/leer** (Spalte für `authenticated` nicht lesbar — Grant entzogen). Zweite: `notiz_intern` **kommt nicht vor**. Auch per `fetch` auf `/rest/v1/projects?select=notiz_intern` → **permission denied**. |
| **5** | Kein Self-Signup | Auf `login.html` eine **fremde, nicht angelegte** E-Mail eingeben. | **Kein** Konto wird erzeugt; Hinweis „Für diese E-Mail gibt es keinen Zugang". (In Supabase → Users taucht **kein** neuer User auf.) |

### Warum `notiz_intern` sicher ist (gewählte Lösung)
`notiz_intern` bleibt Spalte auf `projects`. Schutz auf **zwei** Ebenen:
1. **Spalten-Grant**: `revoke select on projects from authenticated` + gezielter `grant select (…ohne notiz_intern…)`.
   → PostgREST gibt die Spalte **keinem** `authenticated`-Nutzer heraus (auch nicht per direktem REST-Call).
2. **Lese-Pfade getrennt**: Kunde liest die View `projects_customer` (enthält die Spalte gar nicht),
   Admin liest sie ausschließlich über die `security definer`-Funktion `admin_projects()` (prüft `is_admin()`).
Schreiben/Ändern von `notiz_intern` kann nur ein Admin (RLS `projects_update = is_admin()`).
