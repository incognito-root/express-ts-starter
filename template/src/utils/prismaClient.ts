import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../../generated/prisma/client";
import { getEnv } from "../config/env";

const { DATABASE_URL, DB_POOL_SIZE } = getEnv();

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: DB_POOL_SIZE,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  omit: {
    user: {
      password: true,
    },
  },
});

export default prisma;
