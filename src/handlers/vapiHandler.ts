import { Request, Response } from 'express';
import { VapiServerMessage, VapiServerResponse, VapiToolCallResult } from '../types/vapi';
import { checkAvailabilityTool, type CheckAvailabilityToolParams } from '../tools/checkAvailabilityTool';
import { bookAppointmentTool, type BookAppointmentToolParams } from '../tools/bookAppointmentTool';
import { sendReminderTool, type SendReminderToolParams } from '../tools/sendReminderTool';

export async function handleVapiServerMessage(req: Request, res: Response): Promise<void> {
  try {
    const body: VapiServerMessage = req.body;

    // Validate message structure
    if (!body?.message) {
      res.status(400).json({ error: 'Invalid message format' });
      return;
    }

    const messageType = body.message.type;

    // Handle assistant-request: return assistant config so Vapi uses our assistant
    if (messageType === 'assistant-request') {
      const assistantId = process.env.VAPI_ASSISTANT_ID;
      if (!assistantId) {
        // eslint-disable-next-line no-console
        console.warn('VAPI_ASSISTANT_ID not set; Vapi may fall back to dashboard default.');
      }
      res.status(200).json({ assistantId: assistantId || undefined });
      return;
    }

    // Handle tool-calls message (the only one that requires a response)
    if (messageType === 'tool-calls' && body.message.toolCalls) {
      const toolCalls = body.message.toolCalls;
      const toolResults: VapiToolCallResult[] = [];

      // Process each tool call
      for (const toolCall of toolCalls) {
        // VAPI may send tool name as "name" or as "function" (object with name or string)
        const toolName =
          toolCall.name ??
          (typeof toolCall.function === 'string' ? toolCall.function : toolCall.function?.name);
        
        // Parameters can be in multiple places depending on Vapi's format:
        // - toolCall.parameters (older format)
        // - toolCall.arguments (alternative)
        // - toolCall.function.arguments (OpenAI-style format used by Vapi)
        let params = 
          toolCall.parameters ?? 
          toolCall.arguments ?? 
          (typeof toolCall.function === 'object' ? toolCall.function?.arguments : undefined) ??
          {};
        
        if (typeof params === 'string') {
          try {
            params = JSON.parse(params) as Record<string, unknown>;
          } catch {
            params = {};
          }
        }
        if (!toolName || typeof toolName !== 'string') {
          toolResults.push({
            id: toolCall.id,
            error: `Missing or invalid tool name in request. Received: ${JSON.stringify(toolCall)}`,
          });
          continue;
        }
        try {
          const result = await executeToolCall(toolName, params);
          toolResults.push({
            id: toolCall.id,
            result,
          });
        } catch (error: any) {
          // Log error but still respond to Vapi
          // eslint-disable-next-line no-console
          console.error(`Error executing tool ${toolName}:`, error);
          toolResults.push({
            id: toolCall.id,
            error: error?.message || String(error),
          });
        }
      }

      // Return tool call results
      const response: VapiServerResponse = {
        message: {
          toolCalls: toolResults,
        },
      };

      res.status(200).json(response);
      return;
    }

    // For other message types, just acknowledge (most don't require responses)
    res.status(200).json({ ok: true });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Error handling Vapi server message:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error?.message,
    });
  }
}

async function executeToolCall(toolName: string, parameters: Record<string, any>): Promise<any> {
  switch (toolName) {
    case 'check_availability':
    case 'checkAvailability':
      return await checkAvailabilityTool(parameters as CheckAvailabilityToolParams);

    case 'book_appointment':
    case 'bookAppointment':
      return await bookAppointmentTool(parameters as BookAppointmentToolParams);

    case 'send_reminder':
    case 'sendReminder':
      return await sendReminderTool(parameters as SendReminderToolParams);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
