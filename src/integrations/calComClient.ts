import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

// Load env vars here to ensure they're available when this module loads
dotenv.config();

const CALCOM_BASE_URL = process.env.CALCOM_BASE_URL || 'https://api.cal.com/v2';
const CALCOM_API_KEY = process.env.CALCOM_API_KEY;

if (!CALCOM_API_KEY) {
  // In dev we just warn; real calls will fail loudly if not set.
  // eslint-disable-next-line no-console
  console.warn('[calComClient] CALCOM_API_KEY is not set. Cal.com calls will fail until configured.');
}

const client: AxiosInstance = axios.create({
  baseURL: CALCOM_BASE_URL,
  headers: {
    Authorization: CALCOM_API_KEY ? `Bearer ${CALCOM_API_KEY}` : '',
    'Content-Type': 'application/json',
    'cal-api-version': '2024-09-04', // Required header for Cal.com API v2
  },
  timeout: 10_000,
});

export interface CalComAvailabilityRequest {
  start: string; // ISO string (UTC)
  end: string; // ISO string (UTC)
  // Option 1: Query by event type ID
  eventTypeId?: number | string;
  // Option 2: Query by event type slug + username
  eventTypeSlug?: string;
  username?: string;
  organizationSlug?: string; // Optional, for org-scoped event types
  // Option 3: Query by team event type slug + team slug
  teamSlug?: string;
  // Common optional params
  timeZone?: string;
  duration?: number; // Optional duration in minutes
  format?: 'time' | 'range'; // Format of slot times
}

export async function getAvailability(params: CalComAvailabilityRequest) {
  const queryParams = new URLSearchParams({
    start: params.start,
    end: params.end,
  });

  // Query by eventTypeId (highest priority)
  if (params.eventTypeId) {
    queryParams.append('eventTypeId', String(params.eventTypeId));
  }
  // Query by eventTypeSlug + username
  else if (params.eventTypeSlug && params.username) {
    queryParams.append('eventTypeSlug', params.eventTypeSlug);
    queryParams.append('username', params.username);
    if (params.organizationSlug) {
      queryParams.append('organizationSlug', params.organizationSlug);
    }
  }
  // Query by team event type slug + team slug
  else if (params.eventTypeSlug && params.teamSlug) {
    queryParams.append('eventTypeSlug', params.eventTypeSlug);
    queryParams.append('teamSlug', params.teamSlug);
    if (params.organizationSlug) {
      queryParams.append('organizationSlug', params.organizationSlug);
    }
  }

  if (params.timeZone) {
    queryParams.append('timeZone', params.timeZone);
  }

  if (params.duration) {
    queryParams.append('duration', String(params.duration));
  }

  if (params.format) {
    queryParams.append('format', params.format);
  }

  const response = await client.get(`/slots?${queryParams.toString()}`);

  return response.data;
}

