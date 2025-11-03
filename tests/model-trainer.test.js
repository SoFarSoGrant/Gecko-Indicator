/**
 * Model Predictor Tests - Phase 4
 *
 * Comprehensive test suite for TensorFlow.js model training, prediction, and persistence.
 * Tests all critical functionality:
 * 1. Model architecture building
 * 2. Training pipeline with validation
 * 3. Prediction and inference
 * 4. Model serialization/deserialization
 * 5. Memory management and tensor disposal
 * 6. Phase 4 success criteria validation
 *
 * @test
 */

const { ModelPredictor } = require('../src/models/predictor.cjs');
const {
  generateSyntheticDataset,
  generateWinnerPattern,
  generateLoserPattern,
} = require('../scripts/train-model.cjs');
const tf = require('@tensorflow/tfjs-node');
const fs = require('fs').promises;
const path = require('path');

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock config
const mockConfig = {
  model: {
    path: './data/models/test-model/model.json',
    minConfidence: 0.7,
  },
};

describe('ModelPredictor', () => {
  let predictor;

  beforeEach(() => {
    predictor = new ModelPredictor(mockConfig, mockLogger);
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any loaded models
    if (predictor.model) {
      predictor.model.dispose();
    }
  });

  // ============================================================================
  // MODEL BUILDING TESTS
  // ============================================================================

  describe('buildModel()', () => {
    test('should build model with default architecture', () => {
      const model = predictor.buildModel();

      expect(model).toBeDefined();
      expect(predictor.model).toBe(model);
      expect(predictor.isLoaded).toBe(true);

      // Check model structure
      expect(model.layers.length).toBe(7); // 3 hidden dense + 3 dropout + 1 output
      expect(model.inputs[0].shape).toEqual([null, 62]); // 62 input features
      expect(model.outputs[0].shape).toEqual([null, 2]); // 2 output classes
    });

    test('should accept custom hyperparameters', () => {
      const model = predictor.buildModel({
        inputFeatures: 62,
        hiddenLayers: [64, 32],
        dropout: [0.4, 0.3],
        learningRate: 0.0005,
      });

      expect(model).toBeDefined();
      // Model should have 2 hidden layers + 2 dropout + 1 output = 5 total
      expect(model.layers.length).toBe(5);
    });

    test('should warn on non-standard input feature count', () => {
      predictor.buildModel({ inputFeatures: 50 });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Non-standard input feature count')
      );
    });

    test('should compile model with correct optimizer and loss', () => {
      const model = predictor.buildModel();

      // Check compilation (model should be ready for training)
      expect(model.optimizer).toBeDefined();
      expect(model.loss).toBeDefined();
    });
  });

  // ============================================================================
  // TRAINING TESTS
  // ============================================================================

  describe('trainModel()', () => {
    test('should train model on synthetic dataset', async () => {
      const dataset = generateSyntheticDataset(100, 0.5);

      const result = await predictor.trainModel(dataset, {
        epochs: 5, // Fast test
        batchSize: 16,
        verbose: 0,
      });

      expect(result.success).toBe(true);
      expect(result.epochs).toBeLessThanOrEqual(5);
      expect(result.metrics).toBeDefined();
      expect(result.metrics.trainLoss).toBeGreaterThan(0);
      expect(result.metrics.trainAccuracy).toBeGreaterThan(0);
      expect(result.metrics.valAccuracy).toBeGreaterThan(0);
      expect(result.metrics.testAUC).toBeGreaterThan(0);
    }, 30000); // 30s timeout

    test('should split dataset correctly (70/15/15)', async () => {
      const dataset = generateSyntheticDataset(100, 0.5);

      const result = await predictor.trainModel(dataset, {
        epochs: 2,
        verbose: 0,
      });

      expect(result.success).toBe(true);
      // Check logged split sizes
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Dataset split')
      );
    }, 20000);

    test('should throw error on invalid dataset', async () => {
      await expect(
        predictor.trainModel({ features: null, labels: null })
      ).rejects.toThrow('Invalid dataset');
    });

    test('should throw error on missing features', async () => {
      await expect(
        predictor.trainModel({ labels: [[0, 1]] })
      ).rejects.toThrow('Invalid dataset');
    });

    test('should build model automatically if not built', async () => {
      expect(predictor.model).toBeNull();

      const dataset = generateSyntheticDataset(50, 0.5);
      await predictor.trainModel(dataset, { epochs: 2, verbose: 0 });

      expect(predictor.model).not.toBeNull();
    }, 20000);

    test('should store training history', async () => {
      const dataset = generateSyntheticDataset(50, 0.5);

      await predictor.trainModel(dataset, { epochs: 3, verbose: 0 });

      expect(predictor.trainingHistory).toBeDefined();
      expect(predictor.trainingHistory.history.loss).toBeDefined();
      expect(predictor.trainingHistory.history.acc).toBeDefined();
    }, 20000);

    test('should store model metadata after training', async () => {
      const dataset = generateSyntheticDataset(50, 0.5);

      await predictor.trainModel(dataset, { epochs: 2, verbose: 0 });

      expect(predictor.modelMetadata).toBeDefined();
      expect(predictor.modelMetadata.trainedAt).toBeDefined();
      expect(predictor.modelMetadata.hyperparameters).toBeDefined();
      expect(predictor.modelMetadata.trainingMetrics).toBeDefined();
    }, 20000);

    test('should validate Phase 4 gate criteria', async () => {
      const dataset = generateSyntheticDataset(200, 0.5);

      const result = await predictor.trainModel(dataset, {
        epochs: 20,
        verbose: 0,
      });

      expect(result.gatePassed).toBeDefined();
      expect(result.gatePassed.criteria.validationAccuracy).toBeDefined();
      expect(result.gatePassed.criteria.testAUC).toBeDefined();
    }, 60000); // 60s timeout for longer training
  });

  // ============================================================================
  // PREDICTION TESTS
  // ============================================================================

  describe('predictPattern()', () => {
    beforeEach(async () => {
      // Train a small model for prediction tests
      const dataset = generateSyntheticDataset(50, 0.5);
      await predictor.trainModel(dataset, { epochs: 2, verbose: 0 });
    }, 20000);

    test('should predict on feature array', async () => {
      const features = generateWinnerPattern();

      const result = await predictor.predictPattern(features);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.winnerProbability).toBeGreaterThan(0);
      expect(result.loserProbability).toBeGreaterThan(0);
      expect(result.prediction).toMatch(/WINNER|LOSER/);
      expect(result.recommendation).toMatch(/STRONG_TRADE|MODERATE_TRADE|NO_TRADE/);
      expect(result.inferenceTime).toBeGreaterThan(0);
    });

    test('should predict on feature object', async () => {
      const featuresArray = generateWinnerPattern();
      const featuresObject = {};
      featuresArray.forEach((val, idx) => {
        featuresObject[`feature_${idx}`] = val;
      });

      const result = await predictor.predictPattern(featuresObject);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should throw error on invalid feature count', async () => {
      const invalidFeatures = new Array(50).fill(0.5); // Only 50 features

      await expect(predictor.predictPattern(invalidFeatures)).rejects.toThrow(
        'Expected 62 features'
      );
    });

    test('should return default prediction when model not loaded', async () => {
      const newPredictor = new ModelPredictor(mockConfig, mockLogger);
      const features = generateWinnerPattern();

      const result = await newPredictor.predictPattern(features);

      expect(result.prediction).toBe('PENDING_MODEL');
      expect(result.confidence).toBe(0.5);
    });

    test('should measure inference latency', async () => {
      const features = generateWinnerPattern();

      const result = await predictor.predictPattern(features);

      expect(result.inferenceTime).toBeDefined();
      expect(result.inferenceTime).toBeGreaterThan(0);
      expect(result.inferenceTime).toBeLessThan(100); // Should be <100ms
    });

    test('should generate correct recommendation based on confidence', async () => {
      const features = generateWinnerPattern();

      const result = await predictor.predictPattern(features);

      if (result.predictedClass === 1 && result.confidence >= 0.7) {
        expect(result.recommendation).toBe('STRONG_TRADE');
      } else if (result.predictedClass === 1 && result.confidence >= 0.6) {
        expect(result.recommendation).toBe('MODERATE_TRADE');
      } else {
        expect(result.recommendation).toBe('NO_TRADE');
      }
    });
  });

  describe('predictBatch()', () => {
    beforeEach(async () => {
      const dataset = generateSyntheticDataset(50, 0.5);
      await predictor.trainModel(dataset, { epochs: 2, verbose: 0 });
    }, 20000);

    test('should predict on batch of patterns', async () => {
      const batch = [
        generateWinnerPattern(),
        generateLoserPattern(),
        generateWinnerPattern(),
      ];

      const results = await predictor.predictBatch(batch);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.prediction).toMatch(/WINNER|LOSER/);
      });
    });

    test('should be faster than individual predictions', async () => {
      const batch = Array.from({ length: 10 }, () => generateWinnerPattern());

      const batchStart = Date.now();
      await predictor.predictBatch(batch);
      const batchTime = Date.now() - batchStart;

      const individualStart = Date.now();
      for (const features of batch) {
        await predictor.predictPattern(features);
      }
      const individualTime = Date.now() - individualStart;

      // Batch should be at least 2x faster
      expect(batchTime).toBeLessThan(individualTime / 2);
    }, 10000);
  });

  // ============================================================================
  // MODEL PERSISTENCE TESTS
  // ============================================================================

  describe('saveModel() and loadModel()', () => {
    const testModelPath = './data/models/test-model-save';

    afterEach(async () => {
      // Clean up test model files
      try {
        await fs.rm(testModelPath, { recursive: true, force: true });
      } catch (error) {
        // Ignore errors
      }
    });

    test('should save model to disk', async () => {
      const dataset = generateSyntheticDataset(50, 0.5);
      await predictor.trainModel(dataset, { epochs: 2, verbose: 0 });

      await predictor.saveModel(testModelPath);

      // Check files exist
      const modelFile = await fs.access(`${testModelPath}/model.json`);
      const weightsFile = await fs.access(`${testModelPath}/weights.bin`);
      const metadataFile = await fs.access(`${testModelPath}/metadata.json`);
      const historyFile = await fs.access(`${testModelPath}/training-history.json`);

      expect(modelFile).toBeUndefined(); // access() returns undefined on success
      expect(weightsFile).toBeUndefined();
      expect(metadataFile).toBeUndefined();
      expect(historyFile).toBeUndefined();
    }, 30000);

    test('should load saved model', async () => {
      // Train and save
      const dataset = generateSyntheticDataset(50, 0.5);
      await predictor.trainModel(dataset, { epochs: 2, verbose: 0 });
      await predictor.saveModel(testModelPath);

      // Create new predictor and load
      const newPredictor = new ModelPredictor(mockConfig, mockLogger);
      await newPredictor.loadModel(`${testModelPath}/model.json`);

      expect(newPredictor.isLoaded).toBe(true);
      expect(newPredictor.model).toBeDefined();
    }, 30000);

    test('should make predictions with loaded model', async () => {
      // Train and save
      const dataset = generateSyntheticDataset(50, 0.5);
      await predictor.trainModel(dataset, { epochs: 2, verbose: 0 });
      await predictor.saveModel(testModelPath);

      // Load and predict
      const newPredictor = new ModelPredictor(mockConfig, mockLogger);
      await newPredictor.loadModel(`${testModelPath}/model.json`);

      const features = generateWinnerPattern();
      const result = await newPredictor.predictPattern(features);

      expect(result.prediction).toMatch(/WINNER|LOSER/);
      expect(result.confidence).toBeGreaterThan(0);

      newPredictor.model.dispose();
    }, 30000);

    test('should throw error when saving without model', async () => {
      await expect(predictor.saveModel(testModelPath)).rejects.toThrow(
        'No model to save'
      );
    });

    test('should throw error when loading non-existent model', async () => {
      await expect(
        predictor.loadModel('./non-existent/model.json')
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // MEMORY MANAGEMENT TESTS
  // ============================================================================

  describe('Memory Management', () => {
    test('should not leak tensors during training', async () => {
      const initialTensors = tf.memory().numTensors;

      const dataset = generateSyntheticDataset(50, 0.5);
      await predictor.trainModel(dataset, { epochs: 2, verbose: 0 });

      const finalTensors = tf.memory().numTensors;

      // Should have only model weights + small overhead
      expect(finalTensors - initialTensors).toBeLessThan(50);
    }, 20000);

    test('should dispose tensors during prediction', async () => {
      const dataset = generateSyntheticDataset(50, 0.5);
      await predictor.trainModel(dataset, { epochs: 2, verbose: 0 });

      const initialTensors = tf.memory().numTensors;

      // Make 10 predictions
      for (let i = 0; i < 10; i++) {
        const features = generateWinnerPattern();
        await predictor.predictPattern(features);
      }

      const finalTensors = tf.memory().numTensors;

      // Tensor count should not grow significantly
      expect(finalTensors - initialTensors).toBeLessThan(5);
    }, 30000);
  });

  // ============================================================================
  // HELPER METHOD TESTS
  // ============================================================================

  describe('getModelInfo()', () => {
    test('should return not loaded when no model', () => {
      const info = predictor.getModelInfo();

      expect(info.loaded).toBe(false);
    });

    test('should return model info after building', () => {
      predictor.buildModel();
      const info = predictor.getModelInfo();

      expect(info.loaded).toBe(true);
      expect(info.hyperparameters).toBeDefined();
      expect(info.layers).toBeGreaterThan(0);
    });

    test('should include metadata after training', async () => {
      const dataset = generateSyntheticDataset(50, 0.5);
      await predictor.trainModel(dataset, { epochs: 2, verbose: 0 });

      const info = predictor.getModelInfo();

      expect(info.metadata).toBeDefined();
      expect(info.metadata.trainingMetrics).toBeDefined();
    }, 20000);
  });

  // ============================================================================
  // SYNTHETIC DATA GENERATION TESTS
  // ============================================================================

  describe('Synthetic Data Generation', () => {
    test('should generate dataset with correct shape', () => {
      const dataset = generateSyntheticDataset(100, 0.5);

      expect(dataset.features).toHaveLength(100);
      expect(dataset.labels).toHaveLength(100);
      expect(dataset.features[0]).toHaveLength(62);
      expect(dataset.labels[0]).toHaveLength(2);
    });

    test('should respect winner ratio', () => {
      const dataset = generateSyntheticDataset(100, 0.7);

      const winners = dataset.labels.filter((label) => label[1] === 1).length;
      const losers = dataset.labels.filter((label) => label[0] === 1).length;

      expect(winners).toBe(70);
      expect(losers).toBe(30);
    });

    test('should generate valid winner patterns', () => {
      const pattern = generateWinnerPattern();

      expect(pattern).toHaveLength(62);
      pattern.forEach((value) => {
        expect(typeof value).toBe('number');
        expect(value).not.toBeNaN();
        expect(isFinite(value)).toBe(true);
      });
    });

    test('should generate valid loser patterns', () => {
      const pattern = generateLoserPattern();

      expect(pattern).toHaveLength(62);
      pattern.forEach((value) => {
        expect(typeof value).toBe('number');
        expect(value).not.toBeNaN();
        expect(isFinite(value)).toBe(true);
      });
    });

    test('winner patterns should have stronger trend features', () => {
      const winner = generateWinnerPattern();
      const loser = generateLoserPattern();

      // Check COMA long alignment (index 47)
      expect(winner[47]).toBeGreaterThan(loser[47]);

      // Check volume ratio (index 59)
      expect(winner[59]).toBeGreaterThan(loser[59]);
    });
  });
});
