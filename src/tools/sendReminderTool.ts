import { sendSms } from '../integrations/twilioClient';

export interface SendReminderToolParams {
  patientPhone: string;
  appointmentTime: string; // ISO string
  patientName?: string;
  customMessage?: string;
  timeZone?: string;
}

export interface SendReminderResult {
  success: boolean;
  sid?: string;
  message: string;
}

export async function sendReminderTool(
  params: SendReminderToolParams,
): Promise<SendReminderResult> {
  // Normalize param names (VAPI or other clients may send phone, phoneNumber, date, etc.)
  const raw = params as unknown as Record<string, unknown>;
  const patientPhone =
    params.patientPhone ?? raw.phone ?? raw.phoneNumber ?? raw.patientPhone;
  const appointmentTime =
    params.appointmentTime ?? raw.appointmentTime ?? raw.date ?? raw.time ?? raw.start;

  if (!patientPhone) {
    throw new Error(
      'patientPhone is required (E.164 format, e.g. +1234567890). Also accepted: phone, phoneNumber.',
    );
  }

  if (!appointmentTime) {
    throw new Error(
      'appointmentTime is required (ISO 8601, e.g. 2026-02-09T15:00:00.000Z). Also accepted: date, time, start.',
    );
  }

  const timeZone = (params.timeZone ?? raw.timeZone) as string | undefined;
  const patientName = (params.patientName ?? raw.patientName) as string | undefined;
  const customMessage = (params.customMessage ?? raw.customMessage) as string | undefined;

  // Format appointment time
  const appointmentDate = new Date(String(appointmentTime));
  const formattedDate = appointmentDate.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timeZone || 'America/New_York',
  });

  // Build SMS message
  let smsBody: string;
  if (customMessage) {
    smsBody = customMessage.replace('{date}', formattedDate);
  } else {
    const greeting = patientName ? `Hi ${patientName}, ` : '';
    smsBody = `${greeting}This is a reminder that you have a dental appointment on ${formattedDate}. We look forward to seeing you!`;
  }

  // Send SMS
  const result = await sendSms({
    to: String(patientPhone),
    body: smsBody,
  });

  return {
    success: true,
    sid: result.sid,
    message: 'Reminder SMS sent successfully',
  };
}
