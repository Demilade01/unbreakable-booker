# Testing Guide for Unbreakable Booker Backend

## Quick Start Testing

### 1. Start Your Server
```bash
npm run dev
```

Your server should start on `http://localhost:3000`

---

## Testing Methods

### Method 1: Swagger UI (Easiest - Recommended)

1. **Open Swagger UI:**
   - Go to: `http://localhost:3000/docs`
   - You'll see all your endpoints with interactive testing

2. **Test Health Check:**
   - Click on `GET /health`
   - Click "Try it out" → "Execute"
   - Should return: `{"status":"ok","service":"unbreakable-booker-tool-backend"}`

3. **Test Cal.com Availability:**
   - Click on `POST /test/cal/availability`
   - Click "Try it out"
   - Paste this in the Request body:
     ```json
     {
       "start": "2026-02-01T00:00:00.000Z",
       "end": "2026-02-07T00:00:00.000Z",
       "eventTypeSlug": "30min",
       "username": "devbyte-9rm9zq",
       "timeZone": "America/New_York"
     }
     ```
   - Click "Execute"
   - Should return available time slots

4. **Test SMS:**
   - Click on `POST /test/sms`
   - Click "Try it out"
   - Paste this (use YOUR phone number):
     ```json
     {
       "to": "+1234567890",
       "body": "Test SMS from Unbreakable Booker"
     }
     ```
   - Click "Execute"
   - Should return: `{"message":"SMS sent successfully","sid":"SM..."}`

---

### Method 2: Test Vapi Webhook Directly

**Using curl:**
```bash
curl -X POST http://localhost:3000/vapi/webhook \
  -H "Content-Type: application/json" \
  -d @test-vapi-webhook.json
```

**Using Postman:**
1. Create new POST request
2. URL: `http://localhost:3000/vapi/webhook`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
   ```json
   {
     "message": {
       "type": "tool-calls",
       "toolCalls": [
         {
           "id": "test_call_123",
           "name": "check_availability",
           "parameters": {
             "start": "2026-02-01T00:00:00.000Z",
             "end": "2026-02-07T00:00:00.000Z",
             "eventTypeSlug": "30min",
             "username": "devbyte-9rm9zq",
             "timeZone": "America/New_York"
           }
         }
       ]
     }
   }
   ```
5. Send request
6. Should return tool results

---

### Method 3: Test Through Vapi (Real Integration)

1. **Make sure your backend is running:**
   ```bash
   npm run dev
   ```

2. **Make sure your dev tunnel is active:**
   - Your URL: `https://msj3gt50-3000.usw3.devtunnels.ms`
   - This should forward to `localhost:3000`

3. **In Vapi Dashboard:**
   - Tools are configured: ✅
   - Server URL is set: ✅
   - Credential is selected: ✅

4. **Make a test call:**
   - Use Vapi phone number or web interface
   - Say: **"I'd like to check available appointments for next week"**
   - Vapi should call your `check_availability` tool

5. **Watch your server logs:**
   - You should see: `POST /vapi/webhook`
   - Tool call being processed
   - Response being sent

---

## What to Look For

### ✅ Success Signs:
- Server logs show incoming requests
- Responses return 200 status
- Tool results are returned correctly
- SMS actually sends (check your phone)

### ❌ Common Issues:

**"Cannot connect" or timeout:**
- Check if dev tunnel is running
- Verify server is running (`npm run dev`)
- Check firewall/network settings

**"Invalid message format":**
- Check request body structure
- Verify `message.type` is `"tool-calls"`
- Verify `toolCalls` array exists

**"Unknown tool":**
- Verify tool name matches exactly:
  - `check_availability` ✅
  - `book_appointment` ✅
  - `send_reminder` ✅

**Cal.com errors:**
- Check `.env` has `CALCOM_API_KEY`
- Verify event type slug/username are correct
- Check Cal.com API is accessible

**Twilio errors:**
- Check `.env` has Twilio credentials
- Verify phone number format (E.164: +1234567890)
- Check Twilio account has credits

---

## Test Payloads

### Test check_availability:
```json
{
  "message": {
    "type": "tool-calls",
    "toolCalls": [{
      "id": "test_1",
      "name": "check_availability",
      "parameters": {
        "start": "2026-02-01T00:00:00.000Z",
        "end": "2026-02-07T00:00:00.000Z",
        "eventTypeSlug": "30min",
        "username": "devbyte-9rm9zq"
      }
    }]
  }
}
```

### Test book_appointment:
```json
{
  "message": {
    "type": "tool-calls",
    "toolCalls": [{
      "id": "test_2",
      "name": "book_appointment",
      "parameters": {
        "start": "2026-02-02T09:00:00.000Z",
        "end": "2026-02-02T09:30:00.000Z",
        "eventTypeId": 123,
        "patientName": "John Doe",
        "patientPhone": "+1234567890",
        "patientEmail": "john@example.com"
      }
    }]
  }
}
```

### Test send_reminder:
```json
{
  "message": {
    "type": "tool-calls",
    "toolCalls": [{
      "id": "test_3",
      "name": "send_reminder",
      "parameters": {
        "patientPhone": "+1234567890",
        "appointmentTime": "2026-02-02T09:00:00.000Z",
        "patientName": "John Doe"
      }
    }]
  }
}
```

---

## Need Help?

1. **Check server logs** - They show what's happening
2. **Test endpoints individually** - Use Swagger UI first
3. **Verify environment variables** - Check `.env` file
4. **Test Vapi webhook last** - After direct endpoints work
