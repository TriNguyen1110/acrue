declare module "sentiment" {
  interface SentimentResult {
    score:         number;
    comparative:   number;
    tokens:        string[];
    words:         string[];
    positive:      string[];
    negative:      string[];
    calculation:   Array<Record<string, number>>;
  }

  interface SentimentOptions {
    language?:    string;
    extras?:      Record<string, number>;
  }

  class Sentiment {
    analyze(phrase: string, options?: SentimentOptions): SentimentResult;
  }

  export = Sentiment;
}
