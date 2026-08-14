import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Application } from "express";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Bayanihan Bank IT Service Desk API",
      version: "1.0.0",
      description:
        "API documentation for the Bayanihan Bank IT Service Desk ticketing system",
      contact: {
        name: "Bayanihan Bank IT Team",
        email: "it-support@bayanihanbank.com",
      },
    },
    servers: [
      {
        url: "http://localhost:3001/api",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            username: { type: "string" },
            name: { type: "string" },
            role: {
              type: "string",
              enum: ["BRANCH_USER", "IT_STAFF", "ADMINISTRATOR", "AUDITOR"],
            },
            email: { type: "string" },
            branchId: { type: "string", nullable: true },
            isActive: { type: "boolean" },
            mustChangePassword: { type: "boolean" },
            passwordResetRequested: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Ticket: {
          type: "object",
          properties: {
            id: { type: "string" },
            subject: { type: "string" },
            description: { type: "string" },
            category: { type: "string" },
            subcategory: { type: "string" },
            status: {
              type: "string",
              enum: [
                "Pending",
                "Assigned",
                "In Progress",
                "Resolved",
                "Closed",
              ],
            },
            priority: {
              type: "string",
              enum: ["Low", "Medium", "High", "Critical"],
            },
            branchId: { type: "string" },
            requesterId: { type: "string" },
            assignedToId: { type: "string", nullable: true },
            attachmentName: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            resolvedAt: { type: "string", format: "date-time", nullable: true },
            closedAt: { type: "string", format: "date-time", nullable: true },
          },
        },
        Branch: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            location: { type: "string" },
            code: { type: "string", nullable: true },
            status: { type: "string", enum: ["Active", "Inactive"] },
            userCount: { type: "number" },
          },
        },
        Comment: {
          type: "object",
          properties: {
            id: { type: "string" },
            ticketId: { type: "string" },
            authorId: { type: "string" },
            content: { type: "string" },
            isInternal: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            token: { type: "string" },
            user: { $ref: "#/components/schemas/User" },
          },
        },
        StateResponse: {
          type: "object",
          properties: {
            users: {
              type: "array",
              items: { $ref: "#/components/schemas/User" },
            },
            tickets: {
              type: "array",
              items: { $ref: "#/components/schemas/Ticket" },
            },
            branches: {
              type: "array",
              items: { $ref: "#/components/schemas/Branch" },
            },
            categories: { type: "array", items: { type: "object" } },
            comments: {
              type: "array",
              items: { $ref: "#/components/schemas/Comment" },
            },
            notifications: { type: "array", items: { type: "object" } },
            timeline: { type: "array", items: { type: "object" } },
            auditLogs: { type: "array", items: { type: "object" } },
            currentUser: { $ref: "#/components/schemas/User" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/auth/login": {
        post: {
          summary: "User login",
          tags: ["Authentication"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["username", "password"],
                  properties: {
                    username: { type: "string" },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Login successful",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AuthResponse" },
                },
              },
            },
            "401": {
              description: "Invalid credentials",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
            "429": {
              description: "Too many login attempts",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/auth/demo-accounts": {
        get: {
          summary: "Get demo accounts (development only)",
          tags: ["Authentication"],
          security: [],
          responses: {
            "200": {
              description: "List of demo accounts",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      users: {
                        type: "array",
                        items: { $ref: "#/components/schemas/User" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/auth/reset-request": {
        post: {
          summary: "Request password reset",
          tags: ["Authentication"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["username"],
                  properties: {
                    username: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Reset request submitted or requires recovery key",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      requiresRecoveryKey: { type: "boolean" },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
            "404": {
              description: "Account not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/auth/admin-recovery": {
        post: {
          summary: "Admin recovery with recovery key",
          tags: ["Authentication"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["username", "key"],
                  properties: {
                    username: { type: "string" },
                    key: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Admin password reset with one-time password",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      oneTimePassword: { type: "string" },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
            "403": {
              description: "Invalid recovery key or credentials",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/auth/password": {
        patch: {
          summary: "Change password",
          tags: ["Authentication"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["currentPassword", "newPassword"],
                  properties: {
                    currentPassword: { type: "string" },
                    newPassword: { type: "string", minLength: 6 },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Password changed successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid current password or new password too short",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/auth/me": {
        get: {
          summary: "Get current user info",
          tags: ["Authentication"],
          responses: {
            "200": {
              description: "Current user",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/state": {
        get: {
          summary: "Get full application state (role-filtered)",
          tags: ["State"],
          responses: {
            "200": {
              description: "Application state",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/StateResponse" },
                },
              },
            },
          },
        },
      },
      "/tickets": {
        get: {
          summary: "List tickets with optional filters",
          tags: ["Tickets"],
          parameters: [
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "branchId", in: "query", schema: { type: "string" } },
            { name: "assignedToId", in: "query", schema: { type: "string" } },
            { name: "requesterId", in: "query", schema: { type: "string" } },
            { name: "category", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "List of tickets",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      tickets: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Ticket" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: "Create a new ticket",
          tags: ["Tickets"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["subject", "description", "category"],
                  properties: {
                    subject: { type: "string", maxLength: 200 },
                    description: { type: "string", maxLength: 10000 },
                    category: { type: "string", maxLength: 100 },
                    subcategory: { type: "string", maxLength: 300 },
                    attachmentName: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Created ticket",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ticket: { $ref: "#/components/schemas/Ticket" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/tickets/{id}": {
        get: {
          summary: "Get ticket by ID",
          tags: ["Tickets"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Ticket details",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ticket: { $ref: "#/components/schemas/Ticket" },
                    },
                  },
                },
              },
            },
            "404": {
              description: "Ticket not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/tickets/{id}/status": {
        patch: {
          summary: "Update ticket status",
          tags: ["Tickets"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["newStatus"],
                  properties: {
                    newStatus: {
                      type: "string",
                      enum: [
                        "Pending",
                        "Assigned",
                        "In Progress",
                        "Resolved",
                        "Closed",
                      ],
                    },
                    notes: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated ticket",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ticket: { $ref: "#/components/schemas/Ticket" },
                    },
                  },
                },
              },
            },
            "404": {
              description: "Ticket not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/tickets/{id}/assign": {
        patch: {
          summary: "Assign ticket to IT staff",
          tags: ["Tickets"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["staffUserId"],
                  properties: {
                    staffUserId: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Assigned ticket",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ticket: { $ref: "#/components/schemas/Ticket" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid staff user",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
            "404": {
              description: "Ticket not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/tickets/{id}/comments": {
        get: {
          summary: "Get ticket comments",
          tags: ["Tickets"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "List of comments",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      comments: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Comment" },
                      },
                    },
                  },
                },
              },
            },
            "404": {
              description: "Ticket not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
        post: {
          summary: "Add comment to ticket",
          tags: ["Tickets"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["content"],
                  properties: {
                    content: { type: "string", maxLength: 10000 },
                    isInternal: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Created comment",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      comment: { $ref: "#/components/schemas/Comment" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Content is required",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/users": {
        get: {
          summary: "List users (role-filtered)",
          tags: ["Users"],
          responses: {
            "200": {
              description: "List of users",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      users: {
                        type: "array",
                        items: { $ref: "#/components/schemas/User" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: "Create new user (admin only)",
          tags: ["Users"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["username", "name", "role", "email"],
                  properties: {
                    username: { type: "string", minLength: 3, maxLength: 50 },
                    name: { type: "string", minLength: 1, maxLength: 100 },
                    role: {
                      type: "string",
                      enum: [
                        "BRANCH_USER",
                        "IT_STAFF",
                        "ADMINISTRATOR",
                        "AUDITOR",
                      ],
                    },
                    email: { type: "string", format: "email" },
                    branchId: { type: "string" },
                    password: { type: "string", minLength: 6 },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Created user",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
            "403": {
              description: "Admin access required",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/branches": {
        get: {
          summary: "List all branches",
          tags: ["Branches"],
          responses: {
            "200": {
              description: "List of branches",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      branches: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Branch" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: "Create new branch (admin only)",
          tags: ["Branches"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "location"],
                  properties: {
                    name: { type: "string", minLength: 1, maxLength: 100 },
                    location: { type: "string", minLength: 1, maxLength: 200 },
                    code: { type: "string", maxLength: 20 },
                    status: {
                      type: "string",
                      enum: ["Active", "Inactive"],
                      default: "Active",
                    },
                    userCount: { type: "number", minimum: 0 },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Created branch",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      branch: { $ref: "#/components/schemas/Branch" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
            "403": {
              description: "Admin access required",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/categories": {
        get: {
          summary: "List all categories",
          tags: ["Categories"],
          responses: {
            "200": {
              description: "List of categories",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      categories: { type: "array", items: { type: "object" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/notifications": {
        get: {
          summary: "Get user notifications",
          tags: ["Notifications"],
          responses: {
            "200": {
              description: "List of notifications",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      notifications: {
                        type: "array",
                        items: { type: "object" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/audit-logs": {
        get: {
          summary: "Get audit logs (admin/IT/auditor only)",
          tags: ["Audit"],
          responses: {
            "200": {
              description: "List of audit logs",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      auditLogs: { type: "array", items: { type: "object" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/health": {
        get: {
          summary: "Health check",
          tags: ["System"],
          security: [],
          responses: {
            "200": {
              description: "Service is healthy",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/events": {
        get: {
          summary: "Server-Sent Events stream for real-time updates",
          tags: ["System"],
          security: [],
          parameters: [
            {
              name: "token",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "SSE stream",
              content: {
                "text/event-stream": {
                  schema: { type: "string" },
                },
              },
            },
            "401": {
              description: "Invalid or expired token",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJSDoc(options);

export function setupSwagger(app: Application): void {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "Bayanihan Bank IT Service Desk API",
    }),
  );

  // JSON endpoint
  app.get("/api-docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}
