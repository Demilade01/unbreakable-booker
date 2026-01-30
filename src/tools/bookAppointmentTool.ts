import axios from 'axios';
import dotenv from 'dotenv';
import { sendSms } from '../integrations/twilioClient';

dotenv.config();

// Default Cal.com configuration - change these to your actual values
const DEFAULT_CALCOM_USERNAME = process.env.CALCOM_USERNAME || 'devbyte-9rm9zq';
const DEFAULT_CALCOM_EVENT_TYPE_SLUG = process.env.CALCOM_EVENT_TYPE_SLUG || '30min';

const CALCOM_BASE_URL = process.env.CALCOM_BASE_URL || 'https://api.cal.com/v2';
const CALCOM_API_KEY = process.env.CALCOM_API_KEY;

if (!CALCOM_API_KEY) {
  throw new Error('CALCOM_API_KEY is not configured');
}

const calComClient = axios.create({
  baseURL: CALCOM_BASE_URL,
  headers: {
    Authorization: `Bearer ${CALCOM_API_KEY}`,
    'Content-Type': 'application/json',
    'cal-api-version': '2024-08-13',
  },
  timeout: 10_000,
});

export interface BookAppointmentToolParams {
  start: string; // ISO string (UTC)
  end: string; // ISO string (UTC)
  eventTypeId?: number | string;
  eventTypeSlug?: string;
  username?: string;
  teamSlug?: string;
  organizationSlug?: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  notes?: string;
  timeZone?: string;
  sendSmsConfirmation?: boolean;
}

export interface BookAppointmentResult {
  bookingId: string;
  start: string;
  end: string;
  patientName: string;
  smsSent: boolean;
  message: string;
}

export async function bookAppointmentTool(
  params: BookAppointmentToolParams,
): Promise<BookAppointmentResult> {
  // Normalize param names (VAPI/LLM may send many variations)
  const raw = params as unknown as Record<string, unknown>;
  const start =
    params.start ??
    raw.startDate ??
    raw.startTime ??
    raw.startDateTime ??
    raw.start_date ??
    raw.start_time ??
    raw.appointmentStart ??
    raw.appointmentTime ??
    raw.appointment_time ??
    raw.appointment_start ??
    raw.date ??
    raw.time ??
    raw.dateTime ??
    raw.date_time;
  let end: string | undefined =
    params.end ??
    raw.endDate ??
    raw.endTime ??
    raw.endDateTime ??
    raw.end_date ??
    raw.end_time ??
    raw.appointmentEnd ??
    raw.appointment_end;
  if (start && !end) {
    const durationMinutes = Number(raw.duration ?? raw.durationMinutes ?? 30);
    const startDate = new Date(start);
    startDate.setMinutes(startDate.getMinutes() + durationMinutes);
    end = startDate.toISOString();
  }

  if (!start || !end) {
    throw new Error(
      'start (and end or duration) are required. Use ISO 8601 UTC, e.g. start: "2026-02-09T15:00:00.000Z", end: "2026-02-09T15:30:00.000Z"',
    );
  }

  if (!params.patientName || !params.patientPhone || !params.patientEmail) {
    throw new Error('patientName, patientPhone, and patientEmail are required');
  }

  // Apply defaults for username and eventTypeSlug if not provided
  const effectiveUsername = params.username || DEFAULT_CALCOM_USERNAME;
  const effectiveEventTypeSlug = params.eventTypeSlug || DEFAULT_CALCOM_EVENT_TYPE_SLUG;

  // Require either eventTypeId OR (eventTypeSlug + username) OR (eventTypeSlug + teamSlug)
  // If caller passes a numeric eventTypeSlug (e.g. "4567450" from dashboard URL), treat it as eventTypeId
  let effectiveEventTypeId: string | number | undefined = params.eventTypeId;
  const slugIsNumeric =
    effectiveEventTypeSlug != null &&
    String(effectiveEventTypeSlug).trim() !== '' &&
    /^\d+$/.test(String(effectiveEventTypeSlug).trim());
  if (!effectiveEventTypeId && slugIsNumeric) {
    effectiveEventTypeId = Number(effectiveEventTypeSlug);
  }

  const hasEventTypeId = effectiveEventTypeId != null && effectiveEventTypeId !== '';
  const hasSlugAndUser = effectiveEventTypeSlug && effectiveUsername && !slugIsNumeric;
  const hasSlugAndTeam = effectiveEventTypeSlug && params.teamSlug && !slugIsNumeric;

  if (!hasEventTypeId && !hasSlugAndUser && !hasSlugAndTeam) {
    throw new Error(
      'Either eventTypeId OR (eventTypeSlug + username) OR (eventTypeSlug + teamSlug) is required for booking',
    );
  }

  const timeZone = params.timeZone || 'America/New_York';

  // Cal.com v2 expects "attendee" object, not "responses"
  const attendee = {
    name: params.patientName,
    email: params.patientEmail,
    phoneNumber: params.patientPhone,
    timeZone,
    language: 'en',
  };

  // Build Cal.com v2 create-booking body. Do not send lengthInMinutes unless the event type
  // has multiple possible lengths; Cal.com uses the event type default duration otherwise.
  const body: Record<string, unknown> = {
    start: String(start),
    attendee,
  };

  if (hasEventTypeId) {
    body.eventTypeId = effectiveEventTypeId;
  } else if (hasSlugAndUser) {
    body.eventTypeSlug = effectiveEventTypeSlug;
    body.username = effectiveUsername;
    if (params.organizationSlug) body.organizationSlug = params.organizationSlug;
  } else {
    body.eventTypeSlug = effectiveEventTypeSlug;
    body.teamSlug = params.teamSlug;
    if (params.organizationSlug) body.organizationSlug = params.organizationSlug;
  }

  // Custom booking fields (e.g. notes) if the event type has them
  if (params.notes) {
    body.bookingFieldsResponses = { notes: params.notes };
  }

  let bookingResponse;
  try {
    bookingResponse = await calComClient.post('/bookings', body);
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.data) {
      const calData = err.response.data as { error?: { message?: string }; message?: string };
      const msg =
        calData?.error?.message ?? calData?.message ?? JSON.stringify(calData);
      throw new Error(`Cal.com booking failed (${err.response.status}): ${msg}`);
    }
    throw err;
  }

  const booking = bookingResponse.data.data || bookingResponse.data;
  const bookingId = booking.id || booking.uid || String(bookingResponse.data.id);

  // Send SMS confirmation if requested
  let smsSent = false;
  if (params.sendSmsConfirmation !== false && params.patientPhone) {
    try {
      const startDate = new Date(String(start));
      const formattedDate = startDate.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: params.timeZone || 'America/New_York',
      });

      const smsBody = `Hi ${params.patientName}, your dental appointment is confirmed for ${formattedDate}. We'll see you then!`;

      await sendSms({
        to: params.patientPhone,
        body: smsBody,
      });

      smsSent = true;
    } catch (smsError) {
      // Log but don't fail the booking if SMS fails
      // eslint-disable-next-line no-console
      console.error('Failed to send SMS confirmation:', smsError);
    }
  }

  return {
    bookingId,
    start: String(start),
    end: String(end),
    patientName: params.patientName,
    smsSent,
    message: `Appointment booked successfully${smsSent ? ' and SMS confirmation sent' : ''}`,
  };
}
