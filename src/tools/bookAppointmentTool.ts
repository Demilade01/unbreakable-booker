import axios from 'axios';
import dotenv from 'dotenv';
import { sendSms } from '../integrations/twilioClient';

dotenv.config();

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
    'cal-api-version': '2024-09-04',
  },
  timeout: 10_000,
});

export interface BookAppointmentToolParams {
  start: string; // ISO string (UTC)
  end: string; // ISO string (UTC)
  eventTypeId?: number | string;
  eventTypeSlug?: string;
  username?: string;
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
  // Validate required params
  if (!params.start || !params.end) {
    throw new Error('start and end times are required');
  }

  if (!params.patientName || !params.patientPhone) {
    throw new Error('patientName and patientPhone are required');
  }

  // Determine event type identifier
  let eventTypeId: string | number | undefined = params.eventTypeId;
  if (!eventTypeId && params.eventTypeSlug && params.username) {
    // If slug provided, we'd need to fetch event type ID first
    // For now, require eventTypeId for booking
    throw new Error('eventTypeId is required for booking (slug lookup not implemented)');
  }

  if (!eventTypeId) {
    throw new Error('eventTypeId is required');
  }

  // Create booking via Cal.com API
  const bookingResponse = await calComClient.post('/bookings', {
    start: params.start,
    end: params.end,
    eventTypeId: eventTypeId,
    responses: {
      name: params.patientName,
      email: params.patientEmail || '',
      phone: params.patientPhone,
      notes: params.notes || '',
    },
    timeZone: params.timeZone || 'America/New_York',
  });

  const booking = bookingResponse.data.data || bookingResponse.data;
  const bookingId = booking.id || booking.uid || String(bookingResponse.data.id);

  // Send SMS confirmation if requested
  let smsSent = false;
  if (params.sendSmsConfirmation !== false && params.patientPhone) {
    try {
      const startDate = new Date(params.start);
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
    start: params.start,
    end: params.end,
    patientName: params.patientName,
    smsSent,
    message: `Appointment booked successfully${smsSent ? ' and SMS confirmation sent' : ''}`,
  };
}
