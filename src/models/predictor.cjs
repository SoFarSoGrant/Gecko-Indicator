/**
 * Model Predictor Module - Phase 4
 *
 * TensorFlow.js-based neural network for binary classification of Gecko patterns.
 * Implements feedforward architecture with 62 input features and binary output.
 *
 * Architecture:
 * - Input: 62 normalized features (0-1 range)
 * - Hidden Layer 1: 128 neurons, ReLU activation, Dropout(0.3)
 * - Hidden Layer 2: 64 neurons, ReLU activation, L2 regularization(0.001), Dropout(0.2)
 * - Hidden Layer 3: 32 neurons, ReLU activation, L2 regularization(0.001), Dropout(0.2)
 * - Output: 2 neurons, Softmax activation (binary classification)
 *
 * Training:
 * - Loss: Binary crossentropy
 * - Optimizer: Adam (learning rate 0.001)
 * - Batch size: 32
 * - Early stopping: patience=15, monitor validation loss
 * - Metrics: accuracy, AUC
 *
 * Success Criteria (Phase 4 Gate):
 * - Validation accuracy ≥ 70%
 * - Test AUC ≥ 0.75
 * - Inference latency < 50ms per prediction
 * - Model serializable and reproducible
 *
 * @module src/models/predictor
 */

const tf = require('@tensorflow/tfjs-node');

class ModelPredictor {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.model = null;
    this.isLoaded = false;
    this.modelMetadata = null;

    // Model hyperparameters (tunable)
    this.hyperparameters = {
      inputFeatures: 62,
      hiddenLayers: [128, 64, 32],
      dropout: [0.3, 0.2, 0.2],
      l2Regularization: 0.001,
      learningRate: 0.001,
      batchSize: 32,
      epochs: 100,
      earlyStoppingPatience: 15,
    };

    // Training history
    this.trainingHistory = null;
  }

  /**
   * Build TensorFlow.js neural network model
   *
   * Creates a sequential feedforward network optimized for Gecko pattern classification.
   * Architecture: 62 inputs → 128 → 64 → 32 → 2 outputs (binary classification)
   *
   * @param {Object} options - Optional architecture overrides
   * @returns {tf.LayersModel} Compiled TensorFlow.js model
   */
  buildModel(options = {}) {
    this.logger.info('Building TensorFlow.js neural network model');

    const {
      inputFeatures = this.hyperparameters.inputFeatures,
      hiddenLayers = this.hyperparameters.hiddenLayers,
      dropout = this.hyperparameters.dropout,
      l2Regularization = this.hyperparameters.l2Regularization,
      learningRate = this.hyperparameters.learningRate,
    } = options;

    // Validate architecture parameters
    if (inputFeatures !== 62) {
      this.logger.warn(
        `Non-standard input feature count: ${inputFeatures} (expected 62)`
      );
    }

    // Create sequential model
    const model = tf.sequential();

    // Add hidden layers dynamically
    hiddenLayers.forEach((units, index) => {
      const layerConfig = {
        units,
        activation: 'relu',
        name: `hidden_layer_${index + 1}`,
      };

      // Add input shape to first layer
      if (index === 0) {
        layerConfig.inputShape = [inputFeatures];
      }

      // Add L2 regularization to layers after the first
      if (index > 0) {
        layerConfig.kernelRegularizer = tf.regularizers.l2({ l2: l2Regularization });
      }

      model.add(tf.layers.dense(layerConfig));

      // Add dropout after each hidden layer
      if (dropout[index] !== undefined) {
        model.add(
          tf.layers.dropout({
            rate: dropout[index],
            name: `dropout_${index + 1}`,
          })
        );
      }
    });

    // Output layer (binary classification with softmax)
    model.add(
      tf.layers.dense({
        units: 2,
        activation: 'softmax',
        name: 'output_layer',
      })
    );

    // Compile model
    model.compile({
      optimizer: tf.train.adam(learningRate),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    this.model = model;
    this.isLoaded = true;

    // Log model summary
    this.logger.info('Model architecture:');
    model.summary();

    return model;
  }

  /**
   * Train model on labeled Gecko pattern data
   *
   * Implements full training pipeline with:
   * - Train/validation/test split (70/15/15)
   * - Batch processing
   * - Early stopping on validation loss
   * - Training metrics logging
   * - Tensor memory cleanup
   *
   * @param {Object} dataset - Dataset with features and labels
   *   Format: {
   *     features: Float32Array or Array of shape [numPatterns, 62],
   *     labels: Uint8Array or Array of shape [numPatterns, 2] (one-hot encoded)
   *   }
   * @param {Object} options - Training options
   * @returns {Promise<Object>} Training results with metrics
   */
  async trainModel(dataset, options = {}) {
    this.logger.info('Starting model training');

    const {
      validationSplit = 0.15,
      testSplit = 0.15,
      batchSize = this.hyperparameters.batchSize,
      epochs = this.hyperparameters.epochs,
      earlyStoppingPatience = this.hyperparameters.earlyStoppingPatience,
      verbose = 1,
    } = options;

    try {
      // Validate dataset
      if (!dataset || !dataset.features || !dataset.labels) {
        throw new Error('Invalid dataset: missing features or labels');
      }

      // Convert to tensors
      const featuresTensor = tf.tensor2d(dataset.features);
      const labelsTensor = tf.tensor2d(dataset.labels);

      this.logger.info(
        `Dataset shape: features=${featuresTensor.shape}, labels=${labelsTensor.shape}`
      );

      // Calculate split indices
      const numSamples = featuresTensor.shape[0];
      const testSize = Math.floor(numSamples * testSplit);
      const valSize = Math.floor(numSamples * validationSplit);
      const trainSize = numSamples - testSize - valSize;

      this.logger.info(
        `Dataset split: train=${trainSize}, validation=${valSize}, test=${testSize}`
      );

      // Split dataset
      const [trainFeatures, valFeatures, testFeatures] = tf.tidy(() => {
        return [
          featuresTensor.slice([0, 0], [trainSize, -1]),
          featuresTensor.slice([trainSize, 0], [valSize, -1]),
          featuresTensor.slice([trainSize + valSize, 0], [testSize, -1]),
        ];
      });

      const [trainLabels, valLabels, testLabels] = tf.tidy(() => {
        return [
          labelsTensor.slice([0, 0], [trainSize, -1]),
          labelsTensor.slice([trainSize, 0], [valSize, -1]),
          labelsTensor.slice([trainSize + valSize, 0], [testSize, -1]),
        ];
      });

      // Build model if not already built
      if (!this.model) {
        this.buildModel();
      }

      // Configure early stopping callback manually
      let bestValLoss = Infinity;
      let patienceCounter = 0;
      let stopTraining = false;

      const callbacks = {
        onEpochEnd: async (epoch, logs) => {
          this.logger.info(
            `Epoch ${epoch + 1}/${epochs} - ` +
              `loss: ${logs.loss.toFixed(4)}, ` +
              `acc: ${logs.acc.toFixed(4)}, ` +
              `val_loss: ${logs.val_loss.toFixed(4)}, ` +
              `val_acc: ${logs.val_acc.toFixed(4)}`
          );

          // Manual early stopping logic
          if (logs.val_loss < bestValLoss) {
            bestValLoss = logs.val_loss;
            patienceCounter = 0;
          } else {
            patienceCounter++;
            if (patienceCounter >= earlyStoppingPatience) {
              this.logger.info(`Early stopping triggered at epoch ${epoch + 1}`);
              stopTraining = true;
              this.model.stopTraining = true;
            }
          }
        },
      };

      // Train model
      this.logger.info('Training started...');
      const history = await this.model.fit(trainFeatures, trainLabels, {
        epochs,
        batchSize,
        validationData: [valFeatures, valLabels],
        callbacks,
        verbose,
      });

      this.trainingHistory = history;

      // Evaluate on test set
      this.logger.info('Evaluating on test set...');
      const testResults = this.model.evaluate(testFeatures, testLabels);

      const testLoss = await testResults[0].data();
      const testAccuracy = await testResults[1].data();

      this.logger.info(
        `Test Results - loss: ${testLoss[0].toFixed(4)}, accuracy: ${testAccuracy[0].toFixed(4)}`
      );

      // Calculate AUC on test set
      const testPredictions = this.model.predict(testFeatures);
      const testAUC = await this._calculateAUC(testLabels, testPredictions);

      this.logger.info(`Test AUC: ${testAUC.toFixed(4)}`);

      // Extract final metrics
      const finalEpoch = history.epoch.length - 1;
      const trainLoss = history.history.loss[finalEpoch];
      const trainAccuracy = history.history.acc[finalEpoch];
      const valLoss = history.history.val_loss[finalEpoch];
      const valAccuracy = history.history.val_acc[finalEpoch];

      // Store model metadata
      this.modelMetadata = {
        trainedAt: new Date().toISOString(),
        hyperparameters: this.hyperparameters,
        trainingMetrics: {
          epochs: history.epoch.length,
          trainLoss,
          trainAccuracy,
          valLoss,
          valAccuracy,
          testLoss: testLoss[0],
          testAccuracy: testAccuracy[0],
          testAUC,
        },
        datasetInfo: {
          totalSamples: numSamples,
          trainSize,
          valSize,
          testSize,
        },
      };

      // Check Phase 4 success criteria
      const gatePassed = this._validatePhase4Gate(
        valAccuracy,
        testAUC,
        testAccuracy[0]
      );

      // Clean up tensors
      tf.dispose([
        featuresTensor,
        labelsTensor,
        trainFeatures,
        valFeatures,
        testFeatures,
        trainLabels,
        valLabels,
        testLabels,
        testResults,
        testPredictions,
      ]);

      this.logger.info('Training complete. Memory cleaned up.');

      return {
        success: true,
        gatePassed,
        epochs: history.epoch.length,
        metrics: this.modelMetadata.trainingMetrics,
        history: {
          loss: history.history.loss,
          acc: history.history.acc,
          val_loss: history.history.val_loss,
          val_acc: history.history.val_acc,
        },
      };
    } catch (error) {
      this.logger.error('Error during model training:', error);
      throw error;
    }
  }

  /**
   * Predict pattern quality from engineered features
   *
   * Runs inference on a single pattern's features and returns prediction.
   * Implements proper tensor disposal to prevent memory leaks.
   *
   * @param {Object|Array} features - Engineered features (62 values)
   *   Can be object with feature names or flat array [62]
   * @returns {Promise<Object>} Prediction result with confidence and recommendation
   */
  async predictPattern(features) {
    if (!this.isLoaded || !this.model) {
      this.logger.warn('Model not loaded, returning default prediction');
      return {
        confidence: 0.5,
        winnerProbability: 0.5,
        loserProbability: 0.5,
        prediction: 'PENDING_MODEL',
        recommendation: 'NO_TRADE',
      };
    }

    try {
      // Convert features to array if object
      let featureArray;
      if (Array.isArray(features)) {
        featureArray = features;
      } else if (typeof features === 'object' && features !== null) {
        // Extract values in consistent order
        featureArray = Object.values(features);
      } else {
        throw new Error('Features must be array or object');
      }

      // Validate feature count
      if (featureArray.length !== this.hyperparameters.inputFeatures) {
        throw new Error(
          `Expected ${this.hyperparameters.inputFeatures} features, got ${featureArray.length}`
        );
      }

      // Measure inference latency
      const startTime = Date.now();

      // Run prediction with tensor cleanup
      const prediction = tf.tidy(() => {
        const inputTensor = tf.tensor2d([featureArray]);
        return this.model.predict(inputTensor);
      });

      const predictionData = await prediction.data();
      const inferenceTime = Date.now() - startTime;

      // Dispose prediction tensor
      prediction.dispose();

      // Extract probabilities [loser_prob, winner_prob]
      const loserProbability = predictionData[0];
      const winnerProbability = predictionData[1];

      // Determine prediction class
      const predictedClass = winnerProbability > loserProbability ? 1 : 0;
      const confidence = Math.max(loserProbability, winnerProbability);

      // Generate recommendation
      const minConfidence = this.config.model.minConfidence || 0.7;
      let recommendation;
      if (predictedClass === 1 && confidence >= minConfidence) {
        recommendation = 'STRONG_TRADE';
      } else if (predictedClass === 1 && confidence >= 0.6) {
        recommendation = 'MODERATE_TRADE';
      } else {
        recommendation = 'NO_TRADE';
      }

      this.logger.debug(
        `Prediction: ${predictedClass === 1 ? 'WINNER' : 'LOSER'} ` +
          `(confidence: ${(confidence * 100).toFixed(1)}%, ` +
          `latency: ${inferenceTime}ms)`
      );

      return {
        confidence,
        winnerProbability,
        loserProbability,
        prediction: predictedClass === 1 ? 'WINNER' : 'LOSER',
        predictedClass,
        recommendation,
        inferenceTime,
      };
    } catch (error) {
      this.logger.error('Error during prediction:', error);
      throw error;
    }
  }

  /**
   * Batch predict on multiple patterns
   *
   * More efficient than individual predictions for large datasets.
   *
   * @param {Array<Array>} featuresArray - Array of feature arrays [[62], [62], ...]
   * @returns {Promise<Array<Object>>} Array of prediction results
   */
  async predictBatch(featuresArray) {
    if (!this.isLoaded || !this.model) {
      throw new Error('Model not loaded');
    }

    try {
      const startTime = Date.now();

      // Run batch prediction
      const predictions = tf.tidy(() => {
        const inputTensor = tf.tensor2d(featuresArray);
        return this.model.predict(inputTensor);
      });

      const predictionsData = await predictions.array();
      const inferenceTime = Date.now() - startTime;

      predictions.dispose();

      // Process each prediction
      const results = predictionsData.map((pred) => {
        const [loserProb, winnerProb] = pred;
        const predictedClass = winnerProb > loserProb ? 1 : 0;
        const confidence = Math.max(loserProb, winnerProb);

        return {
          confidence,
          winnerProbability: winnerProb,
          loserProbability: loserProb,
          prediction: predictedClass === 1 ? 'WINNER' : 'LOSER',
          predictedClass,
        };
      });

      this.logger.info(
        `Batch prediction complete: ${featuresArray.length} patterns in ${inferenceTime}ms ` +
          `(${(inferenceTime / featuresArray.length).toFixed(2)}ms per pattern)`
      );

      return results;
    } catch (error) {
      this.logger.error('Error during batch prediction:', error);
      throw error;
    }
  }

  /**
   * Load trained model from disk
   *
   * @param {string} modelPath - Path to model.json file
   * @returns {Promise<void>}
   */
  async loadModel(modelPath = null) {
    const path = modelPath || this.config.model.path;

    try {
      this.logger.info(`Loading model from ${path}`);

      // Load model
      this.model = await tf.loadLayersModel(`file://${path}`);
      this.isLoaded = true;

      this.logger.info('Model loaded successfully');

      // Try to load metadata if exists
      try {
        const metadataPath = path.replace('model.json', 'metadata.json');
        const fs = require('fs').promises;
        const metadataJson = await fs.readFile(metadataPath, 'utf-8');
        this.modelMetadata = JSON.parse(metadataJson);
        this.logger.info('Model metadata loaded');
      } catch (metaError) {
        this.logger.warn('Could not load model metadata (this is optional)');
      }
    } catch (error) {
      this.logger.error('Error loading model:', error);
      this.isLoaded = false;
      throw error;
    }
  }

  /**
   * Save trained model to disk
   *
   * Saves both model architecture/weights and metadata.
   *
   * @param {string} savePath - Directory path to save model
   * @returns {Promise<void>}
   */
  async saveModel(savePath = null) {
    if (!this.model) {
      throw new Error('No model to save');
    }

    const path = savePath || this.config.model.path.replace('/model.json', '');

    try {
      this.logger.info(`Saving model to ${path}`);

      // Ensure directory exists
      const fs = require('fs').promises;
      const dirPath = require('path').dirname(path + '/model.json');
      await fs.mkdir(dirPath, { recursive: true });

      // Save model
      await this.model.save(`file://${path}`);

      // Save metadata
      if (this.modelMetadata) {
        const metadataPath = `${path}/metadata.json`;
        await fs.writeFile(
          metadataPath,
          JSON.stringify(this.modelMetadata, null, 2)
        );
        this.logger.info('Model metadata saved');
      }

      // Save training history
      if (this.trainingHistory) {
        const historyPath = `${path}/training-history.json`;
        await fs.writeFile(
          historyPath,
          JSON.stringify(this.trainingHistory.history, null, 2)
        );
        this.logger.info('Training history saved');
      }

      this.logger.info('Model saved successfully');
    } catch (error) {
      this.logger.error('Error saving model:', error);
      throw error;
    }
  }

  /**
   * Calculate AUC (Area Under ROC Curve) metric
   *
   * @private
   * @param {tf.Tensor} labels - True labels (one-hot encoded)
   * @param {tf.Tensor} predictions - Predicted probabilities
   * @returns {Promise<number>} AUC score
   */
  async _calculateAUC(labels, predictions) {
    // Extract winner probabilities (class 1)
    const trueLabels = await labels.array();
    const predProbs = await predictions.array();

    // Convert one-hot to binary
    const yTrue = trueLabels.map((label) => label[1]); // Winner = 1
    const yScore = predProbs.map((pred) => pred[1]); // Winner probability

    // Sort by predicted probability
    const sorted = yTrue
      .map((label, idx) => ({ label, score: yScore[idx] }))
      .sort((a, b) => b.score - a.score);

    // Calculate AUC using trapezoidal rule
    let auc = 0;
    let tpCount = 0;
    let fpCount = 0;

    const totalPositive = yTrue.filter((y) => y === 1).length;
    const totalNegative = yTrue.length - totalPositive;

    if (totalPositive === 0 || totalNegative === 0) {
      return 0.5; // Undefined AUC for single-class data
    }

    for (const item of sorted) {
      if (item.label === 1) {
        tpCount++;
      } else {
        fpCount++;
        auc += tpCount / totalPositive;
      }
    }

    auc /= totalNegative;
    return auc;
  }

  /**
   * Validate Phase 4 success criteria
   *
   * @private
   * @param {number} valAccuracy - Validation accuracy
   * @param {number} testAUC - Test set AUC
   * @param {number} testAccuracy - Test set accuracy
   * @returns {Object} Validation results
   */
  _validatePhase4Gate(valAccuracy, testAUC, testAccuracy) {
    const criteria = {
      validationAccuracy: {
        target: 0.7,
        actual: valAccuracy,
        passed: valAccuracy >= 0.7,
      },
      testAUC: {
        target: 0.75,
        actual: testAUC,
        passed: testAUC >= 0.75,
      },
      testAccuracy: {
        actual: testAccuracy,
      },
    };

    const allPassed = criteria.validationAccuracy.passed && criteria.testAUC.passed;

    if (allPassed) {
      this.logger.info('✅ Phase 4 Success Gate: PASSED');
      this.logger.info(
        `  Validation Accuracy: ${(valAccuracy * 100).toFixed(1)}% (target: ≥70%)`
      );
      this.logger.info(`  Test AUC: ${testAUC.toFixed(3)} (target: ≥0.75)`);
    } else {
      this.logger.warn('❌ Phase 4 Success Gate: FAILED');
      if (!criteria.validationAccuracy.passed) {
        this.logger.warn(
          `  Validation Accuracy: ${(valAccuracy * 100).toFixed(1)}% (needs ≥70%)`
        );
      }
      if (!criteria.testAUC.passed) {
        this.logger.warn(`  Test AUC: ${testAUC.toFixed(3)} (needs ≥0.75)`);
      }
    }

    return {
      passed: allPassed,
      criteria,
    };
  }

  /**
   * Get model summary information
   *
   * @returns {Object} Model information
   */
  getModelInfo() {
    if (!this.model) {
      return { loaded: false };
    }

    return {
      loaded: this.isLoaded,
      metadata: this.modelMetadata,
      hyperparameters: this.hyperparameters,
      layers: this.model.layers.length,
      trainable: this.model.trainableWeights.length,
    };
  }
}

module.exports = { ModelPredictor };
