import { z } from "zod";

export const CompanySchema = z.object({
  _id: z.string(), // UUID ou ObjectId
  name: z.string(),
  address: z.string(),
});

export type Company = z.infer<typeof CompanySchema>;