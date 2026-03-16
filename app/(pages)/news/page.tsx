import NewsFeed from "@/components/stateful/NewsFeed";

export default function NewsPage() {
  return (
    <main className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-gold-400 mb-2">News</h1>
        <p className="text-text-secondary text-sm">Market news and macro events for your watchlist.</p>
      </div>
      <NewsFeed />
    </main>
  );
}
