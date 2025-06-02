import { Request, Response, NextFunction } from "express";
import { verifyToken } from "./../controllers/auth";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);
    (req as any).auth = payload; // anexar no req
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}