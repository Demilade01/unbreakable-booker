import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import axios from 'axios';
import cron from 'node-cron';
import swaggerUi from 'swagger-ui-express';
import { getAvailability } from './integrations/calComClient';
import { sendSms } from './integrations/twilioClient';
import { handleVapiServerMessage } from './handlers/vapiHandler';
import { swaggerSpec } from './config/swagger';

dotenv.config();

const app: Application = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs-json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API service
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 service:
 *                   type: string
 *                   example: unbreakable-booker-tool-backend
 */
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'unbreakable-booker-tool-backend',
  });
});

// Chat page: Vapi widget in chat mode (text booking)
const publicKey = process.env.VAPI_PUBLIC_KEY || '';
const assistantId = process.env.VAPI_ASSISTANT_ID || '';

/**
 * @swagger
 * /chat:
 *   get:
 *     summary: Chat booking interface
 *     description: Returns an HTML page with an embedded Vapi.ai chat widget for users to book appointments via text chat. Requires VAPI_PUBLIC_KEY and VAPI_ASSISTANT_ID environment variables to be configured.
 *     tags: [Chat]
 *     responses:
 *       200:
 *         description: Chat interface page loaded successfully
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html>...</html>"
 */
app.get('/chat', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!publicKey || !assistantId) {
    res.status(200).send(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>Chat</title></head>
      <body style="font-family:sans-serif;padding:2rem;">
        <h1>Chat not configured</h1>
        <p>Set VAPI_PUBLIC_KEY and VAPI_ASSISTANT_ID in your environment, then restart the server.</p>
      </body></html>
    `);
    return;
  }
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Book with us – Chat</title>
</head>
<body>
  <div style="max-width:600px;margin:2rem auto;font-family:sans-serif;">
    <h1>Book an appointment</h1>
    <p>Use the chat button below to check availability, book, or get a reminder.</p>
  </div>
  <script src="https://unpkg.com/@vapi-ai/client-sdk-react/dist/embed/widget.umd.js" async type="text/javascript"></script>
  <vapi-widget
    public-key="${publicKey.replace(/"/g, '&quot;')}"
    assistant-id="${assistantId.replace(/"/g, '&quot;')}"
    mode="chat"
    theme="light"
    size="full"
  ></vapi-widget>
</body>
</html>
  `);
});

/**
 * @swagger
 * /test/cal/availability:
 *   post:
 *     summary: Test Cal.com availability integration
 *     description: Test endpoint to check available time slots from Cal.com for a given date range
 *     tags: [Test]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - start
 *               - end
 *             properties:
 *               start:
 *                 type: string
 *                 format: date-time
 *                 description: Start date/time in ISO 8601 format (UTC)
 *                 example: "2026-02-01T00:00:00.000Z"
 *               end:
 *                 type: string
 *                 format: date-time
 *                 description: End date/time in ISO 8601 format (UTC)
 *                 example: "2026-02-07T00:00:00.000Z"
 *               eventTypeId:
 *                 type: integer
 *                 description: Cal.com event type ID
 *                 example: 123
 *               eventTypeSlug:
 *                 type: string
 *                 description: Event type slug (requires username)
 *                 example: "30min"
 *               username:
 *                 type: string
 *                 description: Cal.com username (required if using eventTypeSlug)
 *                 example: "devbyte-9rm9zq"
 *               organizationSlug:
 *                 type: string
 *                 description: Organization slug (optional)
 *               teamSlug:
 *                 type: string
 *                 description: Team slug (for team event types)
 *               timeZone:
 *                 type: string
 *                 description: Timezone for results
 *                 example: "America/New_York"
 *               duration:
 *                 type: integer
 *                 description: Duration in minutes
 *                 example: 30
 *               format:
 *                 type: string
 *                 enum: [time, range]
 *                 description: Format of slot times
 *                 example: "time"
 *     responses:
 *       200:
 *         description: Successfully retrieved availability
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         start:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Bad request - missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "start and end are required (ISO strings in UTC)."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch availability from Cal.com"
 *                 details:
 *                   type: object
 */
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

/**
 * @swagger
 * /test/sms:
 *   post:
 *     summary: Test Twilio SMS integration
 *     description: Test endpoint to send an SMS message via Twilio
 *     tags: [Test]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - body
 *             properties:
 *               to:
 *                 type: string
 *                 description: Recipient phone number in E.164 format
 *                 example: "+1234567890"
 *               body:
 *                 type: string
 *                 description: SMS message content
 *                 example: "Test SMS from Unbreakable Booker"
 *     responses:
 *       200:
 *         description: SMS sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "SMS sent successfully"
 *                 sid:
 *                   type: string
 *                   description: Twilio message SID
 *                   example: "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
 *       400:
 *         description: Bad request - missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "`to` and `body` are required."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to send SMS via Twilio"
 *                 details:
 *                   type: string
 */
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

/**
 * @swagger
 * /vapi/webhook:
 *   post:
 *     summary: Vapi.ai webhook endpoint
 *     description: Receives tool call requests from Vapi.ai during voice conversations. This endpoint handles tool-calls messages and routes them to appropriate handlers (check_availability, book_appointment, send_reminder).
 *     tags: [Vapi]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     example: "tool-calls"
 *                   toolCalls:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "call_123"
 *                         name:
 *                           type: string
 *                           example: "check_availability"
 *                         parameters:
 *                           type: object
 *                           example:
 *                             start: "2026-02-01T00:00:00.000Z"
 *                             end: "2026-02-07T00:00:00.000Z"
 *                             eventTypeSlug: "30min"
 *                             username: "devbyte-9rm9zq"
 *     responses:
 *       200:
 *         description: Tool call processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: object
 *                   properties:
 *                     toolCalls:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           result:
 *                             type: object
 *                           error:
 *                             type: string
 *       400:
 *         description: Invalid message format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid message format"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 *                 details:
 *                   type: string
 */
app.post('/vapi/webhook', handleVapiServerMessage);

// Fallback route (optional, for now just 404 JSON)
app.use('*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// Keep-alive task to prevent Render spin-down
// Runs every 10 minutes and pings the health endpoint
const keepAliveInterval = 10; // minutes
cron.schedule(`*/${keepAliveInterval} * * * *`, async () => {
  try {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const baseUrl = process.env.RENDER_EXTERNAL_URL || `${protocol}://localhost:${PORT}`;
    await axios.get(`${baseUrl}/health`);
    // eslint-disable-next-line no-console
    console.log('[Keep-Alive] Health check ping successful');
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('[Keep-Alive] Health check ping failed:', error?.message);
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Unbreakable Booker backend listening on port ${PORT}`);
});

