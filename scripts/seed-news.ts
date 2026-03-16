/**
 * One-shot script — ingests all configured RSS feeds immediately.
 * Run from the project root:  npx tsx scripts/seed-news.ts
 */
import { ingestRssFeeds } from "@/services/news";

async function main() {
  console.log("Ingesting RSS feeds...");
  const count = await ingestRssFeeds();
  console.log(`Done: ${count} new article(s) created`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
