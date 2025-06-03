import { ObjectId, MongoClient } from "mongodb";
import { Product } from "./../wire/db/product"; 

export async function getProductById(id: string, client: MongoClient) {
  await client.connect();
      const db = client.db("store_wpp_database");
  const collection = db.collection<Product>("products");

  const product = await collection.findOne({ _id: new ObjectId(id) });
  return product;
}