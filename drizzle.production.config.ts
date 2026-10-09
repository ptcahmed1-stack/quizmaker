import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Used to create/update the schema on a production database:
//   DATABASE_URL=postgresql://... npx drizzle-kit push --config=drizzle.production.config.ts
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
