import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __quizMakerPool?: Pool;
};

export const pool =
  globalForDb.__quizMakerPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__quizMakerPool = pool;
}

export const db = drizzle(pool, { schema });
export type Database = typeof db;
