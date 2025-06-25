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


type ListDebtsOptions = {
  page?: number;
  pageSize?: number;
};

export async function listPaginatedDebts(client: MongoClient, options: ListDebtsOptions = {}) {
  const db = client.db("store_wpp_database");
  const debts = db.collection("debts");
  const customers = db.collection("customers");

  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 10;
  const skip = (page - 1) * pageSize;

  const pipeline = [
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: pageSize },
    {
      $lookup: {
        from: "customers",
        localField: "customerId",
        foreignField: "_id",
        as: "customer",
      },
    },
    { $unwind: "$customer" },
    {
      $project: {
        customer: { name: 1, company: 1 },
        createdAt: 1,
        total: 1,
        payments: 1,
        items: 1,
        retrievedBy: 1,
        soldBy: 1,
      },
    },
  ];

  const data = await debts.aggregate(pipeline).toArray();

  const totalCount = await debts.countDocuments();

  return {
    data,
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}

export async function listPaginatedCustomerDebts(customerId: string, client: MongoClient, options: ListDebtsOptions) {
  const db = client.db("store_wpp_database");
  const debts = db.collection("debts");

  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 10;
  const skip = (page - 1) * pageSize;

  const pipeline = [
    {
      $match: {
        customerId: new ObjectId(customerId),
      },
    },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: pageSize },
    {
      $lookup: {
        from: "customers",
        localField: "customerId",
        foreignField: "_id",
        as: "customer",
      },
    },
    { $unwind: "$customer" },
    {
      $project: {
        customer: { name: 1, company: 1 },
        createdAt: 1,
        total: 1,
        payments: 1,
        items: 1,
        retrievedBy: 1,
        soldBy: 1,
      },
    },
  ];

  const data = await debts.aggregate(pipeline).toArray();

  const totalCount = await debts.countDocuments({ customerId: new ObjectId(customerId) });

  return {
    data,
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}
