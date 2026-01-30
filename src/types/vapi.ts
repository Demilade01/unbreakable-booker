// Vapi.ai Server Message Types

export interface VapiServerMessage {
  message: {
    type: string;
    call?: {
      id: string;
      orgId?: string;
      customer?: {
        number?: string;
      };
    };
    toolCalls?: VapiToolCall[];
    [key: string]: any;
  };
}

export interface VapiToolCall {
  id: string;
  name?: string;
  parameters?: Record<string, any>;
  /** VAPI may send tool name as function (string or object with name) */
  function?: string | { name?: string };
  /** Some clients send arguments instead of parameters */
  arguments?: Record<string, any>;
}

export interface VapiToolCallResult {
  id: string;
  result?: any;
  error?: string;
}

export interface VapiServerResponse {
  message: {
    toolCalls?: VapiToolCallResult[];
  };
}
