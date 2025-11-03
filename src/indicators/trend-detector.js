/**
 * Trend Detector Module
 *
 * Detects strong multi-bar trends using Correct Order of Moving Averages (COMA)
 * on the High Frame. Confirms trend stability and direction with configurable bar count.
 *
 * COMA Algorithm:
 * - Uptrend: EMA(8) > EMA(21) > EMA(50) for ≥N consecutive bars
 * - Downtrend: EMA(8) < EMA(21) < EMA(50) for ≥N consecutive bars
 * - Requires configurable minimum consecutive bars (default: 30)
 *
 * @module src/indicators/trend-detector
 */

export class TrendDetector {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.requiredComaBarCount = config?.geckoPattern?.comaBarRequired || 30;
  }

  /**
   * Detect trend on High Frame using COMA algorithm
   * Analyzes EMA alignment to determine trend direction and strength
   *
   * @param {string} symbol - Trading symbol
   * @param {Array} hfData - High Frame OHLCV data with indicators
   * @returns {Promise<Object>} Trend analysis result with direction and confidence
   */
  async detectTrend(symbol, hfData) {
    this.logger.debug(`Detecting trend for ${symbol}, bars: ${hfData?.length || 0}`);

    const result = {
      symbol,
      confirmed: false,
      direction: null, // 'UP', 'DOWN', or null
      barsInCOMA: 0,
      requiredBars: this.requiredComaBarCount,
      currentBar: null,
      latestEMA: {
        ema8: null,
        ema21: null,
        ema50: null,
      },
      trend: {
        strength: 0, // 0-1 where 1 = maximum consecutive bars
        percentageStrength: 0, // percentage of data in COMA
      },
    };

    // Validate input
    if (!hfData || hfData.length < this.requiredComaBarCount) {
      this.logger.warn(
        `Insufficient data for trend detection: ${hfData?.length || 0} bars, need ${this.requiredComaBarCount}`
      );
      return result;
    }

    // Perform COMA check
    const comaResult = this.checkCOMA(hfData);

    if (comaResult.isValid && comaResult.consecutiveBars >= this.requiredComaBarCount) {
      result.confirmed = true;
      result.direction = comaResult.direction;
      result.barsInCOMA = comaResult.consecutiveBars;
      result.trend.strength = Math.min(1, comaResult.consecutiveBars / (this.requiredComaBarCount * 2));
      result.trend.percentageStrength = (comaResult.consecutiveBars / hfData.length) * 100;
    }

    // Extract latest EMA values from most recent bar
    const latestBar = hfData[hfData.length - 1];
    if (latestBar && latestBar.indicators) {
      result.currentBar = {
        time: latestBar.time,
        close: latestBar.close,
        high: latestBar.high,
        low: latestBar.low,
      };
      result.latestEMA = {
        ema8: latestBar.indicators.ema_8,
        ema21: latestBar.indicators.ema_21,
        ema50: latestBar.indicators.ema_50,
      };
    }

    this.logger.debug(
      `Trend detection complete for ${symbol}: ${result.direction}, bars: ${result.barsInCOMA}/${this.requiredComaBarCount}`
    );

    return result;
  }

  /**
   * Check COMA (Correct Order of Moving Averages) across consecutive bars
   * Scans from the most recent bar backwards to find longest COMA streak
   *
   * COMA Criteria:
   * - Uptrend: EMA8 > EMA21 > EMA50
   * - Downtrend: EMA8 < EMA21 < EMA50
   *
   * @param {Array} hfData - High Frame OHLCV data with indicators
   * @returns {Object} COMA validation result
   */
  checkCOMA(hfData) {
    const result = {
      isValid: false,
      direction: null, // 'UP' or 'DOWN'
      consecutiveBars: 0,
      validationDetails: {
        uptrends: 0,
        downtrends: 0,
        mixed: 0,
        incomplete: 0,
      },
    };

    if (!hfData || hfData.length === 0) {
      return result;
    }

    // Work backwards from most recent bar to find longest COMA streak
    let currentStreak = 0;
    let streakDirection = null;
    let maxStreak = 0;
    let maxStreakDirection = null;

    for (let i = hfData.length - 1; i >= 0; i--) {
      const bar = hfData[i];

      // Check if bar has required indicators
      if (!bar.indicators || !bar.indicators.ema_8 || !bar.indicators.ema_21 || !bar.indicators.ema_50) {
        result.validationDetails.incomplete++;
        // Reset streak on incomplete data
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
          maxStreakDirection = streakDirection;
        }
        currentStreak = 0;
        streakDirection = null;
        continue;
      }

      const ema8 = bar.indicators.ema_8;
      const ema21 = bar.indicators.ema_21;
      const ema50 = bar.indicators.ema_50;

      // Determine COMA direction for this bar
      let barDirection = null;
      if (ema8 > ema21 && ema21 > ema50) {
        barDirection = 'UP';
        result.validationDetails.uptrends++;
      } else if (ema8 < ema21 && ema21 < ema50) {
        barDirection = 'DOWN';
        result.validationDetails.downtrends++;
      } else {
        result.validationDetails.mixed++;
        // Reset streak on direction mismatch
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
          maxStreakDirection = streakDirection;
        }
        currentStreak = 0;
        streakDirection = null;
        continue;
      }

      // Check if we're continuing the same direction
      if (streakDirection === null) {
        // Start new streak
        streakDirection = barDirection;
        currentStreak = 1;
      } else if (streakDirection === barDirection) {
        // Continue streak
        currentStreak++;
      } else {
        // Direction changed, save max and reset
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
          maxStreakDirection = streakDirection;
        }
        streakDirection = barDirection;
        currentStreak = 1;
      }
    }

    // Check final streak
    if (currentStreak > maxStreak) {
      maxStreak = currentStreak;
      maxStreakDirection = streakDirection;
    }

    // Set results
    result.consecutiveBars = maxStreak;
    result.direction = maxStreakDirection;
    result.isValid = maxStreak > 0 && maxStreakDirection !== null;

    return result;
  }

  /**
   * Get trend strength description
   *
   * @param {number} strength - Strength value (0-1)
   * @returns {string} Strength description
   */
  getStrengthDescription(strength) {
    if (strength >= 0.9) return 'VERY_STRONG';
    if (strength >= 0.7) return 'STRONG';
    if (strength >= 0.5) return 'MODERATE';
    if (strength >= 0.3) return 'WEAK';
    return 'VERY_WEAK';
  }

  /**
   * Validate trend persistence
   * Checks if trend has maintained COMA alignment for minimum bars
   *
   * @param {Object} trendData - Trend detection result from detectTrend()
   * @returns {boolean} True if trend meets minimum bar requirement
   */
  isTrendConfirmed(trendData) {
    return (
      trendData &&
      trendData.confirmed &&
      trendData.barsInCOMA >= this.requiredComaBarCount
    );
  }

  /**
   * Calculate EMA alignment gradient
   * Shows how strongly EMAs are aligned (slope)
   *
   * @param {Array} hfData - High Frame data (last N bars)
   * @param {number} lookbackPeriod - Number of bars to analyze
   * @returns {Object} Gradient analysis
   */
  analyzeEMAGradient(hfData, lookbackPeriod = 10) {
    const gradient = {
      ema8Slope: 0,
      ema21Slope: 0,
      ema50Slope: 0,
      alignmentTightness: 0, // How close EMAs are to each other (spread)
    };

    if (!hfData || hfData.length < lookbackPeriod) {
      return gradient;
    }

    const recentData = hfData.slice(-lookbackPeriod);

    // Calculate slopes using linear regression
    gradient.ema8Slope = this._calculateSlope(recentData, 'ema_8');
    gradient.ema21Slope = this._calculateSlope(recentData, 'ema_21');
    gradient.ema50Slope = this._calculateSlope(recentData, 'ema_50');

    // Calculate alignment tightness (lower spread = tighter alignment)
    const latestBar = hfData[hfData.length - 1];
    if (latestBar.indicators.ema_8 && latestBar.indicators.ema_21 && latestBar.indicators.ema_50) {
      const ema8 = latestBar.indicators.ema_8;
      const ema21 = latestBar.indicators.ema_21;
      const ema50 = latestBar.indicators.ema_50;
      const avgEMA = (ema8 + ema21 + ema50) / 3;
      const spread = Math.abs(ema8 - ema50);
      gradient.alignmentTightness = spread / avgEMA; // Lower is tighter
    }

    return gradient;
  }

  // ============ PRIVATE METHODS ============

  /**
   * Calculate slope of a series using linear regression
   *
   * @private
   * @param {Array} data - Data points with indicators
   * @param {string} indicatorKey - Indicator key (e.g., 'ema_8')
   * @returns {number} Slope value
   */
  _calculateSlope(data, indicatorKey) {
    if (data.length < 2) return 0;

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    const n = data.length;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = data[i]?.indicators?.[indicatorKey] || 0;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return isFinite(slope) ? slope : 0;
  }
}
