# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **TradingView-API Machine Learning Indicator Project**. The goal is to build ML-based trading indicators that:
- Collect training data from TradingView market data and technical indicators
- Train machine learning models to predict price movements or generate trading signals
- Backtest models on historical data
- Deploy models for real-time predictions

**Key Reference**: See `tv-api_ml-indicator.md` for comprehensive architecture and implementation patterns.

## Development Setup

### Installation

```bash
npm install
npm install @mathieuc/tradingview @tensorflow/tfjs @tensorflow/tfjs-node
```

### Environment Variables

Create a `.env` file in the project root (never commit this):

```
SESSION=your_tradingview_session_cookie
SIGNATURE=your_tradingview_signature_cookie
NODE_ENV=development
LOG_LEVEL=debug
```

Authentication is optional for basic features but required for premium indicators and advanced replay features.

## Common Development Commands

```bash
# Install dependencies
npm install

# Run the main application
npm start

# Run in development with auto-reload
npm run dev

# Run specific data collection
npm run collect:data

# Run model training
npm run train:model

# Run backtesting
npm run backtest

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Project Architecture

### High-Level Data Flow

```
Data Collection
  ↓
├─ Real-time streaming (LiveMarketStream)
├─ Historical data fetching (FromToData pattern)
└─ Indicator value retrieval (BuiltInIndicator, Custom indicators)
  ↓
Feature Engineering
  ↓
├─ Normalize features (FeatureNormalizer)
└─ Create feature vectors with technical indicators
  ↓
Model Training
  ↓
├─ Classification: Buy/Sell prediction
├─ Regression: Price prediction
└─ Multi-output: Combined predictions
  ↓
Evaluation & Deployment
  ↓
├─ Backtesting on historical data (ReplayMode)
└─ Real-time prediction on live data
```

### Directory Structure (When Implemented)

```
src/
├─ config/              # Configuration and constants
├─ data/
│  ├─ collector.js      # TradingView data collection
│  └─ preprocessor.js   # Feature engineering and normalization
├─ models/
│  ├─ trainer.js        # Model training logic
│  ├─ predictor.js      # Real-time predictions
│  └─ backtester.js     # Historical backtesting
├─ indicators/
│  ├─ technical.js      # Technical indicator definitions
│  └─ custom.js         # Custom/Pine Script indicators
└─ index.js             # Application entry point

examples/
├─ simple_data_collection.js
├─ indicator_training.js
└─ backtesting.js

tests/
└─ *.test.js            # Unit tests
```

## Core Patterns & Concepts

### 1. Data Collection Layers

**WebSocket Real-Time Streaming** (LiveMarketStream):
- Connects to TradingView for live candle updates
- Multiple symbols concurrently
- Event-driven callbacks (onUpdate, onError)

**Historical Replay** (ReplayMode):
- Simulates historical market conditions
- Steps through candles chronologically
- Enables backtesting with actual indicator values

**Date-Range Fetching** (FromToData):
- Retrieves specific time windows
- Useful for training data collection

### 2. Feature Engineering

The `FeatureEngineer` class manages:
- **Price Features**: OHLCV, range, body, hl2, hlc3
- **Indicator Values**: Extract numeric outputs from technical indicators
- **Graphic Data**: Handle histogram and visual indicator outputs
- **Normalization**: Min-max scaling or z-score normalization

### 3. Model Patterns

Three primary approaches are documented:

**Classification**: Predict if next candle up/down
```javascript
- Output: probability 0-1
- Use: Binary trading signals (BUY/SELL)
- Loss: binaryCrossentropy
```

**Regression**: Predict exact next price
```javascript
- Output: continuous price value
- Use: Price target forecasting
- Loss: meanSquaredError
```

**Multi-Output**: Combined price + signal prediction
```javascript
- Output: [nextPrice, buySignal]
- Use: Holistic trading system
- Loss: [mse, binaryCrossentropy]
```

### 4. TradingView-API Key Classes

- **Client**: WebSocket connection manager
- **Chart**: Market/symbol instance with OHLCV data
- **Study**: Indicator attached to chart, produces technical values
- **BuiltInIndicator**: Pre-made indicators (RSI, MACD, EMA, etc.)
- **FeatureEngineer**: Helper to extract features from charts and indicators

## Important Considerations

### Authentication Strategy

- **Unauthenticated mode**: Works for public data and standard indicators
- **Authenticated mode**: Required for private indicators and premium replay features
- Use `TradingView.loginUser()` for programmatic authentication

### Data Management

- Always normalize features before feeding to ML models
- Keep training, validation, and test sets separate
- Store historical data patterns locally to avoid redundant API calls
- Monitor for missing or NaN values in indicator calculations

### Performance Optimization

- Use concurrent indicator loading with `Promise.all()`
- Batch predictions instead of individual forecasts
- Dispose of TensorFlow tensors properly to prevent memory leaks
- Consider worker threads for heavy backtesting

### Error Handling

All TradingView API operations should include:
- Chart error handlers (`chart.onError()`)
- Promise rejection handlers
- Network timeout management
- Retry logic with exponential backoff

## Testing Strategy

When implementing tests:
- Mock TradingView API responses for unit tests
- Use fixture historical data for feature engineering tests
- Test feature normalization with known min/max values
- Validate model predictions against simple baseline indicators

## Common Issues & Solutions

**Issue**: Missing indicator values after chart setup
- **Solution**: Wait for study.onReady() or first onUpdate() before accessing study.periods[0]

**Issue**: Timeouts during historical replay
- **Solution**: Add delays between replayStep() calls; set appropriate timeout values

**Issue**: Memory leaks during long-running backtest
- **Solution**: Dispose of TensorFlow tensors after each prediction; monitor tf.memory()

**Issue**: Authentication failures
- **Solution**: Ensure SESSION and SIGNATURE cookies are current; use loginUser() for fresh credentials

## Related Documentation

- `tv-api_ml-indicator.md`: Complete technical guide with code examples
- TradingView-API GitHub: https://github.com/Mathieu2301/TradingView-API
- TensorFlow.js Docs: https://js.tensorflow.org/api/

## Notes for Future Development

- Pin the TradingView-API version in package.json as the unofficial API may change
- Consider caching raw market data locally to reduce API calls
- Implement proper logging throughout the system for debugging backtest runs
- Add configuration validation at startup to catch environment issues early

---

## Project State

### Current Workflow Phase
**Phase 1: Planning & Requirements Validation — COMPLETE**

Next Phase: **Phase 2: Data Pipeline Development** (Nov 10 - Nov 23, 2025)

### Key Decisions & Context

**Problem Definition:**
- **Target:** Predict Gecko pattern quality (winner/loser) for trading signal generation
- **Horizon:** Forward-looking until target or stop hit
- **Decision Threshold:** Min pattern confidence 0.70; min RR 2:1
- **Eval Metrics:** Win rate >65%, Sharpe >1.5, accuracy >70%, AUC >0.75

**Data & Sources:**
- **TradingView-API:** Exclusive data source (@mathieuc/tradingview v1.18.0)
- **Symbol Universe:** BTC, ETH, EUR/USD, GBP/USD, SPY (expandable)
- **Timeframes:** LF (5m), MF (15m), HF (60m) — configurable, auto-derived from user selection
- **Replay Windows:** 6+ months historical data for training (Jan-Oct 2025)

**Feature Set:**
- **EMA Trend (COMA):** 5, 8, 21, 50, 200 EMAs across all timeframes
- **ATR/RSI:** ATR(14), momentum multiples, consolidation compression
- **Derived Features:** EMA distances, crossovers, consolidation quality (touches, bars), volume spikes
- **Version:** v1.0 (baseline feature set defined; not yet implemented)

**Labeling Rules:**
- **Label:** Binary (winner=1, loser=0)
- **Winner Criteria:** Target hit before stop
- **Entry:** Consolidation base + 0.2×ATR
- **Stop:** 1 tick below/above FTB swing
- **Target:** Entry + 100% extension of Momentum Move
- **Revisions:** None yet (baseline definition)

**Modeling Choices:**
- **Algorithm:** Feedforward neural network (baseline), LSTM/ensemble (Phase 4 experiments)
- **Hyperparams:** TBD in Phase 4 (learning rate, batch size, layers)
- **Selection Criteria:** Validation accuracy >70%, AUC >0.75, consistent across symbols
- **Explainability Plan:** Feature importance analysis, SHAP values (Phase 4)

**Acceptance Gates:**
- **Phase 1 → Phase 2:** Architecture approved, environment setup ✅ PASSED
- **Phase 2 → Phase 3:** Data completeness >99.5%, indicator parity with TradingView
- **Phase 3 → Phase 4:** Pattern detection precision >90%, 200+ labeled patterns
- **Phase 4 → Phase 5:** Validation accuracy >70%, AUC >0.75, stakeholder approval
- **Phase 5 → Phase 6:** Win rate >65%, Sharpe >1.5, walk-forward validation passed
- **Phase 6 → Phase 7:** Real-time latency <2s, signals operational, dashboard functional
- **Phase 7 → Phase 8:** System uptime >99%, paper trading successful, go-live approval

**Monitoring Plan:**
- **Latency Ceiling:** <2 seconds from candle close to signal generation
- **Drift Alarms:** Win rate drops >10% below baseline → trigger retraining
- **Retrain Triggers:** Monthly scheduled retraining + drift detection
- **Performance Tracking:** Daily signal logs, weekly performance reports

---

## Session Log

### Session 2025-11-03 (Phase 1 Complete)
- **Phase:** Planning & Requirements Validation
- **Accomplishments:**
  - Created complete project structure with 20+ files
  - Scaffolded all core source modules (config, core, data, indicators, models)
  - Established comprehensive documentation suite (README, PROJECT_PLAN, SETUP_COMPLETE)
  - Defined package dependencies and npm scripts
  - Organized all reference materials into logical directories
- **Key Decisions:**
  - Modular architecture with clear separation of concerns
  - TradingView-API as exclusive data source
  - TensorFlow.js for ML framework (unified Node.js stack)
  - Strict multi-timeframe synchronization to prevent look-ahead bias
  - Comprehensive feature set (50+ features) for ML model
  - Forward-looking outcome labeling (winner/loser based on target/stop)
- **Next Steps:**
  - Initialize git repository and commit all files
  - Install dependencies (`npm install`)
  - Create `.env` file with TradingView credentials
  - Begin Phase 2: DataCollector implementation
- **Session Summary:** `/docs/GECKO-20251103-session-summary.md`

---

## Working Instructions

### Current Focus
**Phase 2: Data Pipeline Development** (Starting Nov 10, 2025)

**Priority Tasks:**
1. Implement `DataCollector` class with TradingView WebSocket integration
2. Build multi-timeframe synchronization (LF/MF/HF)
3. Integrate technical indicators (EMA, ATR, Volume)
4. Collect historical data using replay mode
5. Validate data quality and indicator accuracy

**Key Files to Implement:**
- `src/data/collector.js` — Multi-timeframe data collection
- `src/indicators/trend-detector.js` — COMA algorithm (if time permits)

**Testing Focus:**
- Data completeness checks (>99.5% coverage)
- Indicator validation vs TradingView charts (within 0.01%)
- WebSocket reconnection and error recovery

**Documentation to Update:**
- Add data collection examples to `examples/`
- Document any API quirks or workarounds discovered
- Update CLAUDE.md with new learnings
