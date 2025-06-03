
import { Product } from "../wire/db/product";
import express, { Request, Response } from "express";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { client } from './../db/connection'
import {getProductById, getProductsByQuery} from './../db/product'

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

      const data = req.body

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

export async function list(req: Request, res: Response)  {
    await client.connect();
    const db = client.db("store_wpp_database");
    const collection = db.collection("products");
  
    const products = await collection
    .find({}, {
      projection: {
        model: 1,
        type: 1,
        stock: 1,
        variations: 1,
        name: 1,
        notes: 1,
        related_models: 1,
        related_products: 1,
        _id: 1,
      }
    })
    .toArray();

    res.json(products);
}      

export async function getById(req: Request, res: Response) {
  const { id } = req.params;

  try {    
    const product = await getProductById(id, client);    
    if (!product) return res.status(404).json({ error: "Produto não encontrado" });

    res.json(product);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function searchProduct(req: Request, res: Response) {
  console.log(req)
  console.log('sadsas')
   if (req.method !== "GET") return res.status(405).end();

  const q = req.query.q?.toString().trim();

  if (!q || typeof q !== "string") {
    return res.status(400).json({ message: "Parâmetro de busca inválido." });
  }
  if (!q) return res.status(400).json({ error: "Missing query" });

  try {    
    const products = await getProductsByQuery(q, client);
    return res.status(200).json(products);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}