import { z } from "zod";

export const UserSchema = z.object({
  // _id: z.string().uuid().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  passwordHash: z.string().min(1),
  companyId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export type User = z.infer<typeof UserSchema>;
