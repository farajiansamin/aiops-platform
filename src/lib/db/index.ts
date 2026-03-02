import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

function getDatabaseUrl(): string {
  return process.env.POSTGRES_URL ?? "postgresql://localhost:5432/aiops";
}

export const db = drizzle(getDatabaseUrl(), { schema });

export { schema };
