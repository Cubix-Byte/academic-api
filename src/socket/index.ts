import { Server as SocketServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import mongoose from "mongoose";
import { socketAuthMiddleware } from "./socket.middleware";
import Message from "../models/chat/message.schema";
import Conversation from "../models/chat/conversation.schema";

export let io: SocketServer;

export const initSocket = (httpServer: HttpServer) => {
    // // Configure CORS based on environment
    // // In production, restrict to specific origins for security
    // // const allowedOrigins = process.env.NODE_ENV === "staging"
    // //     ?  process.env.BASE_URL || "https://dev.cognify.education" : "*"; // Allow all origins in development

    // // const allowedOrigins = ["https://dev.cognify.education", "https://cognify.education", "http://localhost:5173"];
    // // io = new SocketServer(httpServer, { cors: { origin: allowedOrigins, credentials: true } });

    // const allowedDomains = [
    //     "dev.cognify.education",
    //     "cognify.education",
    //   ];

    //   const allowedLocalOrigins = [
    //     "http://localhost:5173",
    //   ];

    //   io = new SocketServer(httpServer, {
    //     cors: {
    //       origin: (origin, callback) => {
    //         if (!origin) return callback(null, true);

    //         // Allow specific localhost origins
    //         if (allowedLocalOrigins.includes(origin)) {
    //           return callback(null, true);
    //         }

    //         try {
    //           const { hostname } = new URL(origin);

    //           const isAllowed = allowedDomains.some(domain =>
    //             hostname === domain || hostname.endsWith(`.${domain}`)
    //           );

    //           if (isAllowed) {
    //             callback(null, true);
    //           } else {
    //             callback(new Error("Not allowed by CORS"));
    //           }
    //         } catch {
    //           callback(new Error("Invalid origin"));
    //         }
    //       },
    //       credentials: true,
    //       methods: ["GET", "POST"],
    //     },
    //   });

    // Configure allowed origins based on environment
    // const allowedOrigins =
    //     process.env.NODE_ENV === "staging"
    //         ? process.env.BASE_URL || "https://dev.cognify.education" // only staging domains
    //         : "*"; // local development

    io = new SocketServer(httpServer, {
        path: "/academy/api/v1/socket.io",
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            credentials: true,
        },
    });



    // Authentication Middleware
    io.use(socketAuthMiddleware);

    io.on("connection", (socket: Socket) => {
        const user = (socket as any).user;
        console.log(`👤 User connected: ${user.id} (${socket.id})`);

        // Join a personal room for 1-to-1 notifications (not room-specific)
        socket.join(user.id);

        // Join conversation rooms
        socket.on("join_conversation", (conversationId: string) => {
            socket.join(conversationId);
            console.log(`📢 User ${user.id} joined conversation: ${conversationId}`);
        });

        socket.on("leave_conversation", (conversationId: string) => {
            socket.leave(conversationId);
            console.log(`🔇 User ${user.id} left conversation: ${conversationId}`);
        });

        socket.on("send_message", async (data: { conversationId: string; content: string; type?: "text" | "image" | "file" }) => {
            try {
                const { conversationId, content, type = "text" } = data;
                console.log("📩 Received send_message:", { conversationId, content, type, userId: user.id, tenantId: user.tenantId });

                // Verify conversation exists and user is a participant
                const conversation = await Conversation.findOne({
                    _id: conversationId,
                    $or: [
                        { "participants.teacherId": user.id },
                        { "participants.studentId": user.id },
                        { "participants.parentId": user.id }
                    ],
                    tenantId: user.tenantId,
                });

                if (!conversation) {
                    console.warn("⚠️ Conversation not found or access denied:", { conversationId, userId: user.id, tenantId: user.tenantId });
                    return socket.emit("error_message", { message: "Conversation not found or access denied" });
                }

                console.log("✅ Conversation verified, creating message...");

                // Create new message
                const newMessage = await Message.create({
                    conversationId,
                    sender: user.id,
                    content,
                    type,
                    tenantId: user.tenantId,
                    createdBy: user.id,
                    updatedBy: user.id,
                });

                console.log("💾 Message saved to DB:", newMessage.id);

                // Update conversation lastMessage and unread counts
                // Ensure lastMessage is stored as ObjectId
                conversation.lastMessage = new mongoose.Types.ObjectId(newMessage._id);

                // Helper to get participant IDs
                const participants = conversation.participants;
                const participantValues = [
                    participants.teacherId,
                    participants.studentId,
                    participants.parentId
                ].filter(id => id); // Filter out undefined/null

                // Increment unread count for other participants
                participantValues.forEach((participantId: any) => {
                    if (participantId && participantId.toString() !== user.id) {
                        const currentCount = conversation.unreadCount.get(participantId.toString()) || 0;
                        conversation.unreadCount.set(participantId.toString(), currentCount + 1);
                    }
                });

                await conversation.save();

                // Emit message to the conversation room
                io.to(conversationId).emit("new_message", newMessage);

                // Also emit to individual rooms for notification (in case they aren't in the conversation room)
                participantValues.forEach((participantId: any) => {
                    if (participantId && participantId.toString() !== user.id) {
                        io.to(participantId.toString()).emit("message_notification", {
                            conversationId,
                            message: newMessage,
                        });
                    }
                });

            } catch (error) {
                console.error("Socket send_message error:", error);
                socket.emit("error_message", { message: "Failed to send message" });
            }
        });

        /**
         * Typing indicator events
         *
         * Lightweight, non-persistent events that let other participants know
         * when this user is typing in a conversation. This is intentionally
         * kept simple and does not hit the database to avoid extra load
         * on every keypress. We rely on the same conversation rooms that
         * are used for `new_message` events.
         *
         * Event contract:
         *  - Client → Server: "typing", { conversationId: string; isTyping: boolean }
         *  - Server → Clients (room broadcast): "typing_update", {
         *        conversationId: string;
         *        userId: string;
         *        isTyping: boolean;
         *    }
         */
        socket.on("typing", async (data: { conversationId?: string; isTyping?: boolean }) => {
            try {
                const conversationId = data?.conversationId;
                const isTyping = Boolean(data?.isTyping);

                if (!conversationId) {
                    console.warn("⚠️ Typing event missing conversationId:", { userId: user.id, data });
                    return;
                }

                // Verify conversation exists and user is a participant (lightweight check)
                const conversation = await Conversation.findOne({
                    _id: conversationId,
                    $or: [
                        { "participants.teacherId": user.id },
                        { "participants.studentId": user.id },
                        { "participants.parentId": user.id }
                    ],
                    tenantId: user.tenantId,
                }).select("_id").lean();

                if (!conversation) {
                    console.warn("⚠️ Typing event: Conversation not found or access denied:", {
                        conversationId,
                        userId: user.id,
                        tenantId: user.tenantId
                    });
                    return;
                }

                // Ensure user is in the conversation room (in case they haven't joined yet)
                const rooms = Array.from(socket.rooms);
                if (!rooms.includes(conversationId)) {
                    socket.join(conversationId);
                    console.log(`📢 User ${user.id} auto-joined conversation room for typing: ${conversationId}`);
                }

                // Broadcast to everyone else in the conversation room.
                // We intentionally do not emit back to the typing user.
                socket.to(conversationId).emit("typing_update", {
                    conversationId,
                    userId: user.id,
                    isTyping,
                });

                console.log(`⌨️ Typing event: User ${user.id} ${isTyping ? "started" : "stopped"} typing in conversation ${conversationId}`);
            } catch (error) {
                console.error("Socket typing event error:", error);
            }
        });

        // Handle marking as seen
        socket.on("mark_seen", async (data: { conversationId: string; messageIds: string[] }) => {
            try {
                const { conversationId, messageIds } = data;

                // Update messages seenBy
                await Message.updateMany(
                    { _id: { $in: messageIds }, conversationId, tenantId: user.tenantId },
                    {
                        $addToSet: { seenBy: user.id },
                        $set: { updatedBy: user.id }
                    }
                );

                // Reset unread count for this user in the conversation
                // IMPORTANT: Preserve updatedAt to prevent it from being updated when just marking as seen
                // We use the collection directly to bypass Mongoose's automatic timestamp updates
                // This prevents Mongoose's timestamps: true from auto-updating updatedAt
                await Conversation.collection.updateOne(
                    {
                        _id: new mongoose.Types.ObjectId(conversationId),
                        tenantId: typeof user.tenantId === 'string'
                            ? new mongoose.Types.ObjectId(user.tenantId)
                            : user.tenantId
                    },
                    {
                        $set: {
                            [`unreadCount.${user.id}`]: 0,
                            updatedBy: typeof user.id === 'string'
                                ? new mongoose.Types.ObjectId(user.id)
                                : user.id
                        }
                        // Note: We don't set updatedAt here, so it won't be updated
                        // This bypasses Mongoose's timestamps: true behavior
                    }
                );

                // Notify others that messages were seen
                socket.to(conversationId).emit("messages_seen", {
                    conversationId,
                    messageIds,
                    seenBy: user.id,
                });

            } catch (error) {
                console.error("Socket mark_seen error:", error);
            }
        });

        socket.on("disconnect", () => {
            console.log(`🔌 User disconnected: ${user.id} (${socket.id})`);
        });
    });

    return io;
};
