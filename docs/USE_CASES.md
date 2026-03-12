ACRUE USE CASES
Use Case 1 – Manage Watchlist
Primary Actor:
 Logged-in User
Goal:
 Allow users to add, remove, and manage assets they want to track and monitor.

Preconditions
User is authenticated.
Asset database exists containing ticker symbols and company metadata.

Main Flow
User opens the Watchlist page.
User enters a ticker symbol or company name in the search bar.
System queries the asset database and returns matching results.
User selects a ticker from the search results.
System adds the asset to the user's watchlist.
The watchlist is updated and displayed on the dashboard.

Alternate Flows
A1 – Remove Asset
User selects an asset in the watchlist.
User clicks Remove.
System deletes the asset from the watchlist.



A2 – Add Asset from Other Pages
User views a ticker on another page (News, Signals).
User clicks Add to Watchlist.
System adds the asset to the watchlist.



Exceptions
E1 – Asset Not Found
If no ticker matches the search query, the system displays “No results found.”

E2 – Duplicate Asset
If the ticker already exists in the watchlist, the system prevents duplicate entries.

Postconditions
Watchlist is updated.
Monitoring services begin tracking the newly added asset.

Use Case 2 – Event Detection & Smart Alerts
Primary Actor:
 Logged-in User
Goal:
 Notify users when unusual or important market events occur for assets in their watchlist.

Preconditions
User is authenticated.
Watchlist contains at least one asset.
Market data feeds are available.

Main Flow
System periodically ingests market data for watched assets.
System calculates baseline metrics such as:
price return
trading volume
volatility.
Event detection rules are applied.
If a rule is triggered (e.g., abnormal price change), the system generates an alert.
System attaches an explanation of the trigger.
Alert is sent to the user through push notifications.
Alert is stored in the Alert History.

Alternate Flows
A1 – User Adjusts Alert Sensitivity
User modifies alert thresholds in settings.
System updates detection rules for future monitoring cycles.

A2 – Multiple Events Detected
System ranks events by severity and bundles them into a summary notification.

Exceptions
E1 – Data Source Unavailable
System retries data retrieval and temporarily marks data as delayed.

E2 – Duplicate Alerts
System suppresses duplicate alerts within a defined cooldown window.

Postconditions
Alerts are recorded with timestamps and explanations.
User is notified of important market events.

Use Case 3 – News Impact Insights
Primary Actor:
 Logged-in User
Goal:
 Provide insights on how recent news may affect assets in the user's watchlist.

Preconditions
User is authenticated.
News data sources are available.
Asset metadata exists for entity matching.

Main Flow
System periodically retrieves news articles and headlines.
Natural language processing identifies relevant entities:
companies
sectors
macroeconomic themes.
System analyzes sentiment of the news content.
System links news articles to related assets in the user's watchlist.
System generates a concise insight including:
summary
sentiment
potential impact.
User views insights on the News Impact page.

Alternate Flows
A1 – Filter News
User filters news by ticker, sector, or topic.

A2 – Expand Article
User requests additional context for a news item.

Exceptions
E1 – Paywalled Content
System uses headline and snippet only.

E2 – NLP Processing Failure
System falls back to rule-based entity detection.

Postconditions
News insights are stored.
Related assets are updated with news impact references.

Use Case 4 – Cumulative Signal Scoring
Primary Actor:
 Logged-in User
Goal:
 Provide a summarized signal score that aggregates multiple indicators to help users quickly assess market opportunities or risks.

Preconditions
User is authenticated.
Market data and news sentiment data are available.

Main Flow
User opens the Signals page.
System collects indicators for each watched asset, including:
price momentum
trading volume anomalies
volatility changes
news sentiment.
Indicators are normalized to a standard scale.
System applies weighted scoring to compute a Cumulative Signal Score.
System determines a confidence level based on signal agreement and data completeness.
Results are displayed in a ranked list of assets.

Alternate Flows
A1 – User Adjusts Signal Weights
User modifies signal weighting preferences.
System recalculates scores.

A2 – Sort Signals
User sorts assets by bullish or bearish signal strength.

Exceptions
E1 – Missing Data
If some signals are unavailable, system computes score with reduced confidence.

Postconditions
Signal scores are stored for future comparison.
Users gain quick insight into asset trends.

Use Case 5 – Portfolio Optimization & Scenario Analysis
Primary Actor:
 Logged-in User
Goal:
 Help users optimize portfolio allocation and evaluate potential outcomes under different market scenarios.

Preconditions
User is authenticated.
User has entered portfolio holdings.
Historical market data is available.

Main Flow
User opens the Portfolio page.
User enters or imports current holdings.
System calculates current portfolio metrics:
expected return
volatility
correlation matrix
diversification score.
User clicks Optimize Portfolio.
System runs a portfolio optimization model.
System generates suggested asset allocation.
User optionally runs scenario simulations by defining events such as:
market downturn
sector shock
volatility increase.
System performs probabilistic simulation to project portfolio outcomes.
System displays a visualization showing:
expected outcome path
upside and downside scenarios
probability bands (color intensity indicates likelihood).
User compares optimized and current portfolio outcomes.

Alternate Flows
A1 – Change Risk Preference
User selects conservative, moderate, or aggressive risk levels.



A2 – Modify Allocation
User manually adjusts asset weights and recalculates portfolio metrics.

Exceptions
E1 – Insufficient Historical Data
System excludes assets lacking sufficient data.



E2 – Over-Constrained Portfolio
System provides best feasible solution if constraints limit optimization.

Postconditions
Portfolio recommendations are generated.
Simulation results are stored.
User gains insight into potential portfolio performance.


Tech Stack for Speed
Backend: Node
Market Data:
Yahoo Finance API
Alpha Vantage
Polygon
News: NewsAPI
Signals / Finance:
pandas
numpy
yfinance
PyPortfolioOpt

Frontend:
React and Next.js
Charts
Recharts or Chart.js

Database: PostgreSQL


