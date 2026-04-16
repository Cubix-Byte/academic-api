import { IParent } from "../models/parent.schema";

// Request types for parent operations
export interface CreateParentRequest extends Partial<IParent> {
  // User data (for creating user in user-api)
  username?: string;
  email: string; // Required for parent creation
  password: string; // Required for parent creation (min 6 characters)
  firstName: string; // Required for parent creation
  lastName: string; // Required for parent creation
  role?: 'father' | 'mother' | 'guardian'; // Required role for parent (optional in type, but validated in service)
  phoneNumber?: string;
  address?: string;
  profilePicture?: string; // Profile picture URL
  tenantId?: string;
  tenantName?: string;
  demoPassword?: string;
  userAccessType?: string;
  isEmailVerified?: boolean;
  userType?: string;
  roleName?: string;
  // Children IDs to associate with this parent (REQUIRED - at least one child must be assigned)
  children?: string[];
  // Children/Students to link with parent (REQUIRED - at least one student ID must be provided)
  studentIds?: string[]; // Required array of student IDs to link as children (at least one required)
  childrenIds?: string[]; // Alias for studentIds (for backward compatibility)
}

export interface UpdateParentRequest extends Partial<IParent> {
  // User data (for updating user in user-api)
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  password?: string; // Optional password update (min 6 characters)
  address?: string;
  profilePicture?: string; // Profile picture URL
  // Children/Students to add or update
  studentIds?: string[]; // Array of student IDs to add as children
  childrenIds?: string[]; // Alias for studentIds (for backward compatibility)
  children?: string[]; // Alias for studentIds (alternative field name)
  removeChildIds?: string[]; // Array of student IDs to remove from parent
}

// Response types
export interface ParentResponse extends IParent {
  // Additional computed fields
  fullName?: string;
  childrenCount?: number;
}

// Bulk operations
export interface BulkCreateParentRequest {
  parents: CreateParentRequest[];
}

export interface BulkCreateParentResponse {
  created: ParentResponse[];
  failed: {
    data: CreateParentRequest;
    error: string;
  }[];
}
