import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const database = new Pool({
  user: process.env.NEXT_PUBLIC_DB_USER,
  host: process.env.NEXT_PUBLIC_DB_HOST,
  database: process.env.NEXT_PUBLIC_DB_NAME,
  password: process.env.NEXT_PUBLIC_DB_PASS,
  port: 5432,
});

export const query = async (text: string, params: any[] = []) => {
  const client = await database.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
};
