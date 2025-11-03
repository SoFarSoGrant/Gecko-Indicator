/**
 * Feature Engineering Module
 *
 * Extracts and prepares features from price data and indicators
 * for use in ML model training and prediction.
 *
 * Implements 50+ features across 5 categories:
 * 1. Price action features (OHLCV, wicks, ranges)
 * 2. EMA features (all timeframes, all lengths)
 * 3. Consolidation pattern features (touches, compression, test bar)
 * 4. Trend alignment features (COMA validation, multi-timeframe alignment)
 * 5. Support/resistance & momentum features (distances, volume, momentum)
 *
 * @module src/data/feature-engineer
 */

class FeatureEngineer {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    // FIX #1: Dynamic bounds computed from training data instead of hardcoded
    this.normalizationBounds = null;
    this.featureStats = null; // For ZScore normalization
  }

  /**
   * Set normalization bounds from training dataset
   * CRITICAL FIX #1: Replaces hardcoded bounds
   *
   * @param {Array} features - Array of feature objects from training set
   */
  setNormalizationBounds(features) {
    if (!Array.isArray(features) || features.length === 0) {
      this.logger.warn('Empty features array for bounds computation, using defaults');
      return;
    }

    const bounds = {};
    const allKeys = Object.keys(features[0]);

    for (const key of allKeys) {
      const values = features.map(f => f[key]).filter(v => typeof v === 'number');
      if (values.length === 0) continue;

      bounds[key] = [
        Math.min(...values),
        Math.max(...values)
      ];
    }

    this.normalizationBounds = bounds;
    this.logger.debug(`Normalization bounds computed for ${Object.keys(bounds).length} features`);
  }

  /**
   * Compute per-feature statistics for ZScore normalization
   * CRITICAL FIX #3: Replaces incorrect global mean/stdDev calculation
   *
   * @param {Array} features - Array of feature objects from training set
   */
  setFeatureStatistics(features) {
    if (!Array.isArray(features) || features.length === 0) {
      this.logger.warn('Empty features array for statistics computation');
      return;
    }

    const stats = {};
    const allKeys = Object.keys(features[0]);

    for (const key of allKeys) {
      const values = features.map(f => f[key]).filter(v => typeof v === 'number');
      if (values.length === 0) continue;

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      stats[key] = { mean, stdDev };
    }

    this.featureStats = stats;
    this.logger.debug(`Feature statistics computed for ${Object.keys(stats).length} features`);
  }

  /**
   * Engineer features from pattern and multi-timeframe data
   *
   * @param {string} symbol - Trading symbol
   * @param {Object} pattern - Detected Gecko pattern with consolidation/test bar info
   * @param {Object} multiTimeframeData - Data for LF, MF, HF with OHLCV + indicators
   *   Format: {
   *     lf: { candles: Array, indicators: Object },
   *     mf: { candles: Array, indicators: Object },
   *     hf: { candles: Array, indicators: Object }
   *   }
   * @returns {Promise<Object>} Engineered features object
   */
  async engineerFeatures(symbol, pattern, multiTimeframeData) {
    this.logger.debug(`Engineering features for ${symbol}`);

    try {
      // Extract data from each timeframe
      const lfData = multiTimeframeData.lf || {};
      const mfData = multiTimeframeData.mf || {};
      const hfData = multiTimeframeData.hf || {};

      // Get current candles (index 0 = most recent)
      const lfCandle = lfData.candles?.[0];
      const mfCandle = mfData.candles?.[0];
      const hfCandle = hfData.candles?.[0];

      // Get historical candles for momentum/volatility calculations
      const lfHistory = lfData.candles || [];
      const mfHistory = mfData.candles || [];
      const hfHistory = hfData.candles || [];

      if (!lfCandle || !mfCandle || !hfCandle) {
        throw new Error('Missing candle data for feature engineering');
      }

      // 1. PRICE ACTION FEATURES (12 features)
      const priceFeatures = this._extractPriceFeatures(lfCandle);

      // 2. EMA FEATURES (15 features)
      const emaFeatures = this._extractEMAFeatures(lfCandle, mfCandle, hfCandle);

      // 3. CONSOLIDATION PATTERN FEATURES (12 features)
      const consolidationFeatures = this._extractConsolidationFeatures(
        pattern,
        lfCandle,
        lfHistory
      );

      // 4. TREND ALIGNMENT FEATURES (12 features)
      const trendFeatures = this._extractTrendFeatures(
        lfCandle,
        mfCandle,
        hfCandle
      );

      // 5. SUPPORT/RESISTANCE & MOMENTUM FEATURES (11 features)
      const supportMomentumFeatures = this._extractSupportMomentumFeatures(
        lfCandle,
        mfCandle,
        hfCandle,
        lfHistory,
        mfHistory
      );

      // Combine all features (52 total)
      const allFeatures = {
        ...priceFeatures,
        ...emaFeatures,
        ...consolidationFeatures,
        ...trendFeatures,
        ...supportMomentumFeatures,
      };

      // Validate features (check for NaN/Inf)
      this._validateFeatures(allFeatures);

      return {
        raw: allFeatures,
        normalized: this.normalizeFeatures(allFeatures, 'minmax'),
        categories: {
          priceFeatures,
          emaFeatures,
          consolidationFeatures,
          trendFeatures,
          supportMomentumFeatures,
        },
        count: Object.keys(allFeatures).length,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error(`Feature engineering failed for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Extract price action features from current candle (12 features)
   * CRITICAL FIX #2: Uses percentage-based metrics instead of absolute prices
   * This prevents model from overfitting to symbol-specific price levels
   * @private
   */
  _extractPriceFeatures(candle) {
    const { open, high, low, close, volume } = candle;

    const range = high - low;
    const body = Math.abs(close - open);
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;

    // Safe division with fallback
    const closePrice = close > 0 ? close : 1;
    const hl2Price = (high + low) / 2;
    const rangeValue = range > 0 ? range : 1;

    return {
      // REMOVED: Raw OHLCV prices (symbol-specific, causes overfitting)
      // close, open, high, low - NO LONGER INCLUDED
      volume,

      // Range metrics (scale-invariant)
      range,
      body,
      upper_wick: upperWick,
      lower_wick: lowerWick,

      // Percentage-based composite metrics (generalize across symbols)
      range_percent: range > 0 ? (range / closePrice) * 100 : 0,
      body_percent: range > 0 ? (body / range) * 100 : 0,
      upper_wick_percent: range > 0 ? (upperWick / range) * 100 : 0,
      lower_wick_percent: range > 0 ? (lowerWick / range) * 100 : 0,
      close_position_in_range: range > 0
        ? ((close - low) / range) * 100
        : 50, // Midpoint if no range

      // Volume metrics
      log_volume: volume > 0 ? Math.log10(volume) : 0,
    };
  }

  /**
   * Extract EMA features from all timeframes (15 features)
   * CRITICAL FIX #2: Uses percentage distances instead of absolute EMA values
   * Includes EMA(8, 21, 50, 200) for LF/MF and EMA(5, 8, 21, 50, 200) for HF
   * @private
   */
  _extractEMAFeatures(lfCandle, mfCandle, hfCandle) {
    // Calculate EMA distances as percentage of price
    const lfClose = lfCandle.close > 0 ? lfCandle.close : 1;
    const mfClose = mfCandle.close > 0 ? mfCandle.close : 1;
    const hfClose = hfCandle.close > 0 ? hfCandle.close : 1;

    const lfIndicators = lfCandle.indicators || {};
    const mfIndicators = mfCandle.indicators || {};
    const hfIndicators = hfCandle.indicators || {};

    return {
      // Low Frame EMA distances (% from close)
      ema8_lf_distance: lfIndicators.ema_8
        ? ((lfCandle.close - lfIndicators.ema_8) / lfClose) * 100
        : 0,
      ema21_lf_distance: lfIndicators.ema_21
        ? ((lfCandle.close - lfIndicators.ema_21) / lfClose) * 100
        : 0,
      ema50_lf_distance: lfIndicators.ema_50
        ? ((lfCandle.close - lfIndicators.ema_50) / lfClose) * 100
        : 0,
      ema200_lf_distance: lfIndicators.ema_200
        ? ((lfCandle.close - lfIndicators.ema_200) / lfClose) * 100
        : 0,

      // Mid Frame EMA distances (% from close)
      ema8_mf_distance: mfIndicators.ema_8
        ? ((mfCandle.close - mfIndicators.ema_8) / mfClose) * 100
        : 0,
      ema21_mf_distance: mfIndicators.ema_21
        ? ((mfCandle.close - mfIndicators.ema_21) / mfClose) * 100
        : 0,
      ema50_mf_distance: mfIndicators.ema_50
        ? ((mfCandle.close - mfIndicators.ema_50) / mfClose) * 100
        : 0,
      ema200_mf_distance: mfIndicators.ema_200
        ? ((mfCandle.close - mfIndicators.ema_200) / mfClose) * 100
        : 0,

      // High Frame EMA distances (% from close)
      ema5_hf_distance: hfIndicators.ema_5
        ? ((hfCandle.close - hfIndicators.ema_5) / hfClose) * 100
        : 0,
      ema8_hf_distance: hfIndicators.ema_8
        ? ((hfCandle.close - hfIndicators.ema_8) / hfClose) * 100
        : 0,
      ema21_hf_distance: hfIndicators.ema_21
        ? ((hfCandle.close - hfIndicators.ema_21) / hfClose) * 100
        : 0,
      ema50_hf_distance: hfIndicators.ema_50
        ? ((hfCandle.close - hfIndicators.ema_50) / hfClose) * 100
        : 0,
      ema200_hf_distance: hfIndicators.ema_200
        ? ((hfCandle.close - hfIndicators.ema_200) / hfClose) * 100
        : 0,

      // ATR features (volatility, already scale-free)
      atr_lf: lfIndicators.atr || 0,
      atr_hf: hfIndicators.atr || 0,
    };
  }

  /**
   * Extract consolidation pattern features (12 features)
   * CRITICAL FIX #2: Uses percentage-based metrics instead of absolute prices
   * Analyzes consolidation base, compression, test bar characteristics
   * @private
   */
  _extractConsolidationFeatures(pattern, lfCandle, lfHistory) {
    const consolidation = pattern?.consolidation || {};
    const testBar = pattern?.testBar || {};

    // Count touches to consolidation level (if pattern exists)
    let touches = 0;
    let compressionRatio = 1;
    let volatilitySqueeze = 0;

    const basePrice = consolidation.basePrice || lfCandle.close;
    const safeBasePrice = basePrice > 0 ? basePrice : 1;

    if (consolidation.basePrice && lfHistory.length >= 10) {
      // Count bars within consolidation tolerance
      const tolerance = consolidation.range ? consolidation.range * 0.1 : 0;
      touches = lfHistory.filter(c =>
        Math.abs(c.close - consolidation.basePrice) <= tolerance
      ).length;

      // Calculate compression (recent range vs average)
      const recentRange = lfHistory
        .slice(0, 10)
        .map(c => c.high - c.low)
        .reduce((a, b) => a + b, 0) / 10;
      const avgRange = lfHistory
        .map(c => c.high - c.low)
        .reduce((a, b) => a + b, 0) / lfHistory.length;
      compressionRatio = avgRange > 0 ? recentRange / avgRange : 1;

      // Calculate volatility squeeze (standard deviation as % of close)
      const closes = lfHistory.slice(0, 10).map(c => c.close);
      const stdDev = this._standardDeviation(closes);
      volatilitySqueeze = (stdDev / safeBasePrice) * 100;
    }

    return {
      // Consolidation base metrics (percentage-based)
      consolidation_range_percent: consolidation.range > 0
        ? (consolidation.range / safeBasePrice) * 100
        : 0,
      price_distance_from_base_percent: consolidation.basePrice
        ? ((Math.abs(lfCandle.close - consolidation.basePrice) / safeBasePrice) * 100)
        : 0,

      // Touch detection
      touches_to_level: touches,
      touch_density: lfHistory.length > 0 ? touches / lfHistory.length : 0,

      // Compression metrics
      range_ratio: compressionRatio,
      volatility_squeeze: volatilitySqueeze,
      avg_range_last_10_percent: lfHistory.length >= 10
        ? (lfHistory.slice(0, 10).reduce((sum, c) => sum + (c.high - c.low), 0) / 10 / safeBasePrice) * 100
        : 0,

      // Test bar analysis
      has_test_bar: testBar.formed ? 1 : 0,
      test_bar_strength: testBar.range > 0
        ? (testBar.close - testBar.low) / testBar.range
        : 0,
      test_bar_volume_ratio: lfHistory.length > 0
        ? testBar.volume / (lfHistory.reduce((sum, c) => sum + c.volume, 0) / lfHistory.length)
        : 0,
    };
  }

  /**
   * Extract trend alignment features - COMA validation and multi-timeframe alignment (12 features)
   * @private
   */
  _extractTrendFeatures(lfCandle, mfCandle, hfCandle) {
    const lf = lfCandle.indicators || {};
    const mf = mfCandle.indicators || {};
    const hf = hfCandle.indicators || {};

    // COMA checks
    const lfLongCOMA = lf.ema_8 > lf.ema_21 && lf.ema_21 > lf.ema_50 && lf.ema_50 > lf.ema_200 ? 1 : 0;
    const lfShortCOMA = lf.ema_8 < lf.ema_21 && lf.ema_21 < lf.ema_50 && lf.ema_50 < lf.ema_200 ? 1 : 0;

    const mfLongCOMA = mf.ema_8 > mf.ema_21 && mf.ema_21 > mf.ema_50 && mf.ema_50 > mf.ema_200 ? 1 : 0;
    const mfShortCOMA = mf.ema_8 < mf.ema_21 && mf.ema_21 < mf.ema_50 && mf.ema_50 < mf.ema_200 ? 1 : 0;

    const hfLongCOMA = hf.ema_5 > hf.ema_8 && hf.ema_8 > hf.ema_21 && hf.ema_21 > hf.ema_50 && hf.ema_50 > hf.ema_200 ? 1 : 0;
    const hfShortCOMA = hf.ema_5 < hf.ema_8 && hf.ema_8 < hf.ema_21 && hf.ema_21 < hf.ema_50 && hf.ema_50 < hf.ema_200 ? 1 : 0;

    return {
      // Low Frame trend
      lf_ema_order_long: lfLongCOMA,
      lf_ema_order_short: lfShortCOMA,
      lf_above_200sma: lfCandle.close > lf.ema_200 ? 1 : 0,

      // Mid Frame trend
      mf_ema_order_long: mfLongCOMA,
      mf_ema_order_short: mfShortCOMA,
      mf_above_200sma: mfCandle.close > mf.ema_200 ? 1 : 0,

      // High Frame trend
      hf_ema_order_long: hfLongCOMA,
      hf_ema_order_short: hfShortCOMA,
      hf_above_200sma: hfCandle.close > hf.ema_200 ? 1 : 0,

      // Multi-timeframe alignment (CRITICAL for Gecko)
      all_tf_aligned_long: (lfLongCOMA && mfLongCOMA && hfLongCOMA) ? 1 : 0,
      all_tf_aligned_short: (lfShortCOMA && mfShortCOMA && hfShortCOMA) ? 1 : 0,
      lf_mf_aligned: (lfLongCOMA === mfLongCOMA && lfShortCOMA === mfShortCOMA) ? 1 : 0,
    };
  }

  /**
   * Extract support/resistance distance and momentum features (11 features)
   * @private
   */
  _extractSupportMomentumFeatures(lfCandle, mfCandle, hfCandle, lfHistory, mfHistory) {
    const lf = lfCandle.indicators || {};
    const mf = mfCandle.indicators || {};
    const hf = hfCandle.indicators || {};

    // Support/resistance distances (normalized by price)
    const distanceToEMA21MF = mfCandle.close > 0 ? (lfCandle.close - mf.ema_21) / lfCandle.close : 0;
    const distanceToEMA5HF = hfCandle.close > 0 ? (lfCandle.close - hf.ema_5) / lfCandle.close : 0;
    const distanceToEMA200MF = mfCandle.close > 0 ? (lfCandle.close - mf.ema_200) / lfCandle.close : 0;

    // Momentum metrics from recent price action
    let barsHigherHighs = 0;
    let barsHigherLows = 0;
    let barsLowerHighs = 0;
    let barsLowerLows = 0;

    if (lfHistory.length >= 20) {
      for (let i = 1; i < Math.min(20, lfHistory.length); i++) {
        if (lfHistory[i - 1].high < lfHistory[i].high) barsHigherHighs++;
        if (lfHistory[i - 1].low < lfHistory[i].low) barsHigherLows++;
        if (lfHistory[i - 1].high > lfHistory[i].high) barsLowerHighs++;
        if (lfHistory[i - 1].low > lfHistory[i].low) barsLowerLows++;
      }
    }

    // Volume analysis
    const avgVolume = lfHistory.length > 0
      ? lfHistory.reduce((sum, c) => sum + c.volume, 0) / lfHistory.length
      : 1;
    const volumeRatio = avgVolume > 0 ? lfCandle.volume / avgVolume : 0;

    // Returns
    const return5bars = lfHistory.length >= 5
      ? (lfCandle.close - lfHistory[4].close) / lfHistory[4].close
      : 0;
    const return10bars = lfHistory.length >= 10
      ? (lfCandle.close - lfHistory[9].close) / lfHistory[9].close
      : 0;

    return {
      // Support/resistance distances
      distance_to_ema21_mf: distanceToEMA21MF,
      distance_to_ema5_hf: distanceToEMA5HF,
      distance_to_ema200_mf: distanceToEMA200MF,

      // Close above key levels
      close_above_ema21_mf: lfCandle.close > mf.ema_21 ? 1 : 0,
      close_above_ema5_hf: lfCandle.close > hf.ema_5 ? 1 : 0,
      close_above_ema200_mf: lfCandle.close > mf.ema_200 ? 1 : 0,

      // Momentum (swing counts)
      bars_higher_highs: barsHigherHighs / 20,
      bars_higher_lows: barsHigherLows / 20,
      bars_lower_highs: barsLowerHighs / 20,

      // Volume and returns
      volume_ratio: volumeRatio,
      return_last_5_bars: return5bars,
      return_last_10_bars: return10bars,
    };
  }

  /**
   * Normalize feature values using minmax or zscore
   * CRITICAL FIX #1: Uses dynamic bounds from training dataset
   * CRITICAL FIX #3: Uses per-feature statistics for ZScore
   *
   * @param {Object} features - Raw features object
   * @param {string} method - Normalization method ('minmax' or 'zscore')
   * @returns {Object} Normalized features (values between 0-1 for minmax)
   */
  normalizeFeatures(features, method = 'minmax') {
    const normalized = {};

    if (method === 'minmax') {
      // Use dynamic bounds if set, otherwise fallback to defaults
      const bounds = this.normalizationBounds || this._getDefaultBounds();

      for (const [key, value] of Object.entries(features)) {
        const [min, max] = bounds[key] || [0, 1];
        const range = max - min;

        if (range === 0) {
          normalized[key] = 0.5; // Center if no range
        } else {
          // Clip value to bounds and normalize to [0, 1]
          normalized[key] = Math.max(0, Math.min(1, (value - min) / range));
        }
      }
    } else if (method === 'zscore') {
      // CRITICAL FIX #3: Use per-feature statistics instead of global mean/stdDev
      // This requires featureStats to be set via setFeatureStatistics()
      if (!this.featureStats) {
        this.logger.warn('Feature statistics not set. Using per-feature normalization from data.');
        // Fallback: return as-is (will be normalized during training)
        return features;
      }

      for (const [key, value] of Object.entries(features)) {
        const stats = this.featureStats[key];
        if (stats && stats.stdDev > 0) {
          normalized[key] = (value - stats.mean) / stats.stdDev;
        } else {
          // If no stats or zero variance, keep value as-is
          normalized[key] = value;
        }
      }
    } else {
      return features; // Return as-is if method not recognized
    }

    return normalized;
  }

  /**
   * Get default normalization bounds for all features
   * Used as fallback if dynamic bounds not set
   * @private
   */
  _getDefaultBounds() {
    return {
      // Price features (percentage-based, generalize across symbols)
      volume: [0, 100000000],
      range: [0, 1000],
      body: [0, 1000],
      upper_wick: [0, 1000],
      lower_wick: [0, 1000],
      range_percent: [0, 10],
      body_percent: [0, 100],
      upper_wick_percent: [0, 100],
      lower_wick_percent: [0, 100],
      close_position_in_range: [0, 100],
      log_volume: [0, 10],

      // EMA features (percentage distances)
      ema8_lf_distance: [-5, 5],
      ema21_lf_distance: [-5, 5],
      ema50_lf_distance: [-5, 5],
      ema200_lf_distance: [-5, 5],
      ema8_mf_distance: [-5, 5],
      ema21_mf_distance: [-5, 5],
      ema50_mf_distance: [-5, 5],
      ema200_mf_distance: [-5, 5],
      ema5_hf_distance: [-5, 5],
      ema8_hf_distance: [-5, 5],
      ema21_hf_distance: [-5, 5],
      ema50_hf_distance: [-5, 5],
      ema200_hf_distance: [-5, 5],
      atr_lf: [0, 1000],
      atr_hf: [0, 1000],

      // Consolidation features (percentage-based)
      consolidation_range_percent: [0, 10],
      price_distance_from_base_percent: [0, 10],
      touches_to_level: [0, 50],
      touch_density: [0, 1],
      range_ratio: [0, 2],
      volatility_squeeze: [0, 10],
      avg_range_last_10_percent: [0, 10],
      has_test_bar: [0, 1],
      test_bar_strength: [0, 1],
      test_bar_volume_ratio: [0, 5],

      // Trend features (binary 0-1)
      lf_ema_order_long: [0, 1],
      lf_ema_order_short: [0, 1],
      lf_above_200sma: [0, 1],
      mf_ema_order_long: [0, 1],
      mf_ema_order_short: [0, 1],
      mf_above_200sma: [0, 1],
      hf_ema_order_long: [0, 1],
      hf_ema_order_short: [0, 1],
      hf_above_200sma: [0, 1],
      all_tf_aligned_long: [0, 1],
      all_tf_aligned_short: [0, 1],
      lf_mf_aligned: [0, 1],

      // Support/momentum features
      distance_to_ema21_mf: [-0.1, 0.1],
      distance_to_ema5_hf: [-0.1, 0.1],
      distance_to_ema200_mf: [-0.1, 0.1],
      close_above_ema21_mf: [0, 1],
      close_above_ema5_hf: [0, 1],
      close_above_ema200_mf: [0, 1],
      bars_higher_highs: [0, 1],
      bars_higher_lows: [0, 1],
      bars_lower_highs: [0, 1],
      volume_ratio: [0, 5],
      return_last_5_bars: [-0.1, 0.1],
      return_last_10_bars: [-0.1, 0.1],
      bars_lower_lows: [0, 1], // Added missing feature
    };
  }

  /**
   * Calculate standard deviation of array
   * @private
   */
  _standardDeviation(values) {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Validate features for NaN, Infinity, or invalid values
   * @private
   */
  _validateFeatures(features) {
    const issues = [];

    for (const [key, value] of Object.entries(features)) {
      if (isNaN(value)) {
        issues.push(`${key}: NaN`);
      } else if (!isFinite(value)) {
        issues.push(`${key}: Infinity`);
      } else if (typeof value !== 'number') {
        issues.push(`${key}: Not a number (${typeof value})`);
      }
    }

    if (issues.length > 0) {
      this.logger.warn(`Feature validation issues: ${issues.join(', ')}`);
    }

    return issues.length === 0;
  }
}

module.exports = { FeatureEngineer };
