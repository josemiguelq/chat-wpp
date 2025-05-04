
import { Product } from "../wire/db/product";
import express, { Request, Response } from "express";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { client } from './../db/connection'

export async function createProductSummary(product: Product): Promise<string> {
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

export async function create(req: Request, res: Response)  {

      const {data} = req.body

      const recordsWithSummaries = await Promise.all(
        data.map(async (record :any) => ({
          pageContent: await createProductSummary(record),
          metadata: {...record},
        }))
      );

      await client.connect();
      const db = client.db("store_wpp_database");
    const collection = db.collection("products");

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
      
            res.json({msg: "Successfully processed"});
          }
      
    }  