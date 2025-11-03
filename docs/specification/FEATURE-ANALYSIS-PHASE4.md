# Feature Analysis Report — Phase 4 Model Training Preparation

**Document Version**: 1.0
**Analysis Date**: November 3, 2025
**Analyst**: Feature Analytics Engineer
**Project**: Gecko ML Indicator — Phase 4 Model Training
**Feature Engineering Module**: `/src/data/feature-engineer.js`
**Test Coverage**: 35 tests, 100% passing, 96.89% line coverage

---

## Executive Summary

### Overview

The FeatureEngineer module successfully implements **62 features** across 5 distinct categories for the Gecko ML Indicator project. This analysis provides a comprehensive review of feature quality, potential issues, and optimization recommendations to support Phase 4 model training.

### Key Findings

1. **Feature Count**: 62 features delivered (exceeds 50+ minimum target by 24%)
2. **Feature Quality**: 100% valid features (zero NaN/Inf issues in testing)
3. **Performance**: Feature extraction <5ms per pattern (exceeds <10ms target)
4. **Test Coverage**: 96.89% line coverage with 35 passing tests
5. **Normalization**: Dual methods implemented (MinMax and ZScore)

### Critical Issues Identified

**HIGH PRIORITY**:
- **Multicollinearity Risk**: Multiple EMA features across timeframes measure highly correlated trends
- **Absolute Price Features**: Raw OHLC values (close, open, high, low) are symbol-dependent and may not generalize
- **Normalization Bounds**: Hardcoded minmax bounds [0, 50000] for prices will fail for symbols outside this range

**MEDIUM PRIORITY**:
- **Feature Redundancy**: 15 EMA features with potential correlation >0.85 between same-period EMAs across timeframes
- **Missing Feature Interactions**: No composite features combining consolidation quality with test bar strength
- **ZScore Implementation**: ZScore normalization calculates statistics from single sample (incorrect implementation)

**LOW PRIORITY**:
- **Look-ahead Bias Check**: Verify pattern features don't use future data (requires code audit)
- **Binary Feature Dominance**: 19 of 62 features are binary (0/1), which may limit model expressiveness

### Recommendations for Phase 4

1. **Feature Selection**: Reduce to 30-40 most important features after initial training
2. **Normalization**: Implement dataset-wide MinMax bounds (min/max from training data, not hardcoded)
3. **Remove Absolute Prices**: Replace OHLC raw values with percentage-based or normalized metrics
4. **Feature Engineering**: Create composite features (e.g., consolidation_quality = touches × compression)
5. **ZScore Fix**: Implement proper ZScore with training set statistics (mean/std from entire dataset)
6. **Feature Importance Analysis**: Post-training, use permutation importance to identify top 20 features
7. **Correlation Matrix**: Compute after training to identify and remove redundant features (correlation >0.90)

### Estimated Impact

- **Model Accuracy**: Addressing multicollinearity may improve validation accuracy by 5-10%
- **Inference Latency**: Reducing to 30 features could decrease inference time by ~50% (from 62 to 30 features)
- **Generalization**: Fixing normalization and removing absolute prices will improve cross-symbol performance
- **Training Speed**: Feature reduction will decrease training time by 30-40%

---

## Section 1: Complete Feature Catalog (62 Features)

### Category 1: Price Action Features (12 features)

Features extracted from Low Frame (LF) current candle OHLCV data.

| # | Feature Name | Calculation | Expected Range | Distribution | Notes |
|---|--------------|-------------|----------------|--------------|-------|
| 1 | `close` | Current close price | [0, 50000] | Symbol-dependent | ⚠️ Absolute price, symbol-specific |
| 2 | `open` | Current open price | [0, 50000] | Symbol-dependent | ⚠️ Absolute price, symbol-specific |
| 3 | `high` | Current high price | [0, 50000] | Symbol-dependent | ⚠️ Absolute price, symbol-specific |
| 4 | `low` | Current low price | [0, 50000] | Symbol-dependent | ⚠️ Absolute price, symbol-specific |
| 5 | `volume` | Current bar volume | [0, 100M] | Right-skewed | Volume typically log-normal |
| 6 | `range` | High - Low | [0, 1000] | Right-skewed | Volatility proxy |
| 7 | `body` | \|Close - Open\| | [0, 1000] | Right-skewed | Candle strength |
| 8 | `upper_wick` | High - max(Open, Close) | [0, 1000] | Right-skewed | Rejection wick |
| 9 | `lower_wick` | min(Open, Close) - Low | [0, 1000] | Right-skewed | Support wick |
| 10 | `hl2` | (High + Low) / 2 | [0, 50000] | Symbol-dependent | ⚠️ Absolute price |
| 11 | `hlc3` | (High + Low + Close) / 3 | [0, 50000] | Symbol-dependent | ⚠️ Absolute price |
| 12 | `body_percent` | (Body / Range) × 100 | [0, 100] | Uniform-ish | ✓ Normalized metric |

**Quality Assessment**:
- ✓ All calculations correct
- ⚠️ Features 1-4, 10-11: Absolute prices won't generalize across symbols
- ⚠️ Zero-range edge case handled correctly (line 448)
- ✓ No look-ahead bias

**Recommendations**:
- Replace `close`, `open`, `high`, `low` with percentage change or normalized distance from EMA
- Keep `body_percent` (already normalized)
- Consider replacing `hl2`, `hlc3` with distance from MF/HF EMAs

---

### Category 2: EMA Features (15 features)

Features extracted from Exponential Moving Averages across 3 timeframes.

| # | Feature Name | Timeframe | EMA Period | Expected Range | Notes |
|---|--------------|-----------|------------|----------------|-------|
| 13 | `ema8_lf` | Low Frame | 8 | [0, 50000] | ⚠️ Absolute price |
| 14 | `ema21_lf` | Low Frame | 21 | [0, 50000] | ⚠️ Absolute price |
| 15 | `ema50_lf` | Low Frame | 50 | [0, 50000] | ⚠️ Absolute price |
| 16 | `ema200_lf` | Low Frame | 200 | [0, 50000] | ⚠️ Absolute price |
| 17 | `ema8_mf` | Mid Frame | 8 | [0, 50000] | ⚠️ Absolute price |
| 18 | `ema21_mf` | Mid Frame | 21 | [0, 50000] | ⚠️ Absolute price |
| 19 | `ema50_mf` | Mid Frame | 50 | [0, 50000] | ⚠️ Absolute price |
| 20 | `ema200_mf` | Mid Frame | 200 | [0, 50000] | ⚠️ Absolute price |
| 21 | `ema5_hf` | High Frame | 5 | [0, 50000] | ⚠️ Absolute price |
| 22 | `ema8_hf` | High Frame | 8 | [0, 50000] | ⚠️ Absolute price |
| 23 | `ema21_hf` | High Frame | 21 | [0, 50000] | ⚠️ Absolute price |
| 24 | `ema50_hf` | High Frame | 50 | [0, 50000] | ⚠️ Absolute price |
| 25 | `ema200_hf` | High Frame | 200 | [0, 50000] | ⚠️ Absolute price |
| 26 | `atr_lf` | Low Frame | ATR(14) | [0, 1000] | ✓ Volatility measure |
| 27 | `atr_hf` | High Frame | ATR(14) | [0, 1000] | ✓ Volatility measure |

**Quality Assessment**:
- ✓ Correct extraction from indicator data (lines 160-180)
- ⚠️ Graceful handling of missing indicators (default to 0) — may cause issues if model learns 0 = missing vs actual 0
- ⚠️ High multicollinearity risk: EMA8_lf, EMA8_mf, EMA8_hf are highly correlated (all track same trend)
- ⚠️ Absolute prices — won't generalize across symbols
- ✓ ATR features are volatility-normalized (good)

**Multicollinearity Analysis**:

Expected correlation between EMA features:
- **Same period, different timeframes**: EMA8_lf ↔ EMA8_mf ↔ EMA8_hf likely **r > 0.90** (all track same trend)
- **Adjacent periods, same timeframe**: EMA8_lf ↔ EMA21_lf likely **r > 0.85**
- **Distant periods, same timeframe**: EMA8_lf ↔ EMA200_lf likely **r = 0.60-0.80**

**Recommendations**:
- **Critical**: Replace absolute EMA values with **distance from current price** (e.g., `(close - ema21_mf) / close`)
- Keep only one EMA per period across timeframes (e.g., keep LF EMAs, drop MF/HF absolute values)
- Retain ATR features (important for Gecko pattern validation)
- Post-training: Compute VIF for all EMA features; remove if VIF > 10

---

### Category 3: Consolidation Pattern Features (12 features)

Features measuring Gecko consolidation base quality and test bar characteristics.

| # | Feature Name | Calculation | Expected Range | Notes |
|---|--------------|-------------|----------------|-------|
| 28 | `consolidation_level` | Pattern base price | [0, 50000] | ⚠️ Absolute price |
| 29 | `consolidation_range` | Base high - low | [0, 1000] | ✓ Good metric |
| 30 | `price_distance_from_base` | \|Close - Base\| | [0, 1000] | ✓ Good metric |
| 31 | `touches_to_level` | Count of bars near base | [0, 50] | ✓ Pattern quality |
| 32 | `touch_density` | Touches / History length | [0, 1] | ✓ Normalized |
| 33 | `range_ratio` | Recent range / Avg range | [0, 2] | ✓ Compression metric |
| 34 | `volatility_squeeze` | Std dev of last 10 closes | [0, 1000] | ✓ Consolidation tightness |
| 35 | `avg_range_last_10` | Mean(High-Low) last 10 bars | [0, 1000] | ✓ Recent volatility |
| 36 | `has_test_bar` | Binary: Test bar formed | [0, 1] | ✓ Binary flag |
| 37 | `test_bar_strength` | (Close - Low) / Range | [0, 1] | ✓ Normalized |
| 38 | `test_bar_volume_ratio` | Test bar vol / Avg vol | [0, 5] | ✓ Volume spike |

**Note**: Missing feature 39 in sequence — only 11 features listed but category header says 12. **Investigation required**.

**Quality Assessment**:
- ✓ Consolidation logic correct (lines 189-246)
- ✓ Touch detection within tolerance (10% of range) is reasonable
- ✓ Compression ratio calculation correct
- ✓ Standard deviation calculation correct (lines 475-481)
- ⚠️ Feature 28 (`consolidation_level`) is absolute price
- ⚠️ Missing handling of empty pattern (lines 199-219 assume consolidation exists)
- ✓ Zero-division handling correct (e.g., line 241-242)

**Expected Feature Importance** (trading logic):
- **High importance**: `touches_to_level`, `range_ratio`, `volatility_squeeze` (consolidation quality)
- **High importance**: `test_bar_strength`, `test_bar_volume_ratio` (test bar confirmation)
- **Medium importance**: `consolidation_range`, `price_distance_from_base`
- **Low importance**: `consolidation_level` (absolute price, symbol-specific)

**Recommendations**:
- Replace `consolidation_level` with `(close - consolidation_level) / close` (percentage distance)
- **Create composite feature**: `consolidation_quality = touches_to_level × (1 / range_ratio) × volatility_squeeze`
- **Feature interaction**: `test_bar_confirmation = test_bar_strength × test_bar_volume_ratio × has_test_bar`
- Verify touch tolerance (10% of range) is appropriate for different market conditions

---

### Category 4: Trend Alignment Features (12 features)

COMA (Correct Order of Moving Averages) validation across 3 timeframes.

| # | Feature Name | Calculation | Expected Range | Notes |
|---|--------------|-------------|----------------|-------|
| 39 | `lf_ema_order_long` | LF: 8>21>50>200 | [0, 1] | ✓ Binary COMA |
| 40 | `lf_ema_order_short` | LF: 8<21<50<200 | [0, 1] | ✓ Binary COMA |
| 41 | `lf_above_200sma` | Close > EMA200 | [0, 1] | ✓ Long-term trend |
| 42 | `mf_ema_order_long` | MF: 8>21>50>200 | [0, 1] | ✓ Binary COMA |
| 43 | `mf_ema_order_short` | MF: 8<21<50<200 | [0, 1] | ✓ Binary COMA |
| 44 | `mf_above_200sma` | Close > EMA200 | [0, 1] | ✓ Long-term trend |
| 45 | `hf_ema_order_long` | HF: 5>8>21>50>200 | [0, 1] | ✓ Binary COMA (5 EMAs) |
| 46 | `hf_ema_order_short` | HF: 5<8<21<50<200 | [0, 1] | ✓ Binary COMA (5 EMAs) |
| 47 | `hf_above_200sma` | Close > EMA200 | [0, 1] | ✓ Long-term trend |
| 48 | `all_tf_aligned_long` | All 3 TF long COMA | [0, 1] | ✓ Critical alignment |
| 49 | `all_tf_aligned_short` | All 3 TF short COMA | [0, 1] | ✓ Critical alignment |
| 50 | `lf_mf_aligned` | LF & MF COMA match | [0, 1] | ✓ Partial alignment |

**Quality Assessment**:
- ✓ COMA logic correct (lines 259-266)
- ✓ HF uses 5 EMAs (correct per Gecko spec: EMA5, 8, 21, 50, 200)
- ✓ Multi-timeframe alignment logic correct (lines 285-287)
- ⚠️ **Issue**: `lf_mf_aligned` (line 287) checks equality of boolean values, but doesn't distinguish between "both uptrend" vs "both downtrend" vs "both no trend"
- ✓ Binary features appropriate for trend direction

**Expected Feature Importance** (trading logic):
- **Critical importance**: `all_tf_aligned_long`, `all_tf_aligned_short` (Gecko requires HF trend confirmation)
- **High importance**: `hf_ema_order_long`, `hf_ema_order_short` (HF trend is primary filter)
- **Medium importance**: `lf_ema_order_long`, `mf_ema_order_long` (LF/MF confirm entry)
- **Low importance**: `lf_above_200sma`, `mf_above_200sma`, `hf_above_200sma` (redundant with COMA)

**Potential Issues**:
- **Multicollinearity**: `all_tf_aligned_long` is a perfect linear combination of `lf_ema_order_long`, `mf_ema_order_long`, `hf_ema_order_long`
  - VIF will be **infinite** for this feature
  - **Recommendation**: Remove composite features; model can learn AND logic
- **Class Imbalance**: If dataset has strong trend bias, COMA features may be 0 or 1 for >90% of samples
  - **Recommendation**: Monitor class distribution during training; consider SMOTE if severe imbalance

**Recommendations**:
- **Remove**: `all_tf_aligned_long`, `all_tf_aligned_short`, `lf_mf_aligned` (perfect multicollinearity)
- **Add feature**: `trend_strength = (ema8 - ema200) / ema200` (continuous measure of trend intensity)
- **Add feature**: `trend_consistency = count of consecutive COMA bars / total bars` (trend stability)
- Keep individual COMA binary flags (important for interpretability)

---

### Category 5: Support/Resistance & Momentum Features (11 features)

Distance to key support/resistance levels and momentum metrics.

| # | Feature Name | Calculation | Expected Range | Notes |
|---|--------------|-------------|----------------|-------|
| 51 | `distance_to_ema21_mf` | (Close - EMA21_MF) / Close | [-0.1, 0.1] | ✓ Normalized distance |
| 52 | `distance_to_ema5_hf` | (Close - EMA5_HF) / Close | [-0.1, 0.1] | ✓ Normalized distance |
| 53 | `distance_to_ema200_mf` | (Close - EMA200_MF) / Close | [-0.1, 0.1] | ✓ Normalized distance |
| 54 | `close_above_ema21_mf` | Close > EMA21_MF | [0, 1] | ⚠️ Redundant with #51 |
| 55 | `close_above_ema5_hf` | Close > EMA5_HF | [0, 1] | ⚠️ Redundant with #52 |
| 56 | `close_above_ema200_mf` | Close > EMA200_MF | [0, 1] | ⚠️ Redundant with #53 |
| 57 | `bars_higher_highs` | Count / 20 (last 20 bars) | [0, 1] | ✓ Momentum metric |
| 58 | `bars_higher_lows` | Count / 20 (last 20 bars) | [0, 1] | ✓ Momentum metric |
| 59 | `bars_lower_highs` | Count / 20 (last 20 bars) | [0, 1] | ⚠️ Missing `bars_lower_lows` |
| 60 | `volume_ratio` | Current vol / Avg vol | [0, 5] | ✓ Volume spike detection |
| 61 | `return_last_5_bars` | (Close - Close[-5]) / Close[-5] | [-0.1, 0.1] | ✓ Short-term return |
| 62 | `return_last_10_bars` | (Close - Close[-10]) / Close[-10] | [-0.1, 0.1] | ✓ Medium-term return |

**Quality Assessment**:
- ✓ Distance normalization correct (lines 301-303)
- ✓ Momentum swing counting logic correct (lines 312-317)
- ✓ Volume ratio calculation correct (lines 321-324)
- ✓ Return calculations correct (lines 327-332)
- ⚠️ **Redundancy**: Features 54-56 are binary versions of features 51-53 (sign of distance)
- ⚠️ **Missing feature**: `bars_lower_lows` (line 316 missing — code doesn't extract it)
- ⚠️ **Edge case**: Distance calculation uses `lfCandle.close` for LF but `mfCandle.close` for denominator (line 301) — should use `lfCandle.close` consistently

**Multicollinearity Analysis**:
- `distance_to_ema21_mf` and `close_above_ema21_mf` are **perfectly correlated** (one is sign of the other)
  - Correlation coefficient r = 0.95+ (binary threshold of continuous variable)
  - **Recommendation**: Remove binary versions (features 54-56)

**Expected Feature Importance** (trading logic):
- **High importance**: `distance_to_ema5_hf` (HF dynamic support/resistance)
- **Medium importance**: `bars_higher_highs`, `bars_higher_lows` (momentum confirmation)
- **Medium importance**: `volume_ratio` (breakout volume validation)
- **Low importance**: `return_last_5_bars`, `return_last_10_bars` (less relevant for pattern trading)
- **Low importance**: Binary close_above features (redundant)

**Recommendations**:
- **Remove**: `close_above_ema21_mf`, `close_above_ema5_hf`, `close_above_ema200_mf` (features 54-56) — redundant with distance features
- **Add**: `bars_lower_lows` (missing from swing count)
- **Fix**: Line 301 denominator inconsistency (should use `lfCandle.close` consistently)
- **Add feature**: `momentum_divergence = bars_higher_highs - bars_higher_lows` (price-momentum divergence)
- **Add feature**: `volume_trend = volume_ratio_last_5 / volume_ratio_last_20` (volume acceleration)

---

## Section 2: Multicollinearity Analysis

### High-Risk Correlation Pairs (Expected |r| > 0.85)

Based on feature engineering logic, the following feature pairs are expected to be highly correlated:

#### Perfect Multicollinearity (r ≈ 1.00, VIF → ∞)

| Feature A | Feature B | Reason | VIF Estimate | Action |
|-----------|-----------|--------|--------------|--------|
| `all_tf_aligned_long` | `lf_ema_order_long` AND `mf_ema_order_long` AND `hf_ema_order_long` | Perfect AND combination | ∞ | Remove composite |
| `all_tf_aligned_short` | `lf_ema_order_short` AND `mf_ema_order_short` AND `hf_ema_order_short` | Perfect AND combination | ∞ | Remove composite |
| `close_above_ema21_mf` | `distance_to_ema21_mf` | Binary threshold of continuous | ~50 | Remove binary |
| `close_above_ema5_hf` | `distance_to_ema5_hf` | Binary threshold of continuous | ~50 | Remove binary |
| `close_above_ema200_mf` | `distance_to_ema200_mf` | Binary threshold of continuous | ~50 | Remove binary |

#### High Multicollinearity (r > 0.90, VIF > 10)

| Feature A | Feature B | Expected r | VIF Estimate | Action |
|-----------|-----------|------------|--------------|--------|
| `ema8_lf` | `ema8_mf` | 0.95 | 20 | Keep LF, remove MF/HF absolute EMAs |
| `ema8_lf` | `ema8_hf` | 0.93 | 18 | Keep LF, remove MF/HF absolute EMAs |
| `ema21_lf` | `ema21_mf` | 0.95 | 20 | Keep LF, remove MF/HF absolute EMAs |
| `ema21_lf` | `ema21_hf` | 0.93 | 18 | Keep LF, remove MF/HF absolute EMAs |
| `close` | `hl2` | 0.98 | 25 | Remove hl2, hlc3 |
| `close` | `hlc3` | 0.99 | 30 | Remove hl2, hlc3 |
| `range` | `body` | 0.85 | 8 | Monitor; remove if VIF > 10 |
| `range` | `avg_range_last_10` | 0.80 | 6 | Monitor |

#### Medium Multicollinearity (r = 0.70-0.85, VIF = 5-10)

| Feature A | Feature B | Expected r | VIF Estimate | Action |
|-----------|-----------|------------|--------------|--------|
| `ema8_lf` | `ema21_lf` | 0.80 | 6 | Monitor; consider interaction term |
| `lf_ema_order_long` | `lf_above_200sma` | 0.75 | 5 | Monitor; may be redundant |
| `consolidation_range` | `avg_range_last_10` | 0.70 | 4 | Monitor |
| `touches_to_level` | `touch_density` | 0.85 | 7 | Monitor; density is normalized version |
| `return_last_5_bars` | `return_last_10_bars` | 0.75 | 5 | Monitor |

### Recommended Feature Removals (Pre-Training)

Based on multicollinearity analysis, **remove the following 14 features** before training:

1. `all_tf_aligned_long` — perfect collinearity with individual TF COMA features
2. `all_tf_aligned_short` — perfect collinearity with individual TF COMA features
3. `lf_mf_aligned` — perfect collinearity with LF/MF COMA features
4. `close_above_ema21_mf` — redundant with `distance_to_ema21_mf`
5. `close_above_ema5_hf` — redundant with `distance_to_ema5_hf`
6. `close_above_ema200_mf` — redundant with `distance_to_ema200_mf`
7. `ema8_mf` — highly correlated with `ema8_lf`
8. `ema21_mf` — highly correlated with `ema21_lf`
9. `ema50_mf` — highly correlated with `ema50_lf`
10. `ema200_mf` — highly correlated with `ema200_lf`
11. `ema8_hf` — highly correlated with `ema8_lf`
12. `ema21_hf` — highly correlated with `ema21_lf`
13. `hl2` — highly correlated with `close`
14. `hlc3` — highly correlated with `close`

**Reduction**: 62 features → **48 features** (23% reduction)

### Post-Training VIF Analysis Plan

After initial model training on 48 features:

1. **Calculate VIF for all features** using validation set
   - VIF = 1 / (1 - R²) where R² is from regressing feature i on all other features
   - VIF > 10: Severe multicollinearity (remove feature)
   - VIF 5-10: Moderate multicollinearity (monitor performance)
   - VIF < 5: Acceptable

2. **Compute correlation matrix** on validation set
   - Identify pairs with |r| > 0.85
   - For each pair, keep feature with higher individual importance (from permutation importance)

3. **Iterative removal**
   - Remove highest VIF feature
   - Re-train model
   - Compare validation accuracy
   - Repeat until all VIF < 10 or accuracy drops >2%

---

## Section 3: Feature Quality Assessment

### Validation Checks

#### ✓ PASSED: No NaN/Inf Values

All 35 tests pass validation for:
- No NaN values in raw features (test line 555-562)
- No Infinity values in normalized features (test line 565-572)
- All features are numbers (test line 549-552)

**Code Review**: Validation logic correct (lines 487-505)
- NaN detection: `isNaN(value)`
- Infinity detection: `!isFinite(value)`
- Type check: `typeof value !== 'number'`
- **Issue**: Validation logs warnings but doesn't throw errors (line 501) — may allow bad data to propagate

**Recommendation**: Change validation to throw errors for critical issues, not just log warnings.

#### ✓ PASSED: Feature Count Consistency

- Module implements exactly **62 features** as documented
- Tests verify count: `expect(result.count).toBe(62)` (line 173)
- All features present in `raw` and `normalized` objects

#### ⚠️ WARNING: Zero-Variance Features

Potential zero-variance features (always same value):

| Feature | Condition | Variance | Impact |
|---------|-----------|----------|--------|
| `has_test_bar` | If no test bars in dataset | 0 | Model can't learn |
| `all_tf_aligned_long` | If no aligned trends in dataset | 0 | Model can't learn |
| Binary COMA features | If dataset only has uptrends | 0 | Model can't learn |

**Recommendation**: After dataset collection, compute variance for all features. Remove features with variance < 0.01.

#### ⚠️ WARNING: Skewed Distributions

Expected right-skewed distributions (log-normal):

- `volume`: Typical volume distribution (use log transform)
- `range`, `body`: Volatility measures (use log transform or clip outliers)
- `volume_ratio`: Spike detection (cap at 5.0 as per bounds)
- `test_bar_volume_ratio`: Spike detection (cap at 5.0 as per bounds)

**Recommendation**: Apply log transformation to skewed features before normalization:
```python
volume_normalized = log(volume + 1) / log(max_volume + 1)
```

### Feature Scaling Analysis

#### MinMax Normalization Issues

**Critical Issue**: Hardcoded bounds in lines 369-441 are **symbol-dependent**:

```javascript
close: [0, 50000],  // Only works for BTC ~$40k
```

**Problems**:
1. **Bitcoin at $100k**: `close = 100000` → normalized to `1.0` (clipped) → all high-price BTC samples collapse to 1.0
2. **Forex EURUSD at $1.05**: `close = 1.05` → normalized to `0.000021` → all forex samples collapse to ~0
3. **Stocks like SPY at $450**: Different scale entirely

**Current Clipping**: Line 451 clips to [0, 1]:
```javascript
normalized[key] = Math.max(0, Math.min(1, (value - min) / range));
```

This **silently** clips out-of-bound values, hiding the problem during testing with mock data.

**Recommendation**:
- **Phase 4 start**: Compute min/max from training dataset (not hardcoded)
- **Implementation**:
  ```javascript
  // Compute from training data
  const bounds = computeBoundsFromDataset(trainingData);

  // Save bounds with model
  saveBounds(bounds, './data/models/feature_bounds.json');

  // Load bounds during inference
  const bounds = loadBounds('./data/models/feature_bounds.json');
  ```

#### ZScore Normalization Issues

**Critical Issue**: ZScore implementation is **incorrect** (lines 454-463):

```javascript
// Calculate mean and std dev from features
const values = Object.values(features);
const mean = values.reduce((a, b) => a + b, 0) / values.length;
```

**Problem**: This calculates mean/std across **different features** (e.g., averaging `close`, `volume`, `ema8`, which have completely different scales), not across samples of the same feature.

**Correct Implementation**: Calculate mean/std for each feature across all samples in training set:

```python
# Correct approach
for feature_name in features:
    mean = training_data[feature_name].mean()
    std = training_data[feature_name].std()
    normalized[feature_name] = (value - mean) / std
```

**Recommendation**:
- **Do not use current ZScore method** for Phase 4 training
- Implement proper ZScore with dataset-wide statistics
- Save statistics with model (mean/std for each of 62 features)

### Edge Case Handling

#### ✓ PASSED: Division by Zero

All division operations protected:
- `body_percent`: Line 148 checks `range > 0`
- `range_ratio`: Line 213 checks `avgRange > 0`
- `volume_ratio`: Line 324 checks `avgVolume > 0`
- `test_bar_strength`: Line 241 checks `testBar.range > 0`
- `standard deviation`: Line 476 checks `values.length === 0`

#### ✓ PASSED: Missing Data

Graceful handling of missing indicators:
- Line 160-180: `indicators?.ema_8 || 0` defaults to 0 if missing
- Line 55-57: Throws error if candles missing entirely

**Potential Issue**: Defaulting to 0 for missing indicators means:
- Model may learn `0 = no data` vs `0 = actual EMA value of 0` (though EMA can't actually be 0 for positive prices)
- Better approach: Use `NaN` for missing, then impute or skip sample

#### ⚠️ WARNING: Historical Data Length

Lines 198-219 assume `lfHistory.length >= 10`:
- If fewer bars available, features like `touches_to_level`, `range_ratio` will have default values
- Tests use 20+ bars (line 74-93), so this isn't tested

**Recommendation**: Document minimum history requirement (20 bars) and validate in `engineerFeatures()`.

---

## Section 4: Performance Profiling

### Current Performance Metrics

From test suite (line 626-635):
- **Feature extraction time**: <1000ms for full engineerFeatures() call
- **Test suite runtime**: 35 tests complete in <5 seconds
- **Phase 3 documentation**: <5ms feature extraction per pattern

### Computational Complexity Analysis

#### Feature Extraction by Category

| Category | Features | Complexity | Bottlenecks | Time Estimate |
|----------|----------|------------|-------------|---------------|
| Price Features | 12 | O(1) | Simple arithmetic | <0.1ms |
| EMA Features | 15 | O(1) | Direct indicator lookup | <0.1ms |
| Consolidation Features | 12 | O(n) | Touch counting, std dev | 2-3ms |
| Trend Features | 12 | O(1) | Boolean comparisons | <0.1ms |
| Support/Momentum Features | 11 | O(n) | Swing counting (20 bars) | 1-2ms |
| **Total** | **62** | **O(n)** | **n = history length** | **<5ms** |

#### Bottleneck Analysis

**Consolidation Features** (lines 189-246):
- **Touch counting** (lines 201-203): O(n) iteration over `lfHistory`
- **Compression ratio** (lines 206-213): Two O(n) iterations (last 10 bars + full history)
- **Volatility squeeze** (lines 216-218): O(n) standard deviation calculation

**Support/Momentum Features** (lines 291-355):
- **Swing counting** (lines 312-317): O(n) iteration over last 20 bars
- **Volume average** (lines 321-323): O(n) iteration over `lfHistory`

**Total Iterations**: ~4 passes over historical data (n = 20-100 bars)

### Optimization Recommendations

#### Quick Wins (Phase 4 immediate)

1. **Cache historical statistics** (avg range, avg volume, std dev)
   - Compute once per candle update, reuse for all patterns
   - **Savings**: 3 O(n) iterations → 0 iterations
   - **Estimated speedup**: 40% reduction (5ms → 3ms)

2. **Vectorize consolidation calculations**
   - Replace for-loops with array operations
   - Use single pass for touch counting + compression
   - **Savings**: 2 O(n) iterations → 1 iteration
   - **Estimated speedup**: 20% reduction (5ms → 4ms)

3. **Lazy evaluation for expensive features**
   - Only compute consolidation features if pattern exists
   - Lines 199-219 already check for `consolidation.basePrice`
   - **Savings**: Skip calculations if no pattern detected

#### Medium-Term (Post Phase 4)

4. **Batch feature extraction**
   - Process multiple patterns in single call
   - Reuse historical statistics across patterns
   - **Estimated speedup**: 2x faster for batch processing

5. **Pre-compute indicator statistics**
   - DataCollector module could pre-calculate rolling stats
   - FeatureEngineer just looks up cached values
   - **Estimated speedup**: 50% reduction (5ms → 2.5ms)

6. **Approximate calculations**
   - Use approximate std dev (running variance)
   - Use approximate touch counting (sample every 2nd bar)
   - **Trade-off**: Slight accuracy loss for speed

#### Long-Term (Phase 5-6)

7. **Worker threads for parallel processing**
   - Extract features for LF/MF/HF in parallel
   - Use Node.js worker threads
   - **Estimated speedup**: 2-3x faster

8. **WebAssembly for critical paths**
   - Compile consolidation detection to WASM
   - **Estimated speedup**: 5-10x faster

### Performance Target Validation

**Phase 4 target**: <2s total latency for signal generation

**Breakdown**:
- Data collection (TradingView API): ~500ms
- Feature extraction (62 features): <5ms ✓
- Model inference (TensorFlow.js): ~50ms (estimated)
- Pattern detection: ~100ms (estimated)
- **Total**: ~655ms ✓ **Well below 2s target**

**Recommendation**: Current performance is acceptable for Phase 4. Focus on accuracy, not optimization.

---

## Section 5: Feature Engineering Code Validation

### Code Review Findings

#### ✓ CORRECT: Price Feature Calculations

Lines 123-149: All calculations mathematically correct
- Range: `high - low` ✓
- Body: `Math.abs(close - open)` ✓
- Upper wick: `high - Math.max(open, close)` ✓
- Lower wick: `Math.min(open, close) - low` ✓
- HLC3: `(high + low + close) / 3` ✓

#### ✓ CORRECT: COMA Logic

Lines 259-266: COMA detection matches Gecko specification
- Uptrend: EMA(8) > EMA(21) > EMA(50) > EMA(200) ✓
- Downtrend: EMA(8) < EMA(21) < EMA(50) < EMA(200) ✓
- HF includes EMA(5): `ema_5 > ema_8 > ...` ✓

#### ⚠️ ISSUE: Distance Calculation Inconsistency

Line 301-303:
```javascript
const distanceToEMA21MF = mfCandle.close > 0 ? (lfCandle.close - mf.ema_21) / lfCandle.close : 0;
```

**Issue**: Uses `lfCandle.close` (Low Frame) in numerator but `mfCandle.close` (Mid Frame) in denominator check.

**Correct**: Should consistently use `lfCandle.close`:
```javascript
const distanceToEMA21MF = lfCandle.close > 0 ? (lfCandle.close - mf.ema_21) / lfCandle.close : 0;
```

**Impact**: Low (current code likely works because LF/MF close prices are close), but semantically incorrect.

**Recommendation**: Fix denominator to use `lfCandle.close` consistently.

#### ⚠️ ISSUE: Missing `bars_lower_lows` Feature

Lines 306-318: Swing counting logic counts:
- `barsHigherHighs` ✓
- `barsHigherLows` ✓
- `barsLowerHighs` ✓
- `barsLowerLows` — **calculated but not returned** (line 316 exists but not in return statement)

Line 346-352 return statement **missing** `bars_lower_lows`:
```javascript
bars_higher_highs: barsHigherHighs / 20,
bars_higher_lows: barsHigherLows / 20,
bars_lower_highs: barsLowerHighs / 20,
// Missing: bars_lower_lows: barsLowerLows / 20,
```

**Impact**: Feature count should be **63**, not **62** (off by 1).

**Recommendation**: Add `bars_lower_lows: barsLowerLows / 20` to return statement.

#### ⚠️ ISSUE: Look-Ahead Bias Potential

Lines 327-332: Return calculations use historical data:
```javascript
const return5bars = lfHistory.length >= 5
  ? (lfCandle.close - lfHistory[4].close) / lfHistory[4].close
  : 0;
```

**Analysis**:
- `lfHistory[0]` = current candle
- `lfHistory[4]` = 5 bars ago
- Calculation: (current - past) / past ✓ **No look-ahead bias**

**Validation**: This is a **backward-looking** return, safe for ML.

#### ✓ CORRECT: No Look-Ahead Bias in Consolidation Features

Lines 189-246: All consolidation features use:
- Current candle (`lfCandle`)
- Historical candles (`lfHistory`)
- Pattern data (consolidation base, test bar) — **requires validation**

**Critical Question**: Does `pattern` object use future data?
- Pattern detection happens **before** feature engineering (DataCollector → PatternDetector → FeatureEngineer)
- Pattern should only use data up to current candle
- **Recommendation**: Audit PatternDetector module to verify no future data leakage

### Test Coverage Analysis

**Overall Coverage**: 96.89% line coverage (35 tests)

**Uncovered Lines** (3.11% remaining):
- Likely error handling paths and edge cases
- Need to identify specific uncovered lines with coverage report

**Test Quality**:
- ✓ All feature categories tested
- ✓ Edge cases tested (zero range, missing indicators, empty pattern)
- ✓ Integration tests included
- ✓ Normalization methods tested
- ⚠️ Missing: Historical data length edge cases (<10 bars, <20 bars)
- ⚠️ Missing: Extreme value tests (outliers, very high/low prices)

**Recommendation**: Add tests for:
1. Insufficient historical data (5 bars, 10 bars)
2. Extreme prices (BTC at $1M, forex at $0.001)
3. All-zero pattern (no consolidation, no test bar)
4. Uncovered error paths

---

## Section 6: Optimization Recommendations for Phase 4

### Pre-Training Feature Engineering Fixes

**Priority: CRITICAL (must fix before training)**

1. **Fix normalization bounds** (lines 369-441)
   - **Action**: Remove hardcoded bounds; compute from training dataset
   - **Implementation**: Add `computeBounds(trainingData)` method
   - **Impact**: Enables cross-symbol generalization
   - **Effort**: 2 hours
   - **Files**: `src/data/feature-engineer.js`, `src/models/predictor.js`

2. **Remove absolute price features** (features 1-4, 10-11, 13-25, 28)
   - **Action**: Replace with percentage-based or normalized metrics
   - **Example**: `close_pct_change = (close - ema21_lf) / ema21_lf`
   - **Impact**: Critical for generalization
   - **Effort**: 4 hours
   - **Files**: `src/data/feature-engineer.js`

3. **Fix ZScore normalization** (lines 454-463)
   - **Action**: Calculate statistics per feature across dataset, not across features
   - **Implementation**: Pass training dataset statistics to normalization method
   - **Impact**: Enables proper ZScore normalization
   - **Effort**: 3 hours
   - **Files**: `src/data/feature-engineer.js`

4. **Add missing `bars_lower_lows` feature** (line 352)
   - **Action**: Add to return statement
   - **Impact**: Completes swing momentum features (62 → 63 features)
   - **Effort**: 5 minutes
   - **Files**: `src/data/feature-engineer.js`, tests

**Priority: HIGH (fix before final model)**

5. **Remove redundant features** (14 features identified in Section 2)
   - **Action**: Comment out or remove features with perfect multicollinearity
   - **Impact**: Reduces from 62 to 48 features, improves model stability
   - **Effort**: 1 hour
   - **Files**: `src/data/feature-engineer.js`

6. **Fix distance calculation denominator** (line 301)
   - **Action**: Use `lfCandle.close` consistently
   - **Impact**: Semantic correctness
   - **Effort**: 5 minutes
   - **Files**: `src/data/feature-engineer.js`

7. **Change validation to throw errors** (line 501)
   - **Action**: `if (issues.length > 0) throw new Error(...)`
   - **Impact**: Prevent bad data from reaching model
   - **Effort**: 10 minutes
   - **Files**: `src/data/feature-engineer.js`

**Priority: MEDIUM (post-training optimization)**

8. **Create composite features**
   - `consolidation_quality = touches_to_level × (1 / range_ratio) × volatility_squeeze`
   - `test_bar_confirmation = test_bar_strength × test_bar_volume_ratio × has_test_bar`
   - **Impact**: May improve model accuracy by 2-5%
   - **Effort**: 2 hours
   - **Files**: `src/data/feature-engineer.js`

9. **Add feature interactions**
   - `trend_strength = (ema8 - ema200) / ema200`
   - `momentum_divergence = bars_higher_highs - bars_higher_lows`
   - **Impact**: Capture non-linear relationships
   - **Effort**: 2 hours
   - **Files**: `src/data/feature-engineer.js`

### Model Training Recommendations

**Phase 4 Training Strategy**

1. **Initial Training (Week 1)**
   - Fix critical issues (normalization, absolute prices)
   - Train on 48 features (after removing 14 redundant)
   - Baseline model: Simple feedforward NN (2 × 64 units)
   - **Metric target**: Validation accuracy >70%, AUC >0.75

2. **Feature Importance Analysis (Week 2)**
   - **Permutation importance**: Shuffle each feature, measure accuracy drop
   - **Rank features**: Top 20 by importance
   - **Identify low-value features**: Bottom 10 by importance (candidates for removal)
   - **Correlation matrix**: Identify remaining multicollinearity

3. **Feature Selection (Week 2)**
   - Remove features with:
     - Importance < 1% (no contribution to predictions)
     - VIF > 10 (severe multicollinearity)
     - Correlation > 0.90 with higher-importance feature
   - **Target**: Reduce to 25-30 features

4. **Model Re-training (Week 3)**
   - Train on reduced feature set (25-30 features)
   - Compare validation accuracy vs baseline
   - **Success criteria**: Accuracy drop <2% with 50% fewer features

5. **Feature Interaction Testing (Week 3)**
   - Add composite features (consolidation_quality, test_bar_confirmation)
   - Measure accuracy improvement
   - Keep if improvement >1%

### Post-Training Validation Checklist

**Feature Quality**

- [ ] All features have variance > 0.01 on validation set
- [ ] No features have >10% missing values
- [ ] No features clipped by MinMax bounds (check for values = 0 or 1)
- [ ] No features with extreme outliers (>3 std dev from mean)

**Multicollinearity**

- [ ] VIF < 10 for all features
- [ ] No feature pairs with correlation > 0.90
- [ ] Condition number of feature matrix < 30

**Feature Importance**

- [ ] Top 10 features account for >70% of model importance
- [ ] Bottom 20% of features account for <10% of model importance
- [ ] Feature importance aligns with trading logic (COMA, consolidation quality, test bar)

**Normalization**

- [ ] MinMax bounds cover 99% of training data (no clipping)
- [ ] ZScore normalized features have mean ≈ 0, std ≈ 1 on training set
- [ ] Bounds/statistics saved with model for inference

**Trading Logic Validation**

- [ ] COMA features (`all_tf_aligned_*`) in top 10 importance (trend confirmation critical)
- [ ] Consolidation features (`touches_to_level`, `range_ratio`) in top 20 importance
- [ ] Test bar features (`test_bar_strength`, `test_bar_volume_ratio`) in top 20 importance
- [ ] Absolute price features NOT in top 20 importance (should be removed/replaced)

---

## Section 7: Integration with TensorFlow.js

### Feature Vector Format

**Input Shape**: `[batch_size, 62]` (or 48 after removing redundant features)

**Feature Order**: Must be consistent between training and inference

**Recommendation**:
1. Define canonical feature order in config
2. Save feature names with model
3. Validate feature order before inference

Example:
```javascript
// src/config/feature-order.js
module.exports.FEATURE_ORDER = [
  'close', 'open', 'high', 'low', 'volume',
  'range', 'body', 'upper_wick', 'lower_wick',
  // ... all 62 features in fixed order
];

// During training
const featureVector = FEATURE_ORDER.map(name => features[name]);

// During inference
const featureVector = FEATURE_ORDER.map(name => features[name]);
```

### Normalization Integration

**Training Phase**:
```javascript
// 1. Collect all training samples
const allFeatures = trainingData.map(sample => sample.raw);

// 2. Compute bounds for MinMax
const bounds = computeBoundsFromDataset(allFeatures);

// 3. Normalize training data
const normalizedData = trainingData.map(sample =>
  featureEngineer.normalizeFeatures(sample.raw, 'minmax', bounds)
);

// 4. Save bounds with model
fs.writeFileSync('./data/models/feature_bounds.json', JSON.stringify(bounds));
```

**Inference Phase**:
```javascript
// 1. Load bounds
const bounds = JSON.parse(fs.readFileSync('./data/models/feature_bounds.json'));

// 2. Extract features
const rawFeatures = featureEngineer.engineerFeatures(symbol, pattern, data);

// 3. Normalize with saved bounds
const normalizedFeatures = featureEngineer.normalizeFeatures(rawFeatures.raw, 'minmax', bounds);

// 4. Create tensor
const inputTensor = tf.tensor2d([Object.values(normalizedFeatures)], [1, 62]);
```

### Model Architecture Recommendations

**Input Layer**:
```javascript
const input = tf.input({shape: [62]}); // or [48] after feature reduction
```

**Hidden Layers**:
- Start simple: 2 layers × 64 units
- Activation: ReLU (works well with normalized [0,1] features)
- Regularization: Dropout 0.2-0.3 (prevent overfitting)

**Output Layer**:
```javascript
const output = tf.layers.dense({
  units: 2,           // Binary classification (winner/loser)
  activation: 'softmax'
}).apply(hidden);
```

**Feature-Specific Considerations**:
- **Binary features (19 total)**: ReLU handles 0/1 inputs well
- **Continuous features (43 total)**: MinMax [0,1] normalization works with ReLU
- **Skewed features (volume, range)**: Consider log transform before MinMax

### Data Leakage Prevention

**Critical**: Ensure normalization uses **only training data statistics**

❌ **WRONG**:
```javascript
// Computes bounds from validation set too — LEAKAGE!
const allData = [...trainingData, ...validationData];
const bounds = computeBounds(allData);
```

✓ **CORRECT**:
```javascript
// Compute bounds ONLY from training data
const bounds = computeBounds(trainingData);

// Apply to validation data
const valNormalized = validationData.map(sample =>
  normalize(sample, bounds) // Use training bounds
);
```

**Validation**:
- Validation set should have statistics similar to training (mean ≈ 0.5, std ≈ 0.2-0.3 for MinMax)
- If validation statistics are very different, indicates distribution shift

---

## Section 8: Top Features by Expected Importance

Based on Gecko trading logic and feature engineering analysis, here are the expected top features ranked by importance to the model:

### Tier 1: Critical Features (Top 10, Expected >50% Model Importance)

| Rank | Feature | Category | Why Important | Expected Importance % |
|------|---------|----------|---------------|----------------------|
| 1 | `hf_ema_order_long` | Trend | HF COMA is primary pattern filter | 12% |
| 2 | `hf_ema_order_short` | Trend | HF COMA is primary pattern filter | 12% |
| 3 | `touches_to_level` | Consolidation | Base quality — more touches = stronger pattern | 8% |
| 4 | `range_ratio` | Consolidation | Compression — lower ratio = tighter base | 7% |
| 5 | `test_bar_strength` | Consolidation | Test bar quality — close near high | 6% |
| 6 | `volatility_squeeze` | Consolidation | Base tightness — low vol = strong pattern | 5% |
| 7 | `test_bar_volume_ratio` | Consolidation | Volume confirmation — spike on test bar | 5% |
| 8 | `distance_to_ema5_hf` | Support/Resistance | Dynamic support distance | 4% |
| 9 | `atr_lf` | Volatility | Pattern size validation (vs ATR threshold) | 3% |
| 10 | `consolidation_range` | Consolidation | Base size — smaller range = cleaner pattern | 3% |
| | | | **Tier 1 Subtotal** | **65%** |

### Tier 2: High-Value Features (Next 10, Expected 25% Importance)

| Rank | Feature | Category | Why Important | Expected Importance % |
|------|---------|----------|---------------|----------------------|
| 11 | `lf_ema_order_long` | Trend | LF trend confirmation | 3% |
| 12 | `lf_ema_order_short` | Trend | LF trend confirmation | 3% |
| 13 | `mf_ema_order_long` | Trend | MF trend confirmation | 2.5% |
| 14 | `body_percent` | Price | Candle strength indicator | 2.5% |
| 15 | `bars_higher_highs` | Momentum | Uptrend momentum | 2% |
| 16 | `bars_higher_lows` | Momentum | Uptrend momentum | 2% |
| 17 | `distance_to_ema21_mf` | Support/Resistance | MF support distance | 2% |
| 18 | `volume_ratio` | Momentum | Current volume vs average | 2% |
| 19 | `avg_range_last_10` | Consolidation | Recent volatility context | 1.5% |
| 20 | `touch_density` | Consolidation | Normalized touch frequency | 1.5% |
| | | | **Tier 2 Subtotal** | **22%** |

### Tier 3: Medium-Value Features (Next 10, Expected 10% Importance)

| Rank | Feature | Category | Why Important | Expected Importance % |
|------|---------|----------|---------------|----------------------|
| 21 | `atr_hf` | Volatility | HF volatility context | 1% |
| 22 | `return_last_5_bars` | Momentum | Recent price momentum | 1% |
| 23 | `return_last_10_bars` | Momentum | Medium-term momentum | 1% |
| 24 | `range` | Price | Current bar size | 0.8% |
| 25 | `body` | Price | Current bar strength | 0.8% |
| 26 | `upper_wick` | Price | Rejection signal | 0.7% |
| 27 | `lower_wick` | Price | Support signal | 0.7% |
| 28 | `price_distance_from_base` | Consolidation | Current position vs base | 0.7% |
| 29 | `has_test_bar` | Consolidation | Binary test bar flag | 0.6% |
| 30 | `bars_lower_highs` | Momentum | Downtrend momentum | 0.6% |
| | | | **Tier 3 Subtotal** | **8%** |

### Tier 4: Low-Value Features (Remaining, Expected <5% Importance)

Remaining 32 features (or 18 after removing 14 redundant):
- Absolute EMA values (replaced by distance features)
- Redundant binary flags (`close_above_*`)
- Composite COMA features (multicollinear)
- Absolute price features (symbol-specific)
- Supplementary price metrics (`hl2`, `hlc3`)

**Expected Importance**: <5% combined

### Feature Importance Validation Strategy

**Post-Training Validation** (Week 2 of Phase 4):

1. **Permutation Importance**
   - For each feature, shuffle values in validation set
   - Measure accuracy drop
   - Rank by magnitude of drop
   - **Expected outcome**: Top 10 features account for >60% of importance

2. **SHAP Values** (if model supports)
   - Calculate SHAP contribution for each feature
   - Visualize feature importance distribution
   - Identify feature interactions
   - **Expected outcome**: COMA and consolidation features dominate

3. **Ablation Testing**
   - Remove top 10 features, measure accuracy drop (expect >30% drop)
   - Remove bottom 20 features, measure accuracy drop (expect <5% drop)
   - **Decision**: Remove features with <1% individual importance

4. **Feature Category Importance**
   - Compute importance by category
   - **Expected**:
     - Trend features: 35-40%
     - Consolidation features: 40-45%
     - Support/Momentum features: 10-15%
     - Price features: 5-10%
     - EMA features: <5% (should be replaced by distance features)

### Red Flags for Feature Importance

**Warning Signs** (investigate if observed):

1. **Absolute price features in Top 10**: Indicates model is overfitting to specific price ranges → Remove these features
2. **All binary features in Bottom 20**: Model not learning trend logic → Check COMA implementation
3. **Volume features in Top 5**: Unusual; Gecko pattern is structure-based, not volume-based → Check for data leakage
4. **EMA absolute values more important than distances**: Model learning symbol-specific patterns → Replace with normalized distances
5. **Flat importance distribution** (all features 1-2%): Model not learning meaningful patterns → Revisit feature engineering or model architecture

---

## Appendix A: Feature Engineering Code Issues Summary

| Issue # | Priority | Line(s) | Issue | Recommendation | Effort |
|---------|----------|---------|-------|----------------|--------|
| 1 | CRITICAL | 369-441 | Hardcoded normalization bounds | Compute from training data | 2 hours |
| 2 | CRITICAL | 1-4, 10-11, 13-25, 28 | Absolute price features | Replace with percentage/normalized | 4 hours |
| 3 | CRITICAL | 454-463 | Incorrect ZScore implementation | Calculate per-feature across dataset | 3 hours |
| 4 | HIGH | Multiple | 14 redundant features | Remove multicollinear features | 1 hour |
| 5 | HIGH | 352 | Missing `bars_lower_lows` | Add to return statement | 5 min |
| 6 | HIGH | 501 | Validation logs warnings, doesn't throw | Throw error for critical issues | 10 min |
| 7 | MEDIUM | 301 | Denominator inconsistency | Use `lfCandle.close` consistently | 5 min |
| 8 | MEDIUM | 285-287 | Perfect multicollinearity in composite features | Remove `all_tf_aligned_*` features | 15 min |
| 9 | LOW | 199-219 | No minimum history validation | Document requirement (20 bars) | 30 min |
| 10 | LOW | N/A | Missing tests for edge cases | Add tests for insufficient data | 2 hours |

**Total Estimated Effort**: 13 hours (1.6 developer days)

**Priority Sequencing**:
1. **Day 1**: Fix critical issues (normalization, absolute prices, ZScore) — 9 hours
2. **Day 2**: Fix high-priority issues (redundant features, missing feature, validation) — 2 hours
3. **Day 3**: Fix medium/low issues and add tests — 2 hours

---

## Appendix B: Feature Removal Recommendations

### Phase 4 Pre-Training Removals (14 features)

Remove these before initial training to reduce multicollinearity:

```javascript
// Remove from feature extraction:
// 1. Composite COMA features (perfect multicollinearity)
// all_tf_aligned_long
// all_tf_aligned_short
// lf_mf_aligned

// 2. Redundant binary flags (sign of distance features)
// close_above_ema21_mf
// close_above_ema5_hf
// close_above_ema200_mf

// 3. Absolute EMA values from MF/HF (correlated with LF)
// ema8_mf, ema21_mf, ema50_mf, ema200_mf
// ema8_hf, ema21_hf

// 4. Price composites (correlated with close)
// hl2, hlc3
```

### Phase 4 Post-Training Removals (Variable)

After importance analysis, likely remove:

**If Importance < 1%**:
- `lf_above_200sma`, `mf_above_200sma`, `hf_above_200sma` (redundant with COMA)
- `return_last_5_bars`, `return_last_10_bars` (momentum less important for pattern trading)
- Absolute price features (`close`, `open`, `high`, `low`) if not already replaced

**If VIF > 10**:
- EMA pairs across timeframes (keep LF only)
- `range` vs `body` (if highly correlated)
- `touches_to_level` vs `touch_density` (keep density)

**Expected Final Feature Count**: 25-35 features

---

## Appendix C: Recommended New Features

### Composite Quality Metrics

```javascript
// Consolidation quality score (0-1)
consolidation_quality = (touches_to_level / 50) * (1 / range_ratio) * (volatility_squeeze / 100)

// Test bar confirmation score (0-1)
test_bar_confirmation = test_bar_strength * (test_bar_volume_ratio / 5) * has_test_bar

// Overall pattern quality (0-1)
pattern_quality = consolidation_quality * test_bar_confirmation
```

### Trend Strength Metrics

```javascript
// Continuous trend strength (-1 to +1)
trend_strength_lf = (ema8_lf - ema200_lf) / ema200_lf
trend_strength_mf = (ema8_mf - ema200_mf) / ema200_mf
trend_strength_hf = (ema8_hf - ema200_hf) / ema200_hf

// Multi-timeframe alignment strength (0-3)
tf_alignment_score = (trend_strength_lf > 0 ? 1 : 0) +
                      (trend_strength_mf > 0 ? 1 : 0) +
                      (trend_strength_hf > 0 ? 1 : 0)
```

### Momentum Divergence

```javascript
// Price-momentum divergence (-1 to +1)
momentum_divergence = (bars_higher_highs - bars_lower_lows) - (bars_higher_lows - bars_lower_highs)

// Volume trend (acceleration)
volume_trend = volume_ratio_last_5 / volume_ratio_last_20
```

### Risk Metrics

```javascript
// Distance to stop loss (normalized by ATR)
risk_ratio = price_distance_from_base / atr_lf

// Reward potential (target distance / stop distance)
reward_risk = (consolidation_range * 2) / price_distance_from_base
```

---

## End of Report

**Next Steps for Phase 4 ML Model Trainer**:

1. **Review this document** and understand feature catalog
2. **Fix critical issues** (normalization, absolute prices) before training
3. **Remove 14 redundant features** identified in Section 2
4. **Implement dataset-wide normalization** bounds computation
5. **Train initial model** on 48 features (62 - 14 redundant)
6. **Compute feature importance** via permutation importance
7. **Reduce to 25-35 features** based on importance + VIF analysis
8. **Re-train final model** and validate accuracy >70%, AUC >0.75

**Questions for ML Model Trainer**:
- Do you need feature interaction terms, or will the NN learn them?
- Should we implement log transform for skewed features (volume, range)?
- Do you prefer MinMax [0,1] or ZScore normalization?
- What batch size for training? (Affects normalization statistics computation)

**Contact**: Feature Analytics Engineer Agent
**Document Date**: November 3, 2025
**Status**: Ready for Phase 4 Model Training
