# Phase 5 Readiness Checklist
## Gecko ML Indicator — Backtesting Phase Preparation

**Phase**: Phase 5 - Backtesting & Performance Validation
**Scheduled**: December 27, 2025 - January 9, 2026
**Duration**: 2 weeks
**Prerequisites Status**: ✅ ALL MET

---

## Prerequisites Verification

### Phase 4 Deliverables (All Required) ✅

| Deliverable | Status | Verification |
|-------------|--------|--------------|
| **Trained Model** | ✅ Complete | `data/models/gecko-pattern-classifier/model.json` exists (2.9 KB) |
| **Model Weights** | ✅ Complete | `weights.bin` exists (72 KB, 18,466 parameters) |
| **Training Metadata** | ✅ Complete | `metadata.json` with hyperparameters, metrics |
| **Training History** | ✅ Complete | `training-history.json` with epoch-by-epoch curves |
| **Validation Accuracy** | ✅ 100% | Target: ≥70% (synthetic data) |
| **Test AUC** | ✅ 1.0 | Target: ≥0.75 (synthetic data) |
| **Inference Latency** | ✅ ~8ms | Target: <50ms (6.25x under budget) |
| **Model Serialization** | ✅ Working | Save/load tested and operational |
| **Test Coverage** | ✅ 88.6% | Target: >80% |
| **Documentation** | ✅ 4 guides | 2,500+ lines, comprehensive |

**Overall Phase 4 Status**: ✅ **ALL CRITERIA MET**

### Phase 3 Deliverables (Integration Dependencies) ✅

| Deliverable | Status | Verification |
|-------------|--------|--------------|
| **FeatureEngineer Module** | ✅ Complete | `src/data/feature-engineer.js` (508 lines) |
| **Feature Count** | ✅ 60 features | Reduced from 62, symbol-agnostic |
| **Feature Categories** | ✅ 5 categories | Price, EMA, consolidation, trend, momentum |
| **Normalization Methods** | ✅ 2 methods | MinMax (default), ZScore |
| **Dynamic Bounds** | ✅ Implemented | `setNormalizationBounds(features)` |
| **Per-Feature Stats** | ✅ Implemented | `setFeatureStatistics(features)` |
| **Test Coverage** | ✅ 76.4% | 35/35 tests passing |

**Overall Phase 3 Status**: ✅ **READY FOR INTEGRATION**

### Critical Feature Fixes (Phase 4) ✅

| Issue | Status | Impact |
|-------|--------|--------|
| **#1: Hardcoded Bounds** | ✅ Fixed | Model now generalizes across symbols |
| **#2: Absolute Prices** | ✅ Fixed | Features are percentage-based (symbol-agnostic) |
| **#3: Incorrect ZScore** | ✅ Fixed | Per-feature statistics (statistically correct) |
| **#4: Redundant Features** | ⏳ Identified | 14 features marked for Phase 5 removal |

**Critical Fixes Status**: ✅ **3 of 3 BLOCKER ISSUES RESOLVED**

---

## Phase 5 Week-by-Week Plan

### Week 1 (Dec 27 - Jan 2): Data Collection & Model Retraining

#### Day 1-2: Historical Pattern Collection
- [ ] **Task**: Identify 200+ Gecko patterns from Jan-Jun 2025
- [ ] **Method**: Manual review on TradingView with replay mode
- [ ] **Criteria**:
  - Patterns must meet all 5 Gecko stages (MM, consolidation, TB, hook, re-entry)
  - Multi-timeframe COMA alignment (HF trend confirmation)
  - Clear entry, stop, and target levels
- [ ] **Labeling**:
  - Winner: Target hit before stop loss
  - Loser: Stop loss hit before target
- [ ] **Output**: `data/raw/historical-patterns.json`
- [ ] **Validation**:
  - Class balance: 50/50 or 60/40 ratio acceptable
  - Pattern quality: All 5 stages present and verified
  - Data completeness: OHLCV + indicators for all 3 timeframes

**Estimated Time**: 16-20 hours (200 patterns × 5 min/pattern)

**Mitigation**:
- Team of 3 labelers: Reduces to ~6 hours total
- Start with 100 patterns, expand to 200 if time permits

#### Day 3-4: Feature Engineering & Normalization
- [ ] **Task**: Engineer features for all historical patterns
- [ ] **Code**:
  ```javascript
  const engineer = new FeatureEngineer(config, logger);
  const allFeatures = await Promise.all(
    patterns.map(p => engineer.engineerFeatures(p.symbol, p.pattern, p.data))
  );
  const rawFeatures = allFeatures.map(f => f.raw);
  ```
- [ ] **Validation**:
  - All features in valid ranges (no NaN/Inf)
  - Feature consistency across symbols
  - Multi-timeframe data aligned correctly
- [ ] **Output**: `data/processed/historical-features.json`

**Estimated Time**: 4-6 hours

#### Day 5: Compute Normalization Bounds
- [ ] **Task**: Compute dynamic bounds from historical features
- [ ] **Code**:
  ```javascript
  engineer.setNormalizationBounds(rawFeatures);
  engineer.setFeatureStatistics(rawFeatures);
  ```
- [ ] **Validation**:
  - Bounds cover full range of training data
  - Per-feature statistics computed correctly
  - Save bounds to: `data/processed/normalization-bounds.json`
- [ ] **Output**: `normalization-bounds.json`, `feature-statistics.json`

**Estimated Time**: 2 hours

#### Day 6-7: Model Retraining
- [ ] **Task**: Retrain model on real historical data
- [ ] **Command**:
  ```bash
  node scripts/train-model.cjs --data real --epochs 100 \
    --batch-size 32 --learning-rate 0.001 --patience 15
  ```
- [ ] **Expected Metrics** (real data):
  - Training accuracy: 75-90%
  - Validation accuracy: 70-85% (target: ≥70%)
  - Test AUC: 0.75-0.90 (target: ≥0.75)
  - Test accuracy: 68-82%
- [ ] **Validation**:
  - No overfitting (val_loss < train_loss or within 10%)
  - AUC exceeds 0.75 threshold
  - Confusion matrix: balanced precision/recall
- [ ] **Output**: `data/models/gecko-pattern-classifier-real/`

**Estimated Time**: 6-8 hours (including hyperparameter tuning)

**Contingency** (if metrics < targets):
- Increase training data (300+ patterns)
- Adjust hyperparameters (learning rate, dropout, layers)
- Use class weighting for imbalanced data
- Simplify model architecture (fewer layers)

### Week 2 (Jan 3-9): Feature Importance & Backtesting

#### Day 8-9: Feature Importance Analysis
- [ ] **Task**: Compute permutation importance for all 60 features
- [ ] **Method**:
  - Baseline accuracy: Predict on test set
  - For each feature:
    1. Shuffle feature values randomly
    2. Re-predict and compute accuracy
    3. Importance = baseline_acc - shuffled_acc
  - Rank features by importance score
- [ ] **Code Template**:
  ```javascript
  const importance = await computePermutationImportance(
    predictor, testFeatures, testLabels, iterations=10
  );
  const ranked = Object.entries(importance)
    .sort((a, b) => b[1] - a[1]);
  ```
- [ ] **Output**: `data/analysis/feature-importance.json`
- [ ] **Validation**:
  - Top 10 features should align with domain knowledge
  - Bottom 26 features should show <5% importance
  - Document feature importance rationale

**Estimated Time**: 4-6 hours (including analysis)

#### Day 9: Feature Reduction & Model Retrain
- [ ] **Task**: Remove bottom 26 features, retrain with top 34
- [ ] **Process**:
  1. Select top 34 features from importance ranking
  2. Remove bottom 26 features from FeatureEngineer
  3. Re-engineer features for all patterns (34 features only)
  4. Retrain model: `node scripts/train-model.cjs --data real --features 34`
  5. Compare: 60-feature vs 34-feature performance
- [ ] **Success Criteria**:
  - 34-feature model accuracy ≥ 60-feature model accuracy (within 2%)
  - Inference latency reduced by ~40% (60 → 34 features)
  - No significant AUC degradation (<0.05 drop)
- [ ] **Output**: `data/models/gecko-pattern-classifier-optimized/`

**Estimated Time**: 6-8 hours

**Decision Point**: If 34-feature model underperforms significantly:
- Keep 40-45 features (reduce less aggressively)
- Re-evaluate feature categories (keep all trend features)
- Document trade-off: performance vs inference speed

#### Day 10-12: Backtesting Engine Development
- [ ] **Task**: Build backtesting module in `src/backtest/engine.js`
- [ ] **Components**:
  1. **BacktestEngine Class**:
     - Walk-forward analysis (rolling windows)
     - Trade simulation (entry, stop, target)
     - Position sizing and risk management
     - Commission and slippage modeling
  2. **Metrics Calculator**:
     - Sharpe ratio (annualized)
     - Win rate (winners / total trades)
     - Average risk/reward ratio
     - Max drawdown (peak-to-trough)
     - Profit factor (gross profit / gross loss)
  3. **Equity Curve Generator**:
     - Time-series equity values
     - Drawdown chart
     - Trade log (entry, exit, P&L)
- [ ] **Code Template**:
  ```javascript
  const backtest = new BacktestEngine(config, logger);
  const results = await backtest.run({
    patterns: historicalPatterns,
    predictor: modelPredictor,
    startDate: '2025-01-01',
    endDate: '2025-06-30',
    initialCapital: 10000,
    riskPerTrade: 0.02,  // 2% risk per trade
  });
  ```
- [ ] **Output**:
  - `data/backtest/results.json` (metrics)
  - `data/backtest/equity-curve.csv` (time-series)
  - `data/backtest/trade-log.csv` (all trades)

**Estimated Time**: 12-16 hours

#### Day 13: Performance Validation & Reporting
- [ ] **Task**: Validate Phase 5 success criteria
- [ ] **Success Gates**:
  - [ ] Sharpe ratio ≥ 1.5 on 6-month backtest
  - [ ] Win rate ≥ 65% on validated setups
  - [ ] Risk/reward ≥ 2:1 average per trade
  - [ ] Backtesting latency < 2s per year of data
- [ ] **Analysis**:
  - Review equity curve (smooth growth, acceptable drawdowns)
  - Analyze losing trades (common failure modes)
  - Validate statistical significance (min 50 trades)
  - Check robustness across symbols and timeframes
- [ ] **Output**: `docs/backtest-report.md` (comprehensive report)

**Estimated Time**: 4-6 hours

#### Day 14: Documentation & Phase Closure
- [ ] **Task**: Complete Phase 5 documentation
- [ ] **Documents**:
  1. **Backtest Report** (`docs/backtest-report.md`):
     - Executive summary (metrics)
     - Equity curve visualization
     - Trade log analysis (winners vs losers)
     - Risk metrics (Sharpe, drawdown, profit factor)
     - Failure mode analysis
     - Recommendations for Phase 6
  2. **Model Card Update** (`docs/model-card.md`):
     - Real data performance metrics
     - Feature importance ranking (top 34)
     - Model limitations and caveats
     - Retraining schedule recommendations
  3. **Session Summary** (`docs/GECKO-[DATE]-session-phase5-complete.md`):
     - Phase 5 deliverables checklist
     - Success gate validation
     - Lessons learned
     - Phase 6 handoff notes
- [ ] **Output**: 3 comprehensive documents, Phase 5 closure

**Estimated Time**: 4-6 hours

---

## Data Collection Requirements

### Historical Pattern Dataset

**Target**: 200+ Gecko patterns from Jan-Jun 2025

**Symbols** (diversification):
- **Forex**: EUR/USD, GBP/USD, USD/JPY (3 symbols)
- **Indices**: SPY, QQQ, IWM (3 symbols)
- **Futures**: ES, NQ (2 symbols)
- **Total**: 8 symbols × 25 patterns = 200 patterns

**Timeframes**:
- **Low Frame (LF)**: 5m (primary entry timeframe)
- **Mid Frame (MF)**: 15m (dynamic support)
- **High Frame (HF)**: 60m (trend context)

**Data Requirements per Pattern**:
- OHLCV data: 200+ bars per timeframe (for indicator calculation)
- Indicators: EMA 5/8/21/50/200, ATR 14, Volume
- Pattern stages: All 5 stages identified and timestamped
- Outcome label: Winner (1) or Loser (0)
- Metadata: Symbol, date range, entry/stop/target levels

**Data Format** (`historical-patterns.json`):
```json
{
  "patterns": [
    {
      "id": "pattern_001",
      "symbol": "EUR/USD",
      "date": "2025-01-15",
      "timeframes": {
        "lf": "5m",
        "mf": "15m",
        "hf": "60m"
      },
      "stages": {
        "momentum_move": { "start": "2025-01-15T09:00", "end": "2025-01-15T10:30" },
        "consolidation": { "start": "2025-01-15T10:30", "end": "2025-01-15T14:00" },
        "test_bar": { "timestamp": "2025-01-15T14:05" },
        "hook": { "timestamp": "2025-01-15T14:20" },
        "reentry": { "timestamp": "2025-01-15T15:00" }
      },
      "levels": {
        "entry": 1.0850,
        "stop": 1.0835,
        "target": 1.0880
      },
      "outcome": {
        "label": 1,  // Winner
        "exit_price": 1.0880,
        "exit_time": "2025-01-15T16:30",
        "pnl": 30,  // pips
        "risk_reward": 2.0
      },
      "data": {
        "lf_ohlcv": [...],  // 200+ bars
        "mf_ohlcv": [...],
        "hf_ohlcv": [...],
        "lf_indicators": { "ema8": [...], "ema21": [...], "atr": [...] },
        "mf_indicators": { ... },
        "hf_indicators": { ... }
      }
    },
    // ... 199 more patterns
  ]
}
```

### Data Quality Checklist

For each pattern, verify:
- [ ] All 5 Gecko stages present and clearly identifiable
- [ ] Multi-timeframe COMA alignment on HF (≥30 bars)
- [ ] Entry, stop, and target levels clearly defined
- [ ] Outcome label accurate (winner/loser retroactively validated)
- [ ] OHLCV data complete (no gaps, no NaN values)
- [ ] Indicator values calculated correctly (cross-check with TradingView)
- [ ] Metadata complete (symbol, dates, timeframes)

### Data Collection Tools

1. **TradingView Replay Mode**:
   - Navigate to historical date range
   - Manually identify Gecko patterns
   - Record timestamps for each stage
   - Validate outcome (winner/loser)

2. **DataCollector Module** (Phase 2):
   - Use `collectHistoricalData()` for OHLCV
   - Use `getIndicators()` for EMA/ATR values
   - Automate data export to JSON format

3. **Manual Validation**:
   - Visual inspection on TradingView charts
   - Cross-reference indicator values
   - Confirm pattern quality (all stages present)

---

## Model Retraining Plan

### Training Configuration

**Hyperparameters** (starting point):
- **Epochs**: 100 (with early stopping, patience=15)
- **Batch Size**: 32
- **Learning Rate**: 0.001 (Adam optimizer)
- **Architecture**: 60 → 128 → 64 → 32 → 2
- **Dropout**: [0.3, 0.2, 0.2]
- **L2 Regularization**: 0.001
- **Train/Val/Test Split**: 70% / 15% / 15%

**Expected Performance** (real data):
- Training accuracy: 75-90%
- Validation accuracy: 70-85% (target: ≥70%)
- Test AUC: 0.75-0.90 (target: ≥0.75)
- Test accuracy: 68-82%

**Degradation from Synthetic**: 15-30% (normal and acceptable)

### Hyperparameter Tuning Strategy

If initial training fails to meet targets (accuracy <70% or AUC <0.75):

1. **Increase Training Data**:
   - Collect 300+ patterns (expand dataset)
   - Use data augmentation (slight noise, time shifts)

2. **Adjust Architecture**:
   - Try deeper: 60 → 256 → 128 → 64 → 32 → 2
   - Try wider: 60 → 256 → 128 → 2
   - Try simpler: 60 → 64 → 32 → 2

3. **Increase Regularization** (if overfitting):
   - Dropout: 0.3 → 0.5
   - L2: 0.001 → 0.01
   - Early stopping patience: 15 → 10

4. **Decrease Regularization** (if underfitting):
   - Dropout: 0.3 → 0.1
   - L2: 0.001 → 0.0001
   - Train longer: 100 → 200 epochs

5. **Learning Rate Adjustment**:
   - Too fast: 0.001 → 0.0005
   - Too slow: 0.001 → 0.005
   - Use learning rate scheduler (exponential decay)

6. **Class Weighting** (if imbalanced data):
   - Compute: `weight = totalSamples / (numClasses × classSamples)`
   - Example: 60% winners → `classWeight: {0: 1.5, 1: 1.0}`

### Model Validation Checklist

After training, validate:
- [ ] Validation loss converges (not increasing)
- [ ] No severe overfitting (val_loss < train_loss × 1.1)
- [ ] AUC ≥ 0.75 on test set
- [ ] Validation accuracy ≥ 70%
- [ ] Confusion matrix: balanced precision/recall
- [ ] Inference latency < 50ms (should be ~8ms)
- [ ] Model serialization works (save/load successful)

---

## Feature Optimization Strategy

### Feature Importance Analysis

**Method**: Permutation importance (most reliable for TensorFlow.js)

**Algorithm**:
```
1. Compute baseline accuracy on test set
2. For each feature:
   a. Shuffle feature values randomly
   b. Re-predict on test set
   c. Importance = baseline_acc - shuffled_acc
3. Average over 10 iterations for stability
4. Rank features by importance score
```

**Expected Results**:
- Top 10 features: >10% importance each
- Middle 20 features: 5-10% importance
- Bottom 30 features: <5% importance

**Feature Categories** (expected importance):
- **High Importance**: COMA alignment (HF), consolidation quality, test bar strength
- **Medium Importance**: EMA distances, momentum returns, support/resistance
- **Low Importance**: Redundant features (binary duplicates of continuous features)

### Redundant Feature Candidates (14 identified in Phase 4)

| Feature | Redundancy | Expected Importance |
|---------|-----------|---------------------|
| `lf_above_200sma` | Binary duplicate of `distance_to_ema200_lf` | Low |
| `mf_above_200sma` | Binary duplicate of `distance_to_ema200_mf` | Low |
| `hf_above_200sma` | Binary duplicate of `distance_to_ema200_hf` | Low |
| `all_tf_aligned_long` | Derived from `lf_ema_order_long + mf_ema_order_long + hf_ema_order_long` | Low |
| `all_tf_aligned_short` | Derived from individual shorts | Low |
| `lf_mf_aligned` | Derived from `lf_ema_order + mf_ema_order` | Low |
| `close_above_ema21_mf` | Binary duplicate of `distance_to_ema21_mf` | Low |
| `close_above_ema5_hf` | Binary duplicate of `distance_to_ema5_hf` | Low |
| `close_above_ema200_mf` | Binary duplicate of `distance_to_ema200_mf` | Low |
| `bars_higher_highs` | Correlated with `bars_higher_lows` | Low |
| `bars_lower_highs` | Correlated with `bars_lower_lows` | Low |
| 3 additional | From multicollinearity analysis | Low |

**Removal Strategy**:
1. Compute importance for all 60 features
2. Confirm bottom 26 features have <5% importance
3. Remove bottom 26, keep top 34
4. Retrain and validate performance (should be ≥98% of 60-feature model)

### Expected Feature Set After Optimization

**Top 34 Features** (predicted):
- **COMA Indicators** (9 features): `lf_ema_order_long`, `mf_ema_order_long`, `hf_ema_order_long`, etc.
- **EMA Distances** (6 features): `distance_to_ema8_lf`, `distance_to_ema21_mf`, `distance_to_ema50_hf`, etc.
- **Consolidation Quality** (8 features): `consolidation_range_percent`, `consolidation_touches`, `test_bar_strength`, etc.
- **Price Action** (6 features): `range_percent`, `body_percent`, `close_position_in_range`, etc.
- **Momentum** (5 features): `return_last_5bars`, `return_last_10bars`, `avg_range_last_10_percent`, etc.

**Benefits**:
- 40% faster inference (60 → 34 features)
- Reduced overfitting risk (fewer parameters)
- Cleaner feature space (no redundancy)
- Same or better accuracy (<2% degradation acceptable)

---

## Potential Blockers & Mitigation

### Blocker 1: Data Collection Time Overrun

**Risk**: 200 patterns × 5 min/pattern = ~17 hours (may exceed available time)

**Likelihood**: Medium

**Impact**: High (delays Phase 5 start)

**Mitigation**:
1. **Team Collaboration**: Recruit 3 labelers → ~6 hours total
2. **Incremental Approach**: Start with 100 patterns, expand to 200 later
3. **Automated Pre-Filtering**: Use pattern detector to identify candidates, manually validate
4. **Parallel Workstream**: Start data collection 1 week before Phase 5 official start

**Contingency**:
- If <100 patterns by Day 3: Continue with 100, retrain later with full dataset
- If <50 patterns by Day 3: Extend Phase 5 by 1 week, delay Phase 6 start

### Blocker 2: Model Performance Degradation on Real Data

**Risk**: Real data accuracy <70% or AUC <0.75 (fails Phase 5 gate)

**Likelihood**: Low-Medium

**Impact**: High (requires hyperparameter tuning, more data, or model redesign)

**Mitigation**:
1. **Hyperparameter Tuning**: Try 5-10 configurations (learning rate, architecture, dropout)
2. **Increase Training Data**: Collect 300+ patterns (more data often helps)
3. **Class Weighting**: Address class imbalance (if winner/loser ratio is skewed)
4. **Simplify Model**: Reduce layers or units (prevent overfitting)

**Contingency** (see PROJECT_PLAN.md):
- Accuracy 65-69%: Acceptable if AUC ≥0.75 and backtest Sharpe ≥1.5
- Accuracy <65%: Extend Phase 5 by 1 week, intensive hyperparameter tuning
- AUC <0.70: Redesign features, consult domain experts

### Blocker 3: Feature Importance Computation Too Slow

**Risk**: Permutation importance for 60 features × 200 patterns = ~1-2 hours

**Likelihood**: Low

**Impact**: Low (delays Day 8-9, but not critical path)

**Mitigation**:
1. **Smaller Validation Set**: Use 50 patterns instead of 200 (4x faster)
2. **Parallel Processing**: Use worker threads for feature shuffling
3. **Approximate Importance**: Use 5 iterations instead of 10 (2x faster)

**Contingency**:
- If >3 hours: Skip feature reduction, proceed with 60 features (defer to Phase 6)
- If >6 hours: Use pre-identified 14 redundant features, remove without analysis

### Blocker 4: Backtesting Engine Bugs

**Risk**: BacktestEngine has logic errors (incorrect P&L, equity curve bugs)

**Likelihood**: Medium

**Impact**: Medium (requires debugging, may delay validation)

**Mitigation**:
1. **Unit Tests**: Write tests for entry/exit logic, P&L calculation, metrics
2. **Manual Validation**: Spot-check 10 trades manually (compare to TradingView)
3. **Simplify First**: Build minimal viable backtester, add features incrementally

**Contingency**:
- If critical bug found on Day 13: Extend Phase 5 by 2-3 days for debugging
- If unfixable: Use manual backtesting (slower but reliable)

---

## Success Criteria (Phase 5 Gate)

### Quantitative Metrics (All Required)

| Metric | Target | Stretch Goal |
|--------|--------|--------------|
| **Sharpe Ratio** | ≥ 1.5 | ≥ 2.0 |
| **Win Rate** | ≥ 65% | ≥ 70% |
| **Risk/Reward** | ≥ 2:1 | ≥ 2.5:1 |
| **Max Drawdown** | < 20% | < 15% |
| **Profit Factor** | ≥ 1.8 | ≥ 2.2 |
| **Backtesting Latency** | < 2s/year | < 1s/year |

### Qualitative Criteria

- [ ] Equity curve shows consistent growth (no extreme spikes)
- [ ] Drawdowns are reasonable (<20% max, <10% typical)
- [ ] Performance consistent across symbols (no single-symbol dominance)
- [ ] Performance consistent across months (not just one good month)
- [ ] Model predictions align with domain knowledge (high confidence = quality patterns)
- [ ] Losing trades have identifiable failure modes (not random)
- [ ] Statistical significance: ≥50 trades in backtest period

### Documentation Requirements

- [ ] Comprehensive backtest report (10+ pages)
- [ ] Equity curve visualization (PNG/SVG charts)
- [ ] Trade log analysis (CSV with all trades)
- [ ] Feature importance ranking (top 34 documented)
- [ ] Model card updated (real data metrics)
- [ ] Session summary (Phase 5 closure)
- [ ] Phase 6 handoff notes (integration requirements)

---

## Phase 5 → Phase 6 Handoff

### Deliverables for Phase 6 (Live Indicator)

1. **Optimized Model**: `data/models/gecko-pattern-classifier-optimized/`
   - 34 features (reduced from 60)
   - Trained on real historical data
   - Metrics: accuracy ≥70%, AUC ≥0.75

2. **Normalization Artifacts**:
   - `data/processed/normalization-bounds.json`
   - `data/processed/feature-statistics.json`

3. **Backtesting Results**:
   - `data/backtest/results.json` (metrics)
   - `data/backtest/equity-curve.csv` (time-series)
   - `data/backtest/trade-log.csv` (all trades)

4. **Documentation**:
   - `docs/backtest-report.md` (performance analysis)
   - `docs/model-card.md` (updated with real data)
   - `docs/GECKO-[DATE]-session-phase5-complete.md` (session summary)

5. **Code**:
   - `src/backtest/engine.js` (backtesting module)
   - `scripts/train-model.cjs` (updated for real data)
   - `tests/backtest.test.js` (backtest unit tests)

### Phase 6 Prerequisites

Phase 6 (Live Indicator) requires:
- ✅ Trained model with ≥70% accuracy and ≥0.75 AUC
- ✅ Backtesting Sharpe ≥1.5, win rate ≥65%
- ✅ Normalization bounds and feature statistics stored
- ✅ Model inference API tested and operational
- ✅ Documentation complete and comprehensive

**Status After Phase 5**: ⏳ To be verified

---

## Recommended Timeline

| Week | Days | Focus | Key Deliverables |
|------|------|-------|------------------|
| **Week 1** | Dec 27-28 | Data collection | 200+ historical patterns labeled |
| | Dec 29-30 | Feature engineering | Features engineered for all patterns |
| | Dec 31 | Normalization | Bounds and stats computed |
| | Jan 1-2 | Model retraining | Model retrained on real data |
| **Week 2** | Jan 3-4 | Feature importance | Top 34 features identified |
| | Jan 5 | Model optimization | 34-feature model retrained |
| | Jan 6-7 | Backtesting engine | BacktestEngine built and tested |
| | Jan 8 | Performance validation | Phase 5 gate criteria validated |
| | Jan 9 | Documentation | Phase 5 closure, Phase 6 handoff |

**Total Time**: 14 days, 2 weeks

**Critical Path**:
1. Data collection (Days 1-2)
2. Model retraining (Days 6-7)
3. Backtesting validation (Day 8)

**Slack Time**: Days 3-5 (feature engineering, normalization)

---

## Final Checklist

### Before Starting Phase 5

- [x] Phase 4 complete (all deliverables met)
- [x] Trained model saved and loadable
- [x] Critical feature fixes validated
- [x] Documentation comprehensive and up-to-date
- [x] Test coverage ≥80% on model trainer
- [ ] Data collection plan documented
- [ ] Labeling team recruited (if using team approach)
- [ ] TradingView credentials validated (for replay mode)
- [ ] Git branch created: `git checkout -b phase5-backtesting`

### During Phase 5

- [ ] Daily standup: Track progress, identify blockers
- [ ] Code reviews: Validate backtesting logic before integration
- [ ] Incremental testing: Test each component as you build
- [ ] Documentation: Write as you code, not after
- [ ] Version control: Commit frequently with clear messages

### After Phase 5

- [ ] All success criteria met (Sharpe ≥1.5, win rate ≥65%)
- [ ] Documentation complete (backtest report, model card, session summary)
- [ ] Code reviewed and tested (100% backtest unit tests passing)
- [ ] Phase 6 handoff notes written (integration requirements)
- [ ] Git merged: `git merge phase5-backtesting` to main
- [ ] Session closure: Create final Phase 5 summary document

---

**Document Version**: 1.0
**Created**: November 3, 2025
**Author**: Claude Code (Session Manager)
**Status**: Ready for Phase 5 Start (Dec 27, 2025)

🤖 Generated with Claude Code
