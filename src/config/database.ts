import mongoose from "mongoose";
// Import Student model to ensure it's loaded before syncing indexes
import "../models/student.schema";
import "../models/user.schema";

// Database connection configuration
export const connectDatabase = async (): Promise<void> => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is not set");
    }

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      connectTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 30000, // 30 seconds
      bufferCommands: true // Enable buffering to handle connection issues
    });

    console.log("✅ MongoDB connected successfully to Academy API");
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(
      "🔄 Auto-sync enabled - database changes will be detected automatically"
    );

    // Auto-sync feature - automatically create collections when needed
    mongoose.connection.on("error", (error) => {
      console.error("❌ MongoDB connection error:", error);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("📤 MongoDB disconnected");
    });

    // Log existing collections
    if (mongoose.connection.db) {
      const collections = await mongoose.connection.db
        .listCollections()
        .toArray();
      console.log(`📋 Database contains ${collections.length} collections`);
    }

    // Sync indexes to ensure they match the schema definitions
    // This will automatically update indexes like the rollNumber index with new partial filter
    try {
      const Student = mongoose.model("Student");
      await Student.syncIndexes();
      console.log("✅ Student indexes synced successfully");
    } catch (error: any) {
      // If Student model is not loaded yet, that's okay - indexes will sync when model is first used
      if (!error.message?.includes("Cannot read property 'syncIndexes'")) {
        console.warn("⚠️  Could not sync Student indexes:", error.message);
      }
    }

    // Drop old employeeId indexes from teachers collection (migration)
    try {
      const teachersCollection = mongoose.connection.db?.collection('teachers');
      if (teachersCollection) {
        const indexes = await teachersCollection.indexes();
        const employeeIdIndexes = indexes.filter((idx: any) =>
          idx.key && (idx.key.employeeId || (idx.name && idx.name.includes('employeeId')))
        );

        for (const index of employeeIdIndexes) {
          try {
            await teachersCollection.dropIndex(index.name);
            console.log(`✅ Dropped old employeeId index: ${index.name}`);
          } catch (dropError: any) {
            // Index might not exist, ignore error
            if (!dropError.message?.includes('index not found') && !dropError.message?.includes('ns not found')) {
              console.warn(`⚠️ Could not drop index ${index.name}:`, dropError.message);
            }
          }
        }
      }
    } catch (error: any) {
      console.warn('⚠️ Could not check/drop old employeeId indexes:', error.message);
    }
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error; // Re-throw instead of process.exit to allow graceful handling
  }
};

// Disconnect from database
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    console.log("📤 MongoDB disconnected");
  } catch (error) {
    console.error("❌ MongoDB disconnection error:", error);
  }
};
