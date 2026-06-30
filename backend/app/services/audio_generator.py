import os
import base64
from io import BytesIO
from gtts import gTTS

class AudioGeneratorService:
    def __init__(self):
        pass
        
    def generate_narration(self, text: str, output_path: str) -> str:
        """
        Converts text to speech using gTTS and saves it to an audio file.
        Returns the path to the saved file.
        """
        try:
            tts = gTTS(text=text, lang='en', tld='co.in', slow=False)
            tts.save(output_path)
            return output_path
        except Exception as e:
            raise Exception(f"Failed to generate audio using gTTS: {e}")

    def generate_narration_base64(self, text: str) -> str:
        """
        Converts text to speech using gTTS and returns the base64 string directly.
        """
        try:
            tts = gTTS(text=text, lang='en', tld='co.in', slow=False)
            fp = BytesIO()
            tts.write_to_fp(fp)
            fp.seek(0)
            audio_bytes = fp.read()
            return base64.b64encode(audio_bytes).decode('utf-8')
        except Exception as e:
            raise Exception(f"Failed to generate base64 audio using gTTS: {e}")


    def generate_visemes(self, audio_file_path: str) -> List[Dict[str, float]]:
        """
        Analyzes the generated audio file to produce visemes for lip-syncing.
        In a production environment, you would use a tool like Rhubarb Lip Sync 
        (invoked via subprocess) or a wav2vec2 model to extract timings.
        """
        # Placeholder for viseme generation logic
        return [
            {"time": 0.0, "value": "X"}, # Idle
            {"time": 0.1, "value": "A"},
            {"time": 0.3, "value": "B"},
            {"time": 0.5, "value": "X"}
        ]
