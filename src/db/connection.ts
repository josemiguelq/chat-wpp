import { MongoClient } from "mongodb";

export const client = new MongoClient(process.env.MONGODB_ATLAS_URI as string);