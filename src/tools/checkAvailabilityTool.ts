import { getAvailability, CalComAvailabilityRequest } from '../integrations/calComClient';

// Default Cal.com configuration - change these to your actual values
const DEFAULT_CALCOM_USERNAME = process.env.CALCOM_USERNAME || 'devbyte-9rm9zq';
const DEFAULT_CALCOM_EVENT_TYPE_SLUG = process.env.CALCOM_EVENT_TYPE_SLUG || '30min';

export interface CheckAvailabilityToolParams {
  start: string; // ISO string (UTC)
  end: string; // ISO string (UTC)
  eventTypeSlug?: string;
  username?: string;
  eventTypeId?: number | string;
  timeZone?: string;
  duration?: number;
}

export async function checkAvailabilityTool(
  params: CheckAvailabilityToolParams,
): Promise<{ slots: any; message?: string }> {
  // Normalize param names (VAPI/LLM may send many variations)
  const raw = params as unknown as Record<string, unknown>;
  const dateRange = raw.dateRange as { start?: string; end?: string } | undefined;
  const start =
    params.start ??
    raw.startDate ??
    raw.startTime ??
    raw.startDateTime ??
    raw.start_date ??
    raw.start_time ??
    raw.from ??
    raw.fromDate ??
    raw.from_date ??
    raw.date ??
    raw.appointmentDate ??
    raw.appointment_date ??
    dateRange?.start;
  let end: string | undefined =
    params.end ??
    raw.endDate ??
    raw.endTime ??
    raw.endDateTime ??
    raw.end_date ??
    raw.end_time ??
    raw.to ??
    raw.toDate ??
    raw.to_date ??
    dateRange?.end;
  if (start && !end) {
    const startDate = new Date(start);
    startDate.setDate(startDate.getDate() + 7);
    end = startDate.toISOString();
  }

  if (!start || !end) {
    throw new Error(
      'start (and end) dates are required in ISO 8601 UTC, e.g. start: "2026-02-09T00:00:00.000Z", end: "2026-02-16T00:00:00.000Z"',
    );
  }

  // Build Cal.com request
  const calComRequest: CalComAvailabilityRequest = {
    start: String(start),
    end: String(end),
    timeZone: params.timeZone || 'America/New_York',
  };

  // Use eventTypeId if provided, otherwise use slug + username (with defaults)
  if (params.eventTypeId) {
    calComRequest.eventTypeId = params.eventTypeId;
  } else {
    calComRequest.eventTypeSlug = params.eventTypeSlug || DEFAULT_CALCOM_EVENT_TYPE_SLUG;
    calComRequest.username = params.username || DEFAULT_CALCOM_USERNAME;
  }

  if (params.duration) {
    calComRequest.duration = params.duration;
  }

  // Fetch availability from Cal.com
  const result = await getAvailability(calComRequest);

  // Format response for Vapi
  const slots = result.data || {};
  const slotCount = Object.values(slots).reduce(
    (total: number, daySlots: any) => total + (Array.isArray(daySlots) ? daySlots.length : 0),
    0,
  );

  return {
    slots,
    message: `Found ${slotCount} available time slot(s)`,
  };
}
