import { Router } from "express";
import { ChatController } from "../../controllers/chat.controller";

const router = Router();

router.get("/conversations", ChatController.getConversations);
router.get("/conversations/:conversationId", ChatController.getConversationById);
router.get("/conversations/:conversationId/messages", ChatController.getMessages);
router.post("/conversations", ChatController.startConversation);

export default router;
