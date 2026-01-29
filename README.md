# The Unbreakable Booker - Tool Backend

A Node.js/Express TypeScript backend that serves as the **Tool Backend** for [Vapi.ai](https://vapi.ai), powering a Voice AI Receptionist for dental offices. This backend handles appointment scheduling via Cal.com and SMS notifications via Twilio.

## Overview

**The Unbreakable Booker** is a portfolio project demonstrating a Voice AI Receptionist system. When patients call, the AI assistant can:
- Check available appointment slots
- Book new appointments
- Send SMS confirmations and reminders

This backend acts as the integration layer between Vapi.ai's voice assistant and external services (Cal.com for scheduling, Twilio for SMS).

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Voice Platform:** Vapi.ai (Server-Server communication)
- **Scheduling:** Cal.com API v2
- **SMS:** Twilio API
- **Development:** ts-node-dev, TypeScript

## Features

### Current Implementation

- ✅ **Cal.com Integration**
  - Check available time slots for event types
  - Support for event type ID, slug + username, or team-based queries
  - Flexible date range queries with timezone support

- ✅ **Twilio SMS Integration**
  - Send SMS notifications
  - Confirmation messages for appointments
  - Reminder messages

- ✅ **Test Endpoints**
  - `/test/cal/availability` - Test Cal.com availability queries
  - `/test/sms` - Test SMS sending

### Planned Features (In Progress)

- 🔄 **Vapi Webhook Handler**
  - Handle incoming tool calls from Vapi.ai
  - Route tool calls to appropriate handlers

- 🔄 **Tool Handlers**
  - `checkAvailabilityTool` - Check available slots
  - `bookAppointmentTool` - Create bookings and send confirmations
  - `sendReminderTool` - Send SMS reminders

## Project Structure

```
unbreakable-booker/
├── src/
│   ├── integrations/
│   │   ├── calComClient.ts    # Cal.com API client
│   │   └── twilioClient.ts     # Twilio SMS client
│   └── server.ts               # Express server & routes
├── .env.example                # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- Cal.com account with API key
- Twilio account with credentials

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd unbreakable-booker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your credentials:
   ```env
   PORT=3000

   # Cal.com
   CALCOM_BASE_URL=https://api.cal.com/v2
   CALCOM_API_KEY=your-calcom-api-key-here

   # Twilio
   TWILIO_ACCOUNT_SID=your-twilio-account-sid-here
   TWILIO_AUTH_TOKEN=your-twilio-auth-token-here
   TWILIO_FROM_NUMBER=+10000000000
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

   The server will start on `http://localhost:3000`

### Building for Production

```bash
npm run build
npm start
```

## API Endpoints

### Health Check

**GET** `/health`

Returns server status.

**Response:**
```json
{
  "status": "ok",
  "service": "unbreakable-booker-tool-backend"
}
```

### Test Cal.com Availability

**POST** `/test/cal/availability`

Test the Cal.com availability integration.

**Request Body:**
```json
{
  "start": "2026-02-01T00:00:00.000Z",
  "end": "2026-02-07T00:00:00.000Z",
  "eventTypeSlug": "30min",
  "username": "your-calcom-username",
  "timeZone": "America/New_York"
}
```

**Query Options:**
- By `eventTypeId`: `{ "eventTypeId": 123, "start": "...", "end": "..." }`
- By `eventTypeSlug` + `username`: `{ "eventTypeSlug": "30min", "username": "user", "start": "...", "end": "..." }`
- By `eventTypeSlug` + `teamSlug`: `{ "eventTypeSlug": "team-event", "teamSlug": "team", "start": "...", "end": "..." }`

**Optional Parameters:**
- `timeZone`: Timezone for results (default: UTC)
- `duration`: Duration in minutes
- `format`: `"time"` or `"range"` (default: `"time"`)
- `organizationSlug`: For org-scoped queries

**Response:**
```json
{
  "status": "success",
  "data": {
    "2026-02-02": [
      { "start": "2026-02-02T09:00:00.000-05:00" },
      { "start": "2026-02-02T09:30:00.000-05:00" }
    ]
  }
}
```

### Test SMS Sending

**POST** `/test/sms`

Test the Twilio SMS integration.

**Request Body:**
```json
{
  "to": "+1234567890",
  "body": "Test SMS from Unbreakable Booker"
}
```

**Response:**
```json
{
  "message": "SMS sent successfully",
  "sid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3000) |
| `CALCOM_BASE_URL` | Cal.com API base URL | No (default: https://api.cal.com/v2) |
| `CALCOM_API_KEY` | Cal.com API key | Yes |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | Yes |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | Yes |
| `TWILIO_FROM_NUMBER` | Twilio phone number (E.164 format) | Yes |

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production build

### Code Structure

- **Integrations** (`src/integrations/`): External service clients (Cal.com, Twilio)
- **Server** (`src/server.ts`): Express app, routes, and middleware
- **Tools** (planned): Vapi tool handlers for voice interactions

## Integration with Vapi.ai

This backend is designed to be used as a **Tool Backend** for Vapi.ai. When configured:

1. Vapi.ai sends tool call requests to `POST /vapi/webhook`
2. Backend routes tool calls to appropriate handlers
3. Handlers execute actions (check availability, book appointments, send SMS)
4. Results are returned to Vapi.ai for voice response

**Note:** Vapi webhook integration is currently in development.

## Contributing

This is a portfolio project. Contributions and suggestions are welcome!

## License

MIT

## Acknowledgments

- [Vapi.ai](https://vapi.ai) - Voice AI platform
- [Cal.com](https://cal.com) - Scheduling infrastructure
- [Twilio](https://www.twilio.com) - SMS messaging
