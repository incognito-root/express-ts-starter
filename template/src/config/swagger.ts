import { Express } from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

import { getEnv } from "../config/env";
// @feature:versioning
import { CURRENT_VERSION } from "../config/versions";
// @end:versioning

const env = getEnv();

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "{{PROJECT_NAME}} API Documentation",
      version: env.APP_VERSION,
      // @feature:versioning
      description:
        `{{PROJECT_NAME}} Backend API — current API version: **${CURRENT_VERSION}**.\n\n` +
        "All versioned endpoints respond with an `X-API-Version` header. " +
        "See `docs/api-versioning.md` for the deprecation and migration policy.",
      // @end:versioning
      // @feature:!versioning
      description: "{{PROJECT_NAME}} Backend API",
      // @end:!versioning
      contact: {
        name: "{{PROJECT_NAME}} Team",
        email: "support@yourdomain.com",
      },
      license: {
        name: "ISC",
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: "Development server",
      },
      {
        url: "{{PRODUCTION_URL}}",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "accessToken",
          description: "JWT access token stored in httpOnly cookie",
        },
        refreshCookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "refreshToken",
          description:
            "JWT refresh token stored in httpOnly cookie (auto-refresh enabled)",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "error",
            },
            message: {
              type: "string",
              example: "Error message",
            },
            errorId: {
              type: "string",
              format: "uuid",
            },
          },
        },
        SuccessResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "success",
            },
            data: {
              type: "object",
            },
            message: {
              type: "string",
            },
            metadata: {
              type: "object",
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User authentication and authorization endpoints",
      },
      {
        name: "Health",
        description: "System health and readiness checks",
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "{{PROJECT_NAME}} API Docs",
    })
  );

  app.get("/api-docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}
