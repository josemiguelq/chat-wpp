import { z } from "zod";

export const RoleNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    name: z.string(),
    subordinates: z.array(RoleNodeSchema).optional().default([]),
  })
);

export const RoleSchema = z.object({
  _id: z.string().uuid().optional(), // MongoDB ObjectId geralmente como string, use refine se quiser validar ObjectId
  companyId: z.string().uuid(),
  name: z.string(),
  subordinates: z.array(RoleNodeSchema).optional().default([]),
});

export type Role = z.infer<typeof RoleSchema>;