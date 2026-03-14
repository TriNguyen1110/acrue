export interface User {
  id: string;
  email: string;
  preferences: UserPreferences;
  createdAt: string;
}

export interface UserPreferences {
  signalWeights?: SignalWeights;
  theme?: "dark";
  defaultRiskProfile?: "conservative" | "moderate" | "aggressive";
}

export interface SignalWeights {
  priceMomentum: number;
  volumeAnomaly: number;
  volatility: number;
  newsSentiment: number;
}

export interface AuthSession {
  user: {
    id: string;
    email: string;
  };
  expires: string;
}

export interface ApiError {
  error: string;
  message: string;
}
