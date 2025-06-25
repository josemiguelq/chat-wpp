import { MongoClient, ObjectId } from "mongodb";

interface DebtItem {
  name: string;
  price: number;
  quantity: number;
  paid?: boolean;
  totalPaid?: number;
    totalDebt?: number;
}

interface CreateDebtInput {
  customerId: string;
  retrievedBy: string;
  soldBy: string;
  items: DebtItem[];
}

export async function saveDebt(input: CreateDebtInput, client: MongoClient) {
  await client.connect();
  const db = client.db("store_wpp_database");
  const debts = db.collection("debts");

  const now = new Date();
  const total = input.items.reduce((sum, item) => sum + (item.price || 0), 0);


  const debtDocument = {
    customerId: new ObjectId(input.customerId),
    retrievedBy: input.retrievedBy,
    items: input.items.map(item => ({
      ...item,      
      paid: item.paid ?? false
    })),
    total,
    totalPaid: 0,
    totalDebt: total,
    payments: [],
    createdAt: now
  };

  const result = await debts.insertOne(debtDocument);

  return { insertedId: result.insertedId };
}