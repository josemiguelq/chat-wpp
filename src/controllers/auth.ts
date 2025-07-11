import { Request, Response } from "express";
import { MongoClient } from "mongodb";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {client} from './../db/connection'

import * as userDb from "./../db/user";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

export async function register(req: Request, res: Response) {
  try {
    const { name, email, password, companyId, roleId } = req.body;

    const existingUser = await userDb.getByEmail(email, client);
    if (existingUser) {
      return res.status(400).json({ error: "Email já cadastrado" });
    }

    const result = await userDb.create(
      { name, email, password, companyId, roleId },
      client
    );

    res.status(201).json({ insertedId: result.insertedId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    const user = await userDb.getByEmail(email, client);
    if (!user) return res.status(401).json({ error: "Usuário não encontrado" });

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return res.status(401).json({ error: "Senha incorreta" });

    const token = jwt.sign(
        {
          userId: user._id,
          companyId: user.companyId,
          roleId: user.roleId,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

    // Não retorne passwordHash para o cliente
    const { passwordHash, ...safeUser } = user;

    res.json({ token, user: safeUser });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
}

export async function me (req: Request, res: Response) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await userDb.getById(decoded.userId, client);

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    console.log(err)
    return res.status(401).json({ error: "Token inválido" });
  }
}

export function verifyToken(token: string) {
    return jwt.verify(token, JWT_SECRET) as {
      userId: string;
      companyId: string;
      roleId: string;
    };
  }