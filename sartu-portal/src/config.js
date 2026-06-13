'use strict';
// Zentrale Konfiguration aus der Umgebung. Siehe .env.example für alle Schlüssel.
module.exports = {
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL || '',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  cookieSecret: process.env.COOKIE_SECRET || 'dev-cookie-secret-bitte-aendern-mind-32-zeichen',
  encKey: process.env.ENC_KEY || '', // 64 Hex-Zeichen = 32 Byte (AES-256). Leer => Dev-Fallback.
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'portal@sartu.de',
  },
  uploadDir: process.env.UPLOAD_DIR || '/data/uploads',
  vorschauDir: process.env.VORSCHAU_DIR || '/data/vorschau',
  magicTtlMin: 15,
  sessionTtlDays: 14,
  hourlyRate: 150, // €/Std — Quelle: Leistungsbeschreibung (auch in prices.js gespiegelt)
};
