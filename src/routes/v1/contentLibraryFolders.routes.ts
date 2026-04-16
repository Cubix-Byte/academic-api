import { Router } from "express";
import { ROUTES } from "@/utils/constants/routes";
import { ContentLibraryController } from "@/controllers/v1/contentLibrary.controller";
import { validate } from "@/middlewares/validation.middleware";
import {
  createFolderSchema,
  renameFolderSchema,
  listFoldersSchema,
  listFoldersWithContentsSchema,
  idParamSchema,
} from "@/utils/requestValidators/contentLibrary.validator";

const router = Router();
const controller = new ContentLibraryController();

router.post(
  ROUTES.CONTENT_LIBRARY.SUBROUTES.ROOT,
  validate(createFolderSchema),
  controller.createFolder
);
router.get(
  ROUTES.CONTENT_LIBRARY.SUBROUTES.WITH_CONTENTS,
  validate(listFoldersWithContentsSchema),
  controller.listFoldersWithContents
);
router.get(
  ROUTES.CONTENT_LIBRARY.SUBROUTES.ROOT,
  validate(listFoldersSchema),
  controller.listFolders
);
router.get(
  ROUTES.CONTENT_LIBRARY.SUBROUTES.ID,
  validate(idParamSchema),
  controller.getFolder
);
router.put(
  ROUTES.CONTENT_LIBRARY.SUBROUTES.RENAME,
  validate(renameFolderSchema),
  controller.renameFolder
);
router.delete(
  ROUTES.CONTENT_LIBRARY.SUBROUTES.ID,
  validate(idParamSchema),
  controller.deleteFolder
);

export default router;
