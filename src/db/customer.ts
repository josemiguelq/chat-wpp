import { MongoClient } from "mongodb";

interface CreateCustomerInput {
  name: string;
  phone?: string;
  company?: string;
}

export async function saveCustomer(input: CreateCustomerInput, client: MongoClient) {
  const db = client.db("store_wpp_database");
  const customers = db.collection("customers");

  const customer = {
    name: input.name,
    phone: input.phone ?? null,
    company: input.company ?? null,
    createdAt: new Date()
  };

  const result = await customers.insertOne(customer);
  return { insertedId: result.insertedId };
}

export async function listCustomers(client: MongoClient) {
  const db = client.db("store_wpp_database");
  const customers = db.collection("customers");

  const result = await customers
    .find({}, { projection: { name: 1, phone: 1, company: 1 } })
    .sort({ name: 1 })
    .toArray();

  return result.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    phone: c.phone ?? null,
    company: c.company ?? null,
  }));
}

export async function findCustomersByName(client: MongoClient, nameQuery: string) {
  const db = client.db("store_wpp_database");
  const customers = db.collection("customers");

  const regex = new RegExp(`^${nameQuery}`, "i");

  const result = await customers
    .find({ name: { $regex: regex } })
    .project({ name: 1, phone: 1, company: 1 })
    .limit(10)
    .toArray();

  return result.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    phone: c.phone ?? null,
    company: c.company ?? null,
  }));
}
