import mongoose from 'mongoose';
import { Class } from '../../models/class.schema';
import { Subject } from '../../models/subject.schema';

/**
 * Class and Subject Seeder for Academy API
 * Creates default classes and subjects for testing and initial setup
 */

// Default classes data
const defaultClasses = [
  {
    className: 'Grade 1',
    classCode: 'G1',
    description: 'First Grade - Foundation Level',
    maxStudents: 30,
    academicYear: '2024-2025',
    isActive: true,
    isDeleted: false,
    createdBy: 'system'
  },
  {
    className: 'Grade 2',
    classCode: 'G2',
    description: 'Second Grade - Elementary Level',
    maxStudents: 30,
    academicYear: '2024-2025',
    isActive: true,
    isDeleted: false,
    createdBy: 'system'
  },
  {
    className: 'Grade 3',
    classCode: 'G3',
    description: 'Third Grade - Elementary Level',
    maxStudents: 30,
    academicYear: '2024-2025',
    isActive: true,
    isDeleted: false,
    createdBy: 'system'
  },
  {
    className: 'Grade 4',
    classCode: 'G4',
    description: 'Fourth Grade - Elementary Level',
    maxStudents: 30,
    academicYear: '2024-2025',
    isActive: true,
    isDeleted: false,
    createdBy: 'system'
  },
  {
    className: 'Grade 5',
    classCode: 'G5',
    description: 'Fifth Grade - Elementary Level',
    maxStudents: 30,
    academicYear: '2024-2025',
    isActive: true,
    isDeleted: false,
    createdBy: 'system'
  }
];

// Default subjects data
const defaultSubjects = [
  {
    name: 'Mathematics',
    code: 'MATH',
    grade: 1,
    isActive: true,
    isDeleted: false,
    createdBy: 'system'
  },
  {
    name: 'English Language',
    code: 'ENG',
    grade: 1,
    isActive: true,
    isDeleted: false,
    createdBy: 'system'
  },
  {
    name: 'Science',
    code: 'SCI',
    grade: 1,
    isActive: true,
    isDeleted: false,
    createdBy: 'system'
  },
  {
    name: 'Social Studies',
    code: 'SS',
    grade: 1,
    isActive: true,
    isDeleted: false,
    createdBy: 'system'
  },
  {
    name: 'Urdu',
    code: 'URDU',
    grade: 1,
    isActive: true,
    isDeleted: false,
    createdBy: 'system'
  },
  {
    name: 'Islamic Studies',
    code: 'ISL',
    grade: 1,
    isActive: true,
    isDeleted: false,
    createdBy: 'system'
  },
  {
    name: 'Physical Education',
    code: 'PE',
    grade: 1,
    isActive: true,
    isDeleted: false,
    createdBy: 'system'
  },
  {
    name: 'Art and Craft',
    code: 'ART',
    grade: 1,
    isActive: true,
    isDeleted: false,
    createdBy: 'system'
  }
];

/**
 * Seed default classes
 */
export const seedDefaultClasses = async (): Promise<any[]> => {
  try {
    console.log('🌱 Seeding default classes...');
    
    // Clear existing classes
    await Class.deleteMany({});
    
    // Create default classes
    const createdClasses = await Class.insertMany(defaultClasses);
    
    console.log(`✅ Created ${createdClasses.length} default classes`);
    return createdClasses;
  } catch (error) {
    console.error('❌ Error seeding classes:', error);
    throw error;
  }
};

/**
 * Seed default subjects
 */
export const seedDefaultSubjects = async (): Promise<any[]> => {
  try {
    console.log('🌱 Seeding default subjects...');
    
    // Clear existing subjects
    await Subject.deleteMany({});
    
    // Create default subjects
    const createdSubjects = await Subject.insertMany(defaultSubjects);
    
    console.log(`✅ Created ${createdSubjects.length} default subjects`);
    return createdSubjects;
  } catch (error) {
    console.error('❌ Error seeding subjects:', error);
    throw error;
  }
};

/**
 * Seed all default data
 */
export const seedAllData = async (): Promise<{ classes: any[]; subjects: any[] }> => {
  try {
    console.log('🚀 Starting Academy API data seeding...');
    
    const classes = await seedDefaultClasses();
    const subjects = await seedDefaultSubjects();
    
    console.log('✅ Academy API data seeding completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Classes: ${classes.length}`);
    console.log(`   - Subjects: ${subjects.length}`);
    
    return { classes, subjects };
  } catch (error) {
    console.error('❌ Error in data seeding:', error);
    throw error;
  }
};

/**
 * Reset all data (clear and reseed)
 */
export const resetAndSeedData = async (): Promise<{ classes: any[]; subjects: any[] }> => {
  try {
    console.log('🔄 Resetting and reseeding Academy API data...');
    
    // Clear all data
    await Class.deleteMany({});
    await Subject.deleteMany({});
    
    console.log('🗑️ Cleared existing data');
    
    // Reseed data
    return await seedAllData();
  } catch (error) {
    console.error('❌ Error in reset and seed:', error);
    throw error;
  }
};

// Export individual functions for specific seeding
export {
  defaultClasses,
  defaultSubjects
};
