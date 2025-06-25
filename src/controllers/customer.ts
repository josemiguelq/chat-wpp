import { Request, Response } from "express";
import { saveCustomer, listCustomers, findCustomersByName } from "../db/customer";
import {client} from './../db/connection'

export async function createCustomer(req: Request, res: Response) {
  try {    
    const { name, phone, company } = req.body as { name: string; company?: string; phone?: string };

    if (!name) {
      return res.status(400).json({ error: "Campo 'name' é obrigatório." });
    }
    const result = await saveCustomer({ name, phone, company }, client);

    return res.status(201).json({ message: "Cliente registrado com sucesso", id: result.insertedId });
  } catch (error) {
    console.error("Erro ao registrar cliente:", error);
    return res.status(500).json({ error: "Erro interno ao registrar cliente." });
  }
}

export async function listCustomersController(req: Request, res: Response) {
  try {    
    const customers = await listCustomers(client);

    return res.json(customers);
  } catch (error) {
    console.error("Erro ao listar clientes:", error);
    return res.status(500).json({ error: "Erro ao listar clientes" });
  }
}

export async function searchCustomerByName(req: Request, res: Response) {
  const nameQuery = req.query.name?.toString().trim();

  if (!nameQuery) {
    return res.status(400).json({ error: "Parâmetro 'name' é obrigatório." });
  }

  try {
    const customers = await findCustomersByName(client, nameQuery);
    res.json(customers);
  } catch (err) {
    console.error("Erro ao buscar cliente:", err);
    res.status(500).json({ error: "Erro ao buscar cliente" });
  }
}
