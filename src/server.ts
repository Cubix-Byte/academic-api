import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

import createApp from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { checkAndUpdateExpiredTrials } from "./jobs/trialExpiryCheck.job";
import cron from "node-cron";
import { initSocket } from "./socket";

/**
 * Server Startup
 *
 * Initializes database connection and starts the Express server
 * Handles graceful shutdown on process termination
 */
const PORT = parseInt(process.env.PORT || "3003", 10);
const NODE_ENV = process.env.NODE_ENV || "development";

// Global error handlers
process.on("uncaughtException", (error: Error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  await disconnectDatabase();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received. Shutting down gracefully...");
  await disconnectDatabase();
  process.exit(0);
});

// Start server
const startServer = async (): Promise<void> => {
  try {
    // Create Express app first
    const app = createApp();

    // Start Express server - bind to 0.0.0.0 for Railway deployment
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log("🚀 Academy API Server Started");
      console.log(`📡 Port: ${PORT}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`🔗 Base URL: http://0.0.0.0:${PORT}/academy/api/v1`);
      console.log(`🔧 Internal API: http://0.0.0.0:${PORT}/academy/internal`);
      console.log("✅ Ready to accept requests");
    });

    // Initialize Socket.io
    initSocket(server);
    console.log("🔌 Socket.io initialized");

    // Handle server errors
    server.on("error", (error: any) => {
      if (error.code === "EADDRINUSE") {
        console.error(`❌ Port ${PORT} is already in use`);
      } else {
        console.error("❌ Server error:", error);
      }
      process.exit(1);
    });

    // Try to connect to database after server starts (non-blocking)
    try {
      await connectDatabase();

      // Start cron job to check trials every 5 minutes (timezone-aware decrement)
      console.log("⏰ Registering timezone-aware trial decrement cron job (every 5 minutes)");
      cron.schedule("*/5 * * * *", async () => {
        try {
          await checkAndUpdateExpiredTrials();
        } catch (error) {
          console.error("❌ Cron job error:", error);
        }
      });
      console.log("✅ Cron job registered");
    } catch (dbError) {
      console.warn(
        "⚠️ Database connection failed, but server is running:",
        dbError
      );
      console.log("🔄 Server will continue without database connection");
    }
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();
