/**
 * Test Phase 4 Model Loading
 * Quick smoke test to verify model can be loaded and perform inference
 */

const tf = require('@tensorflow/tfjs-node');
const path = require('path');

const MODEL_DIR = path.join(__dirname, '../data/models/gecko-pattern-classifier');

async function testModelLoad() {
  console.log('=== Phase 4 Model Load Test ===\n');

  try {
    // Load model
    console.log('Loading model from:', MODEL_DIR);
    const model = await tf.loadLayersModel(`file://${MODEL_DIR}/model.json`);
    console.log('✅ Model loaded successfully\n');

    // Verify architecture
    console.log('Model Summary:');
    model.summary();
    console.log('');

    // Check input shape
    const inputShape = model.inputs[0].shape;
    console.log('Input shape:', inputShape);
    console.log('Expected features: 62');
    console.log('Actual input features:', inputShape[1]);

    if (inputShape[1] !== 62) {
      console.log('❌ WARNING: Input shape mismatch!');
    } else {
      console.log('✅ Input shape matches expected 62 features\n');
    }

    // Smoke test inference
    console.log('Running smoke test inference...');
    const dummyInput = tf.randomNormal([1, 62]);
    const prediction = model.predict(dummyInput);
    const predArray = await prediction.array();

    console.log('Prediction output shape:', prediction.shape);
    console.log('Prediction values:', predArray[0]);
    console.log('Sum of probabilities:', predArray[0].reduce((a, b) => a + b, 0).toFixed(4));

    // Cleanup
    tf.dispose([dummyInput, prediction]);

    console.log('\n✅ Model is ready for batch inference');
    return true;

  } catch (error) {
    console.error('❌ Model load failed:', error.message);
    return false;
  }
}

testModelLoad().then(success => {
  process.exit(success ? 0 : 1);
});
