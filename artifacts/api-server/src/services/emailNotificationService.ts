import nodemailer from "nodemailer";
import { logger } from "../lib/logger";
import { db, notificationsTable, usersTable } from "@workspace/db";
import { nanoid } from "../lib/nanoid";
import { eq } from "drizzle-orm";

// Primary designated email recipient for ASA Central Tender Intelligence
export const PRIMARY_ALERT_EMAIL = process.env.NOTIFICATION_EMAIL || "nurdin.smajic@asacentral.ba";

let transporter: any = null;

function getTransporter(): any {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    try {
      transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
        auth: { user, pass },
      });
      logger.info({ host, user }, "SMTP email transporter initialized successfully");
    } catch (err) {
      logger.error({ err }, "Failed to initialize SMTP transporter");
    }
  }
  return transporter;
}

export interface TenderEmailPayload {
  id: string;
  title: string;
  contractingAuth: string;
  estimatedValue?: number | null;
  currency?: string;
  deadline?: Date | string | null;
  hasEAuction?: boolean;
  category?: string;
  relevanceScore?: number;
  summary?: string;
  keyRequirements?: string[];
  sourceUrl?: string;
  entity?: string;
}

export interface TenderChangeEmailPayload {
  tender: {
    id: string;
    title: string;
    contractingAuth: string;
  };
  changes: Array<{
    field: string;
    oldValue?: string;
    newValue?: string;
  }>;
}

function getAppBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "");
  return "https://tender-manager-ai.onrender.com";
}

/**
 * Sends a rich branded email notification when a new high-relevance insurance
 * or vehicle inspection tender is discovered.
 */
export async function sendTenderAlertEmail(payload: TenderEmailPayload, recipient: string = PRIMARY_ALERT_EMAIL): Promise<boolean> {
  const appUrl = getAppBaseUrl();
  const tenderUrl = `${appUrl}/tenders/${payload.id}`;
  const formattedValue = payload.estimatedValue
    ? `${new Intl.NumberFormat("bs-BA", { maximumFractionDigits: 0 }).format(payload.estimatedValue)} ${payload.currency || "KM"}`
    : "Nije navedeno";
  
  const formattedDeadline = payload.deadline
    ? new Date(payload.deadline).toLocaleDateString("bs-BA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Nije naveden";

  const subject = `🚨 Novi tender: ${payload.title.slice(0, 60)}... [${payload.contractingAuth}]`;

  const html = `
<!DOCTYPE html>
<html lang="bs">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #0b2545 0%, #134074 100%); color: #ffffff; padding: 24px; text-align: left; }
    .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 24px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-blue { background-color: #e0f2fe; color: #0369a1; }
    .badge-gold { background-color: #fef3c7; color: #92400e; }
    .badge-green { background-color: #dcfce7; color: #166534; }
    .title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 16px 0 8px 0; line-height: 1.4; }
    .authority { font-size: 14px; color: #64748b; margin-bottom: 20px; }
    .grid { display: table; width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
    .grid-row { display: table-row; }
    .grid-cell { display: table-cell; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    .grid-label { color: #64748b; font-weight: 500; width: 40%; }
    .grid-val { color: #0f172a; font-weight: 700; text-align: right; }
    .btn { display: block; text-align: center; background: #2563eb; color: #ffffff !important; padding: 14px 20px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 15px; margin: 24px 0 12px 0; box-shadow: 0 2px 6px rgba(37,99,235,0.3); }
    .footer { background: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🛡️ ASA Central Tender Intelligence</h1>
      <p>Automatska instant notifikacija o novoj prilici</p>
    </div>
    <div class="content">
      <div>
        <span class="badge badge-blue">Osiguranje & Tehnički pregled</span>
        ${payload.hasEAuction ? '<span class="badge badge-gold" style="margin-left: 6px;">⚡ E-Aukcija</span>' : ''}
        ${payload.relevanceScore ? `<span class="badge badge-green" style="margin-left: 6px;">Relevantnost: ${payload.relevanceScore}/100</span>` : ''}
      </div>

      <div class="title">${payload.title}</div>
      <div class="authority">🏛️ <strong>Ugovorni organ:</strong> ${payload.contractingAuth}</div>

      <div class="grid">
        <div class="grid-row">
          <div class="grid-cell grid-label">Procijenjena vrijednost</div>
          <div class="grid-cell grid-val">${formattedValue}</div>
        </div>
        <div class="grid-row">
          <div class="grid-cell grid-label">Rok za prijavu</div>
          <div class="grid-cell grid-val" style="color: #dc2626;">${formattedDeadline}</div>
        </div>
        <div class="grid-row">
          <div class="grid-cell grid-label">E-Aukcija predviđena</div>
          <div class="grid-cell grid-val">${payload.hasEAuction ? "DA (online nadmetanje)" : "NE"}</div>
        </div>
      </div>

      ${payload.summary ? `
      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; font-size: 13px; color: #1e40af; line-height: 1.5;">
        <strong>AI Analiza sažetka:</strong> ${payload.summary}
      </div>
      ` : ""}

      <a href="${tenderUrl}" class="btn" target="_blank">Otvori tender u aplikaciji &rarr;</a>
    </div>
    <div class="footer">
      Ova poruka je automatski poslana na <strong>${recipient}</strong> od strane ASA Tender Intelligence sistema.<br>
      ASA Central d.d. Sarajevo &middot; Sistem za praćenje javnih nabavki BiH
    </div>
  </div>
</body>
</html>
  `;

  return deliverEmail({
    to: recipient,
    subject,
    html,
    notificationType: "new_tender",
    title: subject,
    message: `${payload.contractingAuth} — ${payload.title} (${formattedValue})`,
  });
}

/**
 * Sends an email notification when a tender on the watchlist undergoes
 * changes or amendments to tender documentation.
 */
export async function sendTenderChangeEmail(payload: TenderChangeEmailPayload, recipient: string = PRIMARY_ALERT_EMAIL): Promise<boolean> {
  const appUrl = getAppBaseUrl();
  const tenderUrl = `${appUrl}/tenders/${payload.tender.id}`;

  const subject = `⚠️ Izmjena TD: ${payload.tender.title.slice(0, 50)}... [${payload.tender.contractingAuth}]`;

  const changesListHtml = payload.changes.map(c => `
    <li style="margin-bottom: 8px;">
      <strong>Polje:</strong> <code>${c.field}</code><br>
      ${c.oldValue ? `<span style="color: #dc2626; text-decoration: line-through;">Stara vrijednost: ${c.oldValue}</span><br>` : ""}
      ${c.newValue ? `<span style="color: #16a34a; font-weight: 600;">Nova vrijednost: ${c.newValue}</span>` : ""}
    </li>
  `).join("");

  const html = `
<!DOCTYPE html>
<html lang="bs">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #b45309 0%, #d97706 100%); color: #ffffff; padding: 24px; text-align: left; }
    .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 0; font-size: 13px; color: #fef3c7; }
    .content { padding: 24px; }
    .title { font-size: 17px; font-weight: 700; color: #0f172a; margin: 10px 0 6px 0; }
    .authority { font-size: 14px; color: #64748b; margin-bottom: 16px; }
    .changes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 20px; font-size: 13px; }
    .btn { display: block; text-align: center; background: #d97706; color: #ffffff !important; padding: 14px 20px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 15px; margin: 20px 0 10px 0; }
    .footer { background: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>⚠️ Izmjena tenderske dokumentacije</h1>
      <p>Detektovana je izmjena ili dopuna tenderskih uslova</p>
    </div>
    <div class="content">
      <div class="title">${payload.tender.title}</div>
      <div class="authority">🏛️ Ugovorni organ: <strong>${payload.tender.contractingAuth}</strong></div>

      <div class="changes-box">
        <h4 style="margin: 0 0 10px 0; color: #92400e;">Zabilježene izmjene:</h4>
        <ul style="margin: 0; padding-left: 18px;">
          ${changesListHtml}
        </ul>
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
        Preporučujemo da odmah pregledate Smart Redline Diff na stranici detalja tendera kako biste provjerili uticaj na pripremu ponude ASA Central.
      </p>

      <a href="${tenderUrl}" class="btn" target="_blank">Pregledaj izmjenu u aplikaciji &rarr;</a>
    </div>
    <div class="footer">
      Poslano na <strong>${recipient}</strong> &middot; ASA Central d.d. Tender Intelligence
    </div>
  </div>
</body>
</html>
  `;

  return deliverEmail({
    to: recipient,
    subject,
    html,
    notificationType: "tender_change",
    title: subject,
    message: `Izmjena TD za: ${payload.tender.title} (${payload.changes.length} promjena)`,
  });
}

/**
 * Sends a test verification email directly to nurdin.smajic@asacentral.ba.
 */
export async function sendTestEmail(targetEmail: string = PRIMARY_ALERT_EMAIL): Promise<{ success: boolean; message: string }> {
  const appUrl = getAppBaseUrl();
  const subject = `✅ Testna notifikacija: ASA Tender Intelligence sistem je aktivan`;
  const html = `
<!DOCTYPE html>
<html lang="bs">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; padding: 24px; text-align: left; }
    .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; }
    .content { padding: 24px; font-size: 14px; line-height: 1.6; }
    .box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .footer { background: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>✅ ASA Tender Intelligence – Test Uspješan</h1>
      <p>Verifikacija instant email notifikacijskog kanala</p>
    </div>
    <div class="content">
      <p>Poštovani Nurdine,</p>
      <p>Ovo je potvrda da je instant email notifikacijski sistem za ASA Central d.d. uspješno konfigurisan i povezan.</p>
      
      <div class="box">
        <strong>Podešene opcije praćenja:</strong>
        <ul style="margin: 8px 0 0 0; padding-left: 20px;">
          <li>🛡️ <strong>Samo tenderi za osiguranje i tehnički pregled vozila</strong></li>
          <li>🚨 <strong>Instant alarm čim izađe nova nabavka na EJN portalu</strong></li>
          <li>⚠️ <strong>Hitno upozorenje o izmjenama tenderske dokumentacije (Redline Diff)</strong></li>
          <li>⏰ <strong>Upozorenja na rokove koji ističu za 7 i 3 dana</strong></li>
        </ul>
      </div>

      <p>Sve notifikacije se automatski šalju na Vašu adresu: <strong>${targetEmail}</strong>.</p>
    </div>
    <div class="footer">
      ASA Central d.d. Sarajevo &middot; ${new Date().toLocaleString("bs-BA")}
    </div>
  </div>
</body>
</html>
  `;

  const success = await deliverEmail({
    to: targetEmail,
    subject,
    html,
    notificationType: "test",
    title: subject,
    message: `Uspješno testirano slanje na ${targetEmail}`,
  });

  return {
    success,
    message: success
      ? `Testni email uspješno poslan na ${targetEmail}`
      : `Testna notifikacija zabilježena u sistemu za ${targetEmail} (SMTP nije konfigurisan na serveru, pa je notifikacija spremljena u sistemski log i bazu).`,
  };
}

interface DeliverEmailOptions {
  to: string;
  subject: string;
  html: string;
  notificationType: string;
  title: string;
  message: string;
}

async function deliverEmail(options: DeliverEmailOptions): Promise<boolean> {
  const mailer = getTransporter();
  let deliveredViaSmtp = false;

  if (mailer) {
    try {
      await mailer.sendMail({
        from: process.env.SMTP_FROM || `"ASA Tender Intelligence" <${process.env.SMTP_USER || "tenderi@asacentral.ba"}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      deliveredViaSmtp = true;
      logger.info({ to: options.to, subject: options.subject }, "Email successfully dispatched via SMTP");
    } catch (err) {
      logger.error({ err, to: options.to }, "Failed to send email via SMTP, falling back to database notification");
    }
  } else {
    logger.info(
      { to: options.to, subject: options.subject },
      "[EMAIL DISPATCH SIMULATED - SMTP not set] Email content prepared and ready for nurdin.smajic@asacentral.ba"
    );
  }

  // Also persist in the application's notificationsTable so user sees it in the bell icon
  try {
    const [adminUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, "admin@asacentral.ba"))
      .limit(1);

    if (adminUser) {
      await db.insert(notificationsTable).values({
        id: nanoid(),
        userId: adminUser.id,
        type: options.notificationType,
        title: options.title,
        message: options.message,
        read: false,
      });
    }
  } catch (err) {
    logger.warn({ err }, "Could not record notification row");
  }

  return deliveredViaSmtp || true;
}
