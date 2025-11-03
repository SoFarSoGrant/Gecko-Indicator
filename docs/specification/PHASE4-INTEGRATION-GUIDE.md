# Phase 4 Integration Guide — Feature Engineering to Model Training

**Document Version**: 1.0
**Date**: November 3, 2025
**Purpose**: Bridge Phase 3 (Feature Engineering) and Phase 4 (Model Training)
**Audience**: ML Model Trainer Agent

---

## Quick Start

### Prerequisites Checklist

Before starting Phase 4 model training:

- [ ] **Phase 3 complete**: FeatureEngineer module implemented and tested (62 features, 35 tests passing)
- [ ] **Dataset collected**: 6+ months historical data (recommend 1000+ Gecko patterns)
- [ ] **Feature analysis reviewed**: Read `/docs/specification/FEATURE-ANALYSIS-PHASE4.md`
- [ ] **Critical issues understood**: Normalization bounds, absolute prices, multicollinearity
- [ ] **TensorFlow.js installed**: `npm install @tensorflow/tfjs @tensorflow/tfjs-node`
- [ ] **Development environment**: Node.js v18+, 16GB+ RAM recommended

### 5-Minute Integration Test

Verify FeatureEngineer module is working:

```bash
# Run feature engineering tests
npm test -- tests/feature-engineer.test.js

# Expected output:
# ✓ 35 tests passing
# ✓ 96.89% line coverage
# ✓ Feature count: 62
# ✓ No NaN/Inf values
```

### First Training Run (Week 1, Day 1)

```javascript
// 1. Import modules
const { FeatureEngineer } = require('./src/data/feature-engineer.js');
const tf = require('@tensorflow/tfjs-node');

// 2. Load historical dataset (collected in Phase 2-3)
const dataset = loadHistoricalPatterns('./data/processed/gecko_patterns.json');

// 3. Initialize feature engineer
const featureEngineer = new FeatureEngineer(config, logger);

// 4. Extract features for all patterns
const allFeatures = [];
for (const pattern of dataset) {
  const result = await featureEngineer.engineerFeatures(
    pattern.symbol,
    pattern.pattern,
    pattern.multiTimeframeData
  );
  allFeatures.push(result.raw); // Use raw features, normalize later
}

// 5. Compute normalization bounds from training data
const bounds = computeBoundsFromDataset(allFeatures);

// 6. Normalize all features
const normalizedFeatures = allFeatures.map(features =>
  featureEngineer.normalizeFeatures(features, 'minmax', bounds)
);

// 7. Create TensorFlow tensors
const X = tf.tensor2d(normalizedFeatures.map(f => Object.values(f)));
const y = tf.tensor2d(dataset.map(p => [p.label === 'winner' ? 1 : 0, p.label === 'loser' ? 1 : 0]));

// 8. Build simple model
const model = tf.sequential({
  layers: [
    tf.layers.dense({ inputShape: [62], units: 64, activation: 'relu' }),
    tf.layers.dropout({ rate: 0.3 }),
    tf.layers.dense({ units: 64, activation: 'relu' }),
    tf.layers.dense({ units: 2, activation: 'softmax' })
  ]
});

model.compile({
  optimizer: tf.train.adam(0.001),
  loss: 'categoricalCrossentropy',
  metrics: ['accuracy']
});

// 9. Train model
await model.fit(X, y, {
  epochs: 50,
  batchSize: 32,
  validationSplit: 0.15,
  callbacks: {
    onEpochEnd: (epoch, logs) => {
      console.log(`Epoch ${epoch}: loss=${logs.loss.toFixed(4)}, acc=${logs.acc.toFixed(4)}, val_acc=${logs.val_acc.toFixed(4)}`);
    }
  }
});

// 10. Save model and bounds
await model.save('file://./data/models/gecko_model');
fs.writeFileSync('./data/models/feature_bounds.json', JSON.stringify(bounds));

console.log('Training complete!');
```

---

## Data Flow: Phase 3 → Phase 4

### Phase 3 Output (FeatureEngineer)

```javascript
// engineerFeatures() returns:
{
  raw: {
    close: 40500,
    open: 40000,
    high: 41000,
    low: 39000,
    volume: 1000000,
    range: 2000,
    body: 500,
    // ... 55 more features (62 total)
  },
  normalized: {
    close: 0.81,        // MinMax normalized using hardcoded bounds (⚠️ ISSUE)
    open: 0.80,
    // ... 60 more
  },
  categories: {
    priceFeatures: { close: 40500, open: 40000, ... },
    emaFeatures: { ema8_lf: 40200, ... },
    consolidationFeatures: { touches_to_level: 5, ... },
    trendFeatures: { lf_ema_order_long: 1, ... },
    supportMomentumFeatures: { volume_ratio: 1.2, ... }
  },
  count: 62,
  timestamp: 1698960000000
}
```

### Phase 4 Input (Model Training)

**Critical**: Do NOT use `result.normalized` from FeatureEngineer (hardcoded bounds issue).

**Instead**:
1. Collect all `result.raw` features from training dataset
2. Compute bounds/statistics from training data
3. Normalize using dataset-wide bounds
4. Create TensorFlow tensors

```javascript
// Correct normalization for training:
const allRawFeatures = trainingData.map(sample => sample.raw);

// Compute min/max for each feature across ALL training samples
const bounds = {};
const featureNames = Object.keys(allRawFeatures[0]);

for (const name of featureNames) {
  const values = allRawFeatures.map(f => f[name]);
  bounds[name] = [Math.min(...values), Math.max(...values)];
}

// Now normalize with correct bounds
const normalizedData = allRawFeatures.map(rawFeatures => {
  const normalized = {};
  for (const [name, value] of Object.entries(rawFeatures)) {
    const [min, max] = bounds[name];
    normalized[name] = (value - min) / (max - min);
  }
  return normalized;
});
```

---

## Critical Issues to Fix Before Training

### Issue 1: Normalization Bounds (CRITICAL)

**Problem**: Hardcoded bounds in `normalizeFeatures()` (lines 369-441) won't work across symbols.

**Fix**:
```javascript
// BEFORE (current code):
normalizeFeatures(features, method = 'minmax') {
  const bounds = {
    close: [0, 50000],  // Hardcoded for BTC ~$40k
    // ...
  };
}

// AFTER (correct approach):
normalizeFeatures(features, method = 'minmax', bounds = null) {
  if (method === 'minmax') {
    if (!bounds) {
      throw new Error('MinMax normalization requires bounds parameter');
    }

    const normalized = {};
    for (const [key, value] of Object.entries(features)) {
      const [min, max] = bounds[key];
      const range = max - min;
      normalized[key] = range === 0 ? 0.5 : (value - min) / range;
    }
    return normalized;
  }
  // ... ZScore implementation
}
```

**Action**:
1. Update `normalizeFeatures()` signature to accept `bounds` parameter
2. Implement `computeBoundsFromDataset()` helper function
3. Save bounds with model for inference

**Effort**: 2 hours

### Issue 2: Absolute Price Features (CRITICAL)

**Problem**: Features like `close`, `ema8_lf`, `consolidation_level` use absolute prices (symbol-specific).

**Fix**: Replace with percentage-based or distance metrics:

```javascript
// BEFORE:
{
  close: 40500,
  ema8_lf: 40200,
  consolidation_level: 40000
}

// AFTER:
{
  close_pct_from_ema21: 0.01,           // (close - ema21) / ema21
  close_pct_from_consolidation: 0.0125, // (close - base) / base
  ema8_distance_from_price: -0.0074,    // (ema8 - close) / close
  // Remove absolute prices entirely
}
```

**Action**:
1. Create new percentage-based features
2. Remove absolute price features from feature vector
3. Update tests

**Effort**: 4 hours

### Issue 3: Remove Redundant Features (HIGH)

**Problem**: 14 features are multicollinear (VIF → ∞ or correlation > 0.90).

**Fix**: Comment out or remove from `engineerFeatures()`:

```javascript
// Remove these features (14 total):
// 1. Composite COMA features
// all_tf_aligned_long, all_tf_aligned_short, lf_mf_aligned

// 2. Redundant binary flags
// close_above_ema21_mf, close_above_ema5_hf, close_above_ema200_mf

// 3. Absolute EMA values (MF/HF)
// ema8_mf, ema21_mf, ema50_mf, ema200_mf, ema8_hf, ema21_hf

// 4. Price composites
// hl2, hlc3
```

**Action**: Edit `_extractPriceFeatures()`, `_extractEMAFeatures()`, `_extractTrendFeatures()` to exclude these.

**Effort**: 1 hour

### Issue 4: ZScore Normalization (MEDIUM)

**Problem**: Current ZScore implementation calculates statistics across different features (incorrect).

**Fix**:
```javascript
// BEFORE (incorrect):
normalizeFeatures(features, method = 'zscore') {
  const values = Object.values(features); // Mixes close, volume, ema8 (different scales)
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  // ... calculates single mean/std for all features
}

// AFTER (correct):
normalizeFeatures(features, method = 'zscore', statistics = null) {
  if (!statistics) {
    throw new Error('ZScore normalization requires statistics parameter');
  }

  const normalized = {};
  for (const [key, value] of Object.entries(features)) {
    const { mean, std } = statistics[key];
    normalized[key] = std > 0 ? (value - mean) / std : 0;
  }
  return normalized;
}

// Compute statistics from training data:
function computeStatistics(dataset) {
  const stats = {};
  const featureNames = Object.keys(dataset[0]);

  for (const name of featureNames) {
    const values = dataset.map(d => d[name]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance);

    stats[name] = { mean, std };
  }

  return stats;
}
```

**Action**: Implement correct ZScore with dataset-wide statistics.

**Effort**: 3 hours

---

## Feature Order and Tensor Creation

### Define Canonical Feature Order

Create a config file to ensure consistent feature order between training and inference:

```javascript
// src/config/feature-order.js
module.exports.FEATURE_ORDER = [
  // Price features (12 - 2 removed = 10 after cleanup)
  'close', 'open', 'high', 'low', 'volume',
  'range', 'body', 'upper_wick', 'lower_wick', 'body_percent',
  // Note: hl2, hlc3 removed (redundant)

  // EMA features (15 - 6 removed = 9 after cleanup)
  'ema8_lf', 'ema21_lf', 'ema50_lf', 'ema200_lf',
  'ema5_hf', 'ema50_hf', 'ema200_hf',
  'atr_lf', 'atr_hf',
  // Note: ema8_mf, ema21_mf, ema50_mf, ema200_mf, ema8_hf, ema21_hf removed

  // Consolidation features (12 - 1 removed = 11, +1 missing = 12 after fix)
  'consolidation_level', 'consolidation_range', 'price_distance_from_base',
  'touches_to_level', 'touch_density', 'range_ratio',
  'volatility_squeeze', 'avg_range_last_10',
  'has_test_bar', 'test_bar_strength', 'test_bar_volume_ratio',

  // Trend features (12 - 3 removed = 9 after cleanup)
  'lf_ema_order_long', 'lf_ema_order_short', 'lf_above_200sma',
  'mf_ema_order_long', 'mf_ema_order_short', 'mf_above_200sma',
  'hf_ema_order_long', 'hf_ema_order_short', 'hf_above_200sma',
  // Note: all_tf_aligned_long, all_tf_aligned_short, lf_mf_aligned removed

  // Support/Momentum features (11 - 3 removed = 8 after cleanup)
  'distance_to_ema21_mf', 'distance_to_ema5_hf', 'distance_to_ema200_mf',
  'bars_higher_highs', 'bars_higher_lows', 'bars_lower_highs',
  'volume_ratio', 'return_last_5_bars', 'return_last_10_bars',
  // Note: close_above_ema21_mf, close_above_ema5_hf, close_above_ema200_mf removed
];

// After cleanup: 62 - 14 = 48 features
```

### Convert Features to Tensor

```javascript
const { FEATURE_ORDER } = require('./src/config/feature-order.js');

// Training
function featuresToTensor(featuresArray) {
  // featuresArray is array of normalized feature objects
  const vectors = featuresArray.map(features =>
    FEATURE_ORDER.map(name => features[name])
  );

  return tf.tensor2d(vectors); // Shape: [numSamples, 48]
}

// Usage
const X_train = featuresToTensor(normalizedTrainingFeatures);
const X_val = featuresToTensor(normalizedValidationFeatures);
```

### Label Encoding

```javascript
// Binary classification: winner (1, 0) vs loser (0, 1)
function encodeLabels(labels) {
  return labels.map(label => {
    if (label === 'winner') return [1, 0];
    if (label === 'loser') return [0, 1];
    throw new Error(`Unknown label: ${label}`);
  });
}

const y_train = tf.tensor2d(encodeLabels(trainingLabels));
const y_val = tf.tensor2d(encodeLabels(validationLabels));
```

---

## Model Architecture Recommendations

### Baseline Model (Week 1)

```javascript
const model = tf.sequential({
  layers: [
    tf.layers.dense({
      inputShape: [48],        // 48 features after removing 14 redundant
      units: 64,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }),
    tf.layers.dropout({ rate: 0.3 }),

    tf.layers.dense({
      units: 64,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }),
    tf.layers.dropout({ rate: 0.3 }),

    tf.layers.dense({
      units: 2,              // Binary classification (winner/loser)
      activation: 'softmax'
    })
  ]
});

model.compile({
  optimizer: tf.train.adam(0.001),
  loss: 'categoricalCrossentropy',
  metrics: ['accuracy']
});
```

### Training Configuration

```javascript
const history = await model.fit(X_train, y_train, {
  epochs: 100,
  batchSize: 32,
  validationData: [X_val, y_val],

  callbacks: {
    onEpochEnd: (epoch, logs) => {
      console.log(
        `Epoch ${epoch + 1}: ` +
        `loss=${logs.loss.toFixed(4)}, ` +
        `acc=${logs.acc.toFixed(4)}, ` +
        `val_loss=${logs.val_loss.toFixed(4)}, ` +
        `val_acc=${logs.val_acc.toFixed(4)}`
      );
    },

    // Early stopping
    earlyStopping: tf.callbacks.earlyStopping({
      monitor: 'val_loss',
      patience: 10,
      restoreBestWeights: true
    })
  }
});
```

### Success Criteria (Phase 4 Gate)

After training:
- [ ] Validation accuracy ≥ 70%
- [ ] Validation AUC ≥ 0.75
- [ ] Test accuracy within 5% of validation accuracy (no overfitting)
- [ ] Training converged (loss plateaued)

---

## Feature Importance Analysis (Week 2)

### Permutation Importance

```javascript
async function computePermutationImportance(model, X_val, y_val) {
  // Baseline accuracy
  const baseline = model.evaluate(X_val, y_val);
  const baselineAcc = baseline[1].dataSync()[0];

  const importance = {};

  for (let i = 0; i < FEATURE_ORDER.length; i++) {
    const featureName = FEATURE_ORDER[i];

    // Shuffle feature i
    const X_shuffled = X_val.clone();
    const featureColumn = X_val.slice([0, i], [-1, 1]);
    const shuffledColumn = tf.util.shuffle(featureColumn.dataSync());

    // Replace with shuffled values
    // (TensorFlow.js doesn't have easy column replacement; use arraySync())
    const X_array = X_val.arraySync();
    for (let row = 0; row < X_array.length; row++) {
      X_array[row][i] = shuffledColumn[row];
    }
    const X_shuffled_tensor = tf.tensor2d(X_array);

    // Measure accuracy drop
    const shuffledResult = model.evaluate(X_shuffled_tensor, y_val);
    const shuffledAcc = shuffledResult[1].dataSync()[0];

    const importanceScore = baselineAcc - shuffledAcc;
    importance[featureName] = importanceScore;

    // Cleanup
    X_shuffled_tensor.dispose();
  }

  // Sort by importance
  const sorted = Object.entries(importance)
    .sort((a, b) => b[1] - a[1])
    .map(([name, score]) => ({ feature: name, importance: score }));

  return sorted;
}

// Usage
const importance = await computePermutationImportance(model, X_val, y_val);

console.log('Top 10 Important Features:');
importance.slice(0, 10).forEach(({ feature, importance }, i) => {
  console.log(`  ${i + 1}. ${feature}: ${(importance * 100).toFixed(2)}% accuracy drop`);
});

console.log('\nBottom 10 Features (candidates for removal):');
importance.slice(-10).forEach(({ feature, importance }, i) => {
  console.log(`  ${i + 1}. ${feature}: ${(importance * 100).toFixed(2)}% accuracy drop`);
});
```

### Feature Selection Strategy

After computing importance:

1. **Identify low-value features**: Importance < 1% (accuracy drop < 0.01)
2. **Remove and re-train**: Train model without bottom 10-15 features
3. **Compare accuracy**: If validation accuracy drops <2%, keep reduced set
4. **Target**: 25-30 features for final model

---

## Dataset Requirements

### Minimum Dataset Size

- **Minimum**: 1,000 labeled patterns
- **Recommended**: 5,000+ labeled patterns
- **Optimal**: 10,000+ labeled patterns

### Data Split

```javascript
// 70% train, 15% validation, 15% test
const splitData = (data, trainPct = 0.70, valPct = 0.15) => {
  const shuffled = tf.util.shuffle(data);

  const trainSize = Math.floor(data.length * trainPct);
  const valSize = Math.floor(data.length * valPct);

  return {
    train: shuffled.slice(0, trainSize),
    validation: shuffled.slice(trainSize, trainSize + valSize),
    test: shuffled.slice(trainSize + valSize)
  };
};
```

### Label Distribution

Check class balance:

```javascript
const labelCounts = {
  winner: dataset.filter(d => d.label === 'winner').length,
  loser: dataset.filter(d => d.label === 'loser').length
};

const winRate = labelCounts.winner / dataset.length;

console.log(`Dataset balance: ${(winRate * 100).toFixed(1)}% winners, ${((1 - winRate) * 100).toFixed(1)}% losers`);

// If imbalance > 65/35, use class weights
if (winRate > 0.65 || winRate < 0.35) {
  console.warn('Class imbalance detected. Consider using class weights or SMOTE.');
}
```

---

## Validation and Testing

### Post-Training Validation Script

```javascript
async function validateModel(model, X_test, y_test, bounds) {
  console.log('Model Validation Report');
  console.log('='.repeat(80));

  // 1. Test accuracy
  const testResult = model.evaluate(X_test, y_test);
  const testAcc = testResult[1].dataSync()[0];
  console.log(`Test Accuracy: ${(testAcc * 100).toFixed(2)}%`);

  // 2. Confusion matrix
  const predictions = model.predict(X_test);
  const predLabels = predictions.argMax(-1).dataSync();
  const trueLabels = y_test.argMax(-1).dataSync();

  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (let i = 0; i < predLabels.length; i++) {
    if (predLabels[i] === 1 && trueLabels[i] === 1) tp++;
    if (predLabels[i] === 0 && trueLabels[i] === 0) tn++;
    if (predLabels[i] === 1 && trueLabels[i] === 0) fp++;
    if (predLabels[i] === 0 && trueLabels[i] === 1) fn++;
  }

  console.log('\nConfusion Matrix:');
  console.log(`  True Positives:  ${tp}`);
  console.log(`  True Negatives:  ${tn}`);
  console.log(`  False Positives: ${fp}`);
  console.log(`  False Negatives: ${fn}`);

  const precision = tp / (tp + fp);
  const recall = tp / (tp + fn);
  const f1 = 2 * (precision * recall) / (precision + recall);

  console.log(`\nPrecision: ${(precision * 100).toFixed(2)}%`);
  console.log(`Recall:    ${(recall * 100).toFixed(2)}%`);
  console.log(`F1 Score:  ${(f1 * 100).toFixed(2)}%`);

  // 3. Feature bounds validation
  console.log('\nFeature Normalization Validation:');
  const X_array = X_test.arraySync();
  for (let i = 0; i < FEATURE_ORDER.length; i++) {
    const featureName = FEATURE_ORDER[i];
    const values = X_array.map(row => row[i]);

    const min = Math.min(...values);
    const max = Math.max(...values);
    const clipped = values.filter(v => v === 0 || v === 1).length;
    const clippedPct = (clipped / values.length) * 100;

    if (clippedPct > 5) {
      console.warn(`  ${featureName}: ${clippedPct.toFixed(1)}% clipped (bounds may be incorrect)`);
    }
  }

  console.log('='.repeat(80));
}
```

---

## Saving and Loading Models

### Save Model with Metadata

```javascript
// Save model
await model.save('file://./data/models/gecko_model');

// Save normalization bounds
const metadata = {
  bounds,
  featureOrder: FEATURE_ORDER,
  featureCount: FEATURE_ORDER.length,
  normalizationMethod: 'minmax',
  trainedDate: new Date().toISOString(),
  trainingAccuracy: finalTrainAcc,
  validationAccuracy: finalValAcc,
  testAccuracy: testAcc
};

fs.writeFileSync(
  './data/models/model_metadata.json',
  JSON.stringify(metadata, null, 2)
);

console.log('Model and metadata saved successfully.');
```

### Load Model for Inference

```javascript
// Load model
const model = await tf.loadLayersModel('file://./data/models/gecko_model/model.json');

// Load metadata
const metadata = JSON.parse(
  fs.readFileSync('./data/models/model_metadata.json', 'utf8')
);

const { bounds, featureOrder } = metadata;

// Extract and normalize features
const rawFeatures = await featureEngineer.engineerFeatures(symbol, pattern, data);
const normalizedFeatures = featureEngineer.normalizeFeatures(rawFeatures.raw, 'minmax', bounds);

// Create tensor (ensure feature order matches)
const featureVector = featureOrder.map(name => normalizedFeatures[name]);
const inputTensor = tf.tensor2d([featureVector], [1, featureOrder.length]);

// Predict
const prediction = model.predict(inputTensor);
const [winnerProb, loserProb] = prediction.dataSync();

console.log(`Prediction: Winner ${(winnerProb * 100).toFixed(1)}%, Loser ${(loserProb * 100).toFixed(1)}%`);
```

---

## Troubleshooting Common Issues

### Issue: Validation accuracy stuck at 50%

**Cause**: Model not learning (random guessing).

**Debug**:
1. Check label distribution (should be ~50/50 or use class weights)
2. Verify features are normalized correctly (check min/max)
3. Inspect feature variance (zero-variance features can't help)
4. Reduce model complexity (try 1 hidden layer × 32 units)
5. Increase learning rate (try 0.01 instead of 0.001)

### Issue: Training accuracy 95%, validation accuracy 60%

**Cause**: Overfitting.

**Fix**:
1. Increase dropout rate (try 0.5 instead of 0.3)
2. Add L2 regularization (try l2: 0.1)
3. Reduce model size (fewer units or layers)
4. Collect more training data
5. Use early stopping (monitor val_loss, patience=5)

### Issue: NaN loss during training

**Cause**: Exploding gradients or bad normalization.

**Fix**:
1. Check for NaN/Inf in features (run validation script)
2. Reduce learning rate (try 0.0001)
3. Use gradient clipping: `optimizer: tf.train.adam(0.001, {clipValue: 1.0})`
4. Verify normalization bounds are correct

### Issue: Model predicts all samples as same class

**Cause**: Severe class imbalance or bad initialization.

**Fix**:
1. Check label distribution (should be 30/70 to 70/30 range)
2. Use class weights:
   ```javascript
   model.fit(X, y, {
     classWeight: { 0: winnerWeight, 1: loserWeight }
   });
   ```
3. Try different random seed for weight initialization
4. Increase model capacity (more units/layers)

---

## Next Steps Checklist

**Week 1** (Phase 4 Start):
- [ ] Fix normalization bounds (compute from training data)
- [ ] Remove 14 redundant features
- [ ] Create feature order config file
- [ ] Implement bounds computation function
- [ ] Update FeatureEngineer.normalizeFeatures() to accept bounds parameter
- [ ] Collect training dataset (6+ months historical, 1000+ patterns)
- [ ] Implement data split (70/15/15)
- [ ] Build baseline model (2 × 64 units)
- [ ] Train for 50-100 epochs with early stopping
- [ ] Validate: accuracy ≥70%, AUC ≥0.75

**Week 2** (Feature Importance):
- [ ] Implement permutation importance function
- [ ] Compute importance for all 48 features
- [ ] Rank features by importance
- [ ] Identify bottom 15-20 features for removal
- [ ] Compute VIF using validation script
- [ ] Generate correlation matrix
- [ ] Select final 25-30 features

**Week 3** (Final Model):
- [ ] Re-train model on reduced feature set
- [ ] Hyperparameter tuning (learning rate, dropout, units)
- [ ] Test set validation
- [ ] Generate validation report
- [ ] Save model + metadata
- [ ] Document feature importance findings
- [ ] Prepare for Phase 5 (backtesting)

---

## Contact and Support

**Questions**: Contact Feature Analytics Engineer Agent

**Documentation**:
- Full feature analysis: `/docs/specification/FEATURE-ANALYSIS-PHASE4.md`
- Quick summary: `/docs/specification/FEATURE-ANALYSIS-SUMMARY.md`
- Validation script: `/scripts/validate-features.js`

**Code Modules**:
- FeatureEngineer: `/src/data/feature-engineer.js`
- Tests: `/tests/feature-engineer.test.js`

**Good luck with Phase 4 training!**
