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
- **Phase:** 2 Complete (Data Pipeline Development) ✅
- **Next Phase:** 3 Feature Engineering (Nov 24 - Dec 7, 2025)
- **Status:** Ready for Phase 3 implementation

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

### Phase 2: Data Pipeline ✅ COMPLETE (Nov 3, 2025)
- ✅ DataCollector module implemented (514 lines, 10 methods)
- ✅ TrendDetector module implemented (301 lines, 7 methods)
- ✅ Comprehensive test suite (54 tests, 100% passing)
- ✅ Documentation suite (3 guides + 5 examples)
- ✅ TradingView mock infrastructure for testing
- ✅ Real-time streaming + historical replay modes
- ✅ Multi-timeframe synchronization (LF/MF/HF)
- ✅ COMA algorithm for trend detection
- **Success Gate**: PASSED (pending live credential validation)

### Phase 3: Feature Engineering ✅ COMPLETE (Nov 3, 2025)
- **Focus**: Implement Gecko pattern detection and feature extraction
- **Key Deliverables**:
  - ✅ Implement `FeatureEngineer` class with 62 features (exceeds 50+ target)
  - ✅ 5 feature categories: price, EMA, consolidation, trend, momentum
  - ✅ Multi-timeframe COMA trend validation
  - ✅ Consolidation quality metrics (touches, compression, test bar)
  - ✅ Support/resistance distance features
  - ✅ Feature normalization (MinMax + ZScore)
  - ✅ Comprehensive test suite (35 tests, 100% passing)
  - ✅ Complete documentation and examples
- **Metrics**: 62 features, 96.89% line coverage, <5ms extraction time
- **Success Gate**: PASSED ✅
  - Feature count: 62 (exceeds 50+)
  - Test coverage: 35 tests passing
  - Feature quality: 100% (no NaN/Inf)
  - Extraction performance: <2ms per pattern

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

## Working Instructions (Phase 4 Focus)

### Current Priority (Dec 8 - Dec 26, 2025) — NEXT PHASE

**Goal**: Build and train TensorFlow.js neural network for Gecko pattern prediction

**Pre-Phase 4 Tasks (if coming from phase 2)**:
1. **Review FeatureEngineer module** (Phase 3 complete)
   - 62 features across 5 categories
   - Normalization methods (MinMax, ZScore)
   - Test suite with 35 passing tests
   - Comprehensive documentation

2. **Understand feature engineering pipeline**
   - Data collection → Feature extraction → Normalization → ML input
   - Multi-timeframe synchronization (LF/MF/HF)
   - COMA trend validation across all frames

**Phase 4 Tasks** (in order):
1. **Build TensorFlow.js Neural Network** in `src/models/predictor.js`
   - Input layer: 62 features (normalized [0,1])
   - Hidden layers: Experimentation required (start with 2 × 64 units)
   - Output layer: 2 units (softmax for binary classification)
   - Activation: ReLU for hidden, Softmax for output
   - Loss: Categorical crossentropy
   - Optimizer: Adam (recommended)

2. **Implement Model Training Pipeline**
   - Dataset loading (6+ months historical)
   - Train/validation/test split (70/15/15)
   - Batch processing (32-64 samples)
   - Early stopping on validation loss
   - Learning rate scheduling

3. **Hyperparameter Tuning**
   - Network architecture: layers, units, dropout
   - Learning rate: 0.001 - 0.01
   - Batch size: 16, 32, 64
   - Epochs: 50-200 with early stopping
   - Regularization: L1/L2, Dropout

4. **Validation and Testing**
   - Accuracy > 70% on validation set
   - AUC > 0.75 on test set
   - Feature importance analysis
   - Confusion matrix analysis

5. **Documentation and Deployment**
   - Model serialization (TensorFlow.js format)
   - Inference examples
   - Performance benchmarks
   - Error handling

**Phase 4 Success Criteria**:
- [ ] TensorFlow.js model created and trained
- [ ] Validation accuracy ≥ 70%
- [ ] Test set AUC ≥ 0.75
- [ ] Model inference latency < 50ms
- [ ] Model saved and loadable
- [ ] Comprehensive test suite for model
- [ ] Complete documentation with examples

### Phase 3 Completion Status ✅

Phase 3 gate **PASSED** (Nov 3, 2025) — COMPLETE:
- ✅ FeatureEngineer: 62 features (exceeds 50+ target by 24%)
- ✅ Test coverage: 35 tests, 100% passing, 96.89% line coverage
- ✅ Feature categories: 5 (price, EMA, consolidation, trend, momentum)
- ✅ Normalization: MinMax + ZScore methods with formula documentation
- ✅ Documentation: Complete 300+ line guide with examples and troubleshooting
- ✅ Performance: <5ms extraction, <2ms normalization, <0.1ms validation
- ✅ Feature quality: 100% valid (0 NaN/Inf issues)
- ✅ Code quality: 508 lines, comprehensive error handling, full JSDoc
- ✅ Integration ready: Consumes DataCollector, feeds to TensorFlow.js
- ⏳ Dataset collection: Ready for Phase 4 (integrate with training pipeline)
- ⏳ Gecko pattern detection: Scaffolded, ready for Phase 4 completion

### Phase 2 Completion Status

Phase 2 gate PASSED ✅:
- ✅ DataCollector operational (real-time + historical)
- ✅ TrendDetector operational (COMA algorithm)
- ✅ Multi-timeframe sync working (LF/MF/HF aligned)
- ✅ Indicators loading correctly (EMA, ATR, Volume)
- ✅ Comprehensive test suite (54 tests, 100% passing)
- ✅ Complete documentation (3 guides + 5 examples)
- ⚠️  Indicator parity validation (deferred to Phase 3 start — requires credentials)

---

## Session History

### Session 2025-11-03 AM (Phase 1 Complete)
- **Phase**: Planning & Requirements
- **Accomplishment**: Complete project structure, scaffolded all modules, comprehensive documentation
- **Key Decisions**: Modular architecture, TradingView-API exclusive, TensorFlow.js ML framework
- **Status**: ✅ Phase 1 gate passed
- **Details**: `/docs/GECKO-20251103-session-summary.md`

### Session 2025-11-03 PM (Phase 2 Complete)
- **Phase**: Data Pipeline Development
- **Accomplishments**:
  - DataCollector module (514 lines, 10 methods)
  - TrendDetector module (301 lines, 7 methods)
  - 54 tests (100% passing)
  - 3 documentation guides + 5 examples
  - TradingView mock infrastructure
- **Key Decisions**:
  - Event-driven architecture with callbacks
  - Multi-timeframe design pattern (separate Charts)
  - Configurable COMA bar requirements
  - Comprehensive error recovery with exponential backoff
  - Fixed @mathieuc/tradingview to v3.5.2
- **Metrics**: 3,424 lines added, 100% test pass rate, zero critical bugs
- **Status**: ✅ Phase 2 gate passed (pending credential validation)
- **Details**: `/docs/GECKO-20251103-session-phase2-complete.md`

### Session 2025-11-03 Late PM (Phase 3 Complete) ✅
- **Phase**: Feature Engineering Implementation
- **Accomplishments**:
  - FeatureEngineer module (508 lines, 11 methods, 62 features)
  - 5 feature categories (price, EMA, consolidation, trend, momentum)
  - Comprehensive test suite (35 tests, 100% passing, 96.89% line coverage)
  - Complete documentation (300+ line feature engineering guide)
  - Production-ready code with full error handling
- **Key Decisions**:
  - All 62 identified features implemented (vs. 50+ minimum)
  - Dual normalization methods: MinMax (default) + ZScore
  - CommonJS modules for Jest compatibility
  - Graceful validation without exception throwing
  - Integration-ready architecture for Phase 4
- **Metrics**: 1,450+ lines added, 35/35 tests passing, 96.89% line coverage, 100% feature quality
- **Phase Gate**: PASSED ✅
  - Feature count: 62 (exceeds 50+ by 24%)
  - Test coverage: 96.89% lines (exceeds 80% target)
  - Feature quality: 100% (no NaN/Inf)
  - Performance: <5ms extraction (exceeds <10ms target)
- **Status**: ✅ Phase 3 complete; ready for Phase 4 model training
- **Details**: `/docs/GECKO-20251103-session-phase3-feature-engineering.md`

---

**Repository**: https://github.com/SoFarSoGrant/Gecko-Indicator
**Current Phase**: 4 — Model Training (Scheduled Dec 8-26, 2025)
**Last Updated**: November 3, 2025
**Status**: Phases 1-3 complete; Phase 4 ready to start
