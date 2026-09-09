import { logger } from "../lib/logger";

export async function notifyNewTender(tender: any) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const appHost = (process.env.APP_HOST || process.env.APP_URL || "http://localhost:5000").replace(/\/+$/, "");

  if (!webhookUrl) {
    logger.info({ id: tender.id, title: tender.title }, "[SLACK] No webhook URL configured, skipping Slack notification.");
    return;
  }

  const estValStr = tender.estimatedValue
    ? `${tender.estimatedValue.toLocaleString("bs-BA")} KM`
    : "Nije procijenjeno";

  const deadlineStr = tender.deadline
    ? new Date(tender.deadline).toLocaleDateString("bs-BA")
    : "-";

  const payload = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🚨 Novi Tender za Osiguranje na EJN!",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Naziv:* ${tender.title}\n*Ugovorni organ:* ${tender.contractingAuth}\n*Procijenjena vrijednost:* *${estValStr}*\n*Rok za prijem ponuda:* *${deadlineStr}*`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "🔎 Otvori u aplikaciji",
              emoji: true,
            },
            url: `${appHost}/tenders/${tender.id}`,
            action_id: "view_tender",
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Slack status code: ${res.status}`);
    }

    logger.info({ id: tender.id }, "[SLACK] Rich notification sent successfully.");
  } catch (err: any) {
    logger.warn({ id: tender.id, error: err.message }, "[SLACK] Failed to send notification.");
  }
}
