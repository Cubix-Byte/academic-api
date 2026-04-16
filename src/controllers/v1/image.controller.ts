import { Request, Response } from "express";
import axios from "axios";
import {
    sendErrorResponse,
    HttpStatusCodes,
} from "../../utils/shared-lib-imports";

/**
 * Image Controller
 * Handles image related operations
 */

export const downloadImage = async (req: Request, res: Response) => {
    const { imageUrl } = req.query;

    if (!imageUrl) {
        return sendErrorResponse(
            res,
            "Image URL is required.",
            HttpStatusCodes.BAD_REQUEST
        );
    }

    try {
        const response = await axios({
            url: imageUrl as string,
            method: "GET",
            responseType: "stream",
        });

        // Set suggested filename based on URL or use a default
        let filename = "image.jpg";
        const urlParts = (imageUrl as string).split("/");
        const lastPart = urlParts[urlParts.length - 1];
        if (lastPart && lastPart.includes(".")) {
            filename = lastPart.split("?")[0]; // remove query params if any
        }

        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

        // Set Content-Type if available from axios response
        if (response.headers["content-type"]) {
            res.setHeader("Content-Type", response.headers["content-type"]);
        }

        response.data.pipe(res);
    } catch (error: any) {
        console.error("Image download error:", error.message);
        return sendErrorResponse(
            res,
            "Error downloading the image.",
            HttpStatusCodes.INTERNAL_SERVER_ERROR
        );
    }
};
