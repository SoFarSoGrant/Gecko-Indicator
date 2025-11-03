# Gecko ML Indicator: Machine Learning Implementation Guide

This document details the implementation of a Machine Learning-based indicator for the Gecko trading system using TradingView-API and technical analysis pattern recognition. Based on official requirements specification and trading system guidelines.

## Table of Contents

1. [System Overview & Purpose](#system-overview--purpose)
2. [Multi-Timeframe Structure](#multi-timeframe-structure)
3. [Trend Detection (High Frame)](#trend-detection-high-frame)
4. [Gecko Pattern Detection (Low Frame)](#gecko-pattern-detection-low-frame)
5. [Higher-Timeframe Support Validation](#higher-timeframe-support-validation)
6. [Entry, Stop, and Target Rules](#entry-stop-and-target-rules)
7. [Pattern Filters & Validation](#pattern-filters--validation)
8. [Alerts & Labels](#alerts--labels)
9. [ML Architecture for Gecko](#ml-architecture-for-gecko)
10. [Feature Engineering](#feature-engineering)
11. [Model Training Pipeline](#model-training-pipeline)
12. [Real-Time Prediction](#real-time-prediction)
13. [Backtesting Framework](#backtesting-framework)
14. [Implementation Details](#implementation-details)
15. [Input Parameters & Configuration](#input-parameters--configuration)
16. [Output Data & Performance](#output-data--performance)

---

## System Overview & Purpose

### Purpose

The Gecko Indicator is a multi-timeframe trading system designed to **automatically detect and visually highlight Gecko setups** — consolidation and breakout-hook patterns that form within a strong higher-timeframe trend.

### Core Concept

When a strong EMA trend is present on the **High Frame (HF)**, the indicator seeks consolidation and breakout-hook formations (the **Gecko**) two timeframes lower on the **Low Frame (LF)** with dynamic support validation from the **Mid Frame (MF)**.

### What is Gecko?

Gecko is a multi-stage price action pattern that represents:

1. **A Momentum Move (MM):** Strong impulsive leg (≥1.5×ATR) matching HF trend
2. **A Consolidation:** 20-100 bars of sideways movement (horizontal base with ~3 swing touches)
3. **A Test Bar (TB):** Single large bar (>1.5×ATR) closing beyond base
4. **A Hook (FTB):** Failed breakout when price breaks back through TB's high/low
5. **Re-entry Opportunity:** Price re-breaks consolidation base in direction of HF trend

### Moving Averages Used (Correct Order of Moving Averages - COMA)

- **8 EMA (Black)** - Very short-term trend
- **21 EMA (Blue)** - Medium-term trend and primary support/resistance
- **50 EMA (Red)** - Intermediate trend
- **200 SMA (Green)** - Long-term trend
- **5 EMA (Grey)** - Only on High Frame (HF) for support validation

### Timeframe Structure (Dynamic)

**Example Setup (LF=5m):**
- **Low Frame (LF):** 5-minute chart (entry timeframe, pattern detection)
- **Middle Frame (MF):** 15-minute chart (dynamic support validation)
- **High Frame (HF):** 60-minute chart (trend context and validation)

**Available Frame Sets:** 1m → 5m → 15m → 60m → 240m → 1D → 1W → 1M

**Selection Logic:** User selects LF; MF and HF are automatically derived (e.g., LF=5m → MF=15m → HF=60m)

---

## Multi-Timeframe Structure

### Dynamic Frame Selection

The indicator operates on a **three-level timeframe hierarchy** where all timeframes are automatically derived from a single user input:

| Low Frame | Middle Frame | High Frame |
|-----------|--------------|------------|
| 1m        | 5m           | 15m        |
| 5m        | 15m          | 60m        |
| 15m       | 60m          | 240m       |
| 60m       | 240m         | 1D         |
| 240m      | 1D           | 1W         |
| 1D        | 1W           | 1M         |

**User Input:** Low Frame (LF) selection
**Automatic Derivation:** MF and HF are calculated based on the next two timeframes in the hierarchy

### Purpose of Each Timeframe

1. **High Frame (HF):** Establishes overall market context and trend direction
   - Used for trend validation (≥30 bars in COMA)
   - Provides 5 EMA support level

2. **Middle Frame (MF):** Bridges HF and LF, provides dynamic support
   - Confirms 21 EMA touch within consolidation
   - Validates pattern structure

3. **Low Frame (LF):** Entry timeframe where Gecko pattern unfolds
   - Detects consolidation and breakout-hook formations
   - Generates entry, stop, and target signals

---

## Trend Detection (High Frame)

### Objective

Identify a **strong directional trend** that has persisted for ≥30 bars with proper EMA alignment (COMA: Correct Order of Moving Averages).

### Trend Validation Conditions

**1. Minimum Trend Duration**
- Price must trend consistently in one direction for ≥30 bars
- Tracks bars in which COMA is maintained

**2. EMA Alignment (COMA)**

**Uptrend:** 8 EMA > 21 EMA > 50 EMA
```
EMA(8) is above EMA(21) which is above EMA(50)
All three EMAs sloping upward is ideal, but not required
```

**Downtrend:** 8 EMA < 21 EMA < 50 EMA
```
EMA(8) is below EMA(21) which is below EMA(50)
All three EMAs sloping downward is ideal, but not required
```

**3. Optional Displays**
- **Trend Label:** Display on chart once trend qualifies (e.g., "UPTREND" with bar count)
- **Trend Age Counter:** Show number of consecutive bars in COMA alignment

### HF Trend Detection Algorithm

```javascript
const COMA_BARS_REQUIRED = 30;

function detectHFTrend(hfPeriods, emaLengths = [8, 21, 50]) {
  const ema8 = calculateEMA(hfPeriods, 8);
  const ema21 = calculateEMA(hfPeriods, 21);
  const ema50 = calculateEMA(hfPeriods, 50);

  const currentBar = 0;
  let comaCount = 0;
  let trendDirection = null;  // 'UP' or 'DOWN'

  // Count consecutive bars with COMA
  for (let i = 0; i < hfPeriods.length; i++) {
    const isUptrendCOMA = (ema8[i] > ema21[i]) && (ema21[i] > ema50[i]);
    const isDowntrendCOMA = (ema8[i] < ema21[i]) && (ema21[i] < ema50[i]);

    if (isUptrendCOMA) {
      comaCount++;
      trendDirection = 'UP';
    } else if (isDowntrendCOMA) {
      comaCount++;
      trendDirection = 'DOWN';
    } else {
      comaCount = 0;  // Reset if COMA broken
      trendDirection = null;
    }
  }

  const trendConfirmed = comaCount >= COMA_BARS_REQUIRED;

  return {
    confirmed: trendConfirmed,
    direction: trendDirection,
    barsInCOMA: comaCount,
    ema8: ema8[0],
    ema21: ema21[0],
    ema50: ema50[0]
  };
}
```

---

## Gecko Pattern Detection (Low Frame)

### Multi-Stage Pattern Definition

The complete Gecko pattern consists of four distinct stages:

#### **Stage 1: Momentum Move (MM)**

**Definition:** Strong impulsive leg establishing the initial trend
- **Minimum Size:** ≥1.5×ATR(14)
- **Direction:** Must match HF trend direction
- **Duration:** 5-15 bars (typical)
- **Indicator:** Increasing candle sizes, consecutive closes in trend direction

#### **Stage 2: Consolidation**

**Definition:** Pause/compression after MM where price stabilizes
- **Duration:** 20-100 bars of sideways movement
- **Structure:** Horizontal base with approximately 3 swing touches
- **Touches:** Price repeatedly tests the consolidation level within ±3 pips
- **Compression:** Decreasing volatility as consolidation develops
- **Key Metric:** Good compression indicates pressure building for breakout

#### **Stage 3: Test Bar (TB)**

**Definition:** First strong move attempting to break consolidation
- **Size:** >1.5×ATR(14)
- **Closes:** Beyond consolidation base (upside for long, downside for short)
- **Ideally:** Includes rejection wick on far side (pin bar characteristic)
- **Volume:** Often elevated, showing conviction move

#### **Stage 4: Hook / Failed Test Bar (FTB)**

**Definition:** Price breaks back through TB's high/low (failed breakout)
- **Trigger:** Price crosses back through TB's opposite extreme
- **Setup:** Creates the "hook" or failed breakout pattern
- **Opportunity:** This rejection sets up re-entry signal

#### **Stage 5: Re-Entry (Entry Signal)**

**Definition:** Price re-breaks consolidation base in direction of HF trend
- **Entry Trigger:** Price closes beyond consolidation with 0.2×ATR confirmation
- **Direction:** Must align with HF trend
- **Confirmation:** LF candle closes clearly beyond base, not just touches

### Pattern Detection Validation

```javascript
const CONSOLIDATION_MIN_BARS = 20;
const CONSOLIDATION_MAX_BARS = 100;
const CONSOLIDATION_TOUCHES = 3;
const ATR_LENGTH = 14;

function detectGeckoPattern(lfPeriods, mfPeriods, hfTrendConfirmed) {
  if (!hfTrendConfirmed) {
    return null;  // Cannot start pattern detection without HF trend
  }

  const atr = calculateATR(lfPeriods, ATR_LENGTH);
  const currentBar = lfPeriods[0];
  const currentATR = atr[0];

  // Stage 1: Detect Momentum Move
  const mmStats = detectMomentumMove(lfPeriods, currentATR);
  if (!mmStats.detected || mmStats.size < 1.5 * currentATR) {
    return null;  // Invalid MM
  }

  // Stage 2: Detect Consolidation
  const consolidation = detectConsolidation(
    lfPeriods,
    mmStats.endIndex,
    CONSOLIDATION_MIN_BARS,
    CONSOLIDATION_MAX_BARS,
    CONSOLIDATION_TOUCHES
  );
  if (!consolidation.detected) {
    return null;  // No valid consolidation
  }

  // Stage 3: Detect Test Bar
  const testBar = detectTestBar(lfPeriods, consolidation, currentATR);
  if (!testBar.detected) {
    return null;  // No valid test bar
  }

  // Stage 4: Detect Hook/FTB
  const hook = detectHook(lfPeriods, testBar);

  return {
    type: 'GECKO',
    momentumMove: mmStats,
    consolidation: consolidation,
    testBar: testBar,
    hook: hook,
    quality: calculatePatternQuality(mmStats, consolidation, testBar),
    readyForEntry: hook.detected  // Ready when hook has formed
  };
}
```

---

## Higher-Timeframe Support Validation

### Critical Validation Rules

The Gecko pattern is **only valid** if it has proper support from higher timeframes:

#### **Middle Frame (MF) Validation**

**Requirement:** 21 EMA touch
- Price must touch or stay near the 21 EMA on the MF
- Typical tolerance: within 10-20 pips of the 21 EMA
- **Failure Condition:** If price is far below/above 21 EMA MF, setup is invalidated

```javascript
function validateMFSupport(lfClose, mfEMA21, priceSymbol) {
  const tolerance = getATR(mfPeriods) * 0.5;  // ~0.5 ATR tolerance
  const distanceToEMA = Math.abs(lfClose - mfEMA21);

  return {
    hasSupport: distanceToEMA <= tolerance,
    distance: distanceToEMA,
    tolerance: tolerance,
    status: distanceToEMA <= tolerance ? 'VALID' : 'INVALID'
  };
}
```

#### **High Frame (HF) Validation**

**Requirement:** 5 EMA touch during consolidation
- Consolidation must form near or with support from 5 EMA on HF
- Indicates alignment with higher timeframe trend
- **Failure Condition:** Consolidation too far from 5 EMA HF invalidates setup

```javascript
function validateHFSupport(consolidationLevel, hfEMA5, priceSymbol) {
  const tolerance = getATR(hfPeriods) * 0.5;  // ~0.5 ATR tolerance
  const distanceToEMA = Math.abs(consolidationLevel - hfEMA5);

  return {
    hasSupport: distanceToEMA <= tolerance,
    distance: distanceToEMA,
    tolerance: tolerance,
    status: distanceToEMA <= tolerance ? 'VALID' : 'INVALID'
  };
}
```

### Pattern Invalidation Rules

❌ **Setup is INVALID if:**
1. MF 21 EMA not near consolidation level
2. HF 5 EMA does not support consolidation
3. No confluence between LF pattern and MF/HF EMAs
4. Pattern forms too far from higher timeframe support levels

---

## Entry, Stop, and Target Rules

### Entry Conditions

**Trigger:** Re-break of consolidation base in direction of HF trend

```javascript
const ENTRY_BUFFER = 0.2;  // 0.2 × ATR

function generateEntrySignal(lfPeriods, consolidationBase, hfTrendDirection, atr) {
  const currentBar = lfPeriods[0];
  const entryBuffer = ENTRY_BUFFER * atr[0];

  if (hfTrendDirection === 'UP') {
    // Long entry: Price closes above base + buffer
    const longEntry = consolidationBase + entryBuffer;
    const isLongSetup = currentBar.close > longEntry;

    return isLongSetup ? {
      signal: 'LONG',
      entryPrice: longEntry,
      confirmed: currentBar.close > longEntry
    } : null;
  } else {
    // Short entry: Price closes below base - buffer
    const shortEntry = consolidationBase - entryBuffer;
    const isShortSetup = currentBar.close < shortEntry;

    return isShortSetup ? {
      signal: 'SHORT',
      entryPrice: shortEntry,
      confirmed: currentBar.close < shortEntry
    } : null;
  }
}
```

### Stop Loss Placement

**Rule:** 1 tick below/above FTB swing

```javascript
function calculateStopLoss(testBar, hookBar, hfTrendDirection) {
  if (hfTrendDirection === 'UP') {
    // Long stop: 1 tick below the lowest low of hook/test bar
    const stopPrice = Math.min(testBar.low, hookBar.low) - 1 * POINT_VALUE;
    return {
      level: stopPrice,
      pips: (entryPrice - stopPrice) / POINT_VALUE,
      type: 'LONG_STOP'
    };
  } else {
    // Short stop: 1 tick above the highest high of hook/test bar
    const stopPrice = Math.max(testBar.high, hookBar.high) + 1 * POINT_VALUE;
    return {
      level: stopPrice,
      pips: (stopPrice - entryPrice) / POINT_VALUE,
      type: 'SHORT_STOP'
    };
  }
}
```

### Target Calculation

**Rule:** 100% extension of prior Momentum Move

```javascript
function calculateTargets(momentumMove, entryPrice, hfTrendDirection) {
  const mmSize = momentumMove.size;
  const mmDirection = momentumMove.direction;

  if (hfTrendDirection === 'UP') {
    // Long target: Entry + 100% of MM
    const target = entryPrice + mmSize;
    return {
      target: target,
      extension: mmSize,
      rrRatio: mmSize / (entryPrice - stopLoss),
      type: 'LONG_TARGET'
    };
  } else {
    // Short target: Entry - 100% of MM
    const target = entryPrice - mmSize;
    return {
      target: target,
      extension: mmSize,
      rrRatio: mmSize / (stopLoss - entryPrice),
      type: 'SHORT_TARGET'
    };
  }
}
```

### Risk-Reward Ratio Validation

**Minimum Requirement:** RR ≥ 2:1

```javascript
function validateRiskReward(entryPrice, stopLoss, target) {
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(target - entryPrice);
  const rrRatio = reward / risk;

  return {
    risk: risk,
    reward: reward,
    ratio: rrRatio,
    isValid: rrRatio >= 2.0,
    quality: rrRatio > 3.0 ? 'EXCELLENT' :
             rrRatio >= 2.5 ? 'GOOD' :
             rrRatio >= 2.0 ? 'ACCEPTABLE' : 'POOR'
  };
}
```

---

## Pattern Filters & Validation

### Additional Pattern Quality Filters

#### **1. Stop-Run Levels (SRLs)**

**Requirement:** At least one Stop-Run Level within or just beyond the pattern

- Stop-Run Levels are price levels where traders' stops were clustered
- Pattern is stronger if it has 1+ SRLs within reach after entry
- Indicates liquidity clusters that price can run through

```javascript
function validateStopRunLevels(consolidationRange, entryPrice, target) {
  const patternsRangeSize = consolidationRange;
  const targetDistance = Math.abs(target - entryPrice);

  // SRLs should exist between entry and target
  const hasStopRuns = identifyStopRunLevels(entryPrice, target);

  return {
    count: hasStopRuns.length,
    isValid: hasStopRuns.length >= 1,
    levels: hasStopRuns,
    quality: hasStopRuns.length >= 2 ? 'STRONG' : 'ACCEPTABLE'
  };
}
```

#### **2. Minimum ATR Threshold (Optional)**

- Reject patterns on very low volatility days
- Typical: ATR < 0.3 × 20-period average ATR is suspect

```javascript
function validateATRThreshold(currentATR, avgATR20) {
  const threshold = 0.3;
  const ratio = currentATR / avgATR20;

  return {
    ratio: ratio,
    isValid: ratio >= threshold,
    status: ratio >= threshold ? 'GOOD_VOLATILITY' : 'LOW_VOLATILITY_REJECT'
  };
}
```

#### **3. Swing High/Low Proximity (Optional)**

- Reject patterns forming too near major swing points
- Indicates potential reversal risk rather than continuation
- Typical: Pattern should be 2-3× ATR away from recent major swing

```javascript
function validateSwingProximity(patternLevel, majorSwingLevel, atr) {
  const minDistance = 3 * atr;
  const distance = Math.abs(patternLevel - majorSwingLevel);

  return {
    distance: distance,
    minDistance: minDistance,
    isValid: distance >= minDistance,
    status: distance >= minDistance ? 'SAFE' : 'NEAR_SWING_REJECT'
  };
}
```

---

## Alerts & Labels

### Alert System

The indicator should generate **5 key alerts** as pattern develops:

#### **Alert 1: HF Trend Confirmed**
```
"[SYMBOL] HF TREND CONFIRMED - UPTREND for 30+ bars"
or
"[SYMBOL] HF TREND CONFIRMED - DOWNTREND for 30+ bars"
```
Trigger: When HF reaches 30 bars of COMA alignment

#### **Alert 2: Potential Gecko Consolidation**
```
"[SYMBOL] POTENTIAL GECKO - Consolidation forming (12 bars)"
```
Trigger: When consolidation detection starts, updates with bar count

#### **Alert 3: Test Bar Formed**
```
"[SYMBOL] TEST BAR - 1.8x ATR move closing beyond base"
```
Trigger: When TB is detected and closes beyond consolidation

#### **Alert 4: Hook Triggered**
```
"[SYMBOL] HOOK FORMED - Failed breakout, re-entry possible"
```
Trigger: When price breaks back through TB's extreme (the hook)

#### **Alert 5: Entry Confirmed**
```
"[SYMBOL] ENTRY CONFIRMED - LONG @ 1.2450, SL @ 1.2410, TGT @ 1.2530 (RR 2.5:1)"
```
Trigger: When price re-breaks consolidation base with confirmation

### Chart Labels & Annotations

**Visual Elements to Display:**

1. **Trend Label (HF)**
   - Text: "UPTREND (45 bars)" positioned at top left
   - Green for uptrend, red for downtrend

2. **Consolidation Box**
   - Rectangle highlighting consolidation range
   - Light blue fill, semi-transparent
   - Annotate: "CONS (35 bars, 3 touches)"

3. **Test Bar Marker**
   - Arrow pointing to TB
   - Annotation: "TB: 1.8x ATR"

4. **Hook Annotation**
   - Arc or line showing failed breakout
   - Annotation: "HOOK"

5. **Entry Level Line**
   - Horizontal dashed line at entry price
   - Annotation: "ENTRY 1.2450"

6. **Stop & Target Lines**
   - Horizontal line for stop: Red color
   - Horizontal line for target: Green color
   - Annotations with prices and RR ratio

---

## Gecko Pattern Recognition

### Pattern Types from Screenshots

#### Gecko1: Simple Consolidation with FTB
- **Setup:** Clear support from Higher timeframe EMAs (21/MF and 5/HF)
- **Development:** Follow-through making new highs; pullback to EMA21 MF
- **Entry:** Long from 15-minute when consolidation breaks
- **Key Feature:** Strong EMA alignment across timeframes

#### Gecko2: Strong FTB with Good Compression
- **Setup:** Getting long with low-risk idea to trade the 240min chart
- **Development:** Trend continuation with Higher Highs and Higher Lows
- **Entry:** Long on breakout with multiple timeframe confirmation
- **Key Feature:** Good compression at consolidation end

#### Gecko3: Many Touches with Stop-Run Levels
- **Setup:** Well established higher timeframe trends with test of HT EMAs
- **Development:** Stop-run move taking out all stops of the pattern
- **Entry:** Long when pattern is confirmed
- **Key Feature:** Multiple stop-run levels ahead (SRLs)

#### Gecko4: Pattern WITHOUT Test Bar
- **Setup:** HF in good established EMA-trend but NO Test Bar that closes beyond price activity
- **Development:** Price not strong enough to run for stops - NO TRADE
- **Key Feature:** Demonstrates trade rejection - price lacks follow-through strength
- **Rule:** Must have test bar closing beyond consolidation prices

#### Gecko5: Multi-Bar Breakout
- **Setup:** While MF & HF in trending mode, 240min with HT stop-run level
- **Development:** Stop-run above pattern, HT trend, HT stop-run level
- **Entry:** Long on 5-minute with confluence of multiple timeframes
- **Key Feature:** Lower timeframe entry with higher timeframe objectives

#### Gecko6: Short Side - Strong Test Bar Failure
- **Setup:** MF in strong trend mode after break out of sideways in HF (240min)
- **Development:** Low-risk entry into the start of a promising HT down-trend
- **Entry:** Short when test bar fails
- **Key Feature:** Mirror of long-side logic - test bar rejection in downtrend

#### Gecko7: Short Pattern - Strong MM (Market Makers)
- **Setup:** HF in EMA-Trend about to accelerate the down-trend
- **Development:** Losses are part of the system / stop-out
- **Entry:** Short based on strong MM structure
- **Key Feature:** Shows even well-structured setups can result in losses

#### Gecko8: Test Bar Hook + Re-break
- **Setup:** Clear touch of HT support being 21 (MF) and 5 (HF)
- **Development:** Stop well protected, then stop-run and 20% stop-trail for BE
- **Entry:** Long on stacked-up TB with clear support
- **Key Feature:** Large bar gift after entry provides favorable risk/reward

#### Gecko9: Very Good Slim Pattern
- **Setup:** But: HF trend rules (here: EMA-trend) NOT fulfilled, ie no trade
- **Development:** Price not strong enough to initiate a trend resumption
- **Entry:** REJECTED - HF trend requirement not met
- **Key Feature:** Validates rule enforcement - even good LF patterns rejected without HF confirmation

#### Gecko10: Re-entry Pattern
- **Setup:** Good trending charts in all timeframes; edges in favor for R-winner
- **Development:** Strong follow through providing a big R winner
- **Entry:** Long on re-entry with confirmed trends
- **Key Feature:** Best setups have aligned trends across all timeframes

### Validation Rules for Gecko Patterns

**MUST HAVE:**
1. ✅ Consolidation with multiple precise touches to a level
2. ✅ Support/resistance from at least 21 EMA (MF) and 5 EMA (HF)
3. ✅ Good compression (volatility reducing into breakout)
4. ✅ Test Bar (TB) that closes beyond consolidation prices (for long breakout above)
5. ✅ Follow-through strength after breakout (price must "run for the stops")
6. ✅ Aligned Higher Timeframe trend support

**MUST NOT HAVE:**
1. ❌ Ambiguous consolidation boundaries
2. ❌ Lack of HF trend support/alignment
3. ❌ Test bar that fails to close beyond consolidation prices
4. ❌ Insufficient compression/volatility build
5. ❌ No follow-through after initial breakout
6. ❌ Price too weak to reach higher timeframe stop-run levels

---

## ML Architecture for Gecko

### ML Model Purpose

The ML model should learn to:
1. **Identify valid Gecko patterns** from candlestick data and indicators
2. **Predict pattern outcome** (winner vs. loser)
3. **Filter trades** based on timeframe alignment
4. **Quantify setup quality** with confidence scores

### Classification Approach

**Primary Model:** Binary Classification
- **Input:** Features extracted from chart (price, EMAs, pattern metrics)
- **Output:** Probability that a Gecko pattern will be a winner (probability > 0.5 = BUY signal)

### Feature Engineering for Gecko

#### Price Action Features
```javascript
const priceFeatures = {
  // Current period OHLCV
  close: candle.close,
  open: candle.open,
  high: candle.high,
  low: candle.low,
  volume: candle.volume,

  // Range metrics
  range: high - low,                    // Total range of candle
  body: Math.abs(close - open),         // Real body size
  upper_wick: high - Math.max(open, close),
  lower_wick: Math.min(open, close) - low,

  // Composite metrics
  hl2: (high + low) / 2,               // Midpoint
  hlc3: (high + low + close) / 3,      // Average price
  body_percent: (body / range) * 100,  // Body as % of range
};
```

#### EMA Features (Critical for Gecko)
```javascript
const emaFeatures = {
  // 5-minute chart (Low Frame)
  ema8_lf: study_ema8_lf.periods[0].value,
  ema21_lf: study_ema21_lf.periods[0].value,
  ema50_lf: study_ema50_lf.periods[0].value,
  ema200_lf: study_ema200_lf.periods[0].value,

  // 60-minute chart (Middle Frame)
  ema8_mf: study_ema8_mf.periods[0].value,
  ema21_mf: study_ema21_mf.periods[0].value,
  ema50_mf: study_ema50_mf.periods[0].value,
  ema200_mf: study_ema200_mf.periods[0].value,

  // 240-minute chart (High Frame)
  ema5_hf: study_ema5_hf.periods[0].value,
  ema8_hf: study_ema8_hf.periods[0].value,
  ema21_hf: study_ema21_hf.periods[0].value,
  ema50_hf: study_ema50_hf.periods[0].value,
  ema200_hf: study_ema200_hf.periods[0].value,
};
```

#### Consolidation Pattern Features
```javascript
const consolidationFeatures = {
  // Touch detection
  touches_to_level: countTouchesInRange(periods, level, tolerance),
  highest_touch_bar: barIndexOfHighestTouch,
  lowest_touch_bar: barIndexOfLowestTouch,

  // Compression metrics
  avg_range_last_10_bars: avgRange(periods.slice(0, 10)),
  range_ratio: current_range / average_range,  // < 1 = compression
  volatility_squeeze: stdDev(periods.slice(0, 10)),

  // Level metrics
  consolidation_level: lastTouchPrice,
  consolidation_range: high_of_consolidation - low_of_consolidation,
  price_distance_from_level: Math.abs(close - consolidation_level),

  // Test bar analysis
  has_test_bar: testBarCloseBeyondLevel,
  test_bar_strength: (testBar.close - testBar.low) / testBar.range,
  test_bar_volume_ratio: testBar.volume / avgVolume,
};
```

#### Trend Alignment Features
```javascript
const trendFeatures = {
  // Lower Frame trend
  lf_ema_order_long: ema8_lf > ema21_lf > ema50_lf > ema200_lf ? 1 : 0,
  lf_ema_order_short: ema8_lf < ema21_lf < ema50_lf < ema200_lf ? 1 : 0,
  lf_above_200sma: close > ema200_lf ? 1 : 0,

  // Middle Frame trend
  mf_ema_order_long: ema8_mf > ema21_mf > ema50_mf > ema200_mf ? 1 : 0,
  mf_ema_order_short: ema8_mf < ema21_mf < ema50_mf < ema200_mf ? 1 : 0,
  mf_above_200sma: close > ema200_mf ? 1 : 0,

  // High Frame trend
  hf_ema_order_long: ema5_hf > ema8_hf > ema21_hf > ema50_hf > ema200_hf ? 1 : 0,
  hf_ema_order_short: ema5_hf < ema8_hf < ema21_hf < ema50_hf < ema200_hf ? 1 : 0,
  hf_above_200sma: close > ema200_hf ? 1 : 0,

  // Multi-timeframe alignment (CRITICAL)
  all_tf_aligned_long: (lf_long && mf_long && hf_long) ? 1 : 0,
  all_tf_aligned_short: (lf_short && mf_short && hf_short) ? 1 : 0,
};
```

#### Support/Resistance Distance Features
```javascript
const supportResistanceFeatures = {
  // Distance from key EMAs (normalized by price)
  distance_to_ema21_mf: (close - ema21_mf) / close,
  distance_to_ema5_hf: (close - ema5_hf) / close,
  distance_to_ema200_mf: (close - ema200_mf) / close,

  // Below/above relationships
  close_above_ema21_mf: close > ema21_mf ? 1 : 0,
  close_above_ema5_hf: close > ema5_hf ? 1 : 0,
  close_above_ema200_mf: close > ema200_mf ? 1 : 0,

  // Support strength
  ema21_mf_support: (close - ema21_mf) / close * 100,  // % above support
};
```

#### Historical Momentum Features
```javascript
const momentumFeatures = {
  // Recent price action
  bars_higher_highs: countHigherHighs(periods.slice(0, 20)),
  bars_higher_lows: countHigherLows(periods.slice(0, 20)),
  bars_lower_highs: countLowerHighs(periods.slice(0, 20)),
  bars_lower_lows: countLowerLows(periods.slice(0, 20)),

  // Recent volume
  volume_ratio: current_volume / avgVolume,
  volume_trend: volumeSMA(20)[0] > volumeSMA(20)[1] ? 1 : 0,

  // Recent returns
  return_last_5_bars: (close - periods[4].close) / periods[4].close,
  return_last_10_bars: (close - periods[9].close) / periods[9].close,
  volatility_last_10: stdDev(periods.slice(0, 10).map(p => p.close)),
};
```

---

## Model Training Pipeline

### Data Collection with TradingView-API

```javascript
const TradingView = require('@mathieuc/tradingview');

class GeckoTrainingDataCollector {
  constructor() {
    this.client = new TradingView.Client({
      token: process.env.SESSION,
      signature: process.env.SIGNATURE
    });
  }

  async collectMultiTimeframeData(symbol, startDate, endDate) {
    const data = {
      lf: [],  // 5 or 15 minute
      mf: [],  // 60 minute
      hf: [],  // 240 minute
    };

    // Collect from each timeframe
    data.lf = await this.collectTimeframeData(symbol, '5', startDate, endDate);
    data.mf = await this.collectTimeframeData(symbol, '60', startDate, endDate);
    data.hf = await this.collectTimeframeData(symbol, '240', startDate, endDate);

    return data;
  }

  async collectTimeframeData(symbol, timeframe, startDate, endDate) {
    const chart = new this.client.Session.Chart();
    chart.setMarket(symbol, {
      timeframe,
      replay: Math.floor(startDate.getTime() / 1000),
      range: 1
    });

    const periods = [];

    return new Promise((resolve) => {
      chart.onUpdate(() => {
        if (chart.periods[0]) {
          periods.push({
            time: chart.periods[0].time,
            open: chart.periods[0].open,
            high: chart.periods[0].high,
            low: chart.periods[0].low,
            close: chart.periods[0].close,
            volume: chart.periods[0].volume,
          });
        }
      });

      const checkEnd = setInterval(async () => {
        const currentTime = Math.floor(Date.now() / 1000);
        if (chart.periods[0].time >= Math.floor(endDate.getTime() / 1000)) {
          clearInterval(checkEnd);
          chart.delete();
          resolve(periods);
        }
      }, 1000);
    });
  }
}
```

### Feature Extraction for Each Period

```javascript
class GeckoFeatureExtractor {
  constructor(emaLengths = [5, 8, 21, 50, 200]) {
    this.emaLengths = emaLengths;
    this.emaValues = {};
    this.periods = [];
  }

  // Calculate EMAs for each timeframe
  calculateEMAs(periods, length) {
    const emas = [];
    let multiplier = 2 / (length + 1);

    for (let i = 0; i < periods.length; i++) {
      if (i === 0) {
        // Start with simple average
        emas[i] = periods.slice(0, length).reduce((sum, p) => sum + p.close, 0) / length;
      } else {
        emas[i] = (periods[i].close - emas[i - 1]) * multiplier + emas[i - 1];
      }
    }

    return emas;
  }

  // Extract all features for a given period index
  extractFeaturesForPeriod(periodIndex, lf_periods, mf_periods, hf_periods) {
    const period = lf_periods[periodIndex];
    const features = {};

    // === PRICE ACTION FEATURES ===
    features['close'] = period.close;
    features['open'] = period.open;
    features['high'] = period.high;
    features['low'] = period.low;
    features['volume'] = period.volume;
    features['range'] = period.high - period.low;
    features['body'] = Math.abs(period.close - period.open);
    features['hl2'] = (period.high + period.low) / 2;
    features['hlc3'] = (period.high + period.low + period.close) / 3;
    features['body_percent'] = (features['body'] / features['range']) * 100;

    // === EMA FEATURES ===
    // Low Frame EMAs
    const lf_emas = this.calculateAllEMAs(lf_periods);
    features['ema8_lf'] = lf_emas[8][periodIndex];
    features['ema21_lf'] = lf_emas[21][periodIndex];
    features['ema50_lf'] = lf_emas[50][periodIndex];
    features['ema200_lf'] = lf_emas[200][periodIndex];

    // Middle Frame EMAs (get closest bar)
    const mf_index = this.findClosestTimeIndex(lf_periods[periodIndex].time, mf_periods);
    const mf_emas = this.calculateAllEMAs(mf_periods);
    features['ema8_mf'] = mf_emas[8][mf_index];
    features['ema21_mf'] = mf_emas[21][mf_index];
    features['ema50_mf'] = mf_emas[50][mf_index];
    features['ema200_mf'] = mf_emas[200][mf_index];

    // High Frame EMAs
    const hf_index = this.findClosestTimeIndex(lf_periods[periodIndex].time, hf_periods);
    const hf_emas = this.calculateAllEMAs(hf_periods);
    features['ema5_hf'] = hf_emas[5][hf_index];
    features['ema8_hf'] = hf_emas[8][hf_index];
    features['ema21_hf'] = hf_emas[21][hf_index];
    features['ema50_hf'] = hf_emas[50][hf_index];
    features['ema200_hf'] = hf_emas[200][hf_index];

    // === CONSOLIDATION FEATURES ===
    features['touches_to_level'] = this.countTouches(lf_periods.slice(0, periodIndex), 0.01);
    features['compression_ratio'] = this.calculateCompressionRatio(lf_periods.slice(0, periodIndex));
    features['consolidation_level'] = this.findConsolidationLevel(lf_periods.slice(0, periodIndex));

    // === TREND ALIGNMENT FEATURES ===
    features['lf_ema_aligned_up'] = this.isEMAAlignedUp([features['ema8_lf'], features['ema21_lf'], features['ema50_lf'], features['ema200_lf']]) ? 1 : 0;
    features['mf_ema_aligned_up'] = this.isEMAAlignedUp([features['ema8_mf'], features['ema21_mf'], features['ema50_mf'], features['ema200_mf']]) ? 1 : 0;
    features['hf_ema_aligned_up'] = this.isEMAAlignedUp([features['ema5_hf'], features['ema8_hf'], features['ema21_hf'], features['ema50_hf'], features['ema200_hf']]) ? 1 : 0;
    features['all_aligned_up'] = (features['lf_ema_aligned_up'] && features['mf_ema_aligned_up'] && features['hf_ema_aligned_up']) ? 1 : 0;

    // === SUPPORT/RESISTANCE FEATURES ===
    features['above_ema21_mf'] = period.close > features['ema21_mf'] ? 1 : 0;
    features['above_ema5_hf'] = period.close > features['ema5_hf'] ? 1 : 0;
    features['above_ema200_mf'] = period.close > features['ema200_mf'] ? 1 : 0;
    features['distance_to_ema21_mf'] = (period.close - features['ema21_mf']) / period.close;
    features['distance_to_ema5_hf'] = (period.close - features['ema5_hf']) / period.close;

    // === MOMENTUM FEATURES ===
    features['higher_highs_last_20'] = this.countHigherHighs(lf_periods.slice(Math.max(0, periodIndex - 20), periodIndex));
    features['higher_lows_last_20'] = this.countHigherLows(lf_periods.slice(Math.max(0, periodIndex - 20), periodIndex));
    features['volume_ratio'] = period.volume / this.avgVolume(lf_periods.slice(0, periodIndex));
    features['momentum_last_10'] = (period.close - lf_periods[Math.max(0, periodIndex - 10)].close) / lf_periods[Math.max(0, periodIndex - 10)].close;

    return features;
  }

  // Helper methods
  findClosestTimeIndex(targetTime, periods) {
    let closest = 0;
    let minDiff = Math.abs(periods[0].time - targetTime);
    for (let i = 1; i < periods.length; i++) {
      const diff = Math.abs(periods[i].time - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = i;
      }
    }
    return closest;
  }

  isEMAAlignedUp(emaValues) {
    for (let i = 0; i < emaValues.length - 1; i++) {
      if (emaValues[i] <= emaValues[i + 1]) return false;
    }
    return true;
  }

  countTouches(periods, tolerance) {
    if (periods.length === 0) return 0;
    const level = periods[0].close;
    let touches = 0;
    for (let p of periods) {
      if (Math.abs(p.close - level) / level < tolerance) touches++;
    }
    return touches;
  }

  calculateCompressionRatio(periods) {
    if (periods.length < 2) return 1;
    const recentRange = Math.max(...periods.slice(0, 10).map(p => p.high)) - Math.min(...periods.slice(0, 10).map(p => p.low));
    const historicalRange = Math.max(...periods.map(p => p.high)) - Math.min(...periods.map(p => p.low));
    return recentRange / historicalRange;
  }

  findConsolidationLevel(periods) {
    if (periods.length === 0) return 0;
    return periods.reduce((sum, p) => sum + p.close, 0) / periods.length;
  }

  countHigherHighs(periods) {
    let count = 0;
    for (let i = 1; i < periods.length; i++) {
      if (periods[i].high > periods[i - 1].high) count++;
    }
    return count;
  }

  countHigherLows(periods) {
    let count = 0;
    for (let i = 1; i < periods.length; i++) {
      if (periods[i].low > periods[i - 1].low) count++;
    }
    return count;
  }

  avgVolume(periods) {
    return periods.reduce((sum, p) => sum + p.volume, 0) / periods.length;
  }

  calculateAllEMAs(periods) {
    const emas = {};
    for (let length of this.emaLengths) {
      emas[length] = this.calculateEMAs(periods, length);
    }
    return emas;
  }
}
```

### Target Variable: Labeling Winners vs. Losers

```javascript
class GeckoTargetLabeler {
  // Label each pattern as winner (1) or loser (0)
  labelPattern(entryBar, futureCandles, lookAheadBars = 50) {
    const entryPrice = entryBar.close;
    const stopLoss = this.calculateStop(entryBar);
    const targetPrice = this.calculateTarget(entryBar);

    let maxProfit = 0;
    let maxLoss = 0;
    let hitTarget = false;
    let hitStop = false;

    // Look ahead to see what happened
    for (let i = 0; i < Math.min(lookAheadBars, futureCandles.length); i++) {
      const candle = futureCandles[i];

      const profit = (candle.high - entryPrice) / entryPrice;
      const loss = (candle.low - entryPrice) / entryPrice;

      maxProfit = Math.max(maxProfit, profit);
      maxLoss = Math.min(maxLoss, loss);

      if (candle.high >= targetPrice) {
        hitTarget = true;
        break;
      }

      if (candle.low <= stopLoss) {
        hitStop = true;
        break;
      }
    }

    // Winner if target reached before stop
    return hitTarget && !hitStop ? 1 : 0;
  }

  calculateStop(entryBar) {
    // Stop typically placed below the consolidation low or below recent support
    return entryBar.low * 0.98;  // Simplified: 2% below entry low
  }

  calculateTarget(entryBar) {
    // Target based on risk/reward: 2:1 ratio common in Gecko
    const stop = this.calculateStop(entryBar);
    const risk = entryBar.close - stop;
    return entryBar.close + (risk * 2);
  }
}
```

### Model Building with TensorFlow.js

```javascript
const tf = require('@tensorflow/tfjs');

class GeckoMLModel {
  constructor(featureCount) {
    this.featureCount = featureCount;
    this.model = this.buildModel();
  }

  buildModel() {
    const model = tf.sequential({
      layers: [
        // Input layer
        tf.layers.dense({
          inputShape: [this.featureCount],
          units: 128,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.3 }),

        // Hidden layers
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.3 }),

        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.2 }),

        // Output layer (binary classification)
        tf.layers.dense({
          units: 1,
          activation: 'sigmoid'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', tf.metrics.auc()]
    });

    return model;
  }

  async train(features, labels, epochs = 100, batchSize = 32) {
    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels, [labels.length, 1]);

    const history = await this.model.fit(xs, ys, {
      epochs,
      batchSize,
      validationSplit: 0.2,
      shuffle: true,
      verbose: 1,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
        }
      }
    });

    xs.dispose();
    ys.dispose();

    return history;
  }

  predict(features) {
    const input = tf.tensor2d([features]);
    const prediction = this.model.predict(input);
    const probability = prediction.dataSync()[0];

    input.dispose();
    prediction.dispose();

    return {
      probability,
      signal: probability > 0.5 ? 'LONG' : 'NEUTRAL',
      confidence: Math.abs(probability - 0.5) * 2
    };
  }
}
```

---

## Real-Time Prediction

### Live Gecko Pattern Detection

```javascript
class LiveGeckoIndicator {
  constructor(symbol, lf_timeframe = '5', mf_timeframe = '60', hf_timeframe = '240') {
    this.client = new TradingView.Client({
      token: process.env.SESSION,
      signature: process.env.SIGNATURE
    });

    this.symbol = symbol;
    this.lf_timeframe = lf_timeframe;
    this.mf_timeframe = mf_timeframe;
    this.hf_timeframe = hf_timeframe;

    this.charts = {
      lf: new this.client.Session.Chart(),
      mf: new this.client.Session.Chart(),
      hf: new this.client.Session.Chart()
    };

    this.periods = {
      lf: [],
      mf: [],
      hf: []
    };

    this.model = null;
    this.featureExtractor = new GeckoFeatureExtractor();
  }

  async start(trainedModel) {
    this.model = trainedModel;

    // Setup Low Frame
    this.charts.lf.setMarket(this.symbol, { timeframe: this.lf_timeframe });
    this.charts.lf.onUpdate(() => this.onLFUpdate());

    // Setup Middle Frame
    this.charts.mf.setMarket(this.symbol, { timeframe: this.mf_timeframe });
    this.charts.mf.onUpdate(() => this.onMFUpdate());

    // Setup High Frame
    this.charts.hf.setMarket(this.symbol, { timeframe: this.hf_timeframe });
    this.charts.hf.onUpdate(() => this.onHFUpdate());
  }

  onLFUpdate() {
    if (!this.charts.lf.periods[0]) return;

    const newCandle = {
      time: this.charts.lf.periods[0].time,
      open: this.charts.lf.periods[0].open,
      high: this.charts.lf.periods[0].high,
      low: this.charts.lf.periods[0].low,
      close: this.charts.lf.periods[0].close,
      volume: this.charts.lf.periods[0].volume
    };

    // Keep only last 500 candles
    this.periods.lf.unshift(newCandle);
    if (this.periods.lf.length > 500) this.periods.lf.pop();

    // Check for Gecko pattern
    this.checkGeckoPattern();
  }

  onMFUpdate() {
    if (!this.charts.mf.periods[0]) return;

    const newCandle = {
      time: this.charts.mf.periods[0].time,
      open: this.charts.mf.periods[0].open,
      high: this.charts.mf.periods[0].high,
      low: this.charts.mf.periods[0].low,
      close: this.charts.mf.periods[0].close,
      volume: this.charts.mf.periods[0].volume
    };

    this.periods.mf.unshift(newCandle);
    if (this.periods.mf.length > 500) this.periods.mf.pop();
  }

  onHFUpdate() {
    if (!this.charts.hf.periods[0]) return;

    const newCandle = {
      time: this.charts.hf.periods[0].time,
      open: this.charts.hf.periods[0].open,
      high: this.charts.hf.periods[0].high,
      low: this.charts.hf.periods[0].low,
      close: this.charts.hf.periods[0].close,
      volume: this.charts.hf.periods[0].volume
    };

    this.periods.hf.unshift(newCandle);
    if (this.periods.hf.length > 500) this.periods.hf.pop();
  }

  checkGeckoPattern() {
    if (this.periods.lf.length < 50) return;  // Need min history

    // Extract features from current bar
    const features = this.featureExtractor.extractFeaturesForPeriod(
      0,
      this.periods.lf,
      this.periods.mf,
      this.periods.hf
    );

    // Make prediction
    const prediction = this.model.predict(Object.values(features));

    // Emit signal if confidence high
    if (prediction.confidence > 0.7) {
      this.onSignal({
        symbol: this.symbol,
        time: new Date(),
        signal: prediction.signal,
        probability: prediction.probability,
        confidence: prediction.confidence,
        features: features
      });
    }
  }

  onSignal(signal) {
    console.log(`[SIGNAL] ${signal.symbol} - ${signal.signal} @ ${signal.probability.toFixed(3)} confidence ${signal.confidence.toFixed(2)}`);
    // Send to trading system, alert, webhook, etc.
  }

  stop() {
    this.charts.lf.delete();
    this.charts.mf.delete();
    this.charts.hf.delete();
    this.client.end();
  }
}
```

---

## Backtesting Framework

### Historical Replay Backtester

```javascript
class GeckoBacktester {
  constructor(model, symbol, lf_tf = '5', mf_tf = '60', hf_tf = '240') {
    this.model = model;
    this.symbol = symbol;
    this.lf_tf = lf_tf;
    this.mf_tf = mf_tf;
    this.hf_tf = hf_tf;
    this.featureExtractor = new GeckoFeatureExtractor();
    this.results = {
      trades: [],
      winRate: 0,
      profitLoss: 0,
      maxDrawdown: 0,
      sharpeRatio: 0
    };
  }

  async runBacktest(startDate, endDate) {
    const client = new TradingView.Client({
      token: process.env.SESSION,
      signature: process.env.SIGNATURE
    });

    const chart = new client.Session.Chart();

    // Collect historical data
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    chart.setMarket(this.symbol, {
      timeframe: this.lf_tf,
      replay: startTimestamp,
      range: 1
    });

    const periods = [];
    let replayCount = 0;
    const maxReplaySteps = Math.ceil((endDate - startDate) / (5 * 60 * 1000));  // Approximate

    return new Promise((resolve) => {
      chart.onUpdate(() => {
        if (chart.periods[0]) {
          periods.unshift({
            time: chart.periods[0].time,
            open: chart.periods[0].open,
            high: chart.periods[0].high,
            low: chart.periods[0].low,
            close: chart.periods[0].close,
            volume: chart.periods[0].volume
          });

          // Check for patterns every candle
          if (periods.length > 50) {
            const features = this.featureExtractor.extractFeaturesForPeriod(
              0,
              periods,
              this.getMFPeriods(periods, this.lf_tf, this.mf_tf),
              this.getHFPeriods(periods, this.lf_tf, this.hf_tf)
            );

            const prediction = this.model.predict(Object.values(features));

            if (prediction.confidence > 0.65) {
              // Record potential trade
              this.results.trades.push({
                entryTime: new Date(chart.periods[0].time * 1000),
                entryPrice: chart.periods[0].close,
                signal: prediction.signal,
                confidence: prediction.confidence
              });
            }
          }
        }

        replayCount++;
        if (replayCount % 100 === 0) {
          console.log(`Backtest progress: ${replayCount} candles processed`);
        }

        if (chart.periods[0].time >= Math.floor(endDate.getTime() / 1000) || replayCount >= maxReplaySteps) {
          chart.delete();
          client.end();

          // Calculate metrics
          this.calculateMetrics();
          resolve(this.results);
        }
      });

      chart.onReplayEnd(() => {
        chart.delete();
        client.end();
        this.calculateMetrics();
        resolve(this.results);
      });
    });
  }

  getMFPeriods(lfPeriods, lf_tf, mf_tf) {
    // Resample LF periods to MF
    const tfRatio = parseInt(mf_tf) / parseInt(lf_tf);
    const mfPeriods = [];
    for (let i = 0; i < lfPeriods.length; i += tfRatio) {
      const group = lfPeriods.slice(i, i + tfRatio);
      if (group.length > 0) {
        mfPeriods.push({
          time: group[0].time,
          open: group[0].open,
          high: Math.max(...group.map(p => p.high)),
          low: Math.min(...group.map(p => p.low)),
          close: group[group.length - 1].close,
          volume: group.reduce((sum, p) => sum + p.volume, 0)
        });
      }
    }
    return mfPeriods;
  }

  getHFPeriods(lfPeriods, lf_tf, hf_tf) {
    // Similar resampling for HF
    const tfRatio = parseInt(hf_tf) / parseInt(lf_tf);
    const hfPeriods = [];
    for (let i = 0; i < lfPeriods.length; i += tfRatio) {
      const group = lfPeriods.slice(i, i + tfRatio);
      if (group.length > 0) {
        hfPeriods.push({
          time: group[0].time,
          open: group[0].open,
          high: Math.max(...group.map(p => p.high)),
          low: Math.min(...group.map(p => p.low)),
          close: group[group.length - 1].close,
          volume: group.reduce((sum, p) => sum + p.volume, 0)
        });
      }
    }
    return hfPeriods;
  }

  calculateMetrics() {
    // Win rate
    const winners = this.results.trades.filter(t => t.exitProfit > 0).length;
    this.results.winRate = winners / this.results.trades.length;

    // Total profit/loss
    this.results.profitLoss = this.results.trades.reduce((sum, t) => sum + (t.exitProfit || 0), 0);

    // TODO: Calculate max drawdown, sharpe ratio, etc.
  }
}
```

---

## Implementation Details

### Complete End-to-End Example

```javascript
async function implementGeckoMLIndicator() {
  // Step 1: Collect training data
  console.log('Step 1: Collecting training data...');
  const collector = new GeckoTrainingDataCollector();
  const trainingData = await collector.collectMultiTimeframeData(
    'BINANCE:BTCUSDT',
    new Date('2023-01-01'),
    new Date('2023-06-01')
  );

  // Step 2: Extract features and create labels
  console.log('Step 2: Extracting features...');
  const extractor = new GeckoFeatureExtractor();
  const labeler = new GeckoTargetLabeler();

  const allFeatures = [];
  const allLabels = [];

  for (let i = 50; i < trainingData.lf.length - 50; i++) {
    const features = extractor.extractFeaturesForPeriod(
      i,
      trainingData.lf,
      trainingData.mf,
      trainingData.hf
    );

    const label = labeler.labelPattern(
      trainingData.lf[i],
      trainingData.lf.slice(i + 1, i + 51)
    );

    allFeatures.push(Object.values(features));
    allLabels.push([label]);
  }

  // Step 3: Normalize features
  console.log('Step 3: Normalizing features...');
  const featureCount = allFeatures[0].length;
  const mins = Array(featureCount).fill(Infinity);
  const maxs = Array(featureCount).fill(-Infinity);

  allFeatures.forEach(feature => {
    feature.forEach((val, idx) => {
      mins[idx] = Math.min(mins[idx], val);
      maxs[idx] = Math.max(maxs[idx], val);
    });
  });

  const normalizedFeatures = allFeatures.map(feature =>
    feature.map((val, idx) => {
      const range = maxs[idx] - mins[idx];
      return range === 0 ? 0 : (val - mins[idx]) / range;
    })
  );

  // Step 4: Train model
  console.log('Step 4: Training model...');
  const model = new GeckoMLModel(featureCount);
  await model.train(normalizedFeatures, allLabels.map(l => l[0]), 100, 32);

  // Step 5: Backtest
  console.log('Step 5: Running backtest...');
  const backtester = new GeckoBacktester(model, 'BINANCE:BTCUSDT');
  const backtestResults = await backtester.runBacktest(
    new Date('2023-06-01'),
    new Date('2023-12-31')
  );

  console.log('Backtest Results:', backtestResults);

  // Step 6: Deploy live indicator
  console.log('Step 6: Deploying live indicator...');
  const liveIndicator = new LiveGeckoIndicator('BINANCE:BTCUSDT');
  liveIndicator.start(model);

  // Keep running
  setTimeout(() => {
    liveIndicator.stop();
  }, 24 * 60 * 60 * 1000);  // Run for 24 hours
}

// Run the system
implementGeckoMLIndicator().catch(console.error);
```

---

---

## Input Parameters & Configuration

### User-Configurable Parameters

```javascript
const GECKO_INDICATOR_INPUTS = {
  // Frame Selection
  lowFrame: '5',  // User input: 1, 5, 15, 60, 240, 1D, 1W, or 1M
  // middleFrame and highFrame auto-derived

  // EMA Lengths
  emaLengths: {
    fast: 8,      // EMA 8 (black)
    medium: 21,   // EMA 21 (blue)
    intermediate: 50  // EMA 50 (red)
    // Note: 200 SMA is available but used mainly for reference
  },

  // ATR Settings
  atrLength: 14,
  atrMultipliers: {
    momentumMove: 1.5,    // Minimum MM size
    testBar: 1.5,         // Minimum TB size
    entryBuffer: 0.2      // Re-entry confirmation buffer
  },

  // Trend Detection (HF)
  comaBarRequired: 30,    // Minimum bars in COMA for trend confirmation

  // Consolidation Parameters (LF)
  consolidation: {
    minBars: 20,
    maxBars: 100,
    touchesRequired: 3,
    tolerance: 0.003      // ±0.3% tolerance for touch detection
  },

  // Pattern Quality Filters
  filters: {
    minStopRunLevels: 1,
    minATRRatio: 0.3,     // Minimum ratio of current ATR to 20-bar avg
    swingProximity: 3.0   // Minimum × ATR distance from major swings
  },

  // Display & Alerts
  display: {
    showTrendLabel: true,
    showTrendAge: true,
    showConsolidationBox: true,
    showTestBar: true,
    showHook: true,
    showEntryLevels: true,
    showStopTarget: true
  },

  alerts: {
    enableAlerts: true,
    alertOnTrendConfirm: true,
    alertOnConsolidation: true,
    alertOnTestBar: true,
    alertOnHook: true,
    alertOnEntry: true
  },

  // Risk Management
  riskReward: {
    minimum: 2.0,
    good: 2.5,
    excellent: 3.0
  }
};
```

### Configuration Examples

**Aggressive Trader (Smaller Position, Tighter Stops):**
```javascript
{
  lowFrame: '5',
  comaBarRequired: 25,
  consolidation: { minBars: 15, maxBars: 80 },
  minStopRunLevels: 0,
  riskReward: { minimum: 1.5 }
}
```

**Conservative Trader (Quality Over Quantity):**
```javascript
{
  lowFrame: '15',
  comaBarRequired: 40,
  consolidation: { minBars: 30, maxBars: 100 },
  minStopRunLevels: 2,
  riskReward: { minimum: 3.0 }
}
```

**Scalper (Very Quick Entry/Exit):**
```javascript
{
  lowFrame: '1',
  comaBarRequired: 15,
  consolidation: { minBars: 5, maxBars: 30 },
  minStopRunLevels: 1,
  riskReward: { minimum: 1.5 }
}
```

---

## Output Data & Performance

### Array Outputs for External Integration

The indicator should expose the following arrays and objects for:
- **Automated trading bots**
- **Alert systems**
- **Portfolio analysis**
- **Performance tracking**

#### **1. Trend Data Array**

```javascript
const trendData = {
  timestamp: 1234567890,
  direction: 'UP',           // 'UP' or 'DOWN'
  barsInCOMA: 35,
  ema8: 1.2450,
  ema21: 1.2430,
  ema50: 1.2380,
  trendConfirmed: true,
  trendAge: 35
};

// Array of all trend changes
const allTrends = [
  trendData,
  // ... historical trend data
];
```

#### **2. Gecko Pattern Array**

```javascript
const geckoPattern = {
  timestamp: 1234567890,
  symbol: 'EURUSD',
  stage: 'HOOK_FORMED',        // MOMENTUM_MOVE, CONSOLIDATION, TEST_BAR, HOOK, ENTRY, CLOSED
  quality: 0.87,               // 0-1 score

  // Momentum Move Data
  momentumMove: {
    startBar: 150,
    endBar: 165,
    size: 0.0125,              // Pips or points
    atrMultiple: 1.8,
    direction: 'UP'
  },

  // Consolidation Data
  consolidation: {
    startBar: 165,
    endBar: 205,
    barCount: 40,
    high: 1.2465,
    low: 1.2410,
    level: 1.2435,
    touches: 4,
    compression: 0.65          // 0-1 score
  },

  // Test Bar Data
  testBar: {
    barIndex: 210,
    high: 1.2480,
    low: 1.2405,
    close: 1.2475,
    atrMultiple: 1.7,
    wickRatio: 0.15,           // Upper wick as % of bar
    volume: 150000
  },

  // Hook / FTB Data
  hook: {
    formed: true,
    barIndex: 215,
    breakoutFailed: true,
    rejectPrice: 1.2440
  },

  // Entry Data
  entry: {
    formed: true,
    price: 1.2445,
    bar: 220,
    timestamp: 1234567890
  }
};

// Array of all detected patterns (current and historical)
const allPatterns = [geckoPattern, ...];
```

#### **3. Trade Setup Array**

```javascript
const tradeSetup = {
  timestamp: 1234567890,
  symbol: 'EURUSD',
  patternId: '12345',          // Link to geckoPattern

  // Entry Details
  entry: {
    price: 1.2445,
    bar: 220,
    timestamp: 1234567890,
    confirmed: true,
    signal: 'LONG'
  },

  // Stop Loss
  stopLoss: {
    price: 1.2410,
    bar: 218,                  // FTB bar reference
    pips: 35,
    type: 'HARD_STOP'
  },

  // Target
  target: {
    price: 1.2570,
    extension: 0.0125,         // 100% of MM
    type: 'PRIMARY_TARGET'
  },

  // Risk-Reward
  riskReward: {
    risk: 0.0035,
    reward: 0.0125,
    ratio: 3.57,
    quality: 'EXCELLENT'
  },

  // Stop-Run Levels
  stopRunLevels: [
    { price: 1.2480, type: 'CLUSTER_1' },
    { price: 1.2520, type: 'CLUSTER_2' }
  ],

  // Status
  status: 'ACTIVE',            // PENDING, ACTIVE, CLOSED, INVALIDATED
  outcome: null                // WIN, LOSS, PARTIAL (when closed)
};

// Array of all setups
const allSetups = [tradeSetup, ...];
```

#### **4. Performance Metrics**

```javascript
const performanceMetrics = {
  // Pattern Statistics
  patterns: {
    total: 145,
    thisMonth: 23,
    thisWeek: 5,
    confirmed: 142,
    invalidated: 3
  },

  // Trade Statistics
  trades: {
    total: 142,
    closed: 98,
    active: 44,
    winners: 72,
    losers: 26,
    winRate: 0.735,            // 73.5%
    breakeven: 0
  },

  // Profitability
  profitLoss: {
    gross: 4250.50,            // USD
    net: 3875.75,
    avgWinSize: 75.50,
    avgLossSize: 42.25,
    profitFactor: 2.84         // Gross profit / Gross loss
  },

  // Risk Metrics
  risk: {
    maxDrawdown: 0.045,        // 4.5% peak-to-trough
    avgRiskPerTrade: 0.0125,
    totalRiskExposed: 5.5      // In risk units
  },

  // Best / Worst
  bestTrade: { symbol: 'GBPUSD', rr: 5.2, profit: 245 },
  worstTrade: { symbol: 'EURUSD', rr: 0.5, loss: -145 },
  bestDay: { date: '2024-01-15', profit: 1250 },
  worstDay: { date: '2024-01-10', loss: -350 }
};
```

### Performance & Usability

**Computational Requirements:**
- Low computation load across all timeframes
- Real-time processing on standard hardware
- Sub-second pattern detection
- Optional dashboard for monitoring multiple frame sets

**Visual Clarity:**
- Minimal chart clutter with toggleable elements
- Color-coded alerts (green for longs, red for shorts)
- Clear labels with prices and RR ratios
- Optional dark/light theme support

**Dashboard Features:**
- Live Gecko setups across multiple symbols
- Win-rate statistics
- Real-time alerts table
- Performance metrics snapshot

---

## Summary

The Gecko ML Indicator combines:

1. **Multi-Timeframe Pattern Recognition:** Automatically detects Gecko consolidation & breakout-hook patterns across three synchronized timeframes
2. **Trend Validation:** Confirms high-frame trends (≥30 bars COMA) before scanning for patterns
3. **Dynamic Support Validation:** Validates MF 21 EMA and HF 5 EMA confluence for pattern strength
4. **Precise Entry Signals:** Re-break of consolidation with 0.2×ATR buffer for confirmed entries
5. **Risk Management:** Fixed stops 1 tick beyond FTB swings with 100% MM extension targets (minimum 2:1 RR)
6. **Quality Filtering:** Optional filters for stop-run levels, ATR volatility, and swing proximity
7. **Real-Time Alerts:** 5-stage alert system (Trend, Consolidation, Test Bar, Hook, Entry)
8. **Comprehensive Outputs:** Arrays for trend data, pattern metrics, trade setups, and performance statistics
9. **Machine Learning Integration:** Foundation for ML models to learn pattern outcomes and predict winners
10. **Backtesting Framework:** Historical replay capability for strategy validation and optimization

### Key Principles

**"Setup Quality Over Trade Frequency"** - The system is designed to filter out low-quality setups, resulting in fewer but higher-probability trades. Multi-timeframe alignment and proper support validation ensure that only the strongest Gecko patterns trigger alerts.

**"Automatic Timeframe Derivation"** - Users select only the Low Frame; Middle and High Frames are automatically calculated, simplifying configuration and ensuring consistent timeframe relationships.

**"Rules-Based & Quantifiable"** - Every element is strictly defined: minimum trend bars, consolidation range, ATR multiples, EMA tolerances, and RR ratios ensure reproducible, testable patterns.

The system learns from historical Gecko patterns and their outcomes, enabling automated detection and trading of high-probability setups across multiple markets and timeframes.
