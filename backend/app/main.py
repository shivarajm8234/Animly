from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import uuid
import os
import asyncio
from dotenv import load_dotenv

# Load env variables from root directory
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

# Import services
from services.pdf_parser import PDFParserService
from services.script_generator import ScriptGeneratorService
from services.audio_generator import AudioGeneratorService
from services.asset_generator import AssetGeneratorService
from services.video_renderer import VideoRendererService

app = FastAPI(title="Animly API", description="AI-Powered 2D Educational Explainer Video Generator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for job statuses (use Redis/DB in prod)
jobs = {}

class JobStatus(BaseModel):
    job_id: str
    status: str
    progress: int
    message: str

class ChatRequest(BaseModel):
    message: str
    context: str = ""
    character: str = "Mr. Newton"

import json
from typing import Optional
from duckduckgo_search import DDGS

class ChatResponse(BaseModel):
    text: str
    audio_base64: str
    whiteboard_content: Optional[str] = None

async def process_pdf_and_generate(job_id: str, file_path: str, api_key: str = None):
    """
    Main orchestration function to run the full video generation pipeline.
    """
    try:
        jobs[job_id] = {"status": "processing", "progress": 10, "message": "Reading pedagogical material..."}
        
        # 1. Parse PDF
        parser = PDFParserService(file_path)
        pdf_data = parser.process()
        
        jobs[job_id] = {"status": "processing", "progress": 30, "message": "Structuring lesson plan with Groq..."}
        
        # 2. Generate
        jobs[job_id]["progress"] = 30
        jobs[job_id]["message"] = "Generating educational script..."
        script_gen = ScriptGeneratorService(api_key=api_key)
        script = await script_gen.generate_script(pdf_data["content"])
        
        # 3. Generate Audio
        audio_gen = AudioGeneratorService()
        # Mock generation speed up
        await asyncio.sleep(0.2)
        
        jobs[job_id] = {"status": "processing", "progress": 70, "message": "Waking up your AI tutor..."}
        
        # 4. Generate Assets
        asset_gen = AssetGeneratorService()
        await asyncio.sleep(0.2)
        
        jobs[job_id] = {"status": "processing", "progress": 90, "message": "Entering the classroom..."}
        
        # 5. Render Video (mocked - will be removed in next refactor)
        renderer = VideoRendererService()
        await asyncio.sleep(0.2)
        
        jobs[job_id] = {"status": "completed", "progress": 100, "message": "Classroom is ready!"}
        
    except Exception as e:
        jobs[job_id] = {"status": "failed", "progress": 0, "message": str(e)}

@app.post("/api/generate", response_model=JobStatus)
async def generate_video(background_tasks: BackgroundTasks, file: UploadFile = File(...), x_groq_api_key: Optional[str] = Header(None)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    job_id = str(uuid.uuid4())
    
    # Save uploaded file temporarily
    upload_dir = "/tmp/animly_uploads"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{job_id}_{file.filename}")
    
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
        
    jobs[job_id] = {"status": "queued", "progress": 0, "message": "Job queued."}
    
    # Add to background tasks
    background_tasks.add_task(process_pdf_and_generate, job_id, file_path, x_groq_api_key)
    
    return {"job_id": job_id, "status": "queued", "progress": 0, "message": "Generation started."}

@app.get("/api/status/{job_id}", response_model=JobStatus)
def check_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_data = jobs[job_id]
    return {
        "job_id": job_id,
        "status": job_data["status"],
        "progress": job_data["progress"],
        "message": job_data["message"]
    }

@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_tutor(request: ChatRequest, x_groq_api_key: Optional[str] = Header(None)):
    try:
        from groq import AsyncGroq
        key_to_use = x_groq_api_key if x_groq_api_key else os.getenv("GROQ_API_KEY")
        client = AsyncGroq(api_key=key_to_use)
        
        # Web Search Integration
        search_results_str = ""
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(request.message, max_results=3))
                if results:
                    search_results_str = "\\nOnline Research Context:\\n" + "\\n".join([f"- {r['title']}: {r['body']}" for r in results])
        except Exception as e:
            print("Web search error:", e)
            
        system_prompt = f"""You are {request.character}, an interactive AI tutor. 
CRITICAL RULES:
1. You MUST strictly stick to the uploaded PDF material (context) provided below. 
2. Do NOT answer questions outside the scope of this material, unless it is a direct comparison to the material. If unrelated, politely decline and steer the conversation back.
3. You MUST reply in JSON format with exactly two fields.

{{
  "text": "Your concise, spoken response to the student.",
  "whiteboard_content": "HTML formatted content to display on the whiteboard. Use TailwindCSS classes for styling (e.g., <h2 class='text-3xl font-extrabold text-slate-900 mb-4'>, <ul class='list-disc pl-5 space-y-3 text-slate-900 font-medium'>). You MUST make all text very dark (use text-slate-900). You MUST include rich elements: HTML <table> for data, Mermaid.js graphs (wrapped in <pre class='mermaid'>) for concepts, and <iframe src='...'> (like YouTube embeds) if there is a relevant video. Graphs and videos ALL should be shown in the whiteboard."
}}

Use the following context if relevant: {request.context[:1000]}
{search_results_str}
"""
        
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message}
            ],
            response_format={"type": "json_object"}
        )
        
        try:
            answer_json = json.loads(response.choices[0].message.content)
            answer_text = answer_json.get("text", "I'm not sure how to answer that.")
            whiteboard_content = answer_json.get("whiteboard_content", "")
        except json.JSONDecodeError:
            answer_text = response.choices[0].message.content
            whiteboard_content = ""
        
        # Generate Audio
        audio_gen = AudioGeneratorService()
        audio_b64 = audio_gen.generate_narration_base64(answer_text)
        
        return ChatResponse(text=answer_text, audio_base64=audio_b64, whiteboard_content=whiteboard_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
