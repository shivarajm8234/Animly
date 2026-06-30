import fitz  # PyMuPDF
import re
from typing import List, Dict

class PDFParserService:
    def __init__(self, file_path: str):
        self.file_path = file_path
    
    def extract_text_and_metadata(self) -> str:
        """
        Extracts semantic text from the PDF, attempting to ignore headers,
        footers, and irrelevant page numbers. Returns the cleaned text.
        """
        doc = fitz.open(self.file_path)
        full_text = []
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            blocks = page.get_text("blocks")
            
            # Sort blocks top-to-bottom
            blocks.sort(key=lambda b: (b[1], b[0]))
            
            for b in blocks:
                text = b[4].strip()
                # Simple heuristics to ignore headers/footers
                # Ignore very short texts that look like page numbers
                if re.match(r'^\d+$', text):
                    continue
                # Optionally filter out repeated headers by comparing across pages (simplified here)
                
                # Append relevant text
                if text:
                    full_text.append(text)
                    
        doc.close()
        return "\n\n".join(full_text)

    def process(self) -> Dict[str, str]:
        """
        High-level function to parse the PDF and prepare it for the LLM.
        """
        raw_text = self.extract_text_and_metadata()
        return {
            "source_file": self.file_path,
            "content": raw_text
        }
