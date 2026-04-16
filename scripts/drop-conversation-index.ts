import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

async function dropIndex() {
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
        console.error('❌ MONGODB_URI is not defined in .env');
        process.exit(1);
    }

    console.log('🔄 Connecting to MongoDB...');
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to DB:', mongoose.connection.name);

        const db = mongoose.connection.db;
        if (!db) {
            console.error('❌ No DB connection found');
            return;
        }

        const collection = db.collection('conversations');

        // List existing indexes for debugging
        const existingIndexes = await collection.indexes();
        console.log('📋 Existing indexes:', existingIndexes.map(i => i.name));

        const indexName = 'participants_1_type_1_tenantId_1';

        if (existingIndexes.some(i => i.name === indexName)) {
            console.log(`🗑️ Dropping index: ${indexName}`);
            const result = await collection.dropIndex(indexName);
            console.log('✅ Index dropped successfully:', result);
        } else {
            console.log(`ℹ️ Index ${indexName} not found, it might have been dropped already.`);
        }

    } catch (error: any) {
        console.error('❌ Error during index migration:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('📤 MongoDB connection closed');
    }
}

dropIndex();
