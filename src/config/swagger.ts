import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Unbreakable Booker API',
      version: '1.0.0',
      description:
        'Tool backend for The Unbreakable Booker – Vapi.ai Voice AI Receptionist for a dental office. Provides endpoints for appointment scheduling via Cal.com and SMS notifications via Twilio.',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'Test',
        description: 'Test endpoints for integrations',
      },
      {
        name: 'Vapi',
        description: 'Vapi.ai webhook endpoints',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Bearer token authentication (optional for Vapi webhook)',
        },
      },
    },
  },
  apis: ['./src/server.ts'], // Path to the API files
};

export const swaggerSpec = swaggerJsdoc(options);
