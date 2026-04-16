import mongoose from 'mongoose';
import { Class } from '../../models/class.schema';
import { Subject } from '../../models/subject.schema';

/**
 * Database Reset Utility for Academy API
 * Clears all collections and resets the database
 */

/**
 * Reset Academy API database
 * Clears all collections (classes, subjects, etc.)
 */
export const resetAcademyDatabase = async (): Promise<void> => {
  try {
    console.log('🔄 Resetting Academy API database...');
    
    // Check if connected to database
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database not connected');
    }
    
    // Clear all collections
    await Class.deleteMany({});
    await Subject.deleteMany({});
    
    console.log('✅ Academy API database reset completed');
    console.log('📊 Cleared collections:');
    console.log('   - Classes');
    console.log('   - Subjects');
    
  } catch (error) {
    console.error('❌ Error resetting Academy API database:', error);
    throw error;
  }
};

/**
 * Reset specific collection
 */
export const resetCollection = async (collectionName: string): Promise<void> => {
  try {
    console.log(`🔄 Resetting ${collectionName} collection...`);
    
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database not connected');
    }
    
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }
    
    await db.collection(collectionName).deleteMany({});
    
    console.log(`✅ ${collectionName} collection reset completed`);
    
  } catch (error) {
    console.error(`❌ Error resetting ${collectionName} collection:`, error);
    throw error;
  }
};

/**
 * Get collection statistics
 */
export const getCollectionStats = async (): Promise<any> => {
  try {
    console.log('📊 Getting collection statistics...');
    
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database not connected');
    }
    
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }
    
    const collections = await db.listCollections().toArray();
    const stats: any = {};
    
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      stats[collection.name] = count;
    }
    
    console.log('📊 Collection Statistics:');
    Object.entries(stats).forEach(([name, count]) => {
      console.log(`   - ${name}: ${count} documents`);
    });
    
    return stats;
    
  } catch (error) {
    console.error('❌ Error getting collection statistics:', error);
    throw error;
  }
};

/**
 * Drop entire database (DANGEROUS - Use with caution)
 */
export const dropDatabase = async (): Promise<void> => {
  try {
    console.log('⚠️  WARNING: Dropping entire database...');
    
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database not connected');
    }
    
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }
    
    await db.dropDatabase();
    
    console.log('✅ Database dropped successfully');
    
  } catch (error) {
    console.error('❌ Error dropping database:', error);
    throw error;
  }
};

// Export for use in scripts
export default {
  resetAcademyDatabase,
  resetCollection,
  getCollectionStats,
  dropDatabase
};
