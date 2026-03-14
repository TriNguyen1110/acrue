/**
 * Asset seed script
 *
 * Fetches all US-listed symbols from Finnhub's /stock/symbol endpoint and
 * populates the assets table. Run once on initial setup, and via the weekly
 * sync cron to pick up new listings and delistings.
 *
 * Usage:
 *   npx prisma db seed
 *   (or: npx tsx prisma/seed.ts)
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Map Finnhub MIC exchange codes to human-readable names
const MIC_MAP: Record<string, string> = {
  XNYS: "NYSE",
  XNAS: "NASDAQ",
  XASE: "AMEX",
  ARCX: "NYSE Arca",
  BATS: "CBOE BZX",
  EDGX: "CBOE EDGX",
  IEXG: "IEX",
  XCHI: "CHX",
  XPHL: "NASDAQ PHLX",
};

// Only seed these types — keeps the table to investable securities
const INCLUDE_TYPES = new Set(["Common Stock", "ETP"]);

interface FinnhubSymbol {
  symbol: string;
  description: string;
  mic: string;
  type: string;
}

async function main() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) throw new Error("FINNHUB_API_KEY is not set in .env");

  console.log("Fetching US symbols from Finnhub...");
  const res = await fetch(
    `https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${apiKey}`
  );
  if (!res.ok) throw new Error(`Finnhub responded ${res.status}`);

  const all: FinnhubSymbol[] = await res.json();

  const symbols = all.filter(
    (s) =>
      INCLUDE_TYPES.has(s.type) &&
      s.symbol?.trim() &&
      s.description?.trim()
  );

  console.log(
    `${all.length} total symbols → ${symbols.length} after filtering (Common Stock + ETP)`
  );

  // Upsert in chunks of 500 to avoid exceeding query size limits
  const CHUNK = 500;
  let inserted = 0;

  for (let i = 0; i < symbols.length; i += CHUNK) {
    const chunk = symbols.slice(i, i + CHUNK);

    await prisma.asset.createMany({
      data: chunk.map((s) => ({
        ticker: s.symbol.toUpperCase(),
        name: s.description,
        exchange: MIC_MAP[s.mic] ?? s.mic,
        type: s.type,
      })),
      skipDuplicates: true,
    });

    inserted += chunk.length;
    process.stdout.write(`\r  ${inserted}/${symbols.length}`);
  }

  const total = await prisma.asset.count();
  console.log(`\nDone. ${total} assets in DB.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
