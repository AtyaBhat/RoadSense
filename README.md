1. 
    CREATE TABLE reports(id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), image_url TEXT, 
    raw_detections JSONB, structured_report JSONB, status TEXT DEFAULT 'pending', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

cd "D:\DeepLearningComplete Computer Vision With GenAI-12 Projects\yolo_service"
venv\Scripts\activate
uvicorn main:app --reload --port 8000

cd "D:\DeepLearningComplete Computer Vision With GenAI-12 Projects\agent_service"
venv\Scripts\activate
uvicorn main:app --reload --port 8001