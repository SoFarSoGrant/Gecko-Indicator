# Feature Analysis Summary for Phase 4 Team

**Quick Reference Guide for ML Model Training**

**Date**: November 3, 2025
**For**: ML Model Trainer Agent
**Full Report**: `/docs/specification/FEATURE-ANALYSIS-PHASE4.md`

---

## TL;DR — Top 3 Things to Know

1. **62 features delivered**, but **14 are redundant** (multicollinear) → Start with **48 features**
2. **Critical normalization issue**: Hardcoded bounds won't work across symbols → Compute from training data
3. **Top 10 expected important features**: HF COMA (trend), consolidation quality (touches, compression, test bar strength)

---

## Top 10 Most Important Features (Expected)

Based on Gecko trading logic and feature engineering analysis:

| Rank | Feature | Category | Why Critical |
|------|---------|----------|--------------|
| 1 | `hf_ema_order_long` | Trend | HF COMA uptrend (primary pattern filter) |
| 2 | `hf_ema_order_short` | Trend | HF COMA downtrend (primary pattern filter) |
| 3 | `touches_to_level` | Consolidation | Base quality (more touches = stronger) |
| 4 | `range_ratio` | Consolidation | Compression (lower = tighter base) |
| 5 | `test_bar_strength` | Consolidation | Test bar close position |
| 6 | `volatility_squeeze` | Consolidation | Base tightness |
| 7 | `test_bar_volume_ratio` | Consolidation | Volume spike confirmation |
| 8 | `distance_to_ema5_hf` | Support | Dynamic support distance |
| 9 | `atr_lf` | Volatility | Pattern size validation |
| 10 | `consolidation_range` | Consolidation | Base size |

**Expected Importance**: These 10 features should account for ~65% of model predictions.

**Red Flag**: If absolute price features (`close`, `ema8_lf`, etc.) appear in Top 10, model is overfitting to symbol-specific prices.

---

## Top 5 Features to Monitor During Training

**Watch These for Potential Issues**

1. **`all_tf_aligned_long` / `all_tf_aligned_short`**
   - **Issue**: Perfect multicollinearity (AND of other COMA features)
   - **VIF**: Infinite
   - **Action**: Remove before training (see Section "Features to Remove")

2. **Absolute price features** (`close`, `open`, `high`, `low`, `ema8_lf`, etc.)
   - **Issue**: Symbol-dependent, won't generalize
   - **Action**: Replace with percentage-based metrics (e.g., `(close - ema21) / close`)

3. **Volume features** (`volume`, `volume_ratio`)
   - **Issue**: Right-skewed distribution (log-normal)
   - **Action**: Apply log transform before normalization

4. **Binary COMA features** (`lf_ema_order_long`, `hf_ema_order_short`, etc.)
   - **Issue**: May have zero variance if dataset is all uptrends or all downtrends
   - **Action**: Check class distribution; use SMOTE if severe imbalance

5. **Test bar features** (`has_test_bar`, `test_bar_strength`)
   - **Issue**: If dataset has very few test bars, features will be mostly 0
   - **Action**: Verify sufficient positive samples (recommend >30% of dataset)

---

## Features to Remove (14 Total)

**Remove BEFORE training to avoid multicollinearity:**

### Perfect Multicollinearity (VIF → ∞)
- `all_tf_aligned_long` — composite of `lf/mf/hf_ema_order_long`
- `all_tf_aligned_short` — composite of `lf/mf/hf_ema_order_short`
- `lf_mf_aligned` — composite of LF/MF COMA features

### Redundant Binary Flags (r > 0.95 with distance features)
- `close_above_ema21_mf` — sign of `distance_to_ema21_mf`
- `close_above_ema5_hf` — sign of `distance_to_ema5_hf`
- `close_above_ema200_mf` — sign of `distance_to_ema200_mf`

### Highly Correlated EMA Features (r > 0.90)
- `ema8_mf`, `ema21_mf`, `ema50_mf`, `ema200_mf` — keep LF versions only
- `ema8_hf`, `ema21_hf` — keep LF versions only

### Price Composites (r > 0.95 with `close`)
- `hl2`, `hlc3` — highly correlated with `close`

**After removal**: 62 features → **48 features**

---

## Critical Issues to Fix BEFORE Training

| Priority | Issue | Impact | Fix | Effort |
|----------|-------|--------|-----|--------|
| CRITICAL | Hardcoded normalization bounds (lines 369-441) | Won't work for different symbols/prices | Compute bounds from training data | 2 hours |
| CRITICAL | Absolute price features (close, ema values) | Model won't generalize across symbols | Replace with percentage-based | 4 hours |
| CRITICAL | Incorrect ZScore implementation (lines 454-463) | Wrong statistics calculation | Implement per-feature stats | 3 hours |
| HIGH | 14 redundant features | Multicollinearity, unstable model | Remove features listed above | 1 hour |
| HIGH | Missing `bars_lower_lows` feature (line 352) | Incomplete momentum features | Add to return statement | 5 min |

**Total Effort**: ~10 hours (1.25 developer days)

**Recommendation**: Fix normalization and remove redundant features before first training run.

---

## Normalization Strategy

### Current Issue

Hardcoded bounds like `close: [0, 50000]` only work for Bitcoin at ~$40k:
- **Bitcoin at $100k**: Normalized to 1.0 (clipped) — all high-price samples collapse
- **Forex EURUSD at $1.05**: Normalized to 0.000021 — all forex samples collapse to ~0

### Correct Approach

**Training Phase**:
```javascript
// 1. Collect all raw features from training data
const allTrainingFeatures = trainingData.map(sample => sample.raw);

// 2. Compute min/max for each feature across ALL training samples
const bounds = {};
for (const featureName of FEATURE_NAMES) {
  const values = allTrainingFeatures.map(f => f[featureName]);
  bounds[featureName] = [Math.min(...values), Math.max(...values)];
}

// 3. Save bounds with model
fs.writeFileSync('./data/models/feature_bounds.json', JSON.stringify(bounds));

// 4. Normalize training data using computed bounds
const normalizedData = trainingData.map(sample =>
  featureEngineer.normalizeFeatures(sample.raw, 'minmax', bounds)
);
```

**Inference Phase**:
```javascript
// 1. Load saved bounds
const bounds = JSON.parse(fs.readFileSync('./data/models/feature_bounds.json'));

// 2. Normalize with training bounds (DO NOT recompute from inference data)
const normalized = featureEngineer.normalizeFeatures(rawFeatures, 'minmax', bounds);
```

### Implementation

**Update `normalizeFeatures()` signature**:
```javascript
normalizeFeatures(features, method = 'minmax', bounds = null) {
  if (method === 'minmax') {
    if (!bounds) {
      throw new Error('MinMax normalization requires bounds parameter');
    }
    // Use provided bounds instead of hardcoded
    for (const [key, value] of Object.entries(features)) {
      const [min, max] = bounds[key];
      normalized[key] = (value - min) / (max - min);
    }
  }
}
```

---

## Model Training Recommendations

### Initial Training (Week 1)

**Objective**: Baseline model with 48 features

1. **Fix normalization** (compute bounds from training data)
2. **Remove 14 redundant features**
3. **Train simple model**:
   - Architecture: Input(48) → Dense(64, relu) → Dropout(0.3) → Dense(64, relu) → Dense(2, softmax)
   - Optimizer: Adam, learning rate 0.001
   - Loss: Categorical crossentropy
   - Batch size: 32
   - Epochs: 50-100 with early stopping
4. **Success Criteria**: Validation accuracy >70%, AUC >0.75

### Feature Importance Analysis (Week 2)

**Objective**: Identify top 20 features for final model

1. **Permutation Importance**:
   - For each feature, shuffle values on validation set
   - Measure accuracy drop
   - Rank by importance
2. **Compute VIF** for remaining features:
   - Remove if VIF > 10
3. **Correlation Matrix**:
   - Identify pairs with r > 0.90
   - Remove lower-importance feature
4. **Target**: Reduce to 25-30 features

### Feature Selection (Week 2-3)

**Objective**: Optimized feature set

1. **Remove features with**:
   - Importance < 1% (no contribution)
   - VIF > 10 (multicollinearity)
   - Correlation > 0.90 with higher-importance feature
   - Zero variance (all same value)
2. **Re-train on reduced set**
3. **Compare**: Accuracy should drop <2% with 50% fewer features

---

## Post-Training Validation Checklist

After training, validate:

**Feature Quality**
- [ ] All features have variance > 0.01
- [ ] No features clipped by MinMax bounds (values = 0 or 1 for >5% of samples)
- [ ] No features with >10% missing values

**Multicollinearity**
- [ ] VIF < 10 for all features
- [ ] No feature pairs with correlation > 0.90

**Feature Importance**
- [ ] Top 10 features account for >60% of model importance
- [ ] COMA features (`hf_ema_order_*`) in Top 10
- [ ] Consolidation features (`touches_to_level`, `range_ratio`) in Top 20
- [ ] Absolute price features NOT in Top 20 (should be replaced)

**Normalization**
- [ ] MinMax bounds cover 99% of training data (no excessive clipping)
- [ ] Normalized features approximately uniform [0, 1] on training set
- [ ] Bounds saved with model for inference

**Model Performance**
- [ ] Validation accuracy ≥ 70%
- [ ] Validation AUC ≥ 0.75
- [ ] Test set accuracy within 5% of validation accuracy (no overfitting)

---

## Expected Feature Importance by Category

Based on Gecko trading logic:

| Category | Features | Expected Importance % | Key Features |
|----------|----------|----------------------|--------------|
| **Trend (COMA)** | 12 | 35-40% | `hf_ema_order_long/short`, `lf_ema_order_long/short` |
| **Consolidation** | 12 | 40-45% | `touches_to_level`, `range_ratio`, `test_bar_strength` |
| **Support/Resistance** | 11 | 10-15% | `distance_to_ema5_hf`, `distance_to_ema21_mf` |
| **Price Action** | 12 | 5-10% | `body_percent`, `range`, `volume_ratio` |
| **EMA (Absolute)** | 15 | <5% | Should be low (symbol-specific) |

**Red Flags**:
- EMA absolute values in Top 10 → Model overfitting to price levels
- Volume features dominating → Check for data leakage
- Flat distribution (all ~1-2%) → Model not learning patterns

---

## Feature Order for TensorFlow.js

**Critical**: Feature vector order must be consistent between training and inference.

**Recommendation**:
1. Define canonical order in config file
2. Save feature names with model
3. Validate order before inference

**Example Implementation**:
```javascript
// src/config/feature-order.js
module.exports.FEATURE_ORDER = [
  // Price features (12)
  'close', 'open', 'high', 'low', 'volume', 'range', 'body',
  'upper_wick', 'lower_wick', 'hl2', 'hlc3', 'body_percent',

  // EMA features (15)
  'ema8_lf', 'ema21_lf', 'ema50_lf', 'ema200_lf',
  'ema8_mf', 'ema21_mf', 'ema50_mf', 'ema200_mf',
  'ema5_hf', 'ema8_hf', 'ema21_hf', 'ema50_hf', 'ema200_hf',
  'atr_lf', 'atr_hf',

  // ... continue for all 62 features
];

// Training
const featureVector = FEATURE_ORDER.map(name => normalizedFeatures[name]);
const inputTensor = tf.tensor2d([featureVector], [1, 62]);
```

---

## Integration with FeatureEngineer Module

**Module Location**: `/src/data/feature-engineer.js`

**Usage**:
```javascript
const { FeatureEngineer } = require('./src/data/feature-engineer.js');

// Initialize
const featureEngineer = new FeatureEngineer(config, logger);

// Extract features
const result = await featureEngineer.engineerFeatures(symbol, pattern, multiTimeframeData);

// Result structure:
{
  raw: { close: 40500, ema8_lf: 40200, ... },          // 62 raw features
  normalized: { close: 0.81, ema8_lf: 0.804, ... },    // 62 normalized [0,1]
  categories: {                                         // Features grouped by type
    priceFeatures: { ... },
    emaFeatures: { ... },
    consolidationFeatures: { ... },
    trendFeatures: { ... },
    supportMomentumFeatures: { ... }
  },
  count: 62,                                            // Feature count
  timestamp: 1698960000000                              // Extraction time
}
```

**Input Format**:
```javascript
// multiTimeframeData structure
{
  lf: {
    candles: [{ time, open, high, low, close, volume, indicators }, ...],
    indicators: { ema_8: 40200, ... }
  },
  mf: { candles: [...], indicators: {...} },
  hf: { candles: [...], indicators: {...} }
}

// pattern structure
{
  consolidation: { basePrice: 40000, range: 300, startBar: 10, endBar: 20 },
  testBar: { formed: true, range: 800, close: 40500, low: 39900, volume: 2000000 },
  momentumMove: { size: 2000, direction: 'UP' }
}
```

---

## Questions for Clarification

Before starting Phase 4 training, please clarify:

1. **Normalization Method**: MinMax [0,1] or ZScore (μ=0, σ=1)?
   - **Recommendation**: MinMax for initial training (works well with ReLU)

2. **Feature Interactions**: Should we add composite features (e.g., `consolidation_quality = touches × compression`)?
   - **Recommendation**: Let NN learn interactions; add composites only if accuracy <70%

3. **Log Transform**: Apply to skewed features (volume, range)?
   - **Recommendation**: Yes, log(volume) will improve normalization

4. **Class Imbalance**: If winners/losers are unbalanced (e.g., 70/30), use sample weighting?
   - **Recommendation**: Yes, use class weights inversely proportional to frequency

5. **Dataset Size**: How many samples collected? (Need >1000 for reliable training)
   - **Minimum**: 1000 samples (6+ months historical)
   - **Recommended**: 5000+ samples (2+ years)

---

## Next Steps

**Week 1** (Phase 4 Start):
1. Fix critical normalization issues (10 hours)
2. Remove 14 redundant features
3. Collect training dataset (6+ months historical)
4. Compute normalization bounds from training data
5. Train baseline model (48 features)

**Week 2**:
6. Feature importance analysis (permutation + VIF + correlation)
7. Reduce to 25-30 features
8. Re-train optimized model
9. Validate accuracy >70%, AUC >0.75

**Week 3**:
10. Final model tuning (hyperparameters, architecture)
11. Test set validation
12. Save model + bounds for Phase 5 backtesting

**Contact**: Feature Analytics Engineer Agent

---

**Full Documentation**: `/docs/specification/FEATURE-ANALYSIS-PHASE4.md` (12,000+ word comprehensive analysis)
