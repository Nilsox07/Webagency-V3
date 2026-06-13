'use strict';
// Seed: 1 Admin + 2 Demo-Kunden mit je 1 Projekt (inkl. Inhalte-Seiten, Angebot, Meilensteine).
// Idempotent über E-Mail. Nutzt das echte DB (DATABASE_URL) — für Tests gibt es eigene Fixtures.
const db = require('./db');
const auth = require('./auth');
const prices = require('./prices');
const { migrate } = require('./migrate');

async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@sartu.de').toLowerCase();
  const exists = await db.one(`SELECT id FROM admin_user WHERE lower(email) = $1`, [email]);
  if (exists) return;
  const hash = await auth.hashPassword(process.env.ADMIN_PASSWORT || 'portal-admin-dev');
  await db.query(`INSERT INTO admin_user (email, pass_hash) VALUES ($1,$2)`, [email, hash]);
  console.log('Admin angelegt:', email);
}

async function ensureKunde({ email, name, firma, paket, status, redesign, seiten }) {
  let k = await db.one(`SELECT id FROM kunden WHERE lower(email) = $1`, [email.toLowerCase()]);
  if (!k) k = await db.one(`INSERT INTO kunden (email,name,firma) VALUES ($1,$2,$3) RETURNING id`, [email, name, firma]);
  let p = await db.one(`SELECT id FROM projekte WHERE kunde_id = $1`, [k.id]);
  if (!p) {
    const pk = prices.packages[paket];
    p = await db.one(
      `INSERT INTO projekte (kunde_id,name,paket,care_stufe,status,is_redesign,runden_max)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [k.id, firma + ' Website', paket, pk.care, status, !!redesign, pk.rundenMax]
    );
    const ang = await db.one(
      `INSERT INTO angebote (projekt_id,betrag_einmalig,betrag_monatlich,agb_version) VALUES ($1,$2,$3,'v1') RETURNING id`,
      [p.id, pk.price || 0, prices.care[pk.care].price]
    );
    await db.query(`INSERT INTO meilensteine (projekt_id,bezeichnung,betrag,sort) VALUES ($1,'Anzahlung',$2,0),($1,'Go-live-Rate',$3,1)`,
      [p.id, Math.round((pk.price || 0) * 0.5), Math.round((pk.price || 0) * 0.5)]);
    let i = 0;
    for (const s of seiten) {
      await db.query(`INSERT INTO inhalte_seiten (projekt_id,seitenname,sort) VALUES ($1,$2,$3)`, [p.id, s, i++]);
    }
  }
  console.log('Kunde + Projekt:', email);
  return { kundeId: k.id, projektId: p.id };
}

async function seed() {
  await migrate();
  await ensureAdmin();
  await ensureKunde({ email: 'anna@cafe-sonne.de', name: 'Anna Sonne', firma: 'Café Sonne', paket: 'pro', status: 'inhalte', redesign: false, seiten: ['Startseite', 'Speisekarte', 'Über uns', 'Kontakt'] });
  await ensureKunde({ email: 'ben@bau-berg.de', name: 'Ben Berg', firma: 'Bau Berg GmbH', paket: 'platin', status: 'design', redesign: true, seiten: ['Startseite', 'Leistungen', 'Referenzen', 'Karriere', 'Kontakt'] });
}

if (require.main === module) {
  seed().then(() => { console.log('Seed fertig.'); process.exit(0); })
    .catch((e) => { console.error('Seed fehlgeschlagen:', e.message); process.exit(1); });
}
module.exports = { seed, ensureAdmin, ensureKunde };
