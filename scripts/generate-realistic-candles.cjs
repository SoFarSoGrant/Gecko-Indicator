/**
 * Realistic Candle Data Generator
 *
 * Generates synthetic but realistic OHLCV candle data for historical patterns
 * when live data sources are unavailable (e.g., Binance API restrictions).
 *
 * Uses pattern metadata (entry price, ATR, direction, momentum moves) to
 * generate statistically realistic candles that reflect actual market behavior.
 *
 * Phase 6 Priority 1 Days 2-3 - Gecko ML Indicator Project
 *
 * @module scripts/generate-realistic-candles
 */

/**
 * Generate realistic OHLCV candles for a pattern
 *
 * Algorithm:
 * 1. Start from entry price and work backwards
 * 2. Use ATR to generate realistic price movements
 * 3. Apply trend bias based on pattern direction
 * 4. Add noise and volatility for realism
 * 5. Ensure OHLC relationships (high >= close >= low, etc.)
 *
 * @param {Object} pattern - Historical pattern object
 * @param {String} timeframe - Timeframe (e.g., '5m', '15m', '1h')
 * @param {Number} count - Number of candles to generate
 * @returns {Array<Object>} Array of candle objects
 */
function generateRealisticCandles(pattern, timeframe, count = 500) {
  const { entryPrice, atr, direction, entryTime } = pattern;

  // Calculate timeframe duration in seconds
  const timeframeSeconds = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400
  }[timeframe];

  // Generate candles backwards from entry time
  const candles = [];
  let currentPrice = entryPrice;
  let currentTime = entryTime;

  // Trend bias based on pattern direction
  const trendBias = direction === 'long' ? -1 : 1;  // Reverse (building up to entry)

  // Volatility parameters
  const volatility = atr / entryPrice;  // Normalize ATR to percentage
  const avgBodySize = volatility * 0.3;  // Body size ~30% of ATR
  const avgWickSize = volatility * 0.2;  // Wick size ~20% of ATR

  for (let i = 0; i < count; i++) {
    // Price movement for this candle
    const trendMove = avgBodySize * trendBias * (Math.random() * 0.5 + 0.5);
    const noiseMove = avgBodySize * (Math.random() - 0.5) * 2;
    const totalMove = trendMove + noiseMove;

    // Open and close
    const open = currentPrice;
    const close = open + (open * totalMove);

    // High and low with wicks
    const wickMultiplier = Math.random() * 2 + 0.5;  // 0.5-2.5x avg wick
    const highWick = Math.abs(open * avgWickSize * wickMultiplier);
    const lowWick = Math.abs(open * avgWickSize * wickMultiplier);

    const high = Math.max(open, close) + highWick;
    const low = Math.min(open, close) - lowWick;

    // Volume (random but realistic)
    const baseVolume = 1000000;  // Base volume
    const volumeVariation = Math.random() * 0.5 + 0.75;  // 0.75-1.25x
    const volume = baseVolume * volumeVariation;

    candles.unshift({
      timestamp: (currentTime - (i * timeframeSeconds)) * 1000,  // Convert to ms
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: parseFloat(volume.toFixed(2))
    });

    // Update current price for next candle
    currentPrice = close;

    // Add mean reversion (prevent drift too far from entry)
    const drift = (currentPrice - entryPrice) / entryPrice;
    if (Math.abs(drift) > volatility * 3) {
      currentPrice = entryPrice + (entryPrice * volatility * 3 * Math.sign(drift));
    }
  }

  return candles;
}

/**
 * Generate candles with embedded pattern stages
 *
 * Uses actual pattern stage data to ensure realistic progression:
 * - Momentum move
 * - Consolidation
 * - Test bar
 * - Hook
 * - Re-entry
 *
 * @param {Object} pattern - Historical pattern object
 * @param {String} timeframe - Timeframe
 * @param {Number} count - Number of candles
 * @returns {Array<Object>} Array of candles with pattern embedded
 */
function generateCandlesWithPattern(pattern, timeframe, count = 500) {
  const candles = generateRealisticCandles(pattern, timeframe, count);

  // Embed pattern stages in the last ~150 candles (typical pattern length)
  const patternStartIndex = Math.max(count - 150, 0);

  // Stage 1: Momentum Move
  if (pattern.stage1_momentumMove) {
    const { startIndex, endIndex, high, low } = pattern.stage1_momentumMove;
    const stageLength = endIndex - startIndex;

    for (let i = 0; i < stageLength && patternStartIndex + i < candles.length; i++) {
      const candle = candles[patternStartIndex + startIndex + i];
      const progress = i / stageLength;

      // Interpolate price between low and high
      const targetPrice = low + (high - low) * progress;
      const adjustment = targetPrice / candle.close;

      candle.open *= adjustment;
      candle.high *= adjustment;
      candle.low *= adjustment;
      candle.close *= adjustment;
    }
  }

  // Stage 2: Consolidation
  if (pattern.stage2_consolidation) {
    const { startIndex, endIndex, base } = pattern.stage2_consolidation;
    const stageLength = endIndex - startIndex;
    const atr = pattern.atr;

    for (let i = 0; i < stageLength && patternStartIndex + i < candles.length; i++) {
      const candle = candles[patternStartIndex + startIndex + i];

      // Consolidate around base price
      const noise = (Math.random() - 0.5) * atr * 0.3;
      const targetClose = base + noise;
      const adjustment = targetClose / candle.close;

      candle.open *= adjustment;
      candle.high = Math.max(candle.open, targetClose) + (atr * 0.1 * Math.random());
      candle.low = Math.min(candle.open, targetClose) - (atr * 0.1 * Math.random());
      candle.close = targetClose;
    }
  }

  // Stage 3: Test Bar
  if (pattern.stage3_testBar) {
    const { index, high, low, close } = pattern.stage3_testBar;

    if (patternStartIndex + index < candles.length) {
      const candle = candles[patternStartIndex + index];
      candle.high = high;
      candle.low = low;
      candle.close = close;
      candle.open = (high + low) / 2;
    }
  }

  // Stage 4: Hook (FTH - Failed Test High/Low)
  if (pattern.stage4_hook) {
    const { index, swingExtreme } = pattern.stage4_hook;

    if (patternStartIndex + index < candles.length) {
      const candle = candles[patternStartIndex + index];
      const atr = pattern.atr;

      if (pattern.direction === 'long') {
        candle.low = swingExtreme;
        candle.high = swingExtreme + atr * 0.5;
        candle.close = swingExtreme + atr * 0.3;
      } else {
        candle.high = swingExtreme;
        candle.low = swingExtreme - atr * 0.5;
        candle.close = swingExtreme - atr * 0.3;
      }

      candle.open = (candle.high + candle.low) / 2;
    }
  }

  // Stage 5: Re-entry
  if (pattern.stage5_reentry) {
    const { index } = pattern.stage5_reentry;

    if (patternStartIndex + index < candles.length) {
      const candle = candles[patternStartIndex + index];
      const entryPrice = pattern.entryPrice;
      const atr = pattern.atr;

      if (pattern.direction === 'long') {
        candle.close = entryPrice;
        candle.open = entryPrice - atr * 0.2;
        candle.high = entryPrice + atr * 0.1;
        candle.low = entryPrice - atr * 0.3;
      } else {
        candle.close = entryPrice;
        candle.open = entryPrice + atr * 0.2;
        candle.low = entryPrice - atr * 0.1;
        candle.high = entryPrice + atr * 0.3;
      }
    }
  }

  return candles;
}

module.exports = {
  generateRealisticCandles,
  generateCandlesWithPattern
};
