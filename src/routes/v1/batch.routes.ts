import { Router } from 'express';
import * as batchController from '../../controllers/v1/batch.controller';

const router = Router();

/**
 * Batch Routes - API endpoints for batch management
 */

// POST /api/v1/batches - Create new batch
router.post('/', batchController.createBatch);

// GET /api/v1/batches - Get all batches with pagination and filters
router.get('/', batchController.getAllBatches);

// GET /api/v1/batches/ddl - Get batches dropdown list (main endpoint requested)
router.get('/ddl', batchController.getBatchesDDL);

// GET /api/v1/batches/stats - Get batch statistics (total, active, and inactive)
router.get('/stats', batchController.getBatchStats);

// GET /api/v1/batches/search - Search batches
router.get('/search', batchController.searchBatches);

// GET /api/v1/batches/statistics - Get batch statistics (detailed)
router.get('/statistics', batchController.getBatchStatistics);

// GET /api/v1/batches/:id - Get batch by ID
router.get('/:id', batchController.getBatch);

// PUT /api/v1/batches/:id - Update batch
router.put('/:id', batchController.updateBatch);

// DELETE /api/v1/batches/:id - Delete batch
router.delete('/:id', batchController.deleteBatch);

export default router;
