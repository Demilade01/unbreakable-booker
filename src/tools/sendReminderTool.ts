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
  if (!params.patientPhone) {
    throw new Error('patientPhone is required');
  }

  if (!params.appointmentTime) {
    throw new Error('appointmentTime is required');
  }

  // Format appointment time
  const appointmentDate = new Date(params.appointmentTime);
  const formattedDate = appointmentDate.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: params.timeZone || 'America/New_York',
  });

  // Build SMS message
  let smsBody: string;
  if (params.customMessage) {
    smsBody = params.customMessage.replace('{date}', formattedDate);
  } else {
    const greeting = params.patientName ? `Hi ${params.patientName}, ` : '';
    smsBody = `${greeting}This is a reminder that you have a dental appointment on ${formattedDate}. We look forward to seeing you!`;
  }

  // Send SMS
  const result = await sendSms({
    to: params.patientPhone,
    body: smsBody,
  });

  return {
    success: true,
    sid: result.sid,
    message: 'Reminder SMS sent successfully',
  };
}
