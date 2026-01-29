import { getAvailability, CalComAvailabilityRequest } from '../integrations/calComClient';

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
  // Validate required params
  if (!params.start || !params.end) {
    throw new Error('start and end dates are required');
  }

  // Build Cal.com request
  const calComRequest: CalComAvailabilityRequest = {
    start: params.start,
    end: params.end,
    timeZone: params.timeZone || 'America/New_York',
  };

  // Use eventTypeId if provided, otherwise use slug + username
  if (params.eventTypeId) {
    calComRequest.eventTypeId = params.eventTypeId;
  } else if (params.eventTypeSlug && params.username) {
    calComRequest.eventTypeSlug = params.eventTypeSlug;
    calComRequest.username = params.username;
  } else {
    throw new Error('Either eventTypeId OR (eventTypeSlug + username) must be provided');
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
