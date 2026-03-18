import NewsFeed from "@/components/stateful/NewsFeed";

export default function NewsPage() {
  return (
    <main className="p-8 max-w-5xl">
      <div className="mb-8 text-center">
        <h1
          className="font-display text-4xl text-gold-400 mb-2"
          style={{ textShadow: "0 0 24px rgba(247,243,229,0.35), 0 0 48px rgba(247,243,229,0.12)" }}
        >
          News
        </h1>
        <p className="text-text-secondary text-sm max-w-xl mx-auto">
          Sentiment-scored headlines from tier-1 sources, filtered to your watchlist tickers and macro topics like Fed, earnings, and inflation.
        </p>
      </div>
      <NewsFeed />
    </main>
  );
}
