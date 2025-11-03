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
import { TradingView, BuiltInIndicator, BuiltInStudy } from '@mathieuc/tradingview';

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

      // Create chart for symbol/timeframe
      const chart = await this.client.getChart({
        symbol,
        timeframe,
      });

      // Initialize indicators (EMA, ATR)
      await this._attachIndicators(key, chart);

      // Store callback
      if (onUpdate) {
        this.callbacks.set(key, onUpdate);
      }

      // Initialize data array
      if (!this.data.has(key)) {
        this.data.set(key, []);
      }

      // Set up chart ready handler
      chart.onReady(() => {
        this.logger.debug(`Chart ready: ${key}, periods: ${chart.periods.length}`);

        // Load initial data
        this._processChartData(key, chart);

        // Reset reconnect attempts on successful connection
        this.reconnectAttempts.delete(key);
      });

      // Set up chart update handler
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

      // Create chart for symbol/timeframe
      const chart = await this.client.getChart({
        symbol,
        timeframe,
      });

      // Attach indicators
      await this._attachIndicators(key, chart);

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

        chart.onReady(() => {
          clearTimeout(timeout);
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
          high: period.high,
          low: period.low,
          close: period.close,
          volume: period.volume,
          indicators: {},
        };

        // Extract EMA values
        const emaLengths = this.config.indicators.emaLengths;
        for (const length of emaLengths) {
          const studyKey = `${key}_ema_${length}`;
          const study = this.studies.get(studyKey);
          if (study && study.periods && study.periods[i]) {
            candle.indicators[`ema_${length}`] = study.periods[i].value;
          }
        }

        // Extract ATR value
        const atrStudy = this.studies.get(`${key}_atr`);
        if (atrStudy && atrStudy.periods && atrStudy.periods[i]) {
          candle.indicators.atr = atrStudy.periods[i].value;
        }

        // Extract Volume
        const volumeStudy = this.studies.get(`${key}_volume`);
        if (volumeStudy && volumeStudy.periods && volumeStudy.periods[i]) {
          candle.indicators.volume = volumeStudy.periods[i].value;
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
}
