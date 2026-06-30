import os
import json
from groq import AsyncGroq
from pydantic import BaseModel, Field
from typing import List, Optional, Union, Any

# Define the structured output we want from the LLM
class WhiteboardAction(BaseModel):
    action_type: str # 'draw_text', 'draw_diagram', 'highlight'
    content: Optional[Union[str, List[str], Any]] = ""
    timing_offset: Optional[float] = 0.0 # when it should happen relative to scene start

class Scene(BaseModel):
    scene_number: Union[int, float]
    narration: str
    character_pose: str # 'explaining', 'thinking', 'pointing_board', 'idle'
    character_emotion: str # 'happy', 'neutral', 'curious'
    camera_movement: str # 'static', 'slow_zoom_in', 'pan_to_board'
    whiteboard_actions: List[WhiteboardAction]
    background: str

class VideoScript(BaseModel):
    title: str
    scenes: List[Scene]

class ScriptGeneratorService:
    def __init__(self, api_key: str = None):
        key = api_key if api_key else os.getenv("GROQ_API_KEY")
        self.client = AsyncGroq(api_key=key)
        
    async def generate_script(self, raw_text: str) -> VideoScript:
        """
        Uses Groq LLM to transform raw PDF text into a structured educational script.
        """
        system_prompt = """
        You are an expert educational animation director. Transform the following text into a 
        2D educational explainer video script. 
        Break the content into logical scenes. Each scene should have narration, character poses, 
        and whiteboard actions. Do not read the text directly, convert it into a natural spoken 
        explanation (student-friendly, step-by-step).

        Respond ONLY in valid JSON matching this schema:
        {
          "title": "Script Title",
          "scenes": [
            {
              "scene_number": 1,
              "narration": "Hello students...",
              "character_pose": "explaining",
              "character_emotion": "happy",
              "camera_movement": "static",
              "background": "classroom",
              "whiteboard_actions": [
                 {"action_type": "draw_text", "content": "Physics 101", "timing_offset": 0.5}
              ]
            }
          ]
        }
        """
        
        try:
            response = await self.client.chat.completions.create(
                model="llama-3.1-8b-instant", # Upgraded to non-deprecated LLaMA 3.1
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Text to convert:\n\n{raw_text[:8000]}"}
                ],
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            return VideoScript.model_validate_json(content)
        except Exception as e:
            raise Exception(f"Failed to generate script using Groq: {e}")
