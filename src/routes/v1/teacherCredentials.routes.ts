import { Router } from 'express';
import * as teacherCredentialsController from '../../controllers/v1/teacherCredentials.controller';

const router = Router();

/**
 * Teacher Credentials Routes
 */

// POST /api/v1/teacher-credentials - Create credentials
router.post('/', teacherCredentialsController.createCredentials);

// PUT /api/v1/teacher-credentials - Update credential
router.put('/', teacherCredentialsController.updateCredential);

// DELETE /api/v1/teacher-credentials/:credentialId - Delete credential
router.delete('/:credentialId', teacherCredentialsController.deleteCredential);

// GET /api/v1/teacher-credentials - Get all credentials (original endpoint)
router.get('/', teacherCredentialsController.getTeacherCredentials);

// GET /api/v1/teacher-credentials/issued - Get issued credentials with enhanced filters
router.get('/issued', teacherCredentialsController.getIssuedCredentials);

// GET /api/v1/teacher-credentials/teacher/:teacherId - Get all credentials for a specific teacher (assigned + issued)
router.get('/teacher/:teacherId', teacherCredentialsController.getTeacherCredentialsByTeacherId);

export default router;

