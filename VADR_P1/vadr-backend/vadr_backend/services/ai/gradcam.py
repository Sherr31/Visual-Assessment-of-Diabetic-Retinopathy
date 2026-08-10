import os
import uuid

import numpy as np
import tensorflow as tf

# ── Use the non-interactive Agg backend BEFORE importing pyplot.
# pyplot's default backend (TkAgg) tries to open a GUI window which
# crashes when called from a Flask request thread (non-main thread).
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from .model_loader import model
from .preprocess import preprocess_image

# Absolute path to the project root (vadr-backend/) so the output folder
# is always resolved correctly regardless of Flask's internal root_path.
_PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)


def generate_gradcam(image_path, output_folder="uploads/gradcam"):

    # Resolve output folder to an absolute path under the project root
    abs_output_folder = os.path.join(_PROJECT_ROOT, output_folder)
    os.makedirs(abs_output_folder, exist_ok=True)

    # Load image
    image = preprocess_image(image_path)[0]

    prediction = model.predict(image[np.newaxis], verbose=0)[0]

    class_index = int(np.argmax(prediction))

    confidence = float(np.max(prediction))

    # Input-gradient visualization
    inp = tf.convert_to_tensor(image[np.newaxis], dtype=tf.float32)

    with tf.GradientTape() as tape:
        tape.watch(inp)
        preds = model(inp)
        loss = preds[:, class_index]

    grads = tape.gradient(loss, inp)

    grads = tf.abs(grads)

    heatmap = tf.reduce_mean(grads, axis=-1)[0].numpy()

    heatmap = (
        heatmap - heatmap.min()
    ) / (
        heatmap.max() - heatmap.min() + 1e-8
    )

    # Save overlay
    filename = f"{uuid.uuid4().hex}.png"

    save_path = os.path.join(abs_output_folder, filename)

    fig, ax = plt.subplots(figsize=(6, 6))
    ax.imshow(image)
    ax.imshow(heatmap, cmap="jet", alpha=0.45)
    ax.axis("off")
    fig.savefig(save_path, bbox_inches="tight", pad_inches=0)
    plt.close(fig)

    # Return a normalised relative path (forward slashes) for the frontend
    return f"uploads/gradcam/{filename}"