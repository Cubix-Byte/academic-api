import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Connect to test database
  const mongoUri = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/academy-api-test';
  await mongoose.connect(mongoUri);
  console.log('✅ Test database connected');
});

// Global test teardown
afterAll(async () => {
  // Clean up database and close connection
  if (mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
  await mongoose.disconnect();
  console.log('👋 Test database disconnected');
});

// Clean up after each test
afterEach(async () => {
  // Clear all collections after each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Increase timeout for database operations
jest.setTimeout(30000);
