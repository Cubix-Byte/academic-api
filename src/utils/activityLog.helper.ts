import { UserApiIntegrationService } from '../services/userApiIntegration.service';

/**
 * Activity Log Helper Functions
 * Utility functions for formatting and processing activity logs
 */

/**
 * Format date to relative time string (e.g., "1h ago", "1day ago", "1w ago", "1M ago")
 */
export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMonths > 0) {
    return `${diffMonths}M ago`;
  } else if (diffWeeks > 0) {
    return `${diffWeeks}w ago`;
  } else if (diffDays > 0) {
    return `${diffDays}day ago`;
  } else if (diffHours > 0) {
    return `${diffHours}h ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}m ago`;
  } else {
    return 'just now';
  }
};

/**
 * Format date as "DD/MM/YYYY"
 */
export const formatLogDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Build activity description string
 * Examples:
 * - "Michael Clark Created Exam"
 * - "Alice Completed Exam"
 * - "Michael Clark Assigned Credential to Student"
 */
export const buildActivityDescription = (
  userName: string,
  activityType: string,
  entityName?: string,
  targetUserName?: string
): string => {
  let action = '';
  
  switch (activityType) {
    case 'ExamCreated':
      action = 'Created Exam';
      break;
    case 'ExamEdited':
      action = 'Edited Exam';
      break;
    case 'ExamScheduled':
      action = 'Schedule Exam';
      break;
    case 'PracticeExamCreated':
      action = 'Created Practice Exam';
      break;
    case 'PracticeExamEdited':
      action = 'Edited Practice Exam';
      break;
    case 'CredentialCreated':
      action = 'Created Credential';
      break;
    case 'CredentialAssigned':
      action = targetUserName ? `Assigned ${entityName || 'Credential'} to ${targetUserName}` : `Assigned ${entityName || 'Credential'}`;
      break;
    case 'ExamCompleted':
      action = 'Completed Exam';
      break;
    case 'PracticeCompleted':
      action = 'Completed Practice Exam';
      break;
    case 'BadgeEarned':
      action = entityName ? `Earned ${entityName}` : 'Earned Badge';
      break;
    case 'CertificateEarned':
      action = entityName ? `Earned ${entityName}` : 'Earned Certificate';
      break;
    default:
      action = activityType;
  }

  return `${userName} ${action}`;
};

/**
 * Fetch user names from user-api in batch
 * Returns a map of userId -> fullName
 */
export const fetchUserNames = async (userIds: string[]): Promise<Record<string, string>> => {
  if (userIds.length === 0) {
    return {};
  }

  const nameMap: Record<string, string> = {};

  try {
    // Use batch fetch if available
    const response = await UserApiIntegrationService.getUsersByIds(userIds);
    const users = response?.data?.users || response?.users || [];

    users.forEach((user: any) => {
      const userId = user._id?.toString() || user.id?.toString();
      if (userId) {
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        nameMap[userId] = fullName || 'Unknown User';
      }
    });

    // For any missing users, fetch individually
    const missingIds = userIds.filter(id => !nameMap[id]);
    for (const userId of missingIds) {
      try {
        const userResponse = await UserApiIntegrationService.getUserById(userId);
        const user = userResponse?.data || userResponse;
        if (user) {
          const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
          nameMap[userId] = fullName || 'Unknown User';
        }
      } catch (error) {
        console.error(`Error fetching user ${userId}:`, error);
        nameMap[userId] = 'Unknown User';
      }
    }
  } catch (error) {
    console.error('Error fetching user names:', error);
    // Set default names for all missing users
    userIds.forEach(userId => {
      if (!nameMap[userId]) {
        nameMap[userId] = 'Unknown User';
      }
    });
  }

  return nameMap;
};

/**
 * Parse month string to number (e.g., "August" -> 8)
 */
export const parseMonth = (monthName: string): number | undefined => {
  const months: Record<string, number> = {
    'january': 1, 'february': 2, 'march': 3, 'april': 4,
    'may': 5, 'june': 6, 'july': 7, 'august': 8,
    'september': 9, 'october': 10, 'november': 11, 'december': 12
  };
  
  return months[monthName.toLowerCase()] || undefined;
};

/**
 * Get month name from number (e.g., 8 -> "August")
 */
export const getMonthName = (month: number): string => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || 'Unknown';
};

