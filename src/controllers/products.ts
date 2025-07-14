
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
  
      const basicInfo = `${product.brand} ${product.model}, also known as ${aka}`;
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
    try {
        await client.connect();
        const db = client.db("store_wpp_database");
        const collection = db.collection("products");

        // Parse query parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const category = req.query.category as string;
        const name = req.query.name as string;

        // Build filter object
        const filter: any = {};
        
        if (category && category.trim()) {
            filter.type = new RegExp(category.trim(), 'i');
        }
        
        if (name && name.trim()) {
            filter.$or = [
                { name: new RegExp(name.trim(), 'i') },
                { model: new RegExp(name.trim(), 'i') }
            ];
        }

        // Calculate skip value for pagination
        const skip = (page - 1) * limit;

        // Get total count for pagination metadata
        const totalCount = await collection.countDocuments(filter);

        // Fetch paginated products
        const products = await collection
            .find(filter, {
                projection: {
                    model: 1,
                    type: 1,
                    brand: 1,
                    stock: 1,
                    variations: 1,
                    name: 1,
                    notes: 1,
                    related_models: 1,
                    related_products: 1,
                    _id: 1,
                }
            })
            .sort({ _id: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalCount / limit);
        const hasNextPage = page < totalPages;
        const hasPreviousPage = page > 1;

        res.json({
            products,
            pagination: {
                currentPage: page,
                totalPages,
                totalCount,
                limit,
                hasNextPage,
                hasPreviousPage
            },
            filters: {
                category: category || null,
                name: name || null
            }
        });
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: "Erro ao buscar produtos" });
    }
}      

export async function getById(req: Request, res: Response) {
  const { id } = req.params;

  try {    
    const product = await getProductById(id, client);    
    if (!product) return res.status(404).json({ error: "Produto não encontrado" });

    res.json(product);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export async function update(req: Request, res: Response) {
  const { id } = req.params;
  const productData = req.body;

  try {
    await client.connect();
    const db = client.db("store_wpp_database");
    const collection = db.collection("products");

    // Verificar se o produto existe
    const existingProduct = await getProductById(id, client);
    if (!existingProduct) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    // Preparar dados do produto com valores padrão se necessário
    const updatedProduct = {
      ...productData,
      type_labels: productData.type_labels || [],
      related_products: productData.related_products || [],
      related_models: productData.related_models || [],
      variations: productData.variations || [],
      notes: productData.notes || "",
    };

    // Remover o documento antigo do vector index
    await collection.deleteOne({ _id: existingProduct._id });

    // Gerar novo summary com os dados atualizados
    const newSummary = await createProductSummary(updatedProduct);

    // Criar o novo documento com vector index atualizado
    const recordWithSummary = {
      pageContent: newSummary,
      metadata: { ...updatedProduct },
    };

    // Inserir o novo documento com vector index
    await MongoDBAtlasVectorSearch.fromDocuments(
      [recordWithSummary],
      new OpenAIEmbeddings(),
      {
        collection,
        indexName: "vector_index",
        textKey: "embedding_text",
        embeddingKey: "embedding",
      }
    );

    console.log("Successfully updated product:", updatedProduct.model);
    
    res.json({ 
      message: "Produto atualizado com sucesso", 
      product: recordWithSummary.metadata 
    });

  } catch (err: any) {
    console.error("Error updating product:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function deleteProduct(req: Request, res: Response) {
  const { id } = req.params;

  try {
    await client.connect();
    const db = client.db("store_wpp_database");
    const collection = db.collection("products");

    // Verificar se o produto existe
    const existingProduct = await getProductById(id, client);
    if (!existingProduct) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    // Deletar o produto
    const result = await collection.deleteOne({ _id: existingProduct._id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    console.log("Successfully deleted product:", existingProduct.model);
    
    res.json({ 
      message: "Produto deletado com sucesso", 
      deletedId: id 
    });

  } catch (err: any) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: err.message });
  }
}