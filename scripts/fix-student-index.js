/**
 * Script to fix the student rollNumber index
 * This script drops the old index and lets Mongoose recreate it with the new partial filter expression
 * 
 * Run this once: node scripts/fix-student-index.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function fixStudentIndex() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('students');

    // Get all indexes
    const indexes = await collection.indexes();
    console.log('📋 Current indexes:', indexes.map(idx => idx.name));

    // Find and drop the old rollNumber index
    const oldIndexName = 'rollNumber_1_tenantId_1_classId_1';
    const indexExists = indexes.find(idx => idx.name === oldIndexName);

    if (indexExists) {
      console.log(`🗑️  Dropping old index: ${oldIndexName}`);
      await collection.dropIndex(oldIndexName);
      console.log('✅ Old index dropped successfully');
    } else {
      console.log('ℹ️  Old index not found, might already be updated');
    }

    // The new index will be created automatically by Mongoose when the schema is loaded
    // with the updated partialFilterExpression
    console.log('✅ Index fix completed. Restart your server to recreate the index with the new definition.');

    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error fixing index:', error);
    process.exit(1);
  }
}

// Run the script
fixStudentIndex();

