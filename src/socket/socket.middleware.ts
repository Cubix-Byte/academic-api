import { Socket } from "socket.io";
import { JWTPayload } from "../utils/shared-lib-imports";
import { jwtHelper } from "../config/auth.config";

export const socketAuthMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1];

        if (!token) {
            return next(new Error("Authentication error: Token missing"));
        }

        const payload = jwtHelper.verifyAccessToken(token) as JWTPayload;

        if (!payload) {
            return next(new Error("Authentication error: Invalid token"));
        }

        // Helper to sanitize tenantId
        const sanitizeTenantId = (id: any): string | undefined => {
            if (!id) return undefined;

            // If it's already a 24-char hex string, it's good
            if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
                return id;
            }

            // If it's a 12-char string (raw bytes), convert to hex
            if (typeof id === 'string' && id.length === 12) {
                return Buffer.from(id, 'binary').toString('hex');
            }

            // If it's a Buffer, convert to hex
            if (Buffer.isBuffer(id)) {
                return id.toString('hex');
            }

            return String(id);
        };

        let tenantId = sanitizeTenantId(payload.tenantId);
        let tenantName = payload.tenantName;

        // Fetch user data from user-api to get correct tenantId (if possible)
        try {
            const userApiUrl = process.env.USER_API_URL || "http://localhost:3002";
            const internalApiKey = process.env.INTERNAL_API_KEY || "your-internal-api-key-here";

            // Only fetch if we have a userId
            const userId = payload.id || (payload as any).userId || (payload as any).sub;

            if (userId) {
                const response = await fetch(`${userApiUrl}/user/internal/validate-user`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": internalApiKey,
                    },
                    body: JSON.stringify({ userId }),
                });

                if (response.ok) {
                    const userData = await response.json();
                    const realUser = userData.data?.user || userData.data || userData;

                    if (realUser.tenantId) {
                        tenantId = sanitizeTenantId(realUser.tenantId);
                        tenantName = realUser.tenantName;
                    }
                    console.log(`✅ [SocketAuth] Fetched fresh user data for ${userId}. TenantId: ${tenantId}`);
                }
            }
        } catch (err) {
            console.error("⚠️ [SocketAuth] Failed to fetch user data:", err);
            // Continue with payload data
        }

        // Attach user info to socket
        (socket as any).user = {
            id: payload.id || (payload as any).userId || (payload as any).sub,
            role: payload.role,
            tenantId: tenantId,
            tenantName: tenantName,
            userType: payload.userType,
        };

        next();
    } catch (error) {
        console.error("Socket authentication error:", error);
        next(new Error("Authentication error: Internal server error"));
    }
};
