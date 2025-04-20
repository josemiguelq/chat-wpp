import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { MongoClient } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { z } from "zod";
import "dotenv/config";
import { describe } from "node:test";

const client = new MongoClient(process.env.MONGODB_ATLAS_URI as string);

const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
});

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

type Product = z.infer<typeof ProductSchema>;

const parser = StructuredOutputParser.fromZodSchema(z.array(ProductSchema));

async function generateSyntheticData(): Promise<Product[]> {
  const prompt = `You are a helpful assistant that generates smartphone pieces data. Generate 5 fictional pieces records. Each record should include the following fields: model, related_products, related_models, notes. Ensure variety in the data and realistic values.

  ${parser.getFormatInstructions()}`;

  console.log("Generating synthetic data...");

  const response = await llm.invoke(prompt);
  return parser.parse(response.content as string);
}

async function createProductSummary(product: Product): Promise<string> {
  return new Promise((resolve) => {    
    const relatedModels = product.related_models.join(", ");
    const relatedProducts = product.related_models.join(", ");
    const aka = product.type_labels.join(", ");
    const variations = product.variations
      .map(
        (v) =>
          `${v.description} R$ ${v.price}`
      )
      .join("\n");

    const basicInfo = `${product.model}, also known as ${aka}`;
    const notes = product.notes;

    const summary = `${basicInfo}. Related models compatibles: ${relatedModels}. MensagemFixa: ${variations}. Buy togheter: ${relatedProducts}. Note: ${notes}`;
    console.log(summary)
    resolve(summary);
  });
}

async function seedDatabase(): Promise<void> {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const db = client.db("store_wpp_database");
    const collection = db.collection("products");

    await collection.deleteMany({});
    
    const syntheticData = await generateSyntheticData();

    const recordsWithSummaries = await Promise.all(
      syntheticData.map(async (record) => ({
        pageContent: await createProductSummary(record),
        metadata: {...record},
      }))
    );
    
    for (const record of recordsWithSummaries) {
      await MongoDBAtlasVectorSearch.fromDocuments(
        [record],
        new OpenAIEmbeddings(),
        {
          collection,
          indexName: "vector_index",
          textKey: "embedding_text",
          embeddingKey: "embedding",
        }
      );

      console.log("Successfully processed & saved record:", record.metadata.model);
    }

    console.log("Database seeding completed");

  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await client.close();
  }
}

seedDatabase().catch(console.error);
