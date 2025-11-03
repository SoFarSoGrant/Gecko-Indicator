# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gecko ML Indicator** — A multi-timeframe machine learning trading system that automatically detects Gecko patterns (consolidation-breakout-hook formations within strong higher-timeframe trends) using TradingView-API.

**Goal**: Build an ML-based indicator that:
- Detects Gecko patterns on the Low Frame (LF)
- Validates with High Frame (HF) trend confirmation via COMA (Correct Order of Moving Averages)
- Uses ML to predict pattern quality and generate trading signals
- Achieves >75% win rate on backtests with Sharpe ratio >1.5

**Repository**: https://github.com/SoFarSoGrant/Gecko-Indicator

## Common Development Commands

```bash
# Install dependencies
npm install

# Run the application
npm start                  # Production mode
npm run dev               # Development with auto-reload (nodemon)

# Data and Model Scripts
npm run collect:data      # Collect historical data
npm run train:model       # Train ML model
npm run backtest          # Run backtesting

# Code Quality
npm test                  # Run Jest tests
npm run lint              # ESLint with auto-fix
npm run format            # Prettier code formatting
npm run validate:env      # Validate .env configuration
```

## Development Setup

### Prerequisites
- **Node.js** v18+ and npm v9+
- **TradingView** account with SESSION and SIGNATURE cookies

### Initial Setup

```bash
# 1. Clone and install
git clone https://github.com/SoFarSoGrant/Gecko-Indicator.git
cd Gecko-Indicator
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your TradingView SESSION and SIGNATURE

# 3. Validate setup
npm run validate:env

# 4. Start development
npm run dev
```

### Environment Variables

Key `.env` variables:
```bash
SESSION=your_tradingview_session_cookie
SIGNATURE=your_tradingview_signature_cookie
NODE_ENV=development
LOG_LEVEL=debug

# Indicators
EMA_LENGTHS=8,21,50,200
ATR_LENGTH=14

# Trading Parameters
MIN_PATTERN_CONFIDENCE=0.70
MIN_BACKTEST_SHARPE_RATIO=1.5
MIN_BACKTEST_WIN_RATE=0.65

# Timeframe Settings
DEFAULT_TIMEFRAME=5m  # User-selected LF; MF/HF auto-derived
```

See `.env.example` for complete options.

## Project Architecture

### Current State
- **Phase:** 1 Complete (Planning & Requirements) ✅
- **Next Phase:** 2 Data Pipeline Development (Nov 10-23, 2025)
- **Status:** Ready for implementation

### High-Level Data Flow

```
Data Collection (Phase 2)
  ↓
├─ Real-time streaming via TradingView WebSocket
├─ Historical data via replay mode
└─ Technical indicators (EMA 5/8/21/50, ATR, Volume)
  ↓
Feature Engineering (Phase 3)
  ↓
├─ COMA trend features (HF validation)
├─ Gecko pattern features (consolidation, test bar, hook)
└─ Feature normalization (minmax or zscore)
  ↓
Model Training (Phase 4)
  ↓
├─ Binary classification (winner/loser)
├─ Validation accuracy >70%, AUC >0.75
└─ TensorFlow.js feedforward neural network
  ↓
Backtesting & Deployment (Phases 5-7)
  ↓
├─ Historical performance validation (Sharpe >1.5, Win Rate >65%)
├─ Real-time signal generation (<2s latency)
└─ Live trading indicator
```

### Directory Structure (Current Implementation)

```
src/
├─ config/
│  └─ index.js              # Centralized config from environment
├─ core/
│  └─ gecko-indicator.js    # Main indicator orchestrator
├─ data/
│  ├─ collector.js          # TradingView data collection (Phase 2)
│  └─ feature-engineer.js   # Feature extraction & normalization (Phase 3)
├─ indicators/
│  ├─ trend-detector.js     # COMA trend confirmation (Phase 2)
│  └─ pattern-detector.js   # Gecko pattern detection (Phase 3)
├─ models/
│  └─ predictor.js          # TensorFlow.js model handling (Phase 4)
└─ index.js                 # Application entry point

docs/
├─ architecture/
│  ├─ CLAUDE.md (this file, also in root)
│  └─ PROJECT_PLAN.md       # 15-week detailed execution plan
├─ api/
│  └─ tradingview-api-integration.md  # TradingView API patterns
└─ specification/
   ├─ gecko-pattern-specification.md  # Pattern algorithms
   ├─ gecko_indicator_requirements.txt # Official spec
   └─ gecko-visual-ref.pdf            # Visual examples

data/
├─ raw/                     # Raw historical OHLCV data
├─ processed/               # Normalized feature vectors
└─ models/                  # Trained model files

examples/
└─ simple_data_collection.js  # Example TradingView API usage

tests/
└─ example.test.js          # Jest test template
```

## Core Concepts & Patterns

### 1. Multi-Timeframe Structure

The system uses three synchronized timeframes:

| Frame | Purpose | Example |
|-------|---------|---------|
| **LF (Low Frame)** | Entry and pattern detection | 5m |
| **MF (Mid Frame)** | Dynamic support validation | 15m |
| **HF (High Frame)** | Trend context and confirmation | 60m |

**Auto-Derivation**: User selects LF → MF and HF automatically calculated. Frame hierarchy: 1m→5m→15m→60m→240m→1D→1W→1M

### 2. Gecko Pattern (5 Stages)

1. **Momentum Move (MM)**: Strong impulsive leg (≥1.5×ATR) matching HF trend
2. **Consolidation**: 20-100 bars sideways with ~3 swing touches
3. **Test Bar (TB)**: Single large bar (>1.5×ATR) closing beyond base
4. **Hook (FTB)**: Failed breakout (price breaks back through TB extreme)
5. **Re-entry**: Price re-breaks consolidation in HF trend direction

**Entry Rule**: Consolidation base + (0.2 × ATR)
**Stop Loss**: 1 tick below/above FTB swing
**Target**: Entry + 100% extension of MM
**Min Risk/Reward**: 2:1

### 3. COMA Algorithm (Trend Confirmation)

**COMA** = Correct Order of Moving Averages
- **Uptrend**: EMA(8) > EMA(21) > EMA(50) for ≥30 consecutive bars
- **Downtrend**: EMA(8) < EMA(21) < EMA(50) for ≥30 consecutive bars

Applied on High Frame to confirm trend context.

### 4. Model Architecture

**Task**: Binary classification (pattern quality prediction)
- **Input**: 50+ engineered features (EMAs, ATR, consolidation metrics, etc.)
- **Output**: [confidence, score] — probability pattern is winner
- **Network**: Feedforward NN (TensorFlow.js)
- **Success Criteria**: Validation accuracy >70%, AUC >0.75
- **Labels**: Binary (winner=target hit before stop, loser=stop hit first)

### 5. TradingView-API Key Classes

From `@mathieuc/tradingview`:
- **Client**: WebSocket connection and session manager
- **Chart**: OHLCV data for a symbol/timeframe
- **Study**: Technical indicator attached to chart
- **BuiltInIndicator**: Pre-made indicators (RSI, MACD, EMA, ATR, etc.)

**Patterns**:
- **Real-time**: `chart.onUpdate()` callback for live candles
- **Historical**: `chart.replayMode()` for backtesting
- **Indicators**: `BuiltInIndicator` creates studies; access via `study.periods[bar]`

## Implementation Roadmap

### Phase 1: Planning & Requirements ✅ COMPLETE
- ✅ Project structure created
- ✅ Configuration system implemented
- ✅ Core modules scaffolded with TODOs
- ✅ Comprehensive documentation in place

### Phase 2: Data Pipeline (Nov 10-23, 2025) — NEXT
- **Focus**: Implement data collection and indicator integration
- **Key Files**: `src/data/collector.js`, `src/indicators/trend-detector.js`
- **Deliverable**: 6+ months historical data, 99.5%+ completeness, indicator parity
- **Success Gate**: Data validation >99.5%, indicator accuracy within 0.01% of TradingView

### Phase 3: Feature Engineering (Nov 24 - Dec 7, 2025)
- Implement `FeatureEngineer` with 50+ features
- COMA trend features + Gecko pattern features
- Feature normalization and dataset creation
- **Success Gate**: >200 labeled patterns, pattern detection precision >90%

### Phase 4: Model Training (Dec 8-26, 2025)
- Build TensorFlow.js feedforward neural network
- Hyperparameter tuning and validation
- Feature importance analysis
- **Success Gate**: Validation accuracy >70%, AUC >0.75

### Phase 5: Backtesting (Dec 27 - Jan 9, 2026)
- Walk-forward historical validation
- Risk metrics (Sharpe, win rate, drawdown)
- **Success Gate**: Sharpe >1.5, win rate >65%

### Phase 6: Live Indicator (Jan 10-23, 2026)
- Real-time streaming and signal generation
- Web dashboard for monitoring
- Alert system (Slack/email)
- **Success Gate**: Latency <2s, signals operational

### Phase 7: Deployment (Jan 24 - Feb 3, 2026)
- Production setup and monitoring
- Paper trading validation
- Go-live
- **Success Gate**: System uptime >99%, paper trading success

## Important Patterns & Gotchas

### TradingView-API Quirks

**Indicator Timing**: Indicators calculate on bar close. Access via `study.periods[index]` after `chart.onReady()` or first `onUpdate()`.

```javascript
chart.onReady(() => {
  const latestEMA8 = ema8.periods[0].value;  // Current bar
  const previousEMA8 = ema8.periods[1].value; // Previous bar
});
```

**Historical Replay**: Use `chart.replayMode()` for backtesting. Add delays between `replayStep()` calls to allow indicator calculation.

**WebSocket Reconnection**: Implement exponential backoff for WebSocket failures. Store recent data locally.

### Feature Engineering Best Practices

1. **Normalization First**: Always normalize features before ML training
2. **Train/Validation/Test Split**: Keep separate, no data leakage
3. **Forward-Looking Labels**: Use future price to label patterns (avoid look-ahead bias)
4. **Feature Scaling**: MinMax (0-1) or ZScore (μ=0, σ=1) depending on model

### Model Training Gotchas

1. **Tensor Disposal**: Call `tf.dispose()` on tensors to prevent memory leaks during long training
2. **Batch Processing**: Use batches, not individual predictions
3. **Validation During Training**: Monitor validation loss to catch overfitting early
4. **Class Imbalance**: If winners/losers are unbalanced, use sample weighting

## Testing Strategy

### Unit Tests

Mock TradingView API responses. Test:
- Configuration loading and validation
- COMA trend detection logic
- Gecko pattern detection (each of 5 stages)
- Feature normalization with known min/max values
- Model loading and inference

**Template**: `tests/example.test.js` — implement actual tests following the placeholder structure.

### Integration Tests

- End-to-end data collection → feature engineering → prediction
- Real TradingView data (if credentials available)
- Historical replay accuracy vs live calculation

### Manual Testing

- Visually verify detected patterns against TradingView charts
- Spot-check indicator values (EMA, ATR) for accuracy
- Confirm alert messages and signal generation

## Handling Common Issues

**Problem**: Indicators show NaN/undefined values
**Cause**: Study not ready (chart.onReady() not yet called)
**Solution**: Always wait for `chart.onReady()` or check `study.periods` length before access

**Problem**: WebSocket disconnects during collection
**Cause**: Network timeout or TradingView rate limiting
**Solution**: Implement reconnect with exponential backoff; cache recent bars locally

**Problem**: Model predictions are all same value (e.g., always ~0.5)
**Cause**: Network not trained (random initialization) or training failed
**Solution**: Check training loss convergence; validate labels are balanced; try simplifying model

**Problem**: Backtesting runs very slowly
**Cause**: Too many indicators or deep replay window
**Solution**: Simplify features; use smaller time window; implement batching; consider worker threads

## Key Dependencies & Versions

```json
{
  "@mathieuc/tradingview": "^1.18.0",    // TradingView API
  "@tensorflow/tfjs": "^4.11.0",         // ML framework
  "@tensorflow/tfjs-node": "^4.11.0",    // TensorFlow CPU backend
  "express": "^4.18.2",                  // Web framework (Phase 6)
  "winston": "^3.11.0",                  // Logging
  "redis": "^4.6.11",                    // Caching (optional)
  "pg": "^8.11.2"                        // PostgreSQL (optional)
}
```

**Pin versions** in package.json as TradingView-API is unofficial and may change.

## References & Documentation

- **PROJECT_PLAN.md** — 15-week detailed execution plan with all phases and gates
- **gecko-pattern-specification.md** — Complete pattern algorithms with math
- **tradingview-api-integration.md** — TradingView-API patterns and examples
- **gecko_indicator_requirements.txt** — Official specification document
- **README.md** — Project overview, quick start, disclaimer
- **SETUP_COMPLETE.md** — Detailed setup documentation

### External Resources
- TradingView-API GitHub: https://github.com/Mathieu2301/TradingView-API
- TensorFlow.js Docs: https://js.tensorflow.org/
- TradingView Pine Script: https://www.tradingview.com/pine-script-docs/

## Working Instructions (Phase 2 Focus)

### Current Priority (Nov 10-23, 2025)

**Goal**: Establish reliable multi-timeframe data pipeline

**Tasks** (in order):
1. Implement `DataCollector` class in `src/data/collector.js`
   - WebSocket real-time streaming (single symbol, multiple timeframes)
   - Historical data collection via replay mode
   - Error handling and reconnection logic
   - Chart manager for LF/MF/HF synchronization

2. Implement `TrendDetector` COMA algorithm in `src/indicators/trend-detector.js`
   - Detect 30+ consecutive bars in COMA alignment
   - Return trend direction, strength, and EMA values
   - Validate against HF data

3. Integration tests
   - Collect 500 synchronized candles (BTC, ETH, EUR/USD)
   - Validate <1% data gaps
   - Verify indicator values within 0.01% of TradingView charts

4. Documentation
   - Add working examples to `examples/data_collection.js`
   - Document any API quirks discovered
   - Update CLAUDE.md with learnings

**Success Criteria**:
- ✅ DataCollector operational (real-time + historical)
- ✅ Multi-timeframe sync working (LF/MF/HF aligned)
- ✅ Indicators loading correctly (EMA, ATR, Volume)
- ✅ Data quality >99.5% (minimal gaps)
- ✅ Indicator parity with TradingView (±0.01%)
- ✅ Historical dataset collected (6+ months, 5 symbols)

### Before Starting Phase 3

Ensure Phase 2 gate is passed:
- [ ] All data collected and validated
- [ ] Indicators match TradingView exactly
- [ ] Replayed data consistent with real-time
- [ ] WebSocket reconnection tested
- [ ] Historical data stored locally

---

## Session History

### Session 2025-11-03 (Phase 1 Complete)
- **Accomplishment**: Complete project structure, scaffolded all modules, comprehensive documentation
- **Key Decisions**: Modular architecture, TradingView-API exclusive, TensorFlow.js ML framework
- **Status**: ✅ Phase 1 gate passed — ready for Phase 2
- **Details**: See `/docs/GECKO-20251103-session-summary.md`

---

**Repository**: https://github.com/SoFarSoGrant/Gecko-Indicator
**Current Phase**: 2 — Data Pipeline Development (Ready to Start)
**Last Updated**: November 3, 2025
**Status**: Production-ready structure, ready for implementation
