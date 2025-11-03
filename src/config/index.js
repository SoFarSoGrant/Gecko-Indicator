/**
 * Configuration Module
 *
 * Centralized configuration for the Gecko Indicator system.
 * Loads from environment variables and provides defaults.
 *
 * @module src/config
 */

export const config = {
  // Environment
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  // API Configuration
  api: {
    port: parseInt(process.env.API_PORT || '3000'),
    host: process.env.API_HOST || 'localhost',
  },

  // TradingView Authentication
  tradingView: {
    session: process.env.SESSION || '',
    signature: process.env.SIGNATURE || '',
  },

  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/gecko_indicator',
  },

  // Redis Cache
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Multi-Timeframe Configuration
  timeframes: {
    low: process.env.DEFAULT_TIMEFRAME || '5m',
    available: ['1m', '5m', '15m', '60m', '240m', '1D', '1W', '1M'],
  },

  // Trading Symbols
  symbols: (process.env.DATA_SYMBOLS || 'BTCUSDT,ETHUSDT,EURUSD,GBPUSD,SPY').split(','),

  // Indicator Parameters
  indicators: {
    emaLengths: (process.env.EMA_LENGTHS || '8,21,50,200').split(',').map(Number),
    atrLength: parseInt(process.env.ATR_LENGTH || '14'),
    normalizeMethod: process.env.NORMALIZE_METHOD || 'minmax',
  },

  // Gecko Pattern Parameters
  geckoPattern: {
    comaBarRequired: 30,
    consolidation: {
      minBars: 20,
      maxBars: 100,
      touchesRequired: 3,
    },
    momentumAtrMultiple: 1.5,
    testBarAtrMultiple: 1.5,
    filters: {
      minStopRunLevels: 1,
      minATRRatio: 0.3,
      swingProximity: 3.0,
    },
  },

  // Model Configuration
  model: {
    path: process.env.MODEL_PATH || './data/models/gecko_model.json',
    checkpointPath: process.env.CHECKPOINT_PATH || './data/models/checkpoints',
    minConfidence: parseFloat(process.env.MIN_PATTERN_CONFIDENCE || '0.70'),
  },

  // Backtesting Parameters
  backtest: {
    startDate: process.env.BACKTEST_START_DATE || '2024-01-01',
    endDate: process.env.BACKTEST_END_DATE || '2025-10-31',
    initialCapital: parseInt(process.env.BACKTEST_INITIAL_CAPITAL || '10000'),
    minSharpeRatio: parseFloat(process.env.MIN_BACKTEST_SHARPE_RATIO || '1.5'),
    minWinRate: parseFloat(process.env.MIN_BACKTEST_WIN_RATE || '0.65'),
  },

  // Alerts Configuration
  alerts: {
    enabled: process.env.ENABLE_ALERTS === 'true',
    webhookUrl: process.env.ALERT_WEBHOOK_URL || '',
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
  },

  // Feature Engineering
  features: {
    normalizationMethod: process.env.NORMALIZE_METHOD || 'minmax',
    windowSize: 20,
    lookbackPeriods: 50,
  },
};

/**
 * Validate configuration on startup
 */
export function validateConfig() {
  const errors = [];

  // Check required environment variables
  if (!config.tradingView.session && process.env.NODE_ENV === 'production') {
    errors.push('SESSION environment variable is required in production');
  }

  if (!config.tradingView.signature && process.env.NODE_ENV === 'production') {
    errors.push('SIGNATURE environment variable is required in production');
  }

  // Validate port
  if (config.api.port < 1 || config.api.port > 65535) {
    errors.push('API_PORT must be between 1 and 65535');
  }

  // Validate indicator lengths
  if (!config.indicators.emaLengths || config.indicators.emaLengths.length === 0) {
    errors.push('EMA_LENGTHS must be defined');
  }

  if (config.indicators.atrLength < 1) {
    errors.push('ATR_LENGTH must be greater than 0');
  }

  // Return validation result
  return {
    isValid: errors.length === 0,
    errors,
  };
}

export default config;
