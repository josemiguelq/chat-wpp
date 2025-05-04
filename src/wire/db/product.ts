
import { z } from "zod";

const ProductSchema = z.object({
  model: z.string(),
  type: z.string(),
  type_labels: z.array(z.string()),
  stock: z.string(),
  related_products: z.array(z.string()),
  related_models: z.array(z.string()),

  reporting_manager: z.string().nullable(),
  variations: z.array(
    z.object({
      price: z.number(),      
      description: z.string(),
    })
  ),
  notes: z.string(),
});

export type Product = z.infer<typeof ProductSchema>;