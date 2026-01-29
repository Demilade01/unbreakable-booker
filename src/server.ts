import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { getAvailability } from './integrations/calComClient';
import { sendSms } from './integrations/twilioClient';

dotenv.config();

const app: Application = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'unbreakable-booker-tool-backend',
  });
});

// Test endpoint to check Cal.com availability integration
app.post('/test/cal/availability', async (req: Request, res: Response) => {
  try {
    const {
      start,
      end,
      eventTypeId,
      eventTypeSlug,
      username,
      organizationSlug,
      teamSlug,
      timeZone,
      duration,
      format,
    } = req.body ?? {};

    if (!start || !end) {
      return res.status(400).json({
        error: 'start and end are required (ISO strings in UTC).',
      });
    }

    // Validate that at least one identifier method is provided
    if (!eventTypeId && !(eventTypeSlug && (username || teamSlug))) {
      return res.status(400).json({
        error:
          'Either eventTypeId OR (eventTypeSlug + username) OR (eventTypeSlug + teamSlug) must be provided.',
      });
    }

    const availability = await getAvailability({
      start,
      end,
      eventTypeId,
      eventTypeSlug,
      username,
      organizationSlug,
      teamSlug,
      timeZone,
      duration,
      format,
    });

    return res.status(200).json(availability);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Error fetching Cal.com availability', error?.response?.data || error);
    return res.status(500).json({
      error: 'Failed to fetch availability from Cal.com',
      details: error?.response?.data ?? undefined,
    });
  }
});

// Test endpoint to send SMS via Twilio
app.post('/test/sms', async (req: Request, res: Response) => {
  try {
    const { to, body } = req.body ?? {};

    if (!to || !body) {
      return res.status(400).json({
        error: '`to` and `body` are required.',
      });
    }

    const result = await sendSms({ to, body });

    return res.status(200).json({
      message: 'SMS sent successfully',
      sid: result.sid,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Error sending SMS via Twilio', error);
    return res.status(500).json({
      error: 'Failed to send SMS via Twilio',
      details: error?.message ?? String(error),
    });
  }
});

// Fallback route (optional, for now just 404 JSON)
app.use('*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Unbreakable Booker backend listening on port ${PORT}`);
});

