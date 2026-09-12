import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { Pool } from "pg";

const snsClient = new SNSClient({});
const sesClient = new SESv2Client({});

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

async function sendSms(phone: string, message: string) {
  await snsClient.send(
    new PublishCommand({
      PhoneNumber: phone,
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

export async function handler(event: {
  action: "DISASTER_ALERT" | "SOS_ALERT" | "DIRECT_ALERT";
  disaster?: Record<string, any>;
  alert?: Record<string, any>;
  responders?: Array<Record<string, any>>;
  sos?: Record<string, any>;
}) {
  if (event.action === "DISASTER_ALERT" && event.disaster) {
    const disaster = event.disaster;
    const query = await pool.query(
      `SELECT phone, email
       FROM profiles
       WHERE location IS NOT NULL
         AND ST_DWithin(location, $1::geography, 10000)`,
      [disaster.affected_area]
    );

    const message = `Emergency alert: ${disaster.title} (${disaster.severity}). Open CrisisConnect for details.`;

    await Promise.all(
      query.rows.flatMap((row) => [
        row.phone ? sendSms(row.phone, message) : Promise.resolve(),
        row.email ? sendEmail(row.email, String(disaster.title), message) : Promise.resolve()
      ])
    );

    return { delivered: query.rowCount ?? 0 };
  }

  if (event.action === "SOS_ALERT") {
    const message = `New SOS request needs response: ${event.sos?.type ?? "emergency"} - ${event.sos?.description ?? ""}`;
    await Promise.all(
      (event.responders ?? []).flatMap((responder) => [
        responder.phone ? sendSms(responder.phone, message) : Promise.resolve(),
        responder.email ? sendEmail(responder.email, "New SOS dispatch", message) : Promise.resolve()
      ])
    );
    return { delivered: (event.responders ?? []).length };
  }

  if (event.action === "DIRECT_ALERT" && event.alert) {
    const alert = event.alert;
    const message = `${alert.title}: ${alert.body}`;
    const query = await pool.query(`SELECT phone, email FROM profiles`);
    await Promise.all(
      query.rows.flatMap((row) => [
        row.phone && alert.channel?.includes("sms") ? sendSms(row.phone, message) : Promise.resolve(),
        row.email && alert.channel?.includes("email")
          ? sendEmail(row.email, String(alert.title), String(alert.body))
          : Promise.resolve()
      ])
    );
    return { delivered: query.rowCount ?? 0 };
  }

  return { delivered: 0 };
}
