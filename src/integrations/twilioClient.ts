import dotenv from 'dotenv';
import twilio, { Twilio } from 'twilio';

dotenv.config();

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
  // eslint-disable-next-line no-console
  console.warn(
    '[twilioClient] TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_FROM_NUMBER is not set. SMS sending will fail until configured.',
  );
}

let client: Twilio | null = null;

function getClient(): Twilio {
  if (!client) {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials are not configured.');
    }
    client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return client;
}

export interface SendSmsParams {
  to: string;
  body: string;
}

export interface SendSmsResult {
  sid: string;
}

export async function sendSms({ to, body }: SendSmsParams): Promise<SendSmsResult> {
  if (!TWILIO_FROM_NUMBER) {
    throw new Error('TWILIO_FROM_NUMBER is not configured.');
  }

  const twilioClient = getClient();

  const message = await twilioClient.messages.create({
    to,
    from: TWILIO_FROM_NUMBER,
    body,
  });

  return { sid: message.sid };
}

