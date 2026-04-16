import { Router } from 'express';
import * as parentChildController from '../controllers/v1/parentChild.controller';

const router = Router();

/**
 * Parent-Child Relationship Routes
 * All routes require authentication and tenant context
 */

// Create parent-child relationship
router.post('/', parentChildController.createParentChildRelationship);

// Get children by parent ID
router.get(
	'/parent/:parentId/children',
	parentChildController.getChildrenByParentId,
);

// Get child's subjects with assigned teachers (must be before /child/:childId/parents)
router.get(
	'/child/:childId/subjects',
	parentChildController.getChildSubjectsWithTeachers,
);

// Get parents by child ID
router.get(
	'/child/:childId/parents',
	parentChildController.getParentsByChildId,
);

// Update parent-child relationship
router.put('/:id', parentChildController.updateParentChildRelationship);

// Delete parent-child relationship
router.delete('/:id', parentChildController.deleteParentChildRelationship);

// Set primary parent for a child
router.post('/set-primary', parentChildController.setPrimaryParent);

// Get parent-child relationship statistics
router.get('/statistics', parentChildController.getParentChildStatistics);

export default router;
