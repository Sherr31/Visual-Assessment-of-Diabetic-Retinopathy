import os

model = None

try:
    import tensorflow as tf

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    MODEL_PATH = os.path.join(BASE_DIR, "diabetic_retinopathy_model.keras")

    print("Loading Diabetic Retinopathy model...")
    if os.path.exists(MODEL_PATH):
        model = tf.keras.models.load_model(MODEL_PATH)  # type: ignore
        print("[OK] Model loaded successfully!")
    else:
        print("[WARNING] Model file not found at path:", MODEL_PATH)
except Exception as exc:
    print(f"[WARNING] TensorFlow model loading bypassed ({exc})")
