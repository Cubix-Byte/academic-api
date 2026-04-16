import { Router } from 'express';
import { ROUTES } from '@/utils/constants/routes';
import { ContentLibraryController } from '@/controllers/v1/contentLibrary.controller';
import { validate } from '@/middlewares/validation.middleware';
import { addContentSchema, listContentsSchema, renameContentSchema, updateContentMetaSchema, idParamSchema, assignContentToClassesSchema, unassignContentFromClassesSchema, bulkAddContentSchema } from '@/utils/requestValidators/contentLibrary.validator';

const router = Router();
const controller = new ContentLibraryController();

router.post(ROUTES.CONTENT_LIBRARY_CONTENT.SUBROUTES.ROOT, validate(addContentSchema), controller.addContent);
router.post(ROUTES.CONTENT_LIBRARY_CONTENT.SUBROUTES.BULK_UPLOAD, validate(bulkAddContentSchema), controller.bulkAddContent);
router.get(ROUTES.CONTENT_LIBRARY_CONTENT.SUBROUTES.ROOT, validate(listContentsSchema), controller.listContents);
router.get(ROUTES.CONTENT_LIBRARY_CONTENT.SUBROUTES.ID, validate(idParamSchema), controller.getContent);
router.put(ROUTES.CONTENT_LIBRARY_CONTENT.SUBROUTES.RENAME, validate(renameContentSchema), controller.renameContent);
router.put(ROUTES.CONTENT_LIBRARY_CONTENT.SUBROUTES.ID, validate(updateContentMetaSchema), controller.updateContentMeta);
router.delete(ROUTES.CONTENT_LIBRARY_CONTENT.SUBROUTES.ID, validate(idParamSchema), controller.deleteContent);
router.post(ROUTES.CONTENT_LIBRARY_CONTENT.SUBROUTES.ASSIGN_CLASSES, validate(assignContentToClassesSchema), controller.assignContentToClasses);
router.post(ROUTES.CONTENT_LIBRARY_CONTENT.SUBROUTES.UNASSIGN_CLASSES, validate(unassignContentFromClassesSchema), controller.unassignContentFromClasses);

export default router; 


