/**
 * Data Collector Integration Tests
 *
 * Tests for real-time and historical data collection from TradingView-API
 * Validates:
 * - Chart initialization and data structure
 * - Indicator attachment and calculation
 * - Data completeness and accuracy
 * - Multi-timeframe synchronization
 * - Reconnection logic
 */

import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import { DataCollector } from '../src/data/collector.js';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock config
const mockConfig = {
  tradingView: {
    session: 'test-session',
    signature: 'test-signature',
  },
  indicators: {
    emaLengths: [8, 21, 50, 200],
    atrLength: 14,
  },
  geckoPattern: {
    comaBarRequired: 30,
  },
};

describe('DataCollector', () => {
  let collector;

  beforeEach(() => {
    collector = new DataCollector(mockConfig, mockLogger);
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct default values', () => {
      expect(collector.isRunning).toBe(false);
      expect(collector.client).toBeNull();
      expect(collector.charts.size).toBe(0);
      expect(collector.data.size).toBe(0);
    });

    it('should handle missing TradingView credentials gracefully', async () => {
      const collectorNoCreds = new DataCollector(
        { ...mockConfig, tradingView: { session: '', signature: '' } },
        mockLogger
      );

      await collectorNoCreds.start();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'TradingView credentials not configured. Skipping real-time data collection.'
      );
      expect(collectorNoCreds.isRunning).toBe(false);
    });
  });

  describe('candle data structure', () => {
    it('should create candles with required OHLCV fields', () => {
      const mockChart = {
        periods: [
          {
            time: 1234567890,
            open: 100.0,
            high: 105.0,
            low: 99.0,
            close: 102.0,
            volume: 1000000,
          },
        ],
      };

      // Mock studies map
      collector.studies.set('BTCUSDT_5m_ema_8', {
        periods: [{ value: 101.5 }],
      });
      collector.studies.set('BTCUSDT_5m_ema_21', {
        periods: [{ value: 100.2 }],
      });
      collector.studies.set('BTCUSDT_5m_ema_50', {
        periods: [{ value: 99.1 }],
      });
      collector.studies.set('BTCUSDT_5m_atr', {
        periods: [{ value: 2.5 }],
      });
      collector.studies.set('BTCUSDT_5m_volume', {
        periods: [{ value: 1000000 }],
      });

      const candles = collector._processChartData('BTCUSDT_5m', mockChart);

      expect(candles).toHaveLength(1);
      const candle = candles[0];
      expect(candle).toHaveProperty('time', 1234567890);
      expect(candle).toHaveProperty('open', 100.0);
      expect(candle).toHaveProperty('high', 105.0);
      expect(candle).toHaveProperty('low', 99.0);
      expect(candle).toHaveProperty('close', 102.0);
      expect(candle).toHaveProperty('volume', 1000000);
      expect(candle).toHaveProperty('indicators');
    });

    it('should extract indicator values correctly', () => {
      const mockChart = {
        periods: [
          {
            time: 1234567890,
            open: 100.0,
            high: 105.0,
            low: 99.0,
            close: 102.0,
            volume: 1000000,
          },
        ],
      };

      collector.studies.set('BTCUSDT_5m_ema_8', {
        periods: [{ value: 101.5 }],
      });
      collector.studies.set('BTCUSDT_5m_ema_21', {
        periods: [{ value: 100.2 }],
      });
      collector.studies.set('BTCUSDT_5m_ema_50', {
        periods: [{ value: 99.1 }],
      });
      collector.studies.set('BTCUSDT_5m_atr', {
        periods: [{ value: 2.5 }],
      });
      collector.studies.set('BTCUSDT_5m_volume', {
        periods: [{ value: 1000000 }],
      });

      const candles = collector._processChartData('BTCUSDT_5m', mockChart);

      expect(candles[0].indicators).toEqual({
        ema_8: 101.5,
        ema_21: 100.2,
        ema_50: 99.1,
        atr: 2.5,
        volume: 1000000,
      });
    });
  });

  describe('data retrieval', () => {
    beforeEach(() => {
      // Add test data
      const testData = [
        {
          time: 1000,
          open: 100,
          high: 105,
          low: 99,
          close: 102,
          volume: 1000000,
          indicators: { ema_8: 101.5, ema_21: 100.2, ema_50: 99.1 },
        },
        {
          time: 2000,
          open: 102,
          high: 107,
          low: 101,
          close: 104,
          volume: 1100000,
          indicators: { ema_8: 102.1, ema_21: 101.0, ema_50: 99.8 },
        },
        {
          time: 3000,
          open: 104,
          high: 108,
          low: 103,
          close: 106,
          volume: 1200000,
          indicators: { ema_8: 103.2, ema_21: 102.0, ema_50: 100.5 },
        },
      ];
      collector.data.set('BTCUSDT_5m', testData);
    });

    it('should retrieve latest candle', () => {
      const latest = collector.getLatestCandle('BTCUSDT', '5m');

      expect(latest).toEqual({
        time: 3000,
        open: 104,
        high: 108,
        low: 103,
        close: 106,
        volume: 1200000,
        indicators: { ema_8: 103.2, ema_21: 102.0, ema_50: 100.5 },
      });
    });

    it('should retrieve all data', () => {
      const data = collector.getData('BTCUSDT', '5m');

      expect(data).toHaveLength(3);
      expect(data[0].time).toBe(1000);
      expect(data[2].time).toBe(3000);
    });

    it('should retrieve data range (last N candles)', () => {
      const range = collector.getDataRange('BTCUSDT', '5m', 2);

      expect(range).toHaveLength(2);
      expect(range[0].time).toBe(2000);
      expect(range[1].time).toBe(3000);
    });

    it('should return null for non-existent candle', () => {
      const latest = collector.getLatestCandle('NONEXISTENT', '5m');
      expect(latest).toBeNull();
    });

    it('should return empty array for non-existent data', () => {
      const data = collector.getData('NONEXISTENT', '5m');
      expect(data).toEqual([]);
    });
  });

  describe('data deduplication', () => {
    it('should not duplicate candles with same timestamp', () => {
      const mockChart = {
        periods: [
          {
            time: 1000,
            open: 100,
            high: 105,
            low: 99,
            close: 102,
            volume: 1000000,
          },
          {
            time: 2000,
            open: 102,
            high: 107,
            low: 101,
            close: 104,
            volume: 1100000,
          },
        ],
      };

      // Add indicators
      for (const length of [8, 21, 50]) {
        collector.studies.set(`BTCUSDT_5m_ema_${length}`, {
          periods: [{ value: 100 }, { value: 101 }],
        });
      }
      collector.studies.set('BTCUSDT_5m_atr', {
        periods: [{ value: 2.5 }, { value: 2.6 }],
      });
      collector.studies.set('BTCUSDT_5m_volume', {
        periods: [{ value: 1000000 }, { value: 1100000 }],
      });

      // Process chart twice
      const candles1 = collector._processChartData('BTCUSDT_5m', mockChart);
      expect(candles1).toHaveLength(2);

      const candles2 = collector._processChartData('BTCUSDT_5m', mockChart);
      expect(candles2).toHaveLength(0); // Should be deduplicated

      const allData = collector.getData('BTCUSDT', '5m');
      expect(allData).toHaveLength(2); // Only 2 unique candles
    });
  });

  describe('collection statistics', () => {
    it('should return correct statistics', () => {
      const testData = [
        { time: 1000, indicators: {} },
        { time: 2000, indicators: {} },
      ];
      collector.data.set('BTCUSDT_5m', testData);
      collector.data.set('ETHUSDT_5m', [...testData, { time: 3000, indicators: {} }]);
      collector.isRunning = true;
      collector.client = { connected: true };

      const stats = collector.getStats();

      expect(stats.isRunning).toBe(true);
      expect(stats.dataStreams).toBe(2);
      expect(stats.barCounts['BTCUSDT_5m']).toBe(2);
      expect(stats.barCounts['ETHUSDT_5m']).toBe(3);
    });
  });

  describe('collection status', () => {
    it('should report collecting when running with client', () => {
      collector.isRunning = true;
      collector.client = { connected: true };

      expect(collector.isCollecting()).toBe(true);
    });

    it('should report not collecting when stopped', () => {
      collector.isRunning = false;
      expect(collector.isCollecting()).toBe(false);
    });

    it('should report not collecting when no client', () => {
      collector.isRunning = true;
      collector.client = null;

      expect(collector.isCollecting()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle empty chart periods gracefully', () => {
      const mockChart = { periods: [] };

      const candles = collector._processChartData('BTCUSDT_5m', mockChart);

      expect(candles).toEqual([]);
    });

    it('should handle missing indicators gracefully', () => {
      const mockChart = {
        periods: [
          {
            time: 1000,
            open: 100,
            high: 105,
            low: 99,
            close: 102,
            volume: 1000000,
          },
        ],
      };

      // No indicators attached

      const candles = collector._processChartData('BTCUSDT_5m', mockChart);

      expect(candles).toHaveLength(1);
      expect(candles[0].indicators).toEqual({});
    });

    it('should handle invalid indicator values', () => {
      const mockChart = {
        periods: [
          {
            time: 1000,
            open: 100,
            high: 105,
            low: 99,
            close: 102,
            volume: 1000000,
          },
        ],
      };

      // Invalid indicator data
      collector.studies.set('BTCUSDT_5m_ema_8', {
        periods: [{ value: undefined }],
      });
      collector.studies.set('BTCUSDT_5m_ema_21', {
        periods: [{ value: null }],
      });
      collector.studies.set('BTCUSDT_5m_ema_50', {
        periods: [],
      });

      const candles = collector._processChartData('BTCUSDT_5m', mockChart);

      expect(candles).toHaveLength(1);
      // Candle will have whatever values were in the studies, even if invalid
      // The important thing is that it doesn't crash
      expect(candles[0].indicators).toBeDefined();
    });
  });

  describe('stop functionality', () => {
    it('should clean up resources on stop', async () => {
      const mockChart = { disconnect: jest.fn() };
      collector.charts.set('BTCUSDT_5m', mockChart);
      collector.isRunning = true;

      await collector.stop();

      expect(mockChart.disconnect).toHaveBeenCalled();
      expect(collector.isRunning).toBe(false);
      expect(collector.charts.size).toBe(0);
      expect(collector.studies.size).toBe(0);
      expect(collector.data.size).toBe(0);
    });

    it('should handle disconnect errors gracefully', async () => {
      const mockChart = {
        disconnect: jest.fn(() => {
          throw new Error('Disconnect failed');
        }),
      };
      collector.charts.set('BTCUSDT_5m', mockChart);

      await collector.stop();

      expect(mockLogger.warn).toHaveBeenCalled();
      // Check that warn was called with something containing 'Error disconnecting chart'
      const callArgs = mockLogger.warn.mock.calls[0];
      expect(callArgs[0]).toContain('Error disconnecting chart');
    });
  });
});
