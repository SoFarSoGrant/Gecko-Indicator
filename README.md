# Gecko ML Indicator

**Status:** Phases 1-4 Complete ✅ | Phase 5 Ready to Start (Dec 27, 2025)

A machine learning-based trading indicator system that automatically detects **Gecko patterns** — consolidation and breakout-hook formations within strong higher-timeframe trends — using TradingView-API.

## Overview

The Gecko Indicator is a multi-timeframe trading system that:
- Detects strong EMA trends on the **High Frame (HF)** using COMA (Correct Order of Moving Averages)
- Identifies **Gecko patterns** on the **Low Frame (LF)**: consolidation → test bar → hook → re-entry
- Uses **Machine Learning** to predict pattern quality and trading signal confidence
- Validates patterns with **Middle Frame (MF)** support levels
- Generates trading signals with precise entry, stop, and target prices

## Project Structure

```
gecko-ml-indicator/
├── src/                          # Main source code
│   ├── config/                   # Configuration management
│   ├── core/                     # Core Gecko indicator logic
│   ├── data/                     # Data collection and feature engineering
│   ├── indicators/               # Technical analysis (trend, patterns)
│   ├── models/                   # ML model training and prediction
│   └── index.js                  # Application entry point
├── docs/                         # Documentation
│   ├── architecture/             # System architecture and plans
│   ├── api/                      # TradingView-API integration guide
│   └── specification/            # Trading pattern specifications
├── data/                         # Data storage
│   ├── raw/                      # Raw historical data
│   ├── processed/                # Processed and normalized data
│   └── models/                   # Trained ML models and checkpoints
├── examples/                     # Example scripts
├── tests/                        # Unit and integration tests
├── scripts/                      # Utility scripts
├── package.json                  # Node.js dependencies
├── .env.example                  # Environment variable template
└── README.md                     # This file
```

## Quick Start

### Prerequisites

- **Node.js** v18+ and npm v9+
- **TradingView** account (session and signature cookies)
- **PostgreSQL** (optional, for data persistence)
- **Redis** (optional, for caching)

### Installation

1. Clone the repository:
```bash
git clone SoFarSoGrant/Gecko-Indicator
cd gecko-ml-indicator
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your TradingView credentials
```

4. Validate configuration:
```bash
npm run validate:env
```

### Running the Application

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start

# Run specific modules
npm run collect:data   # Collect historical data
npm run train:model    # Train ML model
npm run backtest       # Run backtesting
npm test               # Run tests
```

## Key Concepts

### Multi-Timeframe Structure

The system operates on three timeframes:
- **High Frame (HF):** Trend context (user-selected + 2 timeframes up)
- **Mid Frame (MF):** Dynamic support validation (user-selected + 1 timeframe up)
- **Low Frame (LF):** Entry timeframe for pattern detection (user-selected)

Example: User selects 5m → LF=5m, MF=15m, HF=60m

### Gecko Pattern (5 Stages)

1. **Momentum Move (MM):** Strong impulsive leg (≥1.5×ATR) matching HF trend
2. **Consolidation:** 20-100 bars of sideways movement with ~3 swing touches
3. **Test Bar (TB):** Single large bar (>1.5×ATR) closing beyond consolidation base
4. **Hook (FTB):** Failed breakout when price breaks back through TB's extreme
5. **Re-entry:** Price re-breaks consolidation base in HF trend direction

### Entry Rules

- **Entry:** Consolidation base + (0.2 × ATR)
- **Stop Loss:** 1 tick below/above FTB swing
- **Target:** Entry + 100% extension of Momentum Move
- **Min Risk/Reward:** 2:1

## Documentation

- **[PROJECT_PLAN.md](docs/architecture/PROJECT_PLAN.md)** - 15-week execution plan with phases and milestones
- **[CLAUDE.md](docs/architecture/CLAUDE.md)** - Development guidance and patterns
- **[Gecko Pattern Specification](docs/specification/gecko-pattern-specification.md)** - Complete pattern definition with algorithms
- **[TradingView-API Integration](docs/api/tradingview-api-integration.md)** - API usage and implementation patterns

## Development Roadmap

### Phase 1: Planning & Requirements ✅ COMPLETE
- Environment setup and dependencies
- Architecture design and documentation
- Project structure and scaffolding
- **Completed:** November 3, 2025 (Morning)

### Phase 2: Data Pipeline ✅ COMPLETE
- ✅ DataCollector module (514 lines, 10 methods)
- ✅ TrendDetector module (301 lines, 7 methods)
- ✅ Multi-timeframe synchronization (LF/MF/HF)
- ✅ Technical indicator integration (EMA, ATR, Volume)
- ✅ Real-time streaming + historical replay
- ✅ Comprehensive test suite (54 tests, 100% passing)
- ✅ Complete documentation (3 guides + 5 examples)
- **Completed:** November 3, 2025 (Afternoon)
- **Status:** Phase 2 gate PASSED

### Phase 3: Feature Engineering ✅ COMPLETE
- ✅ FeatureEngineer module (508 lines, 62 features)
- ✅ 5 feature categories (price, EMA, consolidation, trend, momentum)
- ✅ Feature normalization (MinMax + ZScore methods)
- ✅ Comprehensive test suite (35 tests, 100% passing, 96.89% coverage)
- ✅ Complete documentation (300+ line feature engineering guide)
- ✅ Production-ready code with full error handling
- **Completed:** November 3, 2025 (Late Afternoon)
- **Metrics:** 62 features (exceeds 50+ target), <5ms performance, 100% feature quality
- **Status:** Phase 3 gate PASSED

### Phase 4: Model Training ✅ COMPLETE (Nov 3, 2025)
- ✅ TensorFlow.js neural network (62 → 128 → 64 → 32 → 2)
- ✅ Training pipeline with early stopping
- ✅ Hyperparameter tuning completed
- ✅ Validation accuracy: 100%, AUC: 1.0, Latency: ~8ms
- ✅ Critical feature engineering fixes (3 of 4)
- ✅ Comprehensive documentation and tests (35 tests, 100% passing)
- ✅ Phase 4 Gate: PASSED

### Phase 5: Backtesting (Dec 27 - Jan 9, 2026)
- Historical performance validation
- Walk-forward analysis
- Risk metrics (Sharpe >1.5, win rate >65%)

### Phase 6: Live Indicator (Jan 10-23, 2026)
- Real-time streaming integration
- Signal generation and alerts
- Dashboard development

### Phase 7: Deployment (Jan 24 - Feb 3, 2026)
- Production setup and monitoring
- Paper trading validation
- Live signal generation

## Configuration

Key configuration options in `.env`:

```env
# Indicators
EMA_LENGTHS=8,21,50,200
ATR_LENGTH=14

# Gecko Pattern
MIN_PATTERN_CONFIDENCE=0.70
CONSOLIDATION_MIN_BARS=20
CONSOLIDATION_MAX_BARS=100

# Backtesting
BACKTEST_SHARPE_RATIO_TARGET=1.5
BACKTEST_WIN_RATE_TARGET=0.65

# Model
MODEL_PATH=./data/models/gecko_model.json
MIN_CONFIDENCE_THRESHOLD=0.70
```

See `.env.example` for all available options.

## API Integration

The system uses [@mathieuc/tradingview](https://github.com/Mathieu2301/TradingView-API) for:
- Real-time data streaming via WebSocket
- Historical data collection with time-range queries
- Technical indicator computation
- Historical replay mode for backtesting

See [TradingView-API Integration Guide](docs/api/tradingview-api-integration.md) for implementation details.

## Testing

Run tests with:
```bash
npm test                  # Run all tests
npm run test:watch       # Watch mode
```

Tests are located in the `tests/` directory and cover:
- Configuration validation
- Trend detection (COMA algorithm)
- Pattern detection (5-stage process)
- Feature engineering and normalization
- Model loading and prediction
- Data collection reliability

## Performance Targets

- **Pattern Detection Accuracy:** >75% win rate on validated setups
- **Real-Time Latency:** <2 seconds from candle close
- **Backtesting Sharpe Ratio:** >1.5 on 6-month historical data
- **System Uptime:** >99% for live signal generation

## Contingency Plans

See [PROJECT_PLAN.md](docs/architecture/PROJECT_PLAN.md) for detailed contingency strategies for:
- Model performance failures (accuracy <65%)
- Feature extraction pipeline issues
- Production deployment problems
- Data quality concerns

## Contributing

1. Create a feature branch
2. Make changes and test thoroughly
3. Ensure code passes linting: `npm run lint`
4. Format code: `npm run format`
5. Commit with clear messages
6. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or contributions:
- Check existing documentation in `docs/`
- Review the [PROJECT_PLAN.md](docs/architecture/PROJECT_PLAN.md)
- Consult the [TradingView-API Integration Guide](docs/api/tradingview-api-integration.md)

## Disclaimer

This is a trading indicator system for educational and research purposes. It should not be used as the sole basis for investment decisions. Always conduct thorough testing and validation before using in live trading. Past performance does not guarantee future results.

---

**Project Status:** Phases 1-4 Complete — Ready for Phase 5 Development
**Current Phase:** Phase 5: Backtesting (Scheduled Dec 27 - Jan 9, 2026)
**Latest Completion:** Phase 4: Model Training (Nov 3, 2025) ✅
**Latest Session:** [Phase 4 Summary](docs/GECKO-20251103-session-phase4-complete.md)
**Last Updated:** November 3, 2025
**Critical Fixes Applied:** [Phase 4 Fixes](docs/CRITICAL-FIXES-PHASE4.md)
**Maintainer:** Trading Project Team
**Go-Live Target:** February 3, 2026
