/**
 * Data Collector Module
 *
 * Handles real-time and historical data collection from TradingView-API.
 * Supports multi-symbol and multi-timeframe data aggregation with:
 * - Real-time WebSocket streaming for active monitoring
 * - Historical data collection via replay mode for backtesting
 * - Multi-timeframe synchronization (LF, MF, HF)
 * - Automatic reconnection with exponential backoff
 * - Technical indicator integration (EMA, ATR, Volume)
 *
 * @module src/data/collector
 */

// TradingView API - conditionally imported
// In production: requires @mathieuc/tradingview to be installed
// In testing: Uses mock via setupFilesAfterEnv
import pkg from '@mathieuc/tradingview';
const { Client: TradingView, BuiltInIndicator } = pkg;

export class DataCollector {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.isRunning = false;
    this.client = null;
    this.charts = new Map(); // symbol_timeframe -> Chart instance
    this.studies = new Map(); // symbol_timeframe_indicator -> Study instance
    this.data = new Map(); // symbol_timeframe -> Array of OHLCV candles
    this.callbacks = new Map(); // symbol_timeframe -> callback function
    this.reconnectAttempts = new Map(); // symbol_timeframe -> attempt count
    this.maxReconnectAttempts = 5;
    this.baseReconnectDelay = 1000; // 1 second
  }

  /**
   * Initialize TradingView client and start data collection
   */
  async start() {
    try {
      this.logger.info('Starting DataCollector');

      // Validate credentials
      if (!this.config.tradingView.session || !this.config.tradingView.signature) {
        this.logger.warn('TradingView credentials not configured. Skipping real-time data collection.');
        return;
      }

      // Initialize TradingView client
      this.client = new TradingView({
        session: this.config.tradingView.session,
        signature: this.config.tradingView.signature,
      });

      this.isRunning = true;
      this.logger.info('DataCollector started successfully');

    } catch (error) {
      this.logger.error('Failed to start DataCollector:', error);
      throw error;
    }
  }

  /**
   * Stop data collection and close all connections
   */
  async stop() {
    try {
      this.logger.info('Stopping DataCollector');
      this.isRunning = false;

      // Disconnect all charts
      for (const [key, chart] of this.charts) {
        try {
          chart.disconnect();
          this.logger.debug(`Disconnected chart: ${key}`);
        } catch (error) {
          this.logger.warn(`Error disconnecting chart ${key}:`, error.message);
        }
      }

      this.charts.clear();
      this.studies.clear();
      this.callbacks.clear();
      this.reconnectAttempts.clear();

      this.logger.info('DataCollector stopped');
    } catch (error) {
      this.logger.error('Error stopping DataCollector:', error);
    }
  }

  /**
   * Subscribe to real-time data for a symbol and timeframe
   * Establishes WebSocket connection and attaches indicators
   *
   * @param {string} symbol - Trading symbol (e.g., 'BTCUSDT')
   * @param {string} timeframe - Timeframe (e.g., '5m', '1h')
   * @param {Function} onUpdate - Callback when data updates
   * @returns {Promise<void>}
   */
  async subscribeRealtimeData(symbol, timeframe, onUpdate) {
    const key = `${symbol}_${timeframe}`;

    try {
      if (!this.client) {
        this.logger.error('Client not initialized. Call start() first.');
        return;
      }

      this.logger.info(`Subscribing to real-time data: ${key}`);

      // Create chart for symbol/timeframe using correct TradingView-API v3.5.2 interface
      const chart = new this.client.Session.Chart();

      // Convert timeframe format (5m -> 5, 1h -> 60, 1D -> D)
      const tvTimeframe = this._convertTimeframe(timeframe);

      // Set market with proper exchange prefix
      chart.setMarket(`BINANCE:${symbol}`, {
        timeframe: tvTimeframe,
      });

      // Initialize data array
      if (!this.data.has(key)) {
        this.data.set(key, []);
      }

      // Store callback
      if (onUpdate) {
        this.callbacks.set(key, onUpdate);
      }

      // Set up symbol loaded handler (chart is ready)
      chart.onSymbolLoaded(() => {
        this.logger.debug(`Chart ready: ${key}, periods: ${chart.periods.length}`);

        // Attach indicators after symbol is loaded
        this._attachIndicators(key, chart);

        // Load initial data
        this._processChartData(key, chart);

        // Reset reconnect attempts on successful connection
        this.reconnectAttempts.delete(key);
      });

      // Set up chart update handler for new candles
      chart.onUpdate(() => {
        this._processChartData(key, chart);

        // Call user callback if provided
        const callback = this.callbacks.get(key);
        if (callback) {
          const latestCandle = this.getLatestCandle(symbol, timeframe);
          callback(latestCandle);
        }
      });

      // Handle disconnections with reconnection logic
      chart.onError((error) => {
        this.logger.error(`Chart error for ${key}:`, error.message);
        this._handleDisconnection(symbol, timeframe, onUpdate);
      });

      // Store chart reference
      this.charts.set(key, chart);

    } catch (error) {
      this.logger.error(`Failed to subscribe to ${key}:`, error.message);
      this.logger.debug(`Full error:`, error);
      this._handleDisconnection(symbol, timeframe, onUpdate);
    }
  }

  /**
   * Collect historical data for a symbol using replay mode
   * Used for backtesting and training data generation
   *
   * @param {string} symbol - Trading symbol
   * @param {string} timeframe - Timeframe
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Array of OHLCV candles with indicators
   */
  async collectHistoricalData(symbol, timeframe, startDate, endDate) {
    const key = `${symbol}_${timeframe}`;

    try {
      if (!this.client) {
        this.logger.error('Client not initialized. Call start() first.');
        return [];
      }

      this.logger.info(
        `Collecting historical data for ${key}: ${startDate.toISOString()} to ${endDate.toISOString()}`
      );

      // Create chart for symbol/timeframe using correct TradingView-API v3.5.2 interface
      const chart = new this.client.Session.Chart();

      // Convert timeframe format
      const tvTimeframe = this._convertTimeframe(timeframe);

      // Set market with proper exchange prefix
      chart.setMarket(`BINANCE:${symbol}`, {
        timeframe: tvTimeframe,
      });

      // Initialize data array
      const historicalData = [];

      // Set up replay mode
      const replayStartTime = Math.floor(startDate.getTime() / 1000);
      const replayEndTime = Math.floor(endDate.getTime() / 1000);

      // Wait for chart to be ready
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.logger.warn(`Chart ready timeout for ${key}`);
          resolve();
        }, 5000);

        chart.onSymbolLoaded(() => {
          clearTimeout(timeout);
          this._attachIndicators(key, chart);
          resolve();
        });
      });

      // Start replay
      this.logger.debug(`Starting replay for ${key}: ${replayStartTime} to ${replayEndTime}`);
      chart.startReplay(replayStartTime);

      // Collect data during replay
      await new Promise((resolve, reject) => {
        const replayTimeout = setTimeout(() => {
          this.logger.warn(`Replay timeout for ${key}, collected ${historicalData.length} candles`);
          resolve();
        }, 120000); // 2 minute timeout for replay

        let lastReplayTime = replayStartTime;
        const replayInterval = setInterval(async () => {
          try {
            // Process current chart data
            const candles = this._processChartData(key, chart);
            historicalData.push(...candles);

            // Check if we've reached the end date
            if (lastReplayTime >= replayEndTime) {
              clearInterval(replayInterval);
              clearTimeout(replayTimeout);
              chart.stopReplay();
              resolve();
              return;
            }

            // Step forward in time (1 day at a time)
            lastReplayTime = Math.min(lastReplayTime + 86400, replayEndTime);
            chart.replayTo(lastReplayTime);

          } catch (error) {
            this.logger.error(`Error during replay: ${error.message}`);
            clearInterval(replayInterval);
            clearTimeout(replayTimeout);
            reject(error);
          }
        }, 500); // Process every 500ms

      });

      this.logger.info(
        `Historical data collection complete for ${key}: ${historicalData.length} candles`
      );

      // Store in data map
      this.data.set(key, historicalData);

      // Clean up chart
      chart.disconnect();

      return historicalData;

    } catch (error) {
      this.logger.error(`Failed to collect historical data for ${key}:`, error.message);
      return [];
    }
  }

  /**
   * Get latest candle for symbol and timeframe
   *
   * @param {string} symbol - Trading symbol
   * @param {string} timeframe - Timeframe
   * @returns {Object|null} Latest OHLCV candle with indicators, or null if no data
   */
  getLatestCandle(symbol, timeframe) {
    const key = `${symbol}_${timeframe}`;
    const data = this.data.get(key);
    if (data && data.length > 0) {
      return data[data.length - 1];
    }
    return null;
  }

  /**
   * Get all data for symbol and timeframe
   *
   * @param {string} symbol - Trading symbol
   * @param {string} timeframe - Timeframe
   * @returns {Array} Array of OHLCV candles
   */
  getData(symbol, timeframe) {
    const key = `${symbol}_${timeframe}`;
    return this.data.get(key) || [];
  }

  /**
   * Get data range for symbol and timeframe
   *
   * @param {string} symbol - Trading symbol
   * @param {string} timeframe - Timeframe
   * @param {number} count - Number of candles to return
   * @returns {Array} Last N candles
   */
  getDataRange(symbol, timeframe, count) {
    const key = `${symbol}_${timeframe}`;
    const data = this.data.get(key) || [];
    return data.slice(Math.max(0, data.length - count));
  }

  /**
   * Check if data collection is running
   *
   * @returns {boolean} True if collector is running
   */
  isCollecting() {
    return this.isRunning && this.client !== null;
  }

  /**
   * Get collection statistics
   *
   * @returns {Object} Stats object with symbol counts and bar counts
   */
  getStats() {
    const stats = {
      isRunning: this.isRunning,
      chartsActive: this.charts.size,
      dataStreams: this.data.size,
      barCounts: {},
    };

    for (const [key, data] of this.data) {
      stats.barCounts[key] = data.length;
    }

    return stats;
  }

  // ============ PRIVATE METHODS ============

  /**
   * Attach technical indicators (EMA, ATR) to a chart
   *
   * @private
   * @param {string} key - symbol_timeframe key
   * @param {Chart} chart - TradingView chart instance
   */
  async _attachIndicators(key, chart) {
    try {
      // Get EMA lengths from config
      const emaLengths = this.config.indicators.emaLengths;

      // Create EMA indicators
      for (const length of emaLengths) {
        const study = new BuiltInIndicator(
          {
            indicator: 'Moving Average Exponential',
            length: length,
          },
          chart
        );
        this.studies.set(`${key}_ema_${length}`, study);
      }

      // Create ATR indicator
      const atrLength = this.config.indicators.atrLength;
      const atrStudy = new BuiltInIndicator(
        {
          indicator: 'Average True Range',
          length: atrLength,
        },
        chart
      );
      this.studies.set(`${key}_atr`, atrStudy);

      // Create Volume indicator
      const volumeStudy = new BuiltInIndicator(
        {
          indicator: 'Volume',
        },
        chart
      );
      this.studies.set(`${key}_volume`, volumeStudy);

      this.logger.debug(`Indicators attached for ${key}`);

    } catch (error) {
      this.logger.error(`Failed to attach indicators for ${key}:`, error.message);
    }
  }

  /**
   * Process chart data and extract OHLCV with indicators
   *
   * @private
   * @param {string} key - symbol_timeframe key
   * @param {Chart} chart - TradingView chart instance
   * @returns {Array} Processed candles
   */
  _processChartData(key, chart) {
    const processedCandles = [];

    try {
      const periods = chart.periods || [];
      if (periods.length === 0) return processedCandles;

      // Get existing data to avoid duplicates
      const existingData = this.data.get(key) || [];
      const existingTimes = new Set(existingData.map(c => c.time));

      // Build complete historical data including all periods from chart
      let completeHistory = [...existingData];

      // Process each period
      for (let i = 0; i < periods.length; i++) {
        const period = periods[i];

        // Skip if we already have this candle
        if (existingTimes.has(period.time)) {
          continue;
        }

        const candle = {
          time: period.time,
          open: period.open,
          high: period.max,  // TradingView uses 'max' instead of 'high'
          low: period.min,   // TradingView uses 'min' instead of 'low'
          close: period.close,
          volume: period.volume,
          indicators: {},
        };

        // Build incremental history for accurate indicator calculations
        completeHistory.push(candle);

        // Calculate indicators with full historical context
        // Extract EMA values
        const emaLengths = this.config.indicators.emaLengths;
        for (const length of emaLengths) {
          const emaValue = this._calculateEMA(completeHistory, length);
          if (emaValue !== null) {
            candle.indicators[`ema_${length}`] = emaValue;
          }
        }

        // Calculate ATR value
        const atrLength = this.config.indicators.atrLength;
        const atrValue = this._calculateATR(completeHistory, atrLength);
        if (atrValue !== null) {
          candle.indicators.atr = atrValue;
        }

        processedCandles.push(candle);
      }

      // Update stored data
      if (processedCandles.length > 0) {
        const currentData = this.data.get(key) || [];
        currentData.push(...processedCandles);
        this.data.set(key, currentData);
      }

    } catch (error) {
      this.logger.warn(`Error processing chart data for ${key}:`, error.message);
    }

    return processedCandles;
  }

  /**
   * Handle chart disconnection with exponential backoff reconnection
   *
   * @private
   * @param {string} symbol - Trading symbol
   * @param {string} timeframe - Timeframe
   * @param {Function} onUpdate - Callback to reattach
   */
  async _handleDisconnection(symbol, timeframe, onUpdate) {
    const key = `${symbol}_${timeframe}`;
    const attempts = this.reconnectAttempts.get(key) || 0;

    if (attempts >= this.maxReconnectAttempts) {
      this.logger.error(`Max reconnection attempts reached for ${key}`);
      this.reconnectAttempts.delete(key);
      return;
    }

    // Calculate exponential backoff delay
    const delay = this.baseReconnectDelay * Math.pow(2, attempts);

    this.logger.info(`Reconnecting ${key} in ${delay}ms (attempt ${attempts + 1})`);

    this.reconnectAttempts.set(key, attempts + 1);

    setTimeout(() => {
      if (this.isRunning) {
        this.subscribeRealtimeData(symbol, timeframe, onUpdate).catch((error) => {
          this.logger.error(`Reconnection failed for ${key}:`, error.message);
        });
      }
    }, delay);
  }

  /**
   * Calculate Exponential Moving Average (EMA)
   * Formula: EMA = (Close - EMA_prev) * multiplier + EMA_prev
   * Multiplier = 2 / (length + 1)
   *
   * @private
   * @param {Array} candles - Array of candle objects with 'close' property
   * @param {number} length - EMA period (e.g., 8, 21, 50)
   * @returns {number|null} Current EMA value or null if insufficient data
   */
  _calculateEMA(candles, length) {
    if (candles.length < length) {
      return null; // Not enough data for initial SMA calculation
    }

    const multiplier = 2 / (length + 1);
    let ema = null;

    // Calculate SMA for first value
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += candles[i].close;
    }
    ema = sum / length;

    // Calculate EMA for remaining candles
    for (let i = length; i < candles.length; i++) {
      ema = (candles[i].close - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * Calculate Average True Range (ATR)
   * ATR = SMA of True Range over specified period
   * True Range = max(high - low, abs(high - close_prev), abs(low - close_prev))
   *
   * @private
   * @param {Array} candles - Array of candle objects with 'high', 'low', 'close' properties
   * @param {number} length - ATR period (typically 14)
   * @returns {number|null} Current ATR value or null if insufficient data
   */
  _calculateATR(candles, length) {
    if (candles.length < length + 1) {
      return null; // Need at least length+1 candles (one for previous close)
    }

    const trueRanges = [];

    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];

      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);

      const trueRange = Math.max(tr1, tr2, tr3);
      trueRanges.push(trueRange);
    }

    // Calculate SMA of True Range
    if (trueRanges.length < length) {
      return null;
    }

    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += trueRanges[i];
    }
    return sum / length;
  }

  /**
   * Convert timeframe format from common notation to TradingView format
   * 5m → 5, 15m → 15, 1h → 60, 4h → 240, 1D → D, 1W → W, 1M → M
   *
   * @private
   * @param {string} timeframe - Timeframe in standard format (e.g., '5m', '1h')
   * @returns {string} TradingView format (e.g., '5', '60', 'D')
   */
  _convertTimeframe(timeframe) {
    const map = {
      '1m': '1',
      '5m': '5',
      '15m': '15',
      '30m': '30',
      '1h': '60',
      '4h': '240',
      '1D': 'D',
      '1W': 'W',
      '1M': 'M',
    };
    return map[timeframe] || timeframe;
  }
}
