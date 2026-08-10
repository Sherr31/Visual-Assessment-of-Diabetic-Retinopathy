import os
import tensorflow as tf

# Absolute path to the .keras model
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "diabetic_retinopathy_model.keras")

print("Loading Diabetic Retinopathy model...")

model = tf.keras.models.load_model(MODEL_PATH)  # type: ignore

print("[OK] Model loaded successfully!")