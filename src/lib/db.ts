import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

class Db {
  private static client: NeonQueryFunction<false, false> | null = null;

  static get sql(): NeonQueryFunction<false, false> {
    if (!Db.client) {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error("DATABASE_URL não definido");
      Db.client = neon(url);
    }
    return Db.client;
  }
}

export const sql = Object.assign(
  (strings: TemplateStringsArray, ...params: unknown[]) => Db.sql(strings, ...params),
  {
    query: (text: string, params?: unknown[]) => Db.sql.query(text, params),
    transaction: (queries: Parameters<NeonQueryFunction<false, false>["transaction"]>[0]) => Db.sql.transaction(queries),
  },
);
