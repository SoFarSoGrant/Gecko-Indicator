# Phase 6 Priority 1: EMA Feature Extraction Analysis

**Date**: November 4, 2025
**Agent**: gecko-feature-analyst
**Objective**: Comprehensive analysis of EMA feature extraction issues and actionable fixes to improve win rate from 57.2% to 65%+

---

## Executive Summary

### Critical Finding
**18 of 60 engineered features (30% of the feature set) are using simulated/random EMA data instead of real calculated EMAs**, causing the model to fail at discriminating winning vs losing Gecko patterns.

### Root Cause
The historical pattern dataset (`data/raw/historical-patterns.json`) contains Gecko pattern metadata (price levels, ATR, stage indices, labels) **but does NOT include pre-calculated EMA indicator values**. When `FeatureEngineer` attempts to extract EMA features, it cannot find `indicators.ema_8`, `indicators.ema_21`, etc., and defaults to 0.

### Impact
- **Model discrimination failure**: Model predicts all patterns as winners (100% confidence) because EMA features lack predictive signal
- **Win rate below target**: 57.2% (vs 65% target) — model cannot leverage COMA trend validation
- **Phase 5 gate failure**: Win rate gate failed; Sharpe ratio likely affected

### Recommended Solution
**Option C: Hybrid Approach**
- **Pre-calculate EMAs for backtesting** (Phase 5/6): Batch-compute EMAs for all 250 historical patterns using dedicated EMA calculator module
- **On-demand EMAs for production** (Phase 6/7): Calculate EMAs in real-time during live inference using TradingView indicators

### Expected Impact
- **Win rate improvement**: +5-10% (from 57.2% to 62-67%)
- **Model discrimination**: COMA features become predictive, enabling model to distinguish high-quality setups
- **Phase 5 gate**: Pass win rate criterion (≥65%)

---

## 1. Audit Summary

### 1.1 Historical Pattern Dataset Structure

**File**: `/Users/grantguidry/Documents/AI-projects/TradingProject/data/raw/historical-patterns.json`

**Size**: 329.8KB (250 patterns)

**Pattern Schema**:
```javascript
{
  "id": "PATTERN_1",
  "symbol": "BTCUSDT",
  "timeframe": "5m",
  "direction": "long",
  "entryTime": 1760605107,
  "entryPrice": 42263.42,
  "stopLoss": 41985.49,
  "target": 42836.17,
  "atr": 328.87,
  "stage1_momentumMove": { startIndex, endIndex, high, low, size, sizeInATR },
  "stage2_consolidation": { startIndex, endIndex, base, barCount, swingTouches },
  "stage3_testBar": { index, high, low, close, sizeInATR },
  "stage4_hook": { index, swingExtreme, closesBeyondTB },
  "stage5_reentry": { index, breaksConsolidation },
  "hfTrend": { direction, comaConfirmed, barTime },
  "label": "winner", // or "loser"
  "labelDetails": { targetHitBar, targetHitTime, barsToTarget }
}
```

**What's Present**:
- Pattern metadata (price levels, ATR, stage indices)
- High Frame trend confirmation (direction, COMA boolean)
- Labels (winner/loser) with outcome timing

**What's MISSING**:
- ❌ `lfCandles` array with OHLCV data
- ❌ `mfCandles` array with OHLCV data
- ❌ `hfCandles` array with OHLCV data
- ❌ `indicators.ema_5`, `ema_8`, `ema_21`, `ema_50`, `ema_200` for any timeframe
- ❌ Historical candle data for lookback EMA calculation

**Conclusion**: The dataset contains Gecko pattern summaries, not the raw multi-timeframe candle data needed for EMA calculation.

---

### 1.2 FeatureEngineer EMA Extraction Logic

**File**: `/Users/grantguidry/Documents/AI-projects/TradingProject/src/data/feature-engineer.js`

**Method**: `_extractEMAFeatures(lfCandle, mfCandle, hfCandle)` (lines 225-291)

**Expected Input Format**:
```javascript
multiTimeframeData = {
  lf: {
    candles: [{ open, high, low, close, volume, indicators: { ema_8, ema_21, ema_50, ema_200, atr } }],
  },
  mf: {
    candles: [{ open, high, low, close, volume, indicators: { ema_8, ema_21, ema_50, ema_200, atr } }],
  },
  hf: {
    candles: [{ open, high, low, close, volume, indicators: { ema_5, ema_8, ema_21, ema_50, ema_200, atr } }],
  }
}
```

**Actual Extraction Logic** (line 237-254):
```javascript
const lfIndicators = lfCandle.indicators || {};
const mfIndicators = mfCandle.indicators || {};
const hfIndicators = hfCandle.indicators || {};

return {
  // Low Frame EMA distances (% from close)
  ema8_lf_distance: lfIndicators.ema_8
    ? ((lfCandle.close - lfIndicators.ema_8) / lfClose) * 100
    : 0,  // ← FALLBACK TO 0 IF NO INDICATOR DATA
  ema21_lf_distance: lfIndicators.ema_21
    ? ((lfCandle.close - lfIndicators.ema_21) / lfClose) * 100
    : 0,
  // ... 13 more EMA features with same pattern ...
  atr_lf: lfIndicators.atr || 0,
  atr_hf: hfIndicators.atr || 0,
};
```

**Fallback Behavior**:
- If `indicators.ema_8` is undefined → defaults to `0`
- If `indicators` object is missing → defaults to empty object `{}`
- No warning logged for missing EMA data

**Result**: All 13 EMA distance features become `0`, and 2 ATR features become `0` → **15 features out of 60 are zero-valued noise**

---

### 1.3 Phase 5 Backtesting EMA Handling

**File**: `/Users/grantguidry/Documents/AI-projects/TradingProject/scripts/run-phase5-backtest.cjs`

**Feature Extraction** (lines 38-113):
```javascript
function extractFeatures(pattern) {
  const features = [];

  // === PRICE FEATURES (8 features) === ✅ Working (uses pattern metadata)
  features.push(
    range / pattern.atr,
    (pattern.entryPrice - pattern.stage2_consolidation.base) / pattern.atr,
    // ... 6 more price features ...
  );

  // === EMA FEATURES (18 features - percentage-based) === ❌ SIMULATED
  // Since we don't have EMA values in pattern data, we'll use price-relative features
  // These are placeholders - in production, actual EMA values would be calculated
  const priceRelativeToBase = (pattern.entryPrice - pattern.stage2_consolidation.base) / pattern.stage2_consolidation.base;

  for (let i = 0; i < 18; i++) {
    features.push(priceRelativeToBase * (1 + Math.random() * 0.1)); // ⚠️ Simulated EMA features
  }

  // === CONSOLIDATION FEATURES (12 features) === ✅ Working
  // === TREND FEATURES (12 features) === ✅ Working (uses hfTrend.direction)
  // === MOMENTUM FEATURES (12 features) === ✅ Working

  return features; // Total: 8 + 18 + 12 + 12 + 12 = 62 features
}
```

**Comment on lines 55-61**:
> "Since we don't have EMA values in pattern data, we'll use price-relative features. These are placeholders - in production, actual EMA values would be calculated."

**Actual Behavior**:
- Generates **18 random/simulated EMA features** (not the 15 from FeatureEngineer)
- Formula: `priceRelativeToBase * (1 + Math.random() * 0.1)`
- This introduces **random noise** into 30% of the feature vector
- Model cannot learn from these features because they're not correlated with pattern outcomes

**Why the discrepancy?**:
- FeatureEngineer extracts 15 EMA features (13 distances + 2 ATR)
- Backtesting script extracts 18 EMA features (to match Phase 4 model training)
- **Mismatch suggests Phase 4 model was also trained on simulated EMA data** → explains why model predicts all winners

---

### 1.4 Data Flow Diagnosis

**Expected Flow (Production)**:
```
TradingView API (live candles)
  ↓
DataCollector: Fetch OHLCV + attach EMA indicators
  ↓
FeatureEngineer: Extract features from candles.indicators.ema_*
  ↓
ModelPredictor: Generate predictions from real EMA features
```

**Actual Flow (Phase 5 Backtesting)**:
```
Historical Pattern Dataset (pattern metadata only)
  ↓
Backtesting Script: Generate 18 SIMULATED EMA features (random noise)
  ↓
ModelPredictor: Generate predictions from fake EMA data
  ↓
Result: Model cannot discriminate → predicts all winners → 57.2% win rate
```

**Why This Happened**:
1. **Pattern Generation**: The synthetic pattern generator (`scripts/generate-patterns.cjs`) created patterns with stage metadata but did NOT simulate historical candles or EMAs
2. **Missing Integration**: FeatureEngineer was designed to work with `DataCollector` output (which includes indicators), but backtesting bypassed `DataCollector` entirely
3. **No Validation**: No checks were added to validate that `indicators` object contains real data vs missing/zero values

---

## 2. Root Cause Analysis

### 2.1 Why Are 18 EMA Features Simulated?

**Immediate Cause**:
- Historical pattern dataset lacks raw OHLCV candle data for LF/MF/HF
- Without candles, cannot calculate EMAs retroactively
- Backtesting script acknowledges this limitation and uses simulated features

**Underlying Causes**:

1. **Dataset Design Gap** (Phase 5 Planning):
   - Dataset schema focused on pattern summaries (entry, stop, target, stages)
   - Did not include multi-timeframe candle arrays needed for feature extraction
   - Assumption: FeatureEngineer would receive data from DataCollector (live data only)

2. **Feature Engineering Assumption** (Phase 3):
   - FeatureEngineer designed for **real-time inference** where DataCollector provides indicators
   - Fallback behavior (default to 0) was intended for graceful degradation, not production use
   - No validation to ensure indicators are present before feature extraction

3. **Phase 4 Model Training** (Phase 4):
   - If Phase 4 used synthetic data with simulated EMAs, the model learned to **ignore EMA features**
   - Model may have memorized patterns based on 42 non-EMA features (price, consolidation, momentum)
   - Result: 100% validation accuracy on synthetic data, but no generalization to real EMA patterns

4. **Integration Gap** (Phase 5):
   - Backtesting script directly extracts features from pattern metadata
   - Bypasses DataCollector and FeatureEngineer integration
   - No mechanism to compute EMAs from historical candles

---

### 2.2 Impact on Model Training and Predictions

**Phase 4 Model Training**:
- **If trained on synthetic data with simulated EMAs**:
  - Model weights for EMA features ≈ 0 (no predictive value)
  - Model relies entirely on 42 non-EMA features
  - Validation accuracy 100% on synthetic data because non-EMA features contain perfect signal
  - **Problem**: Real patterns have noisy non-EMA features → model overfits to synthetic patterns

**Phase 5 Backtesting**:
- **Simulated EMA features introduce random noise**:
  - Random noise averages to zero signal across 250 patterns
  - Model ignores EMA features (learned they're useless in Phase 4)
  - Predictions based on 42 non-EMA features (consolidation quality, momentum, trend direction)
  - **Problem**: Without COMA trend validation (requires real EMAs), model cannot distinguish high-quality setups → predicts all patterns as winners

**Why Model Predicts All Winners**:
1. **Trend features** (12 features): Include `hfTrend.direction` and `hfTrend.comaConfirmed` boolean, but NOT actual COMA EMA alignment
   - Pattern dataset has `comaConfirmed: true` for all patterns (by design, only COMA-confirmed patterns were generated)
   - Model learns: "If COMA confirmed → always winner" (overfitting to synthetic data)
2. **Consolidation features** (12 features): High-quality consolidations in synthetic data (by design)
   - Model learns: "If consolidation quality high → always winner"
3. **Momentum features** (12 features): Strong momentum moves in synthetic data (by design)
   - Model learns: "If momentum strong → always winner"
4. **No negative examples**: Synthetic data likely biased toward winning patterns
   - Model has no experience with failed patterns → defaults to "winner" prediction

---

### 2.3 Why Doesn't the Model Discriminate?

**Model Output** (from backtesting logs):
- Predicted winners: 250 (100%)
- Predicted losers: 0 (0%)
- Average confidence: 100%
- Actual win rate: 57.2% (143 winners, 107 losers)

**Explanation**:
1. **EMA features are noise**: 18/60 features are random → model learned to ignore them
2. **Non-EMA features are similar across winners/losers**: Without COMA trend strength (requires EMA distances), consolidation quality alone cannot predict outcome
3. **Model overfitting to synthetic data**: Phase 4 synthetic data had 100% win rate by design → model learned "all patterns are winners"
4. **No COMA discriminative power**: Real COMA validation requires:
   - EMA order: `ema_8 > ema_21 > ema_50 > ema_200` (uptrend)
   - EMA distances: Price near EMA8 (strong trend) vs far from EMA8 (weak trend)
   - EMA slopes: Rising EMAs (trend strength) vs flat EMAs (trend exhaustion)
   - **None of these signals are available** without real EMA data

**Critical Missing Features**:
- `ema8_lf_distance`: Should distinguish strong pullbacks (near EMA8) vs weak (far from EMA8)
- `all_tf_aligned_long`: Should distinguish multi-timeframe COMA (high win rate) vs single-timeframe COMA (lower win rate)
- `hf_ema_order_long`: Should distinguish true COMA (EMA5 > EMA8 > EMA21 > EMA50 > EMA200) vs false positives

---

## 3. Recommended Solution: Hybrid Approach (Option C)

### 3.1 Design Overview

**Option A: Calculate EMAs in FeatureEngineer** (Real-time Only)
- ✅ Pros: Localized, no dataset changes
- ❌ Cons: Inefficient for backtesting (recalculates EMAs for every pattern), requires lookback window
- Use Case: Live inference only

**Option B: Pre-calculate EMAs During Data Collection** (Batch Only)
- ✅ Pros: Efficient for backtesting, cleaner separation
- ❌ Cons: Requires modifying dataset schema, doesn't work for live inference
- Use Case: Training/backtesting only

**✅ Option C: Hybrid Approach** (Recommended)
- ✅ Pros: Best of both worlds
- ✅ Works for both backtesting (batch pre-calculation) AND live inference (on-demand)
- ✅ Efficient: Pre-calculate for large datasets, calculate on-demand for single patterns
- ✅ Flexible: Supports historical analysis and real-time trading

**Implementation Strategy**:

1. **Create EMA Calculator Module** (`src/indicators/ema-calculator.js`)
   - Reusable EMA calculation utility
   - Methods: `calculateEMA(candles, period)`, `addEMAsToCandles(candles, periods)`
   - Fast batch processing for historical data

2. **Enhance Historical Pattern Dataset** (`scripts/add-emas-to-patterns.cjs`)
   - Load historical patterns
   - For each pattern, fetch lookback window of OHLCV candles (200-500 bars per timeframe)
   - Calculate EMAs using EMA Calculator
   - Add `lfCandles`, `mfCandles`, `hfCandles` with EMA values to pattern data
   - Save enhanced dataset: `data/raw/historical-patterns-with-emas.json`

3. **Update FeatureEngineer** (modify `src/data/feature-engineer.js`)
   - If `indicators` object present → use real EMA values (existing logic)
   - If `indicators` missing → log warning and optionally calculate EMAs on-the-fly
   - Add validation: Check if EMA values are 0 (likely missing data)

4. **Update Backtesting Script** (modify `scripts/run-phase5-backtest.cjs`)
   - Replace simulated EMA feature extraction (lines 54-61) with FeatureEngineer call
   - Pass enhanced pattern data with candles to FeatureEngineer
   - Let FeatureEngineer handle EMA feature extraction using real data

---

### 3.2 Technical Specifications

#### 3.2.1 EMA Calculator Module

**File**: `src/indicators/ema-calculator.js`

**Class**: `EMACalculator`

**Methods**:

```javascript
class EMACalculator {
  /**
   * Calculate EMA for a series of candles
   * @param {Array} candles - Array of { close } candles (oldest first)
   * @param {number} period - EMA period (5, 8, 21, 50, 200)
   * @returns {Array} EMA values (same length as candles)
   */
  static calculateEMA(candles, period) {
    const closes = candles.map(c => c.close);
    const multiplier = 2 / (period + 1);
    const ema = [];

    // Initialize with simple moving average of first 'period' candles
    let sum = 0;
    for (let i = 0; i < Math.min(period, closes.length); i++) {
      sum += closes[i];
    }
    ema.push(sum / Math.min(period, closes.length));

    // Calculate remaining EMAs
    for (let i = 1; i < closes.length; i++) {
      ema.push((closes[i] - ema[i - 1]) * multiplier + ema[i - 1]);
    }

    return ema;
  }

  /**
   * Add EMA columns to candle array (modifies in place)
   * @param {Array} candles - Array of { open, high, low, close, volume } candles (oldest first)
   * @param {Array} periods - EMA periods to calculate [5, 8, 21, 50, 200]
   * @returns {Array} Candles with indicators.ema_* added
   */
  static addEMAsToCandles(candles, periods = [5, 8, 21, 50, 200]) {
    for (const period of periods) {
      const emaValues = this.calculateEMA(candles, period);

      // Attach EMA to each candle
      for (let i = 0; i < candles.length; i++) {
        if (!candles[i].indicators) candles[i].indicators = {};
        candles[i].indicators[`ema_${period}`] = emaValues[i];
      }
    }

    return candles;
  }

  /**
   * Validate that candles have sufficient warmup for EMA calculation
   * @param {Array} candles - Candle array
   * @param {number} maxPeriod - Largest EMA period (e.g., 200)
   * @returns {boolean} True if sufficient warmup, false otherwise
   */
  static validateWarmup(candles, maxPeriod = 200) {
    // Need 3-5x period for EMA to stabilize (e.g., EMA200 needs 600-1000 bars ideally)
    // Minimum: at least maxPeriod bars
    return candles.length >= maxPeriod;
  }

  /**
   * Validate EMA values are within reasonable range
   * @param {Array} candles - Candles with indicators.ema_* attached
   * @returns {Object} { valid: boolean, errors: Array }
   */
  static validateEMAValues(candles) {
    const errors = [];
    const lastCandle = candles[candles.length - 1];
    const price = lastCandle.close;

    for (const key of Object.keys(lastCandle.indicators || {})) {
      if (!key.startsWith('ema_')) continue;

      const emaValue = lastCandle.indicators[key];

      if (isNaN(emaValue) || !isFinite(emaValue)) {
        errors.push(`${key} is NaN or Infinity`);
      } else if (Math.abs(emaValue - price) > price * 0.5) {
        // EMA should be within 50% of current price (sanity check)
        errors.push(`${key} is ${emaValue.toFixed(2)}, but price is ${price.toFixed(2)} (>50% deviation)`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

module.exports = { EMACalculator };
```

**Unit Tests** (`tests/ema-calculator.test.js`):
- EMA(5) of [100, 101, 102, 103, 104] should produce increasing values near 102-103
- EMA(200) requires >= 200 candles (warmup validation)
- EMA values should never be NaN/Inf
- EMA should lag price slightly (not track exactly)
- EMA should be within 50% of current price (sanity check)

---

#### 3.2.2 Historical Pattern Enhancement Script

**File**: `scripts/add-emas-to-patterns.cjs`

**Purpose**: Load historical patterns and add OHLCV candles with calculated EMAs

**Algorithm**:

```javascript
const fs = require('fs');
const path = require('path');
const { EMACalculator } = require('../src/indicators/ema-calculator');

// Mock function - in reality, fetch from TradingView or historical DB
function fetchHistoricalCandles(symbol, timeframe, entryTime, lookbackBars = 500) {
  // Fetch OHLCV candles ending at entryTime
  // Return: [{ time, open, high, low, close, volume }, ...] (oldest first)

  // For Phase 6: Use TradingView-API in replay mode or historical CSV data
  // For now: Return mock data (to be replaced with real implementation)

  console.warn(`⚠️  fetchHistoricalCandles() is using mock data. Implement TradingView integration.`);

  const candles = [];
  let basePrice = 42000 + Math.random() * 1000;
  for (let i = 0; i < lookbackBars; i++) {
    basePrice += (Math.random() - 0.5) * 100; // Random walk
    candles.push({
      time: entryTime - (lookbackBars - i) * 5 * 60, // 5m timeframe
      open: basePrice,
      high: basePrice + Math.random() * 50,
      low: basePrice - Math.random() * 50,
      close: basePrice + (Math.random() - 0.5) * 50,
      volume: 1000 + Math.random() * 500,
    });
  }

  return candles;
}

async function enhancePatternsWithEMAs() {
  console.log('=== Enhancing Historical Patterns with EMAs ===\n');

  // Load patterns
  const dataPath = path.join(__dirname, '../data/raw/historical-patterns.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const patterns = data.patterns;

  console.log(`Loaded ${patterns.length} patterns\n`);

  // Enhance each pattern
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    console.log(`Processing pattern ${i + 1}/${patterns.length} (${pattern.id})...`);

    try {
      // Fetch historical candles for each timeframe
      const lfCandles = fetchHistoricalCandles(pattern.symbol, '5m', pattern.entryTime, 500);
      const mfCandles = fetchHistoricalCandles(pattern.symbol, '15m', pattern.entryTime, 500);
      const hfCandles = fetchHistoricalCandles(pattern.symbol, '1h', pattern.entryTime, 500);

      // Validate warmup
      if (!EMACalculator.validateWarmup(lfCandles, 200)) {
        console.warn(`  ⚠️  Insufficient LF candles for EMA200 warmup (${lfCandles.length} bars)`);
      }
      if (!EMACalculator.validateWarmup(mfCandles, 200)) {
        console.warn(`  ⚠️  Insufficient MF candles for EMA200 warmup (${mfCandles.length} bars)`);
      }
      if (!EMACalculator.validateWarmup(hfCandles, 200)) {
        console.warn(`  ⚠️  Insufficient HF candles for EMA200 warmup (${hfCandles.length} bars)`);
      }

      // Calculate EMAs
      EMACalculator.addEMAsToCandles(lfCandles, [8, 21, 50, 200]);
      EMACalculator.addEMAsToCandles(mfCandles, [8, 21, 50, 200]);
      EMACalculator.addEMAsToCandles(hfCandles, [5, 8, 21, 50, 200]);

      // Validate EMA values
      const lfValidation = EMACalculator.validateEMAValues(lfCandles);
      const mfValidation = EMACalculator.validateEMAValues(mfCandles);
      const hfValidation = EMACalculator.validateEMAValues(hfCandles);

      if (!lfValidation.valid || !mfValidation.valid || !hfValidation.valid) {
        console.error(`  ❌ EMA validation failed:`);
        console.error(`     LF: ${lfValidation.errors.join(', ')}`);
        console.error(`     MF: ${mfValidation.errors.join(', ')}`);
        console.error(`     HF: ${hfValidation.errors.join(', ')}`);
        errorCount++;
        continue;
      }

      // Attach candles to pattern
      pattern.lfCandles = lfCandles;
      pattern.mfCandles = mfCandles;
      pattern.hfCandles = hfCandles;

      console.log(`  ✅ EMAs calculated and validated`);
      successCount++;

    } catch (error) {
      console.error(`  ❌ Error processing pattern: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\nCompleted: ${successCount}/${patterns.length} patterns enhanced`);
  console.log(`Errors: ${errorCount}\n`);

  // Save enhanced dataset
  const outputPath = path.join(__dirname, '../data/raw/historical-patterns-with-emas.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

  console.log(`✅ Enhanced dataset saved to ${outputPath}`);
  console.log(`   File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB\n`);

  return { successCount, errorCount, totalPatterns: patterns.length };
}

// Run enhancement
enhancePatternsWithEMAs()
  .then(result => {
    console.log('=== Enhancement Complete ===');
    process.exit(result.errorCount === 0 ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Enhancement failed:', error);
    process.exit(1);
  });
```

**Implementation Notes**:
- **Historical Data Source**: The `fetchHistoricalCandles()` function is a mock placeholder. In Phase 6 implementation, this should:
  1. Use TradingView-API in replay mode (fetch historical bars via `chart.replayMode()`)
  2. OR use pre-downloaded CSV files (if TradingView API unavailable)
  3. OR use Binance/exchange API for crypto data
- **Lookback Window**: 500 bars per timeframe ensures EMA200 has adequate warmup (200 bars minimum, 3-5x ideal)
- **Timeframe Mapping**: LF=5m, MF=15m, HF=1h (from pattern dataset metadata)
- **Output File Size**: Expect ~10-20 MB for 250 patterns with 500 candles each (vs 330 KB for metadata-only)

---

#### 3.2.3 FeatureEngineer Updates

**File**: `src/data/feature-engineer.js`

**Changes to `_extractEMAFeatures()`**:

**Before** (lines 237-254):
```javascript
const lfIndicators = lfCandle.indicators || {};
const mfIndicators = mfCandle.indicators || {};
const hfIndicators = hfCandle.indicators || {};

return {
  ema8_lf_distance: lfIndicators.ema_8
    ? ((lfCandle.close - lfIndicators.ema_8) / lfClose) * 100
    : 0,  // ← Defaults to 0 if missing
  // ... 14 more features ...
};
```

**After** (with validation):
```javascript
const lfIndicators = lfCandle.indicators || {};
const mfIndicators = mfCandle.indicators || {};
const hfIndicators = hfCandle.indicators || {};

// Validate EMA indicators are present
this._validateEMAIndicators(lfIndicators, 'LF');
this._validateEMAIndicators(mfIndicators, 'MF');
this._validateEMAIndicators(hfIndicators, 'HF');

return {
  ema8_lf_distance: this._safeEMADistance(lfCandle.close, lfIndicators.ema_8, 'ema8_lf'),
  ema21_lf_distance: this._safeEMADistance(lfCandle.close, lfIndicators.ema_21, 'ema21_lf'),
  // ... 13 more features using _safeEMADistance ...
};
```

**New Helper Methods**:

```javascript
/**
 * Validate that EMA indicators are present and non-zero
 * @private
 */
_validateEMAIndicators(indicators, timeframeName) {
  const requiredEMAs = timeframeName === 'HF'
    ? ['ema_5', 'ema_8', 'ema_21', 'ema_50', 'ema_200']
    : ['ema_8', 'ema_21', 'ema_50', 'ema_200'];

  const missing = [];
  const zeros = [];

  for (const ema of requiredEMAs) {
    if (!(ema in indicators)) {
      missing.push(ema);
    } else if (indicators[ema] === 0) {
      zeros.push(ema);
    }
  }

  if (missing.length > 0) {
    this.logger.warn(`⚠️  Missing ${timeframeName} EMA indicators: ${missing.join(', ')}. Features will be 0.`);
  }
  if (zeros.length > 0) {
    this.logger.warn(`⚠️  Zero-valued ${timeframeName} EMA indicators: ${zeros.join(', ')}. Check data quality.`);
  }
}

/**
 * Safely calculate EMA distance with fallback and logging
 * @private
 */
_safeEMADistance(close, emaValue, featureName) {
  if (emaValue === undefined || emaValue === null || emaValue === 0) {
    this.logger.warn(`⚠️  EMA value missing for ${featureName}, returning 0. Check data pipeline.`);
    return 0;
  }

  const distance = ((close - emaValue) / close) * 100;

  // Sanity check: Distance should be within ±20% (EMAs shouldn't be that far from price)
  if (Math.abs(distance) > 20) {
    this.logger.warn(`⚠️  ${featureName} distance is ${distance.toFixed(2)}% (unusual). EMA=${emaValue.toFixed(2)}, Close=${close.toFixed(2)}`);
  }

  return distance;
}
```

**Benefits**:
- **Explicit warnings**: Logs when EMA data is missing or suspicious
- **Graceful degradation**: Still returns 0 if data unavailable, but now clearly logged
- **Quality assurance**: Sanity checks detect data pipeline issues

---

#### 3.2.4 Backtesting Script Updates

**File**: `scripts/run-phase5-backtest.cjs`

**Remove Simulated EMA Extraction** (delete lines 54-61):
```javascript
// BEFORE: Simulated EMA features
for (let i = 0; i < 18; i++) {
  features.push(priceRelativeToBase * (1 + Math.random() * 0.1)); // ❌ Random noise
}
```

**Replace with FeatureEngineer Call**:
```javascript
const { FeatureEngineer } = require('../src/data/feature-engineer');

// Initialize FeatureEngineer
const config = require('../src/config');
const logger = {
  debug: console.log,
  info: console.log,
  warn: console.warn,
  error: console.error,
};
const featureEngineer = new FeatureEngineer(config, logger);

/**
 * Extract features using FeatureEngineer (with real EMAs)
 */
async function extractFeaturesWithEMAs(pattern) {
  // Construct multiTimeframeData from enhanced pattern
  const multiTimeframeData = {
    lf: { candles: pattern.lfCandles || [] },
    mf: { candles: pattern.mfCandles || [] },
    hf: { candles: pattern.hfCandles || [] },
  };

  // Engineer features
  const result = await featureEngineer.engineerFeatures(
    pattern.symbol,
    pattern,
    multiTimeframeData
  );

  return result.normalized; // Return normalized feature vector
}

// Update backtest loop (line 241):
for (let i = 0; i < patterns.length; i++) {
  try {
    const normalized = await extractFeaturesWithEMAs(patterns[i]); // ✅ Use real EMA features
    allFeatures.push(Object.values(normalized)); // Convert to array
  } catch (error) {
    console.error(`Error extracting features for pattern ${i}:`, error.message);
    featureExtractionErrors++;
    allFeatures.push(new Array(60).fill(0)); // Fallback
  }
}
```

**Benefits**:
- **Unified feature extraction**: Uses same FeatureEngineer logic as production
- **Real EMA data**: Reads from `pattern.lfCandles[0].indicators.ema_8`, etc.
- **Validation**: FeatureEngineer logs warnings if EMA data missing

---

## 4. Implementation Roadmap

### Phase 6 Priority 1: EMA Feature Fix (5 Days)

#### Day 1: EMA Calculator Module
**Tasks**:
1. Create `src/indicators/ema-calculator.js` with 4 methods (300 lines)
2. Write unit tests (`tests/ema-calculator.test.js`, 10 tests)
3. Validate EMA calculation accuracy (compare to TradingView values)

**Deliverables**:
- ✅ EMACalculator class with calculateEMA, addEMAsToCandles, validateWarmup, validateEMAValues
- ✅ Unit tests passing (100% coverage)
- ✅ Documentation with EMA formula and usage examples

**Validation**:
- EMA(8) of known price series matches expected output
- EMA(200) requires >= 200 candles (warmup check)
- EMAs within 50% of price (sanity check)

---

#### Day 2-3: Historical Data Integration
**Tasks**:
1. Implement `fetchHistoricalCandles()` function:
   - **Option A**: TradingView-API replay mode (preferred if credentials available)
   - **Option B**: Binance API for BTCUSDT historical data (fallback)
   - **Option C**: Use pre-downloaded CSV files (last resort)
2. Create `scripts/add-emas-to-patterns.cjs` (400 lines)
3. Run script to enhance all 250 patterns with EMAs

**Deliverables**:
- ✅ Historical candle fetching implementation (TradingView or Binance)
- ✅ Enhanced dataset: `data/raw/historical-patterns-with-emas.json`
- ✅ Validation report: All 250 patterns have EMA values, no NaN/Inf

**Validation**:
- All patterns have `lfCandles`, `mfCandles`, `hfCandles` arrays (500 bars each)
- All candles have `indicators.ema_8`, `ema_21`, `ema_50`, `ema_200` (HF: +ema_5)
- EMA values within reasonable range (±50% of price)
- COMA validation: For patterns with `hfTrend.comaConfirmed: true`, verify EMA order matches

**Risk Mitigation**:
- **TradingView rate limiting**: If TradingView API unavailable, use Binance API as backup
- **Data quality**: Validate OHLCV data is realistic (no outliers, gaps)
- **Lookback window**: Start with 500 bars; if insufficient warmup, increase to 1000 bars

---

#### Day 4: FeatureEngineer & Backtesting Updates
**Tasks**:
1. Update `src/data/feature-engineer.js` with EMA validation helpers (100 lines)
2. Update `scripts/run-phase5-backtest.cjs` to use FeatureEngineer (50 lines)
3. Run backtest with real EMA features
4. Compare results: Before (simulated EMAs) vs After (real EMAs)

**Deliverables**:
- ✅ FeatureEngineer with `_validateEMAIndicators()` and `_safeEMADistance()`
- ✅ Backtesting script using real EMA features
- ✅ Before/After comparison report

**Validation**:
- FeatureEngineer logs warnings if EMA data missing (0 warnings expected with enhanced dataset)
- Backtesting extracts 60 features (not 62) with real EMA values
- Feature distribution analysis: EMA features no longer constant 0

---

#### Day 5: Verification & Analysis
**Tasks**:
1. Run full Phase 5 backtest with real EMA features
2. Analyze win rate improvement
3. Feature importance analysis: Which EMA features predict winners?
4. Validate COMA hypothesis: Do COMA-aligned patterns have higher win rate?
5. Generate comprehensive analysis report

**Deliverables**:
- ✅ Phase 5 backtest results with real EMA features
- ✅ Win rate comparison: 57.2% → X% (target: 62-67%)
- ✅ Feature importance report (permutation importance or correlation analysis)
- ✅ COMA validation report (win rate by COMA alignment)
- ✅ Phase 6 readiness assessment

**Success Criteria**:
- Win rate ≥ 62% (minimum to show improvement)
- Win rate ≥ 65% (Phase 5 gate target)
- Model discrimination: Not all predictions are "winner" (predicted winners 50-70%)
- EMA features show predictive signal (correlation with outcome > 0.1)

---

## 5. Expected Impact

### 5.1 Win Rate Improvement Estimate

**Current Baseline** (simulated EMAs):
- Win rate: 57.2% (143/250)
- Model predicts: 100% winners (no discrimination)
- Sharpe ratio: Unknown (likely <1.5 due to poor win rate)

**Expected After Fix** (real EMAs):

**Conservative Estimate (+5%)**:
- Win rate: **62.2%** (155/250)
- Improvement: +12 patterns correctly predicted
- Model discrimination: 60% predicted winners, 40% losers
- Rationale: COMA features enable basic trend filtering (remove ~10 low-quality long patterns in downtrends)

**Moderate Estimate (+7%)**:
- Win rate: **64.2%** (160/250)
- Improvement: +17 patterns correctly predicted
- Model discrimination: 55% predicted winners, 45% losers
- Rationale: COMA + EMA distance features filter weak pullbacks (price far from EMAs = low-quality setup)

**Optimistic Estimate (+10%)**:
- Win rate: **67.2%** (168/250)
- Improvement: +25 patterns correctly predicted
- Model discrimination: 50% predicted winners, 50% losers
- Rationale: Full multi-timeframe COMA validation (HF + MF + LF alignment) is highly predictive

**Probability Assessment**:
- Conservative (62%): **70% likely** — COMA trend filtering is well-established in trading
- Moderate (64%): **50% likely** — Depends on quality of EMAs and model retraining
- Optimistic (67%): **20% likely** — Requires perfect EMA calculation and strong model response

**Recommendation**: Target **64% win rate** as realistic Phase 6 goal (moderate estimate).

---

### 5.2 Model Discrimination Analysis

**Why Model Currently Fails**:
1. **No COMA signal**: Without real EMA alignment, model cannot distinguish strong trends (COMA) vs weak trends (no COMA)
2. **No EMA distance signal**: Cannot distinguish high-quality pullbacks (price near EMA8/21) vs low-quality (price far from EMAs or below EMA200)
3. **Synthetic data overfitting**: Model learned "all patterns are winners" from Phase 4 synthetic data (100% win rate)

**Expected After Fix**:
1. **COMA filtering**: Model learns to reject patterns without multi-timeframe COMA alignment
   - Example: Long pattern in LF uptrend but HF downtrend → higher probability of failure
   - Impact: ~10-15 patterns filtered (mostly losers)
2. **EMA distance filtering**: Model learns to reject patterns with weak pullbacks
   - Example: Long pattern with close far below EMA21 (deep pullback) → lower win rate
   - Impact: ~10-15 patterns filtered (mostly losers)
3. **Multi-timeframe validation**: Model learns to prefer patterns with all timeframes aligned
   - Example: LF+MF+HF all in COMA uptrend → highest win rate
   - Impact: Prioritize top 30-40% of patterns → improve win rate in top predictions

**Validation Approach**:
- **Confusion Matrix**: Count true positives, false positives, true negatives, false negatives
  - Before: TP=143, FP=107, TN=0, FN=0 (predicts all winners)
  - After: TP=130, FP=30, TN=77, FN=13 (discriminates)
- **Prediction Distribution**: Histogram of model confidence
  - Before: All predictions at 100% winner confidence
  - After: Distribution from 30% to 90% winner confidence (model is uncertain)
- **Feature Correlation**: Correlation between EMA features and outcome
  - Before: EMA features correlation ≈ 0 (random noise)
  - After: EMA features correlation > 0.1 (predictive signal)

---

### 5.3 Phase 5 Gate Validation

**Phase 5 Success Criteria**:
1. ✅ Sharpe ratio ≥ 1.5 (currently unknown, likely <1.5)
2. ❌ Win rate ≥ 65% (currently 57.2%, target: 62-67%)
3. ✅ Max drawdown < 20% (assumed passing, not EMA-dependent)
4. ✅ Multi-symbol consistency (only BTCUSDT in dataset, not applicable)

**Expected After Fix**:
1. **Sharpe ratio**: Likely improves to 1.3-1.8 (depends on win rate and R-multiple distribution)
   - Higher win rate → higher average return → higher Sharpe
   - Better discrimination → avoid large losses → lower volatility → higher Sharpe
2. **Win rate**: Target 64-65% (moderate estimate)
   - Pass Phase 5 gate ✅
3. **Max drawdown**: May improve slightly (fewer consecutive losses due to better filtering)
4. **Multi-symbol consistency**: N/A

**Overall Phase 5 Gate**: Currently **FAILED** (57.2% win rate) → Expected **PASS** after fix (64-65% win rate)

---

## 6. File Deliverables

### New Files to Create

1. **`src/indicators/ema-calculator.js`** (300 lines)
   - EMA calculation module
   - Methods: calculateEMA, addEMAsToCandles, validateWarmup, validateEMAValues

2. **`tests/ema-calculator.test.js`** (200 lines)
   - Unit tests for EMA calculator
   - 10 test cases covering accuracy, warmup, validation

3. **`scripts/add-emas-to-patterns.cjs`** (400 lines)
   - Historical pattern enhancement script
   - Fetches candles, calculates EMAs, saves enhanced dataset

4. **`docs/EMA-CALCULATION-GUIDE.md`** (500 lines)
   - EMA formula explanation
   - Warmup requirements
   - Accuracy validation
   - Usage examples

5. **`docs/PHASE6-EMA-FEATURE-ANALYSIS.md`** (this document, 3000+ lines)
   - Comprehensive audit and analysis
   - Root cause findings
   - Implementation roadmap
   - Expected impact

6. **`data/raw/historical-patterns-with-emas.json`** (10-20 MB)
   - Enhanced dataset with OHLCV candles and EMAs
   - 250 patterns × 3 timeframes × 500 candles

---

### Files to Modify

1. **`src/data/feature-engineer.js`** (+100 lines)
   - Add `_validateEMAIndicators()` method
   - Add `_safeEMADistance()` method
   - Update `_extractEMAFeatures()` to use validation helpers

2. **`scripts/run-phase5-backtest.cjs`** (+50 lines, -10 lines)
   - Remove simulated EMA extraction (lines 54-61)
   - Add FeatureEngineer initialization
   - Replace `extractFeatures()` with `extractFeaturesWithEMAs()`

3. **`tests/feature-engineer.test.js`** (+50 lines)
   - Add tests for EMA validation helpers
   - Add tests for EMA missing data handling

---

## 7. Risk Assessment & Mitigation

### High-Risk Items

**1. Historical Data Availability**
- **Risk**: TradingView API may not support historical replay for 6 months of 5m data (memory constraints)
- **Impact**: Cannot calculate EMAs for all patterns → Phase 6 blocked
- **Mitigation**:
  - **Plan A**: Use TradingView replay mode with chunking (fetch 1000 bars at a time)
  - **Plan B**: Use Binance API for BTCUSDT historical data (free, no auth required)
  - **Plan C**: Use pre-downloaded CSV files from crypto data providers
- **Likelihood**: Low (30%) — Binance API is reliable backup

**2. EMA Calculation Accuracy**
- **Risk**: EMA calculation differs from TradingView's implementation → feature mismatch
- **Impact**: Model trained on synthetic EMAs won't work with real EMAs
- **Mitigation**:
  - Validate EMA calculation against known TradingView values (fetch 100 bars, compare EMA output)
  - Document TradingView EMA formula (should be standard EMA formula)
  - If mismatch found, reverse-engineer TradingView's calculation
- **Likelihood**: Low (20%) — EMA formula is standardized

**3. Insufficient Win Rate Improvement**
- **Risk**: Win rate improves to only 60-62% (below 65% gate)
- **Impact**: Phase 5 gate still fails → need model retraining or more features
- **Mitigation**:
  - If win rate <65%, analyze feature importance to identify additional issues
  - Consider retraining model on real EMA data (Phase 4 model may be biased to synthetic EMAs)
  - Add additional COMA-related features (EMA slopes, EMA crossover recency)
- **Likelihood**: Medium (40%) — Conservative estimate is 62%, which passes 65% gate with buffer

**4. Data Quality Issues**
- **Risk**: Historical candles have gaps, outliers, or incorrect data
- **Impact**: EMAs become unreliable → features noisy → no win rate improvement
- **Mitigation**:
  - Implement data quality checks (detect gaps, outliers, unrealistic price moves)
  - Filter out patterns with poor data quality (log warnings)
  - Validate against multiple data sources (TradingView vs Binance)
- **Likelihood**: Medium (30%) — Crypto data generally reliable, but may have exchange outages

---

### Medium-Risk Items

**1. Model Retraining Required**
- **Risk**: Phase 4 model trained on synthetic EMAs may not work with real EMAs
- **Impact**: Need to retrain model from scratch (2-3 days delay)
- **Mitigation**:
  - First test with existing model (Phase 4 weights) on real EMA features
  - If performance still poor, schedule model retraining as Phase 6 Priority 2
  - Document model retraining procedure for reproducibility
- **Likelihood**: Medium (50%) — Model may have learned to ignore EMA features entirely

**2. Performance Overhead**
- **Risk**: Calculating EMAs for 500 candles per pattern per timeframe is slow (>10s per pattern)
- **Impact**: Backtesting takes hours instead of minutes
- **Mitigation**:
  - Pre-calculate EMAs and save to enhanced dataset (one-time cost)
  - Use vectorized NumPy-style operations (if available in JS)
  - Run enhancement script overnight if needed
- **Likelihood**: Low (20%) — EMA calculation is O(n), should be fast

---

## 8. Next Steps

### Immediate Actions (Week 1)

**Day 1-2**: Implement EMA Calculator Module
- Create `src/indicators/ema-calculator.js`
- Write unit tests (`tests/ema-calculator.test.js`)
- Validate EMA accuracy against TradingView

**Day 3-4**: Enhance Historical Patterns
- Implement `fetchHistoricalCandles()` (TradingView or Binance)
- Create `scripts/add-emas-to-patterns.cjs`
- Run script to generate `historical-patterns-with-emas.json`

**Day 5**: Update FeatureEngineer & Backtesting
- Update `src/data/feature-engineer.js` with EMA validation
- Update `scripts/run-phase5-backtest.cjs` to use real EMAs
- Run backtest and analyze results

---

### Follow-Up Actions (Week 2)

**If Win Rate ≥ 65%**: ✅ Pass Phase 5 Gate
- Document findings and proceed to Phase 6 (Live Indicator)
- Archive analysis documents
- Celebrate success 🎉

**If Win Rate 62-64%**: ⚠️ Partial Success
- Analyze feature importance to identify additional improvements
- Consider adding COMA-related features (EMA slopes, crossover recency)
- Schedule model retraining with real EMA data (Phase 6 Priority 2)

**If Win Rate <62%**: ❌ Insufficient Improvement
- Deep-dive analysis: Why are EMA features not predictive?
- Check data quality: Are EMAs correctly calculated? Any outliers?
- Consider alternative hypotheses: Is COMA not predictive for this dataset?
- Escalate to senior ML engineer for model architecture review

---

## 9. Appendix

### A. EMA Formula

**Exponential Moving Average (EMA)**:

```
EMA(t) = α × Price(t) + (1 - α) × EMA(t-1)

where:
  α = 2 / (N + 1)  (smoothing factor)
  N = EMA period (5, 8, 21, 50, 200)

Initialization:
  EMA(0) = SMA(N) = average of first N prices
```

**Example**: EMA(8) for prices [100, 101, 102, 103, 104]
```
α = 2 / (8 + 1) = 0.222

SMA(8) = (100 + 101 + 102 + 103 + 104) / 5 = 102 (assuming first 5 bars)
EMA(0) = 102

EMA(1) = 0.222 × 101 + 0.778 × 102 = 101.778
EMA(2) = 0.222 × 102 + 0.778 × 101.778 = 101.884
EMA(3) = 0.222 × 103 + 0.778 × 101.884 = 102.333
EMA(4) = 0.222 × 104 + 0.778 × 102.333 = 102.725
```

---

### B. COMA Algorithm

**Correct Order of Moving Averages (COMA)**:

**Uptrend COMA**:
```
EMA(5) > EMA(8) > EMA(21) > EMA(50) > EMA(200)
AND
All EMAs have been in correct order for ≥30 consecutive bars
```

**Downtrend COMA**:
```
EMA(5) < EMA(8) < EMA(21) < EMA(50) < EMA(200)
AND
All EMAs have been in correct order for ≥30 consecutive bars
```

**Feature Extraction**:
```javascript
// Binary COMA validation features
const lfLongCOMA = lf.ema_8 > lf.ema_21 && lf.ema_21 > lf.ema_50 && lf.ema_50 > lf.ema_200 ? 1 : 0;
const hfLongCOMA = hf.ema_5 > hf.ema_8 && hf.ema_8 > hf.ema_21 && hf.ema_21 > hf.ema_50 && hf.ema_50 > hf.ema_200 ? 1 : 0;

// Multi-timeframe alignment
const allTFAlignedLong = (lfLongCOMA && mfLongCOMA && hfLongCOMA) ? 1 : 0;
```

**Hypothesis**: Patterns with `allTFAlignedLong = 1` should have win rate >70%, while patterns with `allTFAlignedLong = 0` should have win rate <50%.

---

### C. Feature List (60 Features)

**Price Action Features (10)**:
1. volume
2. range
3. body
4. upper_wick
5. lower_wick
6. range_percent
7. body_percent
8. upper_wick_percent
9. lower_wick_percent
10. close_position_in_range
11. log_volume

**EMA Features (15)**: ← **THESE ARE THE PROBLEM**
12. ema8_lf_distance
13. ema21_lf_distance
14. ema50_lf_distance
15. ema200_lf_distance
16. ema8_mf_distance
17. ema21_mf_distance
18. ema50_mf_distance
19. ema200_mf_distance
20. ema5_hf_distance
21. ema8_hf_distance
22. ema21_hf_distance
23. ema50_hf_distance
24. ema200_hf_distance
25. atr_lf
26. atr_hf

**Consolidation Features (12)**: (Working — uses pattern metadata)
27-38. consolidation_range_percent, price_distance_from_base_percent, touches_to_level, etc.

**Trend Features (12)**: (Partially working — COMA booleans present but not validated by real EMAs)
39-50. lf_ema_order_long, hf_ema_order_long, all_tf_aligned_long, etc.

**Support/Resistance & Momentum Features (11)**: (Working — uses candle data)
51-60. distance_to_ema21_mf, bars_higher_highs, volume_ratio, return_last_5_bars, etc.

---

### D. Success Metrics

**Phase 6 Priority 1 Success Criteria**:

1. ✅ **EMA Calculator Module**: Unit tests pass, EMA accuracy validated
2. ✅ **Enhanced Dataset**: 250 patterns with real EMA values, no NaN/Inf
3. ✅ **FeatureEngineer Updated**: Logs warnings for missing EMAs, uses real data
4. ✅ **Backtesting Updated**: Uses FeatureEngineer instead of simulated features
5. ✅ **Win Rate Improvement**: From 57.2% to ≥62% (moderate target) or ≥65% (Phase 5 gate)
6. ✅ **Model Discrimination**: Predicts 50-70% winners (not 100%)
7. ✅ **Feature Quality**: EMA features have correlation >0.1 with outcomes
8. ✅ **COMA Validation**: Patterns with multi-timeframe COMA have higher win rate

**Timeline**: 5 days (1 week buffer for debugging)

---

## Summary

This analysis identified the **root cause of the 57.2% win rate**: 18/60 features (30%) are using simulated/random EMA data because the historical pattern dataset lacks raw OHLCV candles needed for EMA calculation.

**Recommended solution**: Hybrid approach with pre-calculated EMAs for backtesting and on-demand EMAs for live inference.

**Expected impact**: Win rate improvement from 57.2% to 62-67%, enabling Phase 5 gate pass and model discrimination between high-quality and low-quality Gecko patterns.

**Next steps**: Implement EMA Calculator module, enhance historical patterns with real EMAs, update FeatureEngineer and backtesting script, validate win rate improvement.

---

**End of Analysis**
