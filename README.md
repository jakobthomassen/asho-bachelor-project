# ASHO Bachelor Project

ASHO is a [...]

# Setup

This project is structured as a decoupled frontend and backend. The backend is a FastAPI service that exposes a REST API for AI chat functionality. The frontend will consume this API over HTTP.

All backend configuration is environment driven. Secrets such as the OpenAI API key must be provided via environment variables or a local .env file.

#### Local backend setup:

1. Navigate to the backend folder and run `pip install -r requirements.txt`
1. From the backend folder, run: `python -m uvicorn app.main:app --reload --reload-dir app`
   or launch the provided `start_server.bat`
1. The API will be available at: `http://127.0.0.1:8000`
1. Health check: `http://127.0.0.1:8000/health`

#### Local frontend setup:

1. In a terminal navigate to the frontend directory and run: `npm install`
2. In the same directory: `npm run dev`
3. Type `O` + Enter in the terminal or navigate manually to http://localhost:5173/
