# The Unbreakable Booker — Voice AI Receptionist (Tool Backend)

A production Node.js/Express + TypeScript backend that powers a **Voice AI Receptionist** for a dental office, built on [Vapi.ai](https://vapi.ai). It receives tool calls from Vapi during live **voice** (or **text-chat**) conversations and executes real actions — checking open slots, booking appointments, and sending SMS confirmations/reminders — backed by **Cal.com** scheduling and **Twilio** SMS.

> A patient calls or chats. The AI assistant checks real Cal.com availability, books the appointment, and texts a confirmation — end to end, no human needed.

## What it does

When Vapi's assistant needs to act mid-conversation, it calls `POST /vapi/webhook`, which routes to one of three tools:

- **check_availability** — returns real open slots from Cal.com for a date range
- **book_appointment** — creates a Cal.com booking and (optionally) texts an SMS confirmation
- **send_reminder** — sends an SMS appointment reminder via Twilio

It also handles Vapi `assistant-request` events and serves a `/chat` page with an embedded Vapi widget for **text-based** booking.

## Tech stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Voice platform:** Vapi.ai (server-to-server tool calls)
- **Scheduling:** Cal.com API v2
- **SMS:** Twilio
- **API docs:** Swagger / OpenAPI (swagger-ui-express)
- **Keep-alive:** node-cron
- **Deploy target:** Render

## Features

### Voice/chat tool backend (implemented)

- ✅ `POST /vapi/webhook` — handles both `tool-calls` and `assistant-request` messages
- ✅ Tool router with resilient parameter normalization (accepts the many param-name variants an LLM emits — `start`/`startTime`/`startDateTime`/`date`, etc.)
- ✅ **check_availability** — Cal.com slot lookup by `eventTypeId` or `eventTypeSlug` + username/team, timezone-aware, defaults a 7-day window
- ✅ **book_appointment** — Cal.com v2 booking + automatic SMS confirmation
- ✅ **send_reminder** — Twilio SMS reminder with a human-formatted date/time
- ✅ Per-tool error isolation — each call returns a result or an error without crashing the conversation turn
- ✅ SMS failures never fail a booking (logged; the booking still succeeds)

### Supporting

- ✅ `/chat` — embedded Vapi widget page for text booking (gated on env config)
- ✅ `/docs` + `/docs-json` — Swagger UI and raw OpenAPI spec
- ✅ `/health` — health check
- ✅ `/test/cal/availability`, `/test/sms` — isolated integration test endpoints
- ✅ Keep-alive cron (every 10 min) to prevent Render free-tier spin-down

## Project structure

```
unbreakable-booker/
├── src/
│   ├── integrations/
│   │   ├── calComClient.ts      # Cal.com API v2 client (availability + bookings)
│   │   └── twilioClient.ts      # Twilio SMS client
│   ├── tools/
│   │   ├── checkAvailabilityTool.ts
│   │   ├── bookAppointmentTool.ts
│   │   └── sendReminderTool.ts
│   ├── handlers/
│   │   └── vapiHandler.ts       # Routes Vapi tool-calls to the tools
│   ├── types/
│   │   └── vapi.ts              # Vapi message/response types
│   ├── config/
│   │   └── swagger.ts           # OpenAPI spec config
│   └── server.ts                # Express app, routes, cron, Swagger
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/vapi/webhook` | Vapi `tool-calls` + `assistant-request` handler (core) |
| GET | `/chat` | Embedded Vapi widget (text booking) |
| GET | `/docs`, `/docs-json` | Swagger UI / OpenAPI JSON |
| GET | `/health` | Health check |
| POST | `/test/cal/availability` | Test Cal.com availability directly |
| POST | `/test/sms` | Test Twilio SMS directly |

### The three Vapi tools

Tool names are accepted in snake_case or camelCase (`check_availability` / `checkAvailability`, etc.).

- **check_availability** — `{ start, end, eventTypeId? | (eventTypeSlug? + username?), timeZone?, duration? }` → open slots + a count message.
- **book_appointment** — `{ start, end? | duration?, patientName, patientPhone, patientEmail, eventTypeId? | (eventTypeSlug? + username?/teamSlug?), notes?, timeZone?, sendSmsConfirmation? }` → Cal.com booking + SMS confirmation.
- **send_reminder** — `{ patientPhone, appointmentTime, patientName?, customMessage?, timeZone? }` → Twilio SMS reminder.

## Getting started

### Prerequisites

- Node.js 18+
- Cal.com account + API key
- Twilio account (SID, auth token, from number)
- Vapi.ai assistant configured to call this backend's `/vapi/webhook`

### Install & run

```bash
npm install
cp .env.example .env   # fill in credentials
npm run dev            # http://localhost:3000
```

### Build for production

```bash
npm run build
npm start
```

## Environment variables

| Variable | Description | Required |
|---|---|---|
| `PORT` | Server port (default 3000) | No |
| `CALCOM_BASE_URL` | Cal.com API base (default `https://api.cal.com/v2`) | No |
| `CALCOM_API_KEY` | Cal.com API key | ✅ Yes |
| `CALCOM_USERNAME` | Default Cal.com username | No (has default) |
| `CALCOM_EVENT_TYPE_SLUG` | Default event type slug (e.g. `30min`) | No (has default) |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | ✅ Yes |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | ✅ Yes |
| `TWILIO_FROM_NUMBER` | Twilio phone number (E.164) | ✅ Yes |
| `VAPI_PUBLIC_KEY` | Vapi public key (for the `/chat` widget) | For `/chat` |
| `VAPI_ASSISTANT_ID` | Vapi assistant id | For `/chat` + `assistant-request` |
| `RENDER_EXTERNAL_URL` | Public URL used by the keep-alive ping | No |
| `NODE_ENV` | `production` makes the keep-alive ping use https | No |

## How it connects to Vapi

1. In your Vapi assistant, define the three tools (`check_availability`, `book_appointment`, `send_reminder`) with their server URL pointing at `https://<your-host>/vapi/webhook`.
2. During a call or chat, Vapi sends `tool-calls` to the webhook.
3. `vapiHandler` routes each call to the matching tool, executes it against Cal.com / Twilio, and returns the result for the assistant to speak back to the caller.

## License

MIT
