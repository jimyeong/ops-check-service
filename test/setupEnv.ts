import { config } from "dotenv";

config({ path: ".env.test" });

if (process.env.DB_NAME && !process.env.DB_NAME.includes("test")) {
  throw new Error("Refusing to run tests against non-test DB.");
}
