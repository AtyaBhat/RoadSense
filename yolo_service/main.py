from fastapi import FastAPI, UploadFile, File, HTTPException
from PIL import Image
from ultralytics import YOLO
import io
import base64

app = FastAPI()
model = YOLO("model/best.pt")


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    try:    
        image = Image.open(file.file)
        results = model(image)

        detections = []
        for box in results[0].boxes:
            class_id = int(box.cls[0])
            class_name = model.names[class_id]
            confidence = float(box.conf[0])
            bbox = box.xyxy[0].tolist()

            detections.append({
                "class": class_name,
                "confidence": round(confidence, 4),
                "bbox": [round(coord, 2) for coord in bbox]
            })

        # results[0].plot() returns a numpy array (BGR order) with
        # boxes + labels already drawn on it - this is the "annotated" image
        annotated_bgr = results[0].plot()
        annotated_rgb = annotated_bgr[:, :, ::-1]  # BGR -> RGB for PIL
        annotated_image = Image.fromarray(annotated_rgb)

        buffer = io.BytesIO()
        annotated_image.save(buffer, format="JPEG", quality=85)
        annotated_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        return {
            "detections": detections,
            "annotated_image_base64": annotated_base64
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))