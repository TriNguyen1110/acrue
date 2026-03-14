export type AlertType = "price_change" | "volume_spike" | "volatility";
export type AlertSeverity = "low" | "medium" | "high";

export interface Alert {
  id: string;
  ticker: string;
  type: AlertType;
  message: string;
  severity: AlertSeverity;
  triggeredAt: string;
  read: boolean;
  rules: AlertRuleConfig;
}

export interface AlertRuleConfig {
  ruleType?: AlertType;
  threshold?: number;    // e.g. 5.0 for 5% price move
  cooldownMinutes?: number;
}

export interface CreateAlertRuleRequest {
  ticker: string;
  ruleType: AlertType;
  threshold: number;
  cooldownMinutes: number;
}

export interface UnreadAlertsResponse {
  count: number;
  alerts: Alert[];
}

export interface PaginatedAlerts {
  alerts: Alert[];
  page: number;
  limit: number;
  total: number;
}
