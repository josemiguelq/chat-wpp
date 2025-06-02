import { User } from "./../wire/db/user";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { MongoClient } from "mongodb";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

export async function getByEmail(email:string, client: MongoClient) {    
    const userCollection = client.db().collection<User>("users");
    const existing = await userCollection.findOne({ email });
    return existing;
}


export async function create(userData: {
    name: string;
    email: string;
    password: string;
    companyId: string;
    roleId: string;
  }, client: MongoClient) {    
    const userCollection = client.db().collection<User>("users");
    console.log(userData)
    const passwordHash = await bcrypt.hash(userData.password, 4);
    console.log(passwordHash)

    const newUser: User = {
        ...userData,
        passwordHash,
      };
    delete (newUser as any).password;
    const result = await userCollection.insertOne(newUser);
    return result;
}
