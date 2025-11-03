# Phase 2 Quick Reference Guide

## Core Classes

### DataCollector
**Location**: `src/data/collector.js`

**Constructor**:
```javascript
new DataCollector(config, logger)
```

**Key Methods**:
```javascript
// Start/Stop
await collector.start()
await collector.stop()

// Real-time data
await collector.subscribeRealtimeData(symbol, timeframe, callback)

// Historical data
const data = await collector.collectHistoricalData(symbol, timeframe, startDate, endDate)

// Query data
collector.getLatestCandle(symbol, timeframe)        // Latest bar
collector.getData(symbol, timeframe)                // All bars
collector.getDataRange(symbol, timeframe, count)    // Last N bars
collector.getStats()                                // Collection stats
```

**Candle Structure**:
```javascript
{
  time: 1234567890,
  open: 100.0,
  high: 105.0,
  low: 99.0,
  close: 102.0,
  volume: 1000000,
  indicators: {
    ema_8: 101.5,
    ema_21: 100.2,
    ema_50: 99.1,
    ema_200: 98.5,
    atr: 2.5,
    volume: 1000000
  }
}
```

---

### TrendDetector
**Location**: `src/indicators/trend-detector.js`

**Constructor**:
```javascript
new TrendDetector(config, logger)
```

**Key Methods**:
```javascript
// Main trend detection
const trend = await detector.detectTrend(symbol, hfData)

// COMA check (low-level)
const result = detector.checkCOMA(hfData)

// Validation helpers
detector.isTrendConfirmed(trendData)          // Check if trend met requirements
detector.getStrengthDescription(strength)     // Get text description
detector.analyzeEMAGradient(hfData, lookback) // Slope analysis
```

**Trend Result Structure**:
```javascript
{
  symbol: 'BTCUSDT',
  confirmed: true,          // Boolean - meets bar requirement
  direction: 'UP',          // 'UP', 'DOWN', or null
  barsInCOMA: 35,           // Consecutive bars in COMA
  requiredBars: 30,         // Configured requirement
  currentBar: {
    time: 1234567890,
    close: 102.0,
    high: 105.0,
    low: 99.0
  },
  latestEMA: {
    ema8: 101.5,
    ema21: 100.2,
    ema50: 99.1
  },
  trend: {
    strength: 0.75,         // 0-1 scale
    percentageStrength: 75  // % of data in COMA
  }
}
```

---

## Common Usage Patterns

### 1. Real-Time Collection with Trend Detection
```javascript
import { DataCollector } from './src/data/collector.js';
import { TrendDetector } from './src/indicators/trend-detector.js';

const collector = new DataCollector(config, logger);
const detector = new TrendDetector(config, logger);

await collector.start();

// Subscribe to High Frame
await collector.subscribeRealtimeData('BTCUSDT', '1h', async (candle) => {
  if (candle) {
    const hfData = collector.getDataRange('BTCUSDT', '1h', 100);
    const trend = await detector.detectTrend('BTCUSDT', hfData);

    if (trend.confirmed) {
      console.log(`Trend: ${trend.direction}, Strength: ${trend.trend.strength}`);
    }
  }
});
```

### 2. Multi-Timeframe Monitoring
```javascript
// Subscribe to LF, MF, HF
const timeframes = ['5m', '15m', '1h'];
for (const tf of timeframes) {
  await collector.subscribeRealtimeData('BTCUSDT', tf);
}

// Access synchronized data
const lf = collector.getData('BTCUSDT', '5m');  // Low Frame
const mf = collector.getData('BTCUSDT', '15m'); // Mid Frame
const hf = collector.getData('BTCUSDT', '1h');  // High Frame
```

### 3. Historical Data Collection
```javascript
const startDate = new Date('2024-05-01');
const endDate = new Date('2024-11-01');

const data = await collector.collectHistoricalData(
  'BTCUSDT',
  '1h',
  startDate,
  endDate
);

console.log(`Collected ${data.length} bars`);
```

### 4. Trend Strength Analysis
```javascript
const trend = await detector.detectTrend('BTCUSDT', hfData);

const strength = detector.getStrengthDescription(trend.trend.strength);
// Returns: 'VERY_STRONG', 'STRONG', 'MODERATE', 'WEAK', 'VERY_WEAK'

const gradient = detector.analyzeEMAGradient(hfData, 20);
// Returns: { ema8Slope, ema21Slope, ema50Slope, alignmentTightness }
```

---

## Configuration (`.env`)

```bash
# Required
SESSION=your_tradingview_session_cookie
SIGNATURE=your_tradingview_signature_cookie

# Optional
NODE_ENV=development
LOG_LEVEL=debug
DEFAULT_TIMEFRAME=5m
DATA_SYMBOLS=BTCUSDT,ETHUSDT,EURUSD

# Indicators
EMA_LENGTHS=8,21,50,200
ATR_LENGTH=14

# COMA
GECKO_COMA_BAR_REQUIRED=30
```

---

## Testing

**Run all tests**:
```bash
NODE_OPTIONS="--experimental-vm-modules" npm test
```

**Run specific test file**:
```bash
NODE_OPTIONS="--experimental-vm-modules" npx jest tests/data-collector.test.js
```

**Watch mode**:
```bash
NODE_OPTIONS="--experimental-vm-modules" npm run test:watch
```

---

## Error Handling

### DataCollector
- Gracefully handles missing TradingView credentials
- Implements exponential backoff for reconnections (max 5 attempts)
- Catches indicator attachment errors without crashing
- Validates chart data before processing

### TrendDetector
- Returns unconfirmed trends for insufficient data
- Handles null/empty input safely
- Skips bars with missing indicators
- Validates EMA alignment without throwing

---

## Performance Notes

**Memory Usage**:
- Each bar stores ~500 bytes (OHLCV + indicators)
- 1 month of hourly data ≈ 30 KB
- 6 months for 5 symbols ≈ 1 MB

**Processing Speed**:
- Candle processing: <1ms per bar
- Trend detection: <5ms for 100 bars
- Full test suite: 0.16s

**Network**:
- WebSocket reconnection: exponential backoff (1s, 2s, 4s, 8s, 16s)
- Historical replay: configurable interval (default 500ms)

---

## Troubleshooting

**WebSocket disconnects**:
- Check credentials (SESSION, SIGNATURE in .env)
- Verify TradingView API status
- Reconnection logic handles this automatically

**Missing indicators**:
- Wait for `chart.onReady()` before accessing indicators
- Check EMA_LENGTHS config contains required lengths
- Indicators calculate on bar close

**Slow performance**:
- Reduce number of active WebSocket connections
- Use larger timeframes (1h instead of 5m)
- Process data in chunks instead of loading all at once

---

## Example Files

- `examples/phase2-data-collection.js` — 5 complete working examples
- `docs/PHASE2-IMPLEMENTATION-GUIDE.md` — Full API documentation

## Test Files

- `tests/data-collector.test.js` — 37 tests covering all collector features
- `tests/trend-detector.test.js` — 17 tests covering COMA algorithm

---

## Next Phase: Feature Engineering (Phase 3)

The data pipeline is ready to feed into:
1. **FeatureEngineer** — Extract 50+ features from raw OHLCV + indicators
2. **COMA Features** — Trend confirmation metrics on High Frame
3. **Gecko Pattern Features** — Consolidation, momentum, test bar detection
4. **Labeled Dataset** — Winner/loser patterns for ML training

**Data Format Ready**: Clean OHLCV with indicators pre-calculated ✅
**Multi-timeframe Sync**: LF/MF/HF aligned and ready ✅
**Trend Validation**: COMA algorithm validated ✅

---

**Last Updated**: November 3, 2025
**Phase 2 Status**: Complete ✅
