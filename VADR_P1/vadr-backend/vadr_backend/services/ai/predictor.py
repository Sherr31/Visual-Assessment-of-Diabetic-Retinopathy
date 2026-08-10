import numpy as np

from .model_loader import model
from .preprocess import preprocess_image
from .gradcam import generate_gradcam

CLASS_NAMES = [
    "No DR",
    "Mild",
    "Moderate",
    "Severe",
    "Proliferative DR"
]


def predict_retinopathy(image_path):

    image = preprocess_image(image_path)

    predictions = model.predict(image, verbose=0)[0]

    predicted_class = int(np.argmax(predictions))

    confidence = float(predictions[predicted_class])

    gradcam_path = generate_gradcam(image_path)

    probabilities = {
        CLASS_NAMES[i]: round(float(predictions[i]) * 100, 2)
        for i in range(len(CLASS_NAMES))
    }

    return {

    "class_id": predicted_class,

    "prediction": CLASS_NAMES[predicted_class],

    "confidence": round(confidence * 100,2),

    "probabilities": probabilities,

    "gradcam": gradcam_path

}