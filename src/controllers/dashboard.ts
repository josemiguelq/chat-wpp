import { Request, Response } from "express";
import { client } from './../db/connection';

export async function getDashboardData(req: Request, res: Response) {
  try {
    await client.connect();
    const db = client.db("store_wpp_database");
    
    // Coleções
    const ordersCollection = db.collection("orders");
    const debtsCollection = db.collection("debts");
    const customersCollection = db.collection("customers");
    
    // Total de pedidos (se houver coleção de pedidos)
    const totalOrders = await ordersCollection.countDocuments() || 0;
    
    // Valor total vendido (soma das dívidas pagas ou valor dos pedidos)
    const salesAggregation = await debtsCollection.aggregate([
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$amount" }
        }
      }
    ]).toArray();
    
    const totalSales = salesAggregation.length > 0 ? salesAggregation[0].totalSales : 0;
    
    // Clientes que mais devem
    const topDebtorsAggregation = await debtsCollection.aggregate([
      {
        $match: {
          status: { $ne: "paid" } // Apenas dívidas não pagas
        }
      },
      {
        $group: {
          _id: "$customerId",
          totalDebt: { $sum: "$amount" }
        }
      },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customer"
        }
      },
      {
        $unwind: "$customer"
      },
      {
        $project: {
          _id: 1,
          name: "$customer.name",
          totalDebt: 1
        }
      },
      {
        $sort: { totalDebt: -1 }
      },
      {
        $limit: 5
      }
    ]).toArray();
    
    // Vendas dia a dia (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const dailySalesAggregation = await debtsCollection.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          amount: { $sum: "$amount" }
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          amount: 1
        }
      },
      {
        $sort: { date: 1 }
      }
    ]).toArray();
    
    // Preencher dias sem vendas com valor 0
    const dailySales = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      
      const existingSale = dailySalesAggregation.find(sale => sale.date === dateString);
      dailySales.push({
        date: dateString,
        amount: existingSale ? existingSale.amount : 0
      });
    }
    
    res.json({
      totalOrders,
      totalSales,
      topDebtors: topDebtorsAggregation,
      dailySales
    });
    
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ error: "Erro ao buscar dados do dashboard" });
  }
} 