# TradingView-API: Machine Learning Indicator Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture & Core Concepts](#architecture--core-concepts)
3. [Setup & Installation](#setup--installation)
4. [Authentication](#authentication)
5. [Data Collection Fundamentals](#data-collection-fundamentals)
6. [Building ML Training Datasets](#building-ml-training-datasets)
7. [Real-Time Data Streaming](#real-time-data-streaming)
8. [Historical Data & Backtesting](#historical-data--backtesting)
9. [Advanced Features](#advanced-features)
10. [ML Integration Patterns](#ml-integration-patterns)
11. [Complete Implementation Example](#complete-implementation-example)
12. [Best Practices & Optimization](#best-practices--optimization)

---

## Overview

The TradingView-API is a JavaScript/TypeScript library that provides programmatic access to TradingView's market data, technical indicators, and charting functionality. It enables developers to:

- **Retrieve real-time and historical market data** from any trading pair on any exchange
- **Access TradingView's technical indicators** (both built-in and custom/private indicators)
- **Stream live price updates** with custom event handlers
- **Replay historical data** for backtesting machine learning models
- **Combine multiple indicators** for feature engineering
- **Integrate with ML frameworks** for model training and inference

This guide focuses on leveraging the API to create machine learning-based trading indicators that can:
- Collect training data from multiple symbols and timeframes
- Extract technical indicator values as features
- Backtest models on historical data
- Deploy models for real-time predictions

---

## Architecture & Core Concepts

### Core Components

The TradingView-API operates using a layered architecture:

```
┌─────────────────────────────────────────┐
│     ML Indicator Application            │
│  (Your custom prediction logic)          │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│    TradingView-API Wrapper Layer        │
│  - Client connection management         │
│  - Protocol handling                    │
│  - Data transformation                  │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  TradingView WebSocket Service          │
│  - Real-time data streaming             │
│  - Historical data retrieval            │
│  - Indicator computation                │
└─────────────────────────────────────────┘
```

### Key Objects

#### 1. **Client**
The main connection object that establishes a WebSocket session with TradingView.
```javascript
const client = new TradingView.Client({
  token: process.env.SESSION,      // Optional: for authenticated requests
  signature: process.env.SIGNATURE  // Optional: for authenticated requests
});
```

#### 2. **Chart**
Represents a chart/instrument instance that streams price data.
```javascript
const chart = new client.Session.Chart();
chart.setMarket('BINANCE:BTCEUR', { timeframe: 'D' });
```

#### 3. **Study (Indicator)**
An indicator attached to a chart that computes technical analysis values.
```javascript
const indicator = new TradingView.BuiltInIndicator('RSI@tv-basicstudies-241');
const study = new chart.Study(indicator);
```

#### 4. **Periods**
Time-series data for price candles or indicator values. Each period represents one candle/interval.
```javascript
chart.periods[0]  // Current period (most recent)
study.periods[0]  // Current indicator values for this period
```

### Data Flow for ML

```
Search Market → Authenticate → Create Client → Create Chart →
Add Indicators → Stream Data → Collect Periods → Transform Features →
Feed to ML Model → Generate Predictions
```

---

## Setup & Installation

### Prerequisites
- **Node.js** 14.0+ (for JavaScript/TypeScript environment)
- **npm** or **yarn** package manager
- **TradingView account** (free account works for basic features; pro features require subscription)
- **Environment variables setup** (for authenticated access)

### Installation Steps

#### Step 1: Initialize Project
```bash
mkdir ml-trading-bot
cd ml-trading-bot
npm init -y
```

#### Step 2: Install TradingView-API
```bash
# Stable version (recommended)
npm install @mathieuc/tradingview

# OR latest development version
npm install github:Mathieu2301/TradingView-API
```

#### Step 3: Install ML Dependencies (Optional, based on your needs)
```bash
# TensorFlow.js for browser/Node.js ML
npm install @tensorflow/tfjs @tensorflow/tfjs-node

# OR scikit-learn alternative: TensorFlow.js or similar
npm install brain.js  # Neural network library

# Data manipulation and scientific computing
npm install numpy.js pandas-js  # Or use plain JavaScript

# Additional utilities
npm install dotenv axios lodash
```

#### Step 4: Create Environment File
Create a `.env` file in your project root:
```
# TradingView authentication (optional, only if using premium features)
SESSION=your_tradingview_session_cookie_here
SIGNATURE=your_tradingview_signature_cookie_here

# Your application settings
NODE_ENV=development
LOG_LEVEL=debug
```

#### Step 5: Create Basic Project Structure
```
ml-trading-bot/
├── src/
│   ├── config/
│   │   └── config.js
│   ├── data/
│   │   ├── collector.js
│   │   └── preprocessor.js
│   ├── models/
│   │   ├── trainer.js
│   │   └── predictor.js
│   └── index.js
├── examples/
│   ├── simple_data_collection.js
│   ├── indicator_training.js
│   └── backtesting.js
├── .env
├── .gitignore
└── package.json
```

---

## Authentication

### Understanding TradingView Authentication

TradingView-API supports two modes of operation:

#### 1. **Unauthenticated Mode** (Default)
Works with publicly available data and indicators. Good for most use cases.

```javascript
const client = new TradingView.Client();  // No credentials needed
```

**Limitations:**
- Access to public indicators only
- Basic market data available
- No premium features
- Rate limiting may apply

#### 2. **Authenticated Mode** (Pro/Premium)
Required for premium indicators, private indicators, and advanced replay features.

```javascript
const client = new TradingView.Client({
  token: process.env.SESSION,      // Session cookie
  signature: process.env.SIGNATURE  // Signature cookie
});
```

### Getting Authentication Credentials

#### Method 1: Programmatic Login
```javascript
const TradingView = require('@mathieuc/tradingview');

// Function to login and get credentials
async function authenticateUser(email, password) {
  try {
    const user = await TradingView.loginUser(email, password, false);

    console.log('Session ID:', user.session);
    console.log('Signature:', user.signature);

    // Save to .env file
    // Store these securely for future use

    return {
      session: user.session,
      signature: user.signature
    };
  } catch (err) {
    console.error('Authentication failed:', err.message);
  }
}

// Usage
authenticateUser('your-email@example.com', 'your-password');
```

#### Method 2: Manual Cookie Extraction
If programmatic login fails, extract cookies manually:
1. Login to TradingView.com
2. Open Browser DevTools → Application/Storage → Cookies
3. Find cookies named `sessionid` and `signature`
4. Copy their values to your `.env` file

**Security Note:** Never commit `.env` files to version control. Add to `.gitignore`:
```
.env
.env.local
*.log
node_modules/
```

### Handling Authentication in Your Code

```javascript
require('dotenv').config();

const TradingView = require('@mathieuc/tradingview');

// Create client with optional authentication
const clientConfig = {};

if (process.env.SESSION && process.env.SIGNATURE) {
  clientConfig.token = process.env.SESSION;
  clientConfig.signature = process.env.SIGNATURE;
}

const client = new TradingView.Client(clientConfig);

// Check if authenticated
const isAuthenticated = !!(process.env.SESSION && process.env.SIGNATURE);
console.log('Authenticated mode:', isAuthenticated);
```

---

## Data Collection Fundamentals

### Understanding Market Symbols

TradingView uses a standardized symbol format:
```
EXCHANGE:SYMBOL
```

Examples:
- `BINANCE:BTCUSDT` - Bitcoin on Binance
- `NASDAQ:AAPL` - Apple on NASDAQ
- `FOREX:EURUSD` - EUR/USD currency pair
- `NYSE:SPY` - S&P 500 ETF on NYSE

### Finding Available Markets

#### Search for Markets
```javascript
const TradingView = require('@mathieuc/tradingview');

// Search markets on a specific exchange
TradingView.searchMarketV3('BINANCE:').then((results) => {
  console.log('Found markets:', results);
  results.slice(0, 10).forEach(market => {
    console.log(`- ${market.symbol}: ${market.description}`);
  });
});

// Search for specific symbol
TradingView.searchMarketV3('BTC').then((results) => {
  console.log('Bitcoin pairs:', results);
});
```

#### Popular Exchanges for ML Trading
- **Crypto**: BINANCE, COINBASE, KRAKEN, BYBIT
- **Stocks**: NASDAQ, NYSE, AMEX
- **Forex**: FOREX
- **Commodities**: COMEX, NYMEX
- **Indices**: INDEX (TradingView indices)

### Reading Candlestick Data

Each candle (period) contains OHLCV data:

```javascript
const client = new TradingView.Client();
const chart = new client.Session.Chart();

chart.setMarket('BINANCE:BTCUSDT', { timeframe: '15' });  // 15-minute candles

chart.onUpdate(() => {
  const candle = chart.periods[0];  // Most recent candle

  console.log({
    time: new Date(candle.time * 1000),      // Candle close time (Unix timestamp)
    open: candle.open,                         // Opening price
    high: candle.high,                         // Highest price in period
    low: candle.low,                           // Lowest price in period
    close: candle.close,                       // Closing price
    volume: candle.volume,                     // Trading volume
    range: candle.close - candle.open,         // Price range
    bodyPercent: ((candle.close - candle.open) / (candle.high - candle.low)) * 100
  });
});
```

### Understanding Timeframes

Common timeframe strings:
```
'1'    = 1 minute
'5'    = 5 minutes
'15'   = 15 minutes
'30'   = 30 minutes
'60'   = 1 hour
'120'  = 2 hours
'240'  = 4 hours
'D'    = 1 day
'W'    = 1 week
'M'    = 1 month
```

### Basic Data Collection Pattern

```javascript
const TradingView = require('@mathieuc/tradingview');

async function collectMarketData(symbol, timeframe, maxCandles = 100) {
  const client = new TradingView.Client();
  const chart = new client.Session.Chart();

  let candleCount = 0;
  const dataBuffer = [];

  // Configure chart
  chart.setMarket(symbol, { timeframe });

  // Handle errors
  chart.onError((...err) => {
    console.error('Chart error:', ...err);
  });

  // Process updates
  chart.onUpdate(() => {
    if (!chart.periods[0]) return;

    const candle = chart.periods[0];
    dataBuffer.push({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume
    });

    candleCount++;

    if (candleCount >= maxCandles) {
      console.log(`Collected ${candleCount} candles`);
      chart.delete();
      client.end();
    }
  });

  return new Promise((resolve) => {
    chart.onUpdate(() => {
      if (candleCount >= maxCandles) {
        resolve(dataBuffer);
      }
    });
  });
}

// Usage
collectMarketData('BINANCE:BTCUSDT', '60', 50).then((data) => {
  console.log('Data collected:', data);
});
```

---

## Building ML Training Datasets

### Combining Price Data with Indicators

The key to building effective ML models is creating rich feature sets by combining multiple technical indicators.

#### Step 1: Load Indicators

TradingView has thousands of built-in indicators. To use them:

```javascript
const TradingView = require('@mathieuc/tradingview');

// Built-in indicators use standardized format
// Available indicators in TradingView:
const COMMON_INDICATORS = {
  'RSI': 'STD;RSI',                          // Relative Strength Index
  'MACD': 'STD;MACD',                        // MACD
  'EMA_50': 'STD;EMA',                       // Exponential Moving Average
  'SMA_200': 'STD;SMA',                      // Simple Moving Average
  'Volume': 'Volume@tv-basicstudies-241',    // Volume indicator
  'ATR': 'STD;ATR',                          // Average True Range
  'Bollinger': 'STD;BB',                     // Bollinger Bands
  'Stochastic': 'STD;Stoch',                 // Stochastic Oscillator
  'CCI': 'STD;CCI',                          // Commodity Channel Index
  'VWAP': 'STD;VWAP',                        // Volume Weighted Avg Price
};

// Custom/Public indicators use pine script IDs
const CUSTOM_INDICATORS = {
  'MyCustom1': 'PUB;3lEKXjKWycY5fFZRYYujEy8fxzRRUyF3',
  'MyCustom2': 'PUB;5nawr3gCESvSHQfOhrLPqQqT4zM23w3X',
};
```

#### Step 2: Create a Feature Engineering Class

```javascript
class FeatureEngineer {
  constructor(client, chart) {
    this.client = client;
    this.chart = chart;
    this.indicators = new Map();
    this.features = [];
  }

  // Add an indicator to the chart
  async addIndicator(name, indicatorId, options = {}) {
    try {
      // Get indicator definition
      const indicator = indicatorId.includes('@')
        ? new TradingView.BuiltInIndicator(indicatorId)
        : await TradingView.getIndicator(indicatorId);

      // Configure options
      Object.entries(options).forEach(([key, value]) => {
        indicator.setOption(key, value);
      });

      // Create study on chart
      const study = new this.chart.Study(indicator);

      // Store for later access
      this.indicators.set(name, { study, options });

      return study;
    } catch (err) {
      console.error(`Error adding indicator ${name}:`, err);
    }
  }

  // Extract all features for current candle
  extractFeatures() {
    if (!this.chart.periods[0]) return null;

    const features = {};

    // Price-based features
    const candle = this.chart.periods[0];
    features['close'] = candle.close;
    features['open'] = candle.open;
    features['high'] = candle.high;
    features['low'] = candle.low;
    features['volume'] = candle.volume;

    // Derived price features
    features['hl2'] = (candle.high + candle.low) / 2;
    features['hlc3'] = (candle.high + candle.low + candle.close) / 3;
    features['range'] = candle.high - candle.low;
    features['body'] = Math.abs(candle.close - candle.open);

    // Indicator features
    for (const [name, { study }] of this.indicators) {
      if (!study.periods[0]) continue;

      const period = study.periods[0];

      // Handle different indicator output formats
      if (period.value !== undefined) {
        features[`${name}_value`] = period.value;
      }
      if (period.value1 !== undefined) {
        features[`${name}_1`] = period.value1;
      }
      if (period.value2 !== undefined) {
        features[`${name}_2`] = period.value2;
      }
      if (period.value3 !== undefined) {
        features[`${name}_3`] = period.value3;
      }

      // For graphic/histogram data
      if (study.graphic) {
        Object.entries(study.graphic).forEach(([key, data]) => {
          if (Array.isArray(data) && data.length > 0) {
            features[`${name}_${key}`] = data[0];
          }
        });
      }
    }

    return features;
  }
}
```

#### Step 3: Collect Training Data

```javascript
async function collectTrainingData(symbol, timeframe, indicators, targetCandles = 500) {
  const client = new TradingView.Client({
    token: process.env.SESSION,
    signature: process.env.SIGNATURE
  });

  const chart = new client.Session.Chart();
  chart.setMarket(symbol, { timeframe });

  const engineer = new FeatureEngineer(client, chart);
  const trainingData = [];
  let candlesProcessed = 0;

  // Add all indicators
  const indicatorLoads = indicators.map(({ name, id, options }) =>
    engineer.addIndicator(name, id, options)
  );

  await Promise.all(indicatorLoads);

  return new Promise((resolve) => {
    chart.onError((...err) => {
      console.error('Error:', ...err);
    });

    chart.onUpdate(() => {
      // Extract features
      const features = engineer.extractFeatures();

      if (features) {
        // Add target variable (next candle direction)
        // This will be set in historical replay
        features.timestamp = chart.periods[0].time;
        trainingData.push(features);

        candlesProcessed++;

        if (candlesProcessed % 50 === 0) {
          console.log(`Processed ${candlesProcessed} candles...`);
        }
      }

      if (candlesProcessed >= targetCandles) {
        console.log(`Collection complete: ${trainingData.length} samples`);
        chart.delete();
        client.end();
        resolve(trainingData);
      }
    });
  });
}

// Usage example
const indicators = [
  { name: 'RSI', id: 'STD;RSI', options: { Length: 14 } },
  { name: 'MACD', id: 'STD;MACD', options: {} },
  { name: 'EMA50', id: 'STD;EMA', options: { Length: 50 } },
  { name: 'Volume', id: 'Volume@tv-basicstudies-241', options: {} },
];

collectTrainingData('BINANCE:BTCUSDT', '60', indicators, 500)
  .then(data => {
    console.log('Training data:', data);
    // Save to file or database
  });
```

### Feature Normalization

Machine learning models typically require normalized features:

```javascript
class FeatureNormalizer {
  // Min-Max scaling to [0, 1]
  static minMaxScale(data, featureNames) {
    const normalized = [];

    // Calculate min/max for each feature
    const stats = {};

    featureNames.forEach(feature => {
      const values = data.map(d => d[feature]).filter(v => typeof v === 'number');
      stats[feature] = {
        min: Math.min(...values),
        max: Math.max(...values),
        range: Math.max(...values) - Math.min(...values)
      };
    });

    // Apply normalization
    data.forEach(sample => {
      const normalizedSample = { ...sample };

      featureNames.forEach(feature => {
        if (typeof sample[feature] === 'number') {
          const { min, range } = stats[feature];
          normalizedSample[feature] = (sample[feature] - min) / range;
        }
      });

      normalized.push(normalizedSample);
    });

    return { normalized, stats };
  }

  // Z-score normalization
  static zScoreNormalize(data, featureNames) {
    const normalized = [];

    const stats = {};

    // Calculate mean and std dev
    featureNames.forEach(feature => {
      const values = data.map(d => d[feature]).filter(v => typeof v === 'number');
      const mean = values.reduce((a, b) => a + b) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2)) / values.length;
      const stdDev = Math.sqrt(variance);

      stats[feature] = { mean, stdDev };
    });

    data.forEach(sample => {
      const normalizedSample = { ...sample };

      featureNames.forEach(feature => {
        if (typeof sample[feature] === 'number') {
          const { mean, stdDev } = stats[feature];
          normalizedSample[feature] = (sample[feature] - mean) / stdDev;
        }
      });

      normalized.push(normalizedSample);
    });

    return { normalized, stats };
  }
}

// Usage
const { normalized, stats } = FeatureNormalizer.minMaxScale(
  trainingData,
  ['close', 'volume', 'RSI_value', 'MACD_1']
);
```

---

## Real-Time Data Streaming

### Live Market Data Subscription

For deploying ML models in production, you need to stream live data:

```javascript
class LiveMarketStream {
  constructor(symbols, timeframe = '5') {
    this.client = new TradingView.Client();
    this.symbols = symbols;
    this.timeframe = timeframe;
    this.charts = new Map();
    this.callbacks = {
      onUpdate: null,
      onError: null
    };
  }

  // Initialize streams for multiple symbols
  async start() {
    for (const symbol of this.symbols) {
      const chart = new this.client.Session.Chart();

      chart.setMarket(symbol, { timeframe: this.timeframe });

      chart.onError((...err) => {
        console.error(`Error for ${symbol}:`, ...err);
        if (this.callbacks.onError) {
          this.callbacks.onError(symbol, err);
        }
      });

      chart.onSymbolLoaded(() => {
        console.log(`${symbol} loaded and streaming`);
      });

      chart.onUpdate(() => {
        if (!chart.periods[0]) return;

        const data = {
          symbol,
          timestamp: new Date(chart.periods[0].time * 1000),
          open: chart.periods[0].open,
          high: chart.periods[0].high,
          low: chart.periods[0].low,
          close: chart.periods[0].close,
          volume: chart.periods[0].volume
        };

        if (this.callbacks.onUpdate) {
          this.callbacks.onUpdate(data);
        }
      });

      this.charts.set(symbol, chart);
    }
  }

  // Register callback for new candle updates
  onUpdate(callback) {
    this.callbacks.onUpdate = callback;
  }

  // Register callback for errors
  onError(callback) {
    this.callbacks.onError = callback;
  }

  // Stop streaming
  stop() {
    this.charts.forEach(chart => chart.delete());
    this.client.end();
  }
}

// Usage with ML model
class MLTradingSystem {
  constructor(model, symbols, timeframe = '5') {
    this.model = model;  // Your trained TensorFlow/ML model
    this.stream = new LiveMarketStream(symbols, timeframe);
    this.featureBuffer = new Map();

    // Initialize feature buffers
    symbols.forEach(s => {
      this.featureBuffer.set(s, []);
    });
  }

  start() {
    this.stream.onUpdate((data) => {
      const prediction = this.predictNextMove(data);

      if (prediction.signal === 'BUY') {
        console.log(`BUY signal for ${data.symbol}: confidence ${prediction.confidence}`);
        // Execute buy order
      } else if (prediction.signal === 'SELL') {
        console.log(`SELL signal for ${data.symbol}: confidence ${prediction.confidence}`);
        // Execute sell order
      }
    });

    this.stream.start();
  }

  predictNextMove(marketData) {
    // Prepare features from market data
    const features = this.extractFeatures(marketData);

    // Run ML model
    const prediction = this.model.predict(features);

    // Convert to trading signal
    return {
      signal: prediction.probability > 0.65 ? 'BUY' : 'SELL',
      probability: prediction.probability,
      confidence: Math.abs(prediction.probability - 0.5) * 2  // 0-1 confidence
    };
  }

  extractFeatures(marketData) {
    // Extract relevant features from market data
    // Return in format expected by your model
    return {
      close: marketData.close,
      volume: marketData.volume,
      // ... other features
    };
  }

  stop() {
    this.stream.stop();
  }
}
```

---

## Historical Data & Backtesting

### Replay Mode for Strategy Testing

One of the most powerful features for ML development is the ability to replay historical data:

```javascript
async function backTestMLModel(
  symbol,
  timeframe,
  startDate,
  endDate,
  indicators,
  model
) {
  const client = new TradingView.Client({
    token: process.env.SESSION,
    signature: process.env.SIGNATURE
  });

  const chart = new client.Session.Chart();

  // Calculate Unix timestamp for start date
  const startTimestamp = Math.floor(startDate.getTime() / 1000);
  const endTimestamp = Math.floor(endDate.getTime() / 1000);

  // Configure chart for replay
  chart.setMarket(symbol, {
    timeframe,
    replay: startTimestamp,  // Start from this timestamp
    range: 1
  });

  const engineer = new FeatureEngineer(client, chart);

  // Add indicators for feature extraction
  for (const { name, id, options } of indicators) {
    await engineer.addIndicator(name, id, options);
  }

  const results = {
    predictions: [],
    trades: [],
    metrics: {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalProfit: 0
    }
  };

  let isReplaying = true;
  let stepCount = 0;

  return new Promise((resolve) => {
    // Process each historical candle
    async function processStep() {
      if (!isReplaying) return;

      const features = engineer.extractFeatures();

      if (features) {
        // Make prediction with ML model
        const prediction = model.predict(features);

        results.predictions.push({
          timestamp: chart.periods[0].time,
          prediction,
          price: chart.periods[0].close
        });

        stepCount++;

        if (stepCount % 100 === 0) {
          console.log(`Backtesting: ${stepCount} candles processed`);
        }

        // Check if we've reached the end date
        if (chart.periods[0].time >= endTimestamp) {
          isReplaying = false;
          console.log('Backtest complete');
          chart.delete();
          client.end();
          resolve(results);
          return;
        }
      }

      // Step to next candle
      try {
        await chart.replayStep(1);
        setTimeout(processStep, 10);  // Small delay to avoid overload
      } catch (err) {
        console.error('Replay error:', err);
        isReplaying = false;
        resolve(results);
      }
    }

    chart.onReplayEnd(() => {
      console.log('Replay ended');
      isReplaying = false;
      resolve(results);
    });

    // Start processing after chart is ready
    setTimeout(processStep, 100);
  });
}

// Usage
backTestMLModel(
  'BINANCE:BTCUSDT',
  '60',
  new Date('2023-01-01'),
  new Date('2023-12-31'),
  [
    { name: 'RSI', id: 'STD;RSI', options: { Length: 14 } },
    { name: 'MACD', id: 'STD;MACD', options: {} }
  ],
  yourTrainedModel
).then(results => {
  console.log('Backtest results:', results);
});
```

### Fetching Data in Date Ranges

For training data collection without replay:

```javascript
async function fetchDataRange(symbol, timeframe, toTimestamp, rangeCandles) {
  const client = new TradingView.Client();
  const chart = new client.Session.Chart();

  chart.setMarket(symbol, {
    timeframe,
    to: toTimestamp,      // End timestamp
    range: rangeCandles   // Number of candles before 'to'
  });

  return new Promise((resolve) => {
    chart.onUpdate(() => {
      // Collect all periods
      const allCandles = [...chart.periods].reverse();  // Oldest first

      chart.delete();
      client.end();
      resolve(allCandles);
    });
  });
}

// Get last 100 candles of BTC
const endTime = Math.floor(Date.now() / 1000);
fetchDataRange('BINANCE:BTCUSDT', '240', endTime, 100).then(candles => {
  console.log('Retrieved', candles.length, 'candles');
});
```

---

## Advanced Features

### Custom/Private Indicators

If you have Pine Script indicators on TradingView, you can use them in your ML system:

```javascript
async function loadCustomIndicator(pineScriptId) {
  try {
    // Get the indicator definition
    const indicator = await TradingView.getIndicator(pineScriptId);

    console.log('Indicator name:', indicator.description);
    console.log('Available options:', indicator.properties);

    return indicator;
  } catch (err) {
    console.error('Error loading indicator:', err);
  }
}

// Example: Using a custom Moving Average Ribbon indicator
async function useCustomIndicator() {
  const client = new TradingView.Client({
    token: process.env.SESSION,
    signature: process.env.SIGNATURE
  });

  const chart = new client.Session.Chart();
  chart.setMarket('BINANCE:BTCUSDT', { timeframe: '60' });

  // Load custom indicator by ID
  const customIndic = await TradingView.getIndicator('PUB;YOUR_PINE_ID_HERE');

  // Configure options
  customIndic.setOption('length1', 10);
  customIndic.setOption('length2', 20);

  const study = new chart.Study(customIndic);

  study.onUpdate(() => {
    console.log('Custom indicator values:', study.periods[0]);
  });
}
```

### Multiple Concurrent Indicators

Efficiently load multiple indicators simultaneously:

```javascript
async function loadMultipleIndicatorsParallel(symbol, indicators) {
  const client = new TradingView.Client();
  const chart = new client.Session.Chart();
  chart.setMarket(symbol, { timeframe: '60' });

  // Load all indicator definitions in parallel
  const indicatorDefs = await Promise.all(
    indicators.map(id =>
      id.includes('@')
        ? new TradingView.BuiltInIndicator(id)
        : TradingView.getIndicator(id)
    )
  );

  // Create studies for each indicator
  const studies = indicatorDefs.map(indic => new chart.Study(indic));

  // Wait for all to be ready
  const readyPromises = studies.map(study =>
    new Promise(resolve => {
      study.onReady(() => resolve(study));
      study.onUpdate(() => {
        // Also resolve on first update
        resolve(study);
      });
    })
  );

  return Promise.all(readyPromises);
}

// Usage
loadMultipleIndicatorsParallel('BINANCE:ETHUSDT', [
  'STD;RSI',
  'STD;MACD',
  'STD;EMA',
  'STD;Stoch'
]).then(studies => {
  console.log('All indicators loaded:', studies.length);
});
```

### Chart Type Support

TradingView supports different candle representations:

```javascript
const CHART_TYPES = {
  'standard': 'candlestick',      // Regular OHLC candles
  'heikin-ashi': 'HeikinAshi',    // Smoothed candles
  'renko': 'Renko',                // Brick charts
  'kagi': 'Kagi',                  // Kagi charts
  'point-and-figure': 'PF',        // Point & Figure
  'line-break': 'LineBreak'        // Line Break charts
};

// Use different chart type
chart.setMarket('BINANCE:BTCUSDT', {
  timeframe: 'D',
  type: 'HeikinAshi'
});
```

---

## ML Integration Patterns

### Pattern 1: Classification Model (Buy/Sell Prediction)

```javascript
class ClassificationMLIndicator {
  constructor(tensorflowModel) {
    this.model = tensorflowModel;
    this.featureScaler = null;
  }

  async train(trainingData, labels) {
    // Normalize features
    const features = trainingData.map(d => [
      d.close, d.volume, d.RSI_value, d.MACD_1
    ]);

    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels);

    await this.model.fit(xs, ys, {
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2
    });

    xs.dispose();
    ys.dispose();
  }

  predict(features) {
    const input = tf.tensor2d([features]);
    const prediction = this.model.predict(input);
    const result = prediction.dataSync()[0];

    input.dispose();
    prediction.dispose();

    return {
      buyProbability: result,
      signal: result > 0.5 ? 'BUY' : 'SELL'
    };
  }
}
```

### Pattern 2: Regression Model (Price Prediction)

```javascript
class RegressionMLIndicator {
  constructor(tensorflowModel) {
    this.model = tensorflowModel;
  }

  async train(trainingData, priceTargets) {
    const features = trainingData.map(d => [
      d.close, d.volume, d.high - d.low, d.RSI_value
    ]);

    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(priceTargets, [priceTargets.length, 1]);

    await this.model.fit(xs, ys, {
      epochs: 50,
      batchSize: 16
    });

    xs.dispose();
    ys.dispose();
  }

  predict(features) {
    const input = tf.tensor2d([features]);
    const prediction = this.model.predict(input);
    const nextPrice = prediction.dataSync()[0];

    input.dispose();
    prediction.dispose();

    return {
      predictedPrice: nextPrice,
      confidence: 0.75  // Calculate based on model confidence
    };
  }
}
```

### Pattern 3: Multi-Output Model (Price + Signal)

```javascript
class MultiOutputMLIndicator {
  constructor(tensorflowModel) {
    this.model = tensorflowModel;
  }

  async train(trainingData, targets) {
    // targets = { prices: [...], signals: [...] }

    const features = trainingData.map(d => [
      d.close, d.volume, d.RSI_value, d.MACD_1, d.MACD_2
    ]);

    const xs = tf.tensor2d(features);
    const prices = tf.tensor2d(targets.prices, [targets.prices.length, 1]);
    const signals = tf.tensor2d(targets.signals, [targets.signals.length, 1]);

    await this.model.fit(xs, [prices, signals], {
      epochs: 100,
      batchSize: 32
    });

    xs.dispose();
    prices.dispose();
    signals.dispose();
  }

  predict(features) {
    const input = tf.tensor2d([features]);
    const [priceOutput, signalOutput] = this.model.predict(input);

    const nextPrice = priceOutput.dataSync()[0];
    const buySignal = signalOutput.dataSync()[0];

    input.dispose();
    priceOutput.dispose();
    signalOutput.dispose();

    return {
      predictedPrice: nextPrice,
      buySignal: buySignal > 0.5,
      confidence: Math.abs(buySignal - 0.5) * 2
    };
  }
}
```

---

## Complete Implementation Example

### Full ML Trading System

Here's a complete, working example that demonstrates all concepts:

```javascript
const TradingView = require('@mathieuc/tradingview');
const tf = require('@tensorflow/tfjs');
require('dotenv').config();

// ============== Configuration ==============
const CONFIG = {
  symbol: 'BINANCE:BTCUSDT',
  timeframe: '60',  // 1-hour candles
  trainingCandles: 500,
  backtestStartDate: new Date('2023-06-01'),
  backtestEndDate: new Date('2023-12-31'),
  indicators: [
    { name: 'RSI', id: 'STD;RSI', options: { Length: 14 } },
    { name: 'MACD', id: 'STD;MACD', options: {} },
    { name: 'EMA50', id: 'STD;EMA', options: { Length: 50 } },
    { name: 'Volume', id: 'Volume@tv-basicstudies-241', options: {} }
  ]
};

// ============== Helper Classes ==============

class FeatureEngineer {
  constructor(client, chart) {
    this.client = client;
    this.chart = chart;
    this.indicators = new Map();
  }

  async addIndicator(name, indicatorId, options = {}) {
    const indicator = indicatorId.includes('@')
      ? new TradingView.BuiltInIndicator(indicatorId)
      : await TradingView.getIndicator(indicatorId);

    Object.entries(options).forEach(([key, value]) => {
      indicator.setOption(key, value);
    });

    const study = new this.chart.Study(indicator);
    this.indicators.set(name, { study, options });

    return study;
  }

  extractFeatures() {
    if (!this.chart.periods[0]) return null;

    const candle = this.chart.periods[0];
    const features = {
      close: candle.close,
      volume: candle.volume,
      hl2: (candle.high + candle.low) / 2,
      range: candle.high - candle.low
    };

    for (const [name, { study }] of this.indicators) {
      if (!study.periods[0]) continue;

      const period = study.periods[0];

      if (period.value !== undefined) {
        features[`${name}_value`] = period.value;
      }
      if (period.value1 !== undefined) {
        features[`${name}_1`] = period.value1;
      }
      if (period.value2 !== undefined) {
        features[`${name}_2`] = period.value2;
      }
    }

    return features;
  }
}

// ============== Main ML System ==============

class MLTradingIndicator {
  constructor(config) {
    this.config = config;
    this.model = null;
    this.scaler = null;
    this.featureNames = [];
  }

  // Step 1: Collect Training Data
  async collectTrainingData() {
    console.log('Starting data collection...');

    const client = new TradingView.Client({
      token: process.env.SESSION,
      signature: process.env.SIGNATURE
    });

    const chart = new client.Session.Chart();
    chart.setMarket(this.config.symbol, { timeframe: this.config.timeframe });

    const engineer = new FeatureEngineer(client, chart);

    // Load all indicators
    const indicatorLoads = this.config.indicators.map(({ name, id, options }) =>
      engineer.addIndicator(name, id, options)
    );

    await Promise.all(indicatorLoads);

    const trainingData = [];
    let candleCount = 0;

    return new Promise((resolve) => {
      chart.onUpdate(() => {
        const features = engineer.extractFeatures();

        if (features) {
          if (this.featureNames.length === 0) {
            this.featureNames = Object.keys(features);
          }

          features.timestamp = chart.periods[0].time;
          trainingData.push(features);

          candleCount++;

          if (candleCount % 100 === 0) {
            console.log(`  Collected ${candleCount} candles...`);
          }

          if (candleCount >= this.config.trainingCandles) {
            console.log(`Data collection complete: ${trainingData.length} samples`);
            chart.delete();
            client.end();
            resolve(trainingData);
          }
        }
      });
    });
  }

  // Step 2: Prepare Data for Training
  prepareData(rawData) {
    console.log('Preparing data for training...');

    // Extract features and targets
    const features = rawData.slice(0, -1).map(d => {
      return this.featureNames.map(name => d[name] || 0);
    });

    // Target: predict if price will go up
    const targets = rawData.slice(1).map(d => {
      const current = d.close;
      const next = rawData[rawData.indexOf(d) + 1]?.close || current;
      return next > current ? 1 : 0;  // 1 = up, 0 = down
    });

    // Normalize features
    const numFeatures = features[0].length;
    const mins = Array(numFeatures).fill(Infinity);
    const maxs = Array(numFeatures).fill(-Infinity);

    features.forEach(feature => {
      feature.forEach((val, idx) => {
        mins[idx] = Math.min(mins[idx], val);
        maxs[idx] = Math.max(maxs[idx], val);
      });
    });

    this.scaler = { mins, maxs };

    const normalizedFeatures = features.map(feature =>
      feature.map((val, idx) => {
        const range = maxs[idx] - mins[idx];
        return range === 0 ? 0 : (val - mins[idx]) / range;
      })
    );

    return {
      xs: tf.tensor2d(normalizedFeatures),
      ys: tf.tensor2d(targets, [targets.length, 1])
    };
  }

  // Step 3: Build and Train Model
  async buildAndTrain(data) {
    console.log('Building and training model...');

    this.model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [this.featureNames.length],
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 1,
          activation: 'sigmoid'  // Output: probability 0-1
        })
      ]
    });

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    await this.model.fit(data.xs, data.ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 1
    });

    console.log('Training complete!');

    data.xs.dispose();
    data.ys.dispose();
  }

  // Step 4: Make Predictions
  predict(features) {
    // Normalize input features
    const normalized = this.featureNames.map((name, idx) => {
      const val = features[name] || 0;
      const range = this.scaler.maxs[idx] - this.scaler.mins[idx];
      return range === 0 ? 0 : (val - this.scaler.mins[idx]) / range;
    });

    const input = tf.tensor2d([normalized]);
    const prediction = this.model.predict(input);
    const probability = prediction.dataSync()[0];

    input.dispose();
    prediction.dispose();

    return {
      buyProbability: probability,
      signal: probability > 0.5 ? 'BUY' : 'SELL',
      confidence: Math.abs(probability - 0.5) * 2
    };
  }

  // Step 5: Complete Training Pipeline
  async train() {
    const trainingData = await this.collectTrainingData();
    const preparedData = this.prepareData(trainingData);
    await this.buildAndTrain(preparedData);
  }
}

// ============== Main Execution ==============

async function main() {
  console.log('=== ML Trading Indicator System ===\n');

  // Create indicator system
  const indicator = new MLTradingIndicator(CONFIG);

  // Train the model
  await indicator.train();

  // Example: Make a prediction
  const exampleFeatures = {
    close: 27500,
    volume: 1000000,
    hl2: 27550,
    range: 150,
    RSI_value: 55,
    MACD_1: 100,
    MACD_2: 95,
    EMA50_value: 27400,
    Volume_value: 950000
  };

  const prediction = indicator.predict(exampleFeatures);
  console.log('\nExample Prediction:', prediction);
}

// Run the system
main().catch(console.error);
```

---

## Best Practices & Optimization

### 1. Error Handling and Resilience

```javascript
class RobustTradingSystem {
  constructor(config) {
    this.config = config;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  async withRetry(fn, context = this) {
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        return await fn.call(context);
      } catch (err) {
        console.warn(`Attempt ${i + 1} failed:`, err.message);

        if (i === this.maxRetries - 1) throw err;

        // Exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, i) * 1000)
        );
      }
    }
  }

  async collectDataWithRetry() {
    return this.withRetry(async function() {
      // Data collection logic
    });
  }
}
```

### 2. Memory Management

```javascript
// Dispose of TensorFlow tensors properly
function predictWithMemoryCleanup(model, features) {
  const input = tf.tensor2d([features]);

  try {
    const output = model.predict(input);
    const result = output.dataSync()[0];

    output.dispose();

    return result;
  } finally {
    input.dispose();
  }
}

// Monitor memory usage
console.log('Memory:', tf.memory());
```

### 3. Performance Optimization

```javascript
// Batch predictions instead of individual ones
async function batchPredict(model, featuresList) {
  const features = tf.tensor2d(featuresList);
  const predictions = model.predict(features);

  const results = predictions.dataSync();

  features.dispose();
  predictions.dispose();

  return Array.from(results);
}

// Use worker threads for heavy computations
const { Worker } = require('worker_threads');
const worker = new Worker('./ml-worker.js');

worker.postMessage({ features: [...] });
worker.on('message', (prediction) => {
  console.log('Prediction from worker:', prediction);
});
```

### 4. Data Validation

```javascript
function validateData(data, requiredFeatures) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Data must be non-empty array');
  }

  data.forEach((sample, idx) => {
    requiredFeatures.forEach(feature => {
      if (!Number.isFinite(sample[feature])) {
        throw new Error(
          `Invalid value for feature "${feature}" at index ${idx}`
        );
      }
    });
  });

  return true;
}
```

### 5. Logging and Monitoring

```javascript
class Logger {
  static log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      memoryUsage: process.memoryUsage()
    };

    console.log(JSON.stringify(logEntry));
  }

  static info(msg, data) { this.log('INFO', msg, data); }
  static warn(msg, data) { this.log('WARN', msg, data); }
  static error(msg, data) { this.log('ERROR', msg, data); }
}

Logger.info('Model training started', { symbol: 'BTCUSDT' });
```

### 6. Configuration Management

```javascript
const DEFAULT_CONFIG = {
  // Data Collection
  trainingCandles: 500,
  validationSplit: 0.2,

  // Model Architecture
  layers: [64, 32, 16],
  dropout: 0.2,
  learningRate: 0.001,

  // Training
  epochs: 50,
  batchSize: 32,
  earlyStoppingPatience: 10,

  // Prediction
  buyThreshold: 0.55,
  minConfidence: 0.1,

  // Timeouts
  dataCollectionTimeout: 600000,  // 10 minutes
  replayTimeout: 1800000          // 30 minutes
};

function loadConfig(overrides = {}) {
  return { ...DEFAULT_CONFIG, ...overrides };
}
```

---

## Summary and Next Steps

You now have a comprehensive understanding of how to use the TradingView-API to build ML-based trading indicators. The key takeaways are:

1. **Data Collection**: Use TradingView-API to stream real-time and historical market data
2. **Feature Engineering**: Combine price data with technical indicators to create rich feature sets
3. **Model Training**: Use TensorFlow.js or similar ML frameworks to train predictive models
4. **Backtesting**: Leverage replay mode to test your models on historical data
5. **Deployment**: Stream live data and make real-time predictions with your trained models

When you're ready to implement your specific ML indicator, provide:
- What specific price action should the indicator predict? (up/down, specific price level, etc.)
- What timeframe? (minutes, hours, days)
- What symbols/assets? (crypto, stocks, forex)
- Any specific indicators you want to use as features?

This information will help tailor the implementation to your exact needs.
