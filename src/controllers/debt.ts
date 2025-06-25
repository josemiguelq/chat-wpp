import { Request, Response } from "express";
import { saveDebt } from "../db/debt";
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