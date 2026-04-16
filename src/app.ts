import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import mongoose from "mongoose";
import routes from "./routes";
import { errorHandler } from "./middlewares/error.middleware";
import morgan from "morgan";
import { ROUTES } from "./utils/constants/routes";
import { globalAuthMiddleware } from "./config/global-auth.config";

// Express application factory function - sets up all middleware and routes
const createApp = (): express.Application => {
  const app = express();

  // Security middleware
  app.use(helmet());
  // CORS configuration - allow all origins
  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
      optionsSuccessStatus: 200,
    }),
  );
  app.use(compression());

  // Body parsing middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Logger
  if (process.env.NODE_ENV === "development") {
    app.use(morgan("dev"));
  }

  // Global authentication middleware with tenantId and role validation
  // baseMiddleware handles JWT authentication, validationMiddleware handles tenantId and role validation
  app.use(globalAuthMiddleware);

  // Health check endpoint (root level)
  app.get("/health", (req, res) => {
    const isDatabaseConnected = mongoose.connection.readyState === 1;

    res.json({
      success: true,
      message: "Academy API is running",
      timestamp: new Date().toISOString(),
      service: "academy-api",
      environment: process.env.NODE_ENV || "development",
      port: process.env.PORT || "3002",
      host: "0.0.0.0",
      database: {
        connected: isDatabaseConnected,
        status: isDatabaseConnected ? "healthy" : "disconnected",
      },
      status: isDatabaseConnected ? "healthy" : "degraded",
    });
  });

  // Debug endpoint for troubleshooting
  app.get("/debug", (req, res) => {
    res.json({
      success: true,
      message: "Debug information",
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        MONGODB_URI: process.env.MONGODB_URI ? "Set" : "Not set",
        JWT_SECRET: process.env.JWT_SECRET ? "Set" : "Not set",
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
        USER_API_URL: process.env.USER_API_URL,
      },
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      },
      service: "academy-api",
    });
  });

  // Routes with service-specific base path
  app.use(ROUTES.BASE, routes);

  // Internal API routes mounted at /academy/internal (separate from versioned API)
  // Import internal routes directly for separate mounting
  const internalRoutes = require("./routes/internal.routes").default;
  app.use(ROUTES.INTERNAL, internalRoutes);

  // Error handling middleware
  app.use(errorHandler);

  return app;
};

export default createApp;
