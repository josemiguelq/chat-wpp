import { Request, Response } from "express";
import { saveDebt, listPaginatedDebts, listPaginatedCustomerDebts } from "../db/debt";
import {client} from './../db/connection'

export async function createDebt(req: Request, res: Response) {
  try {
    const { customerId, retrievedBy, items, soldBy } = req.body as {
      customerId: string;
      retrievedBy: string;
      soldBy: string;
      items: {
        name: string;
        price: number;
        quantity: number;
      }[];
    };

    if (!customerId || !retrievedBy || !items?.length) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }

    const result = await saveDebt({ customerId, retrievedBy, soldBy, items }, client);

    return res.status(201).json({ message: "Dívida registrada com sucesso", id: result.insertedId });
  } catch (error) {
    console.error("Erro ao criar dívida:", error);
    return res.status(500).json({ error: "Erro interno ao registrar dívida." });
  }
}

export async function listPaginatedDebtsController(req: Request, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 10;

  try {    
    const result = await listPaginatedDebts(client, { page, pageSize });
    res.json(result);
  } catch (err) {
    console.error("Erro ao listar dívidas paginadas:", err);
    res.status(500).json({ error: "Erro interno ao listar dívidas" });
  }
}

export async function listPaginatedCustomerDebtsController(req: Request, res: Response) {
  const customerId = req.params.id;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 10;

  if (!customerId) {
    return res.status(400).json({ error: "Parâmetro 'customerId' é obrigatório" });
  }

  try {
    const result = await listPaginatedCustomerDebts(customerId, client, { page, pageSize });
    res.json(result);
  } catch (err) {
    console.error("Erro ao listar dívidas do cliente:", err);
    res.status(500).json({ error: "Erro interno ao listar dívidas" });
  }
}
