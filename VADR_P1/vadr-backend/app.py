"""VADR API entry point."""

from vadr_backend import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=False, port=5000)
