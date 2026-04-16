import { z } from "zod";
import { objectIdSchema } from "./objectId.validator";

export const createPartnerSchema = z.object({
  body: z.object({
    partnersField: z.string().min(1, "Partners field is required"),
    partnerLogo: z.string().optional(),
    companyName: z.string().min(1, "Company name is required"),
    supportEmail: z.string().email("Invalid email format"),
    colourTheme: z.array(
      z.object({
        key: z.string().min(1),
        value: z.string().min(1),
      })
    ),
    sidebarGradient: z.string().optional(),
    isDefault: z.boolean().optional(),
  }),
});

export const updatePartnerSchema = z.object({
  body: z.object({
    partnersField: z.string().optional(),
    partnerLogo: z.string().optional(),
    companyName: z.string().optional(),
    supportEmail: z.string().email("Invalid email format").optional(),
    colourTheme: z
      .array(
        z.object({
          key: z.string(),
          value: z.string(),
        })
      )
      .optional(),
    sidebarGradient: z.string().optional(),
    isDefault: z.boolean().optional(),
  }),
  params: z.object({
    id: objectIdSchema,
  }),
});

export const getPartnerSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const deletePartnerSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});
