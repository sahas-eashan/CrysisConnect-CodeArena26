import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { Pool } from "pg";

const snsClient = new SNSClient({});
const sesClient = new SESv2Client({});
const notifyEndpoint = "https://app.notify.lk/api/v1/send";
const maxSmsLength = 621;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  },
  max: 3
});

type RecipientRow = {
  phone: string | null;
  email: string | null;
};

function trimToNull(value: unknown) {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeSriLankanPhone(phone: string) {
  const sanitized = phone.replace(/[^\d+]/g, "");
  const withoutPlus = sanitized.startsWith("+") ? sanitized.slice(1) : sanitized;

  if (withoutPlus.startsWith("94") && withoutPlus.length === 11) {
    return withoutPlus;
  }

  if (withoutPlus.startsWith("0") && withoutPlus.length === 10) {
    return `94${withoutPlus.slice(1)}`;
  }

  if (withoutPlus.startsWith("7") && withoutPlus.length === 9) {
    return `94${withoutPlus}`;
  }

  return null;
}

function getDemoRecipients() {
  const raw = trimToNull(process.env.DEMO_SMS_RECIPIENTS);
  if (!raw) return [] as RecipientRow[];

  const phones = raw
    .split(/[,\n\r]/)
    .map((value) => normalizeSriLankanPhone(value))
    .filter((value): value is string => Boolean(value));

  return [...new Set(phones)].map((phone) => ({
    phone,
    email: null
  }));
}

function getNotifyConfig() {
  const userId = trimToNull(process.env.NOTIFYLK_USER_ID);
  const apiKey = trimToNull(process.env.NOTIFYLK_API_KEY);
  const senderId = trimToNull(process.env.NOTIFYLK_SENDER_ID);
  const smsType = trimToNull(process.env.NOTIFYLK_SMS_TYPE);

  if (!userId || !apiKey || !senderId) {
    return null;
  }

  return {
    userId,
    apiKey,
    senderId,
    smsType: smsType?.toLowerCase() === "unicode" ? "unicode" : null
  };
}

function toSmsMessage(message: string) {
  const trimmed = message.trim();
  return trimmed.length <= maxSmsLength ? trimmed : trimmed.slice(0, maxSmsLength);
}

async function sendNotifySms(phone: string, message: string) {
  const notifyConfig = getNotifyConfig();
  if (!notifyConfig) {
    throw new Error("Notify.lk is not configured.");
  }

  const payload = new URLSearchParams({
    user_id: notifyConfig.userId,
    api_key: notifyConfig.apiKey,
    sender_id: notifyConfig.senderId,
    to: phone,
    message
  });

  if (notifyConfig.smsType) {
    payload.set("type", notifyConfig.smsType);
  }

  const response = await fetch(notifyEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: payload.toString()
  });

  const raw = await response.text();
  let parsed: { status?: string; data?: unknown } | null = null;

  try {
    parsed = raw ? (JSON.parse(raw) as { status?: string; data?: unknown }) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok || parsed?.status !== "success") {
    throw new Error(`Notify.lk SMS delivery failed: ${raw || response.statusText}`);
  }
}

async function sendSnsSms(phone: string, message: string) {
  await snsClient.send(
    new PublishCommand({
      PhoneNumber: `+${phone}`,
      Message: message,
      MessageAttributes: {
        "AWS.SNS.SMS.SenderID": {
          DataType: "String",
          StringValue: "CRISISAPP"
        },
        "AWS.SNS.SMS.SMSType": {
          DataType: "String",
          StringValue: "Transactional"
        }
      }
    })
  );
}

async function sendSms(phone: string, message: string) {
  const normalizedPhone = normalizeSriLankanPhone(phone);
  if (!normalizedPhone) return;

  const smsMessage = toSmsMessage(message);
  if (getNotifyConfig()) {
    await sendNotifySms(normalizedPhone, smsMessage);
    return;
  }

  await sendSnsSms(normalizedPhone, smsMessage);
}

async function sendEmail(email: string, subject: string, body: string) {
  if (!process.env.SES_FROM) return;

  await sesClient.send(
    new SendEmailCommand({
      FromEmailAddress: process.env.SES_FROM,
      Destination: {
        ToAddresses: [email]
      },
      Content: {
        Simple: {
          Subject: { Data: subject },
          Body: {
            Text: {
              Data: body
            }
          }
        }
      }
    })
  );
}

function normalizeTargetRoles(input: unknown) {
  if (!Array.isArray(input)) return [] as string[];

  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeChannels(input: unknown) {
  if (!Array.isArray(input)) return [] as string[];

  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

async function resolveAlertTargetArea(alert: Record<string, any>) {
  const directArea = trimToNull(alert.targetArea);
  if (directArea) return directArea;

  const disasterId = trimToNull(alert.disasterId);
  if (!disasterId) return null;

  const result = await pool.query<{ affected_area: string | null }>(
    `SELECT ST_AsGeoJSON(affected_area) AS affected_area
     FROM disasters
     WHERE id = $1
     LIMIT 1`,
    [disasterId]
  );

  return trimToNull(result.rows[0]?.affected_area);
}

async function getRecipients(targetArea: string | null, targetRoles: string[]) {
  const values: any[] = [];
  const filters = ["1 = 1"];

  if (targetRoles.length) {
    values.push(targetRoles);
    filters.push(`role::text = ANY($${values.length}::text[])`);
  }

  if (targetArea) {
    values.push(targetArea);
    const geoJsonIndex = values.length;
    filters.push("location IS NOT NULL");
    filters.push(`ST_Intersects(location::geometry, ST_SetSRID(ST_GeomFromGeoJSON($${geoJsonIndex}), 4326))`);
  }

  const result = await pool.query<RecipientRow>(`SELECT phone, email FROM profiles WHERE ${filters.join(" AND ")}`, values);
  const demoRecipients = getDemoRecipients();

  if (!demoRecipients.length) {
    return result;
  }

  const uniqueRecipients = new Map<string, RecipientRow>();

  for (const recipient of [...result.rows, ...demoRecipients]) {
    const recipientKey = `${recipient.phone ?? ""}|${recipient.email ?? ""}`;
    if (!recipient.phone && !recipient.email) continue;
    if (!uniqueRecipients.has(recipientKey)) {
      uniqueRecipients.set(recipientKey, recipient);
    }
  }

  return {
    ...result,
    rows: [...uniqueRecipients.values()],
    rowCount: uniqueRecipients.size
  };
}

async function deliverAlert(recipients: RecipientRow[], subject: string, message: string, channels: string[]) {
  const shouldSendSms = channels.includes("sms");
  const shouldSendEmail = channels.includes("email");

  await Promise.all(
    recipients.flatMap((recipient) => [
      recipient.phone && shouldSendSms ? sendSms(recipient.phone, message) : Promise.resolve(),
      recipient.email && shouldSendEmail ? sendEmail(recipient.email, subject, message) : Promise.resolve()
    ])
  );
}

export async function handler(event: {
  action: "DISASTER_ALERT" | "SOS_ALERT" | "DIRECT_ALERT";
  disaster?: Record<string, any>;
  alert?: Record<string, any>;
  responders?: Array<Record<string, any>>;
  sos?: Record<string, any>;
}) {
  if (event.action === "DISASTER_ALERT" && event.disaster) {
    const disaster = event.disaster;
    const message = `Emergency alert: ${disaster.title} (${disaster.severity}). Open CrisisConnect for details.`;
    const affectedArea = trimToNull(disaster.affected_area);
    const query = await getRecipients(affectedArea, ["citizen"]);

    await deliverAlert(query.rows, String(disaster.title), message, ["sms", "email"]);

    return { delivered: query.rowCount ?? 0 };
  }

  if (event.action === "SOS_ALERT") {
    const message = `New SOS request needs response: ${event.sos?.type ?? "emergency"} - ${event.sos?.description ?? ""}`;
    await deliverAlert((event.responders ?? []) as RecipientRow[], "New SOS dispatch", message, ["sms", "email"]);
    return { delivered: (event.responders ?? []).length };
  }

  if (event.action === "DIRECT_ALERT" && event.alert) {
    const alert = event.alert;
    const message = `${alert.title}: ${alert.body}`;
    const targetArea = await resolveAlertTargetArea(alert);
    const targetRoles = normalizeTargetRoles(alert.targetRoles);
    const channels = normalizeChannels(alert.channel);
    const query = await getRecipients(targetArea, targetRoles);

    await deliverAlert(query.rows, String(alert.title), message, channels);
    return { delivered: query.rowCount ?? 0 };
  }

  return { delivered: 0 };
}
