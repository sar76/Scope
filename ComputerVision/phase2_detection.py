"""
Phase 2: UI Component Detection and Extraction using OpenAI Vision API

This script analyzes a screenshot and extracts UI components using GPT-4 Omni model,
outputting a JSON file with component details and metadata.
"""

import argparse
import base64
import json
import logging
import sys
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from PIL import Image

# OpenAI SDK imports
import openai
from openai import OpenAI

# Add the parent directory to sys.path to import config
sys.path.append(str(Path(__file__).parent.parent))
from ComputerVision.config import (
    OPENAI_API_KEY, 
    DEFAULT_ANALYSIS_PATH, 
    LOG_LEVEL,
    MODEL_NAME,
    OPENAI_MAX_TOKENS,
    OPENAI_TEMPERATURE,
    OPENAI_RETRY_ATTEMPTS,
    OPENAI_BACKOFF_FACTOR
)

# Import the refinement module
try:
    from ComputerVision.basic_refinement import refine_bounding_boxes
    REFINEMENT_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Refinement module not available: {e}")
    REFINEMENT_AVAILABLE = False

logger = logging.getLogger(__name__)
logging.basicConfig(level=LOG_LEVEL, format='%(asctime)s - %(levelname)s - %(message)s')

@dataclass
class UIComponent:
    name: str
    text: str
    x: int
    y: int
    width: int
    height: int
    component_type: str
    confidence: float

    def to_dict(self) -> Dict[str, Any]:
        base = asdict(self)
        base["bounding_box"] = [self.x, self.y, self.width, self.height]
        base["coordinates"] = {"x": self.x, "y": self.y, "width": self.width, "height": self.height}
        return base

class UIAnalyzer:
    """
    Analyzer for detecting UI components in a screenshot via OpenAI's GPT-4 Omni model.
    """
    def __init__(self, model: str = MODEL_NAME, temperature: float = OPENAI_TEMPERATURE, max_tokens: int = OPENAI_MAX_TOKENS) -> None:
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.system_prompt_template = (
            "You are an expert UI/UX analyst specializing in computer vision and interface analysis.\n"
            "Your task is to identify and extract all UI components from a screenshot with maximum accuracy.\n\n"
            "CRITICAL REQUIREMENTS:\n"
            "1. Screenshot dimensions: {width}x{height} pixels\n"
            "2. Coordinate system: (0,0) is at top-left corner, x increases right, y increases down\n"
            "3. All coordinates MUST be within bounds: 0 ≤ x < {width}, 0 ≤ y < {height}\n"
            "4. All dimensions MUST be positive: width > 0, height > 0\n"
            "5. Bounding boxes MUST fit within image: x + width ≤ {width}, y + height ≤ {height}\n\n"
            "Return a JSON array of objects with these EXACT fields:\n"
            "- name: descriptive name of the component\n"
            "- text: visible text content (empty string if no text)\n"
            "- x: left edge coordinate (integer, 0-{width_max})\n"
            "- y: top edge coordinate (integer, 0-{height_max})\n"
            "- width: component width in pixels (integer > 0)\n"
            "- height: component height in pixels (integer > 0)\n"
            "- component_type: one of [button, link, input, image, text, icon, menu, header, footer, navigation, form, table, list, unknown]\n"
            "- confidence: confidence score 0.0-1.0 (float)\n\n"
            "IMPORTANT: Validate all coordinates before returning. If any component would extend beyond image bounds, adjust coordinates to fit within the image."
        )
        
        # Initialize OpenAI client with API key
        if not OPENAI_API_KEY:
            logger.error("OPENAI_API_KEY not set in environment.")
            raise RuntimeError("OPENAI_API_KEY not set.")
        
        self.client = OpenAI(api_key=OPENAI_API_KEY)
        self.full_response: Optional[str] = None

    def _encode_image(self, path: Path) -> str:
        """Encode image to base64 for API transmission."""
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode()

    def _parse_json(self, text: str) -> List[Dict[str, Any]]:
        """Parse JSON response with fallback regex extraction."""
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            import re
            match = re.search(r"\[.*\]", text, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            logger.error("Failed to parse JSON from response.")
            raise

    def _validate_and_fix_coordinates(self, data: Dict[str, Any], image_width: int, image_height: int) -> Dict[str, Any]:
        """Validate and fix coordinates to ensure they are within image bounds."""
        x = int(data.get("x", 0))
        y = int(data.get("y", 0))
        width = int(data.get("width", 0))
        height = int(data.get("height", 0))
        
        # Fix coordinates to be within bounds
        x = max(0, min(x, image_width - 1))
        y = max(0, min(y, image_height - 1))
        width = max(1, min(width, image_width - x))
        height = max(1, min(height, image_height - y))
        
        # Update data with validated coordinates
        data["x"] = x
        data["y"] = y
        data["width"] = width
        data["height"] = height
        
        return data

    def _to_component(self, data: Dict[str, Any], image_width: int, image_height: int) -> UIComponent:
        """Convert validated data to UIComponent."""
        # Validate coordinates before creating component
        validated_data = self._validate_and_fix_coordinates(data, image_width, image_height)
        
        return UIComponent(
            name=validated_data.get("name", ""),
            text=validated_data.get("text", ""),
            x=validated_data["x"],
            y=validated_data["y"],
            width=validated_data["width"],
            height=validated_data["height"],
            component_type=validated_data.get("component_type", "unknown"),
            confidence=float(validated_data.get("confidence", 0.0))
        )

    def extract_components(
        self, image_path: Path, retries: int = OPENAI_RETRY_ATTEMPTS, backoff: float = OPENAI_BACKOFF_FACTOR
    ) -> List[UIComponent]:
        """
        Extract UI components from image with retry logic and exponential backoff.
        
        Args:
            image_path: Path to the screenshot image
            retries: Maximum number of retry attempts
            backoff: Exponential backoff factor
            
        Returns:
            List of UIComponent objects
            
        Raises:
            RuntimeError: If all retries are exhausted
        """
        if not image_path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        # Get dimensions
        with Image.open(image_path) as img:
            width, height = img.size
            logger.info(f"Image dimensions: {width}x{height} pixels")

        # Prepare prompts with proper coordinate bounds
        system_prompt = self.system_prompt_template.format(
            width=width, 
            height=height,
            width_max=width-1,
            height_max=height-1
        )
        
        b64_img = self._encode_image(image_path)
        
        # Prepare messages for the new OpenAI API format
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user", 
                "content": [
                    {"type": "text", "text": "Analyze this screenshot and extract all UI components with precise coordinates. Ensure all bounding boxes are within the image bounds."},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_img}"}}
                ]
            }
        ]

        for attempt in range(1, retries + 1):
            try:
                logger.info(f"Analysis request (attempt {attempt}/{retries})")
                
                # Use the new OpenAI API format
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=self.temperature,
                    max_tokens=self.max_tokens
                )
                
                raw = response.choices[0].message.content
                self.full_response = raw
                logger.debug(f"Raw response: {raw}")
                
                if not raw:
                    raise ValueError("Empty response from API")
                
                items = self._parse_json(raw)
                
                # Validate all components
                valid_components = []
                for i, item in enumerate(items):
                    try:
                        component = self._to_component(item, width, height)
                        valid_components.append(component)
                    except Exception as e:
                        logger.warning(f"Invalid component {i}: {e}, skipping")
                        continue
                
                logger.info(f"Successfully extracted {len(valid_components)} valid components from {len(items)} total")
                
                # Apply hybrid refinement to improve bounding box accuracy
                if valid_components:
                    logger.info("Applying hybrid refinement to improve bounding box accuracy...")
                    refined_components = self._apply_refinement(valid_components, image_path)
                    return refined_components
                else:
                    return valid_components
                
            except Exception as e:
                logger.warning(f"Attempt {attempt} failed: {e}")
                if attempt < retries:
                    wait_time = backoff ** (attempt - 1)
                    logger.info(f"Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                    continue
                raise

        raise RuntimeError("All retries exhausted without success")

    def get_full_response(self) -> Optional[str]:
        """Get the full response from the last API call"""
        return self.full_response

    def _apply_refinement(self, components: List[UIComponent], image_path: Path, enable_ocr: bool = True) -> List[UIComponent]:
        """
        Apply hybrid refinement to the extracted components.
        
        Args:
            components: List of UIComponent objects
            image_path: Path to the original screenshot
            enable_ocr: Whether to enable OCR-based refinement
            
        Returns:
            List of refined UIComponent objects
        """
        if not REFINEMENT_AVAILABLE:
            logger.info("Refinement not available, returning original components")
            return components
        
        try:
            import cv2
            import numpy as np
            
            # Load the image using OpenCV
            image = cv2.imread(str(image_path))
            if image is None:
                logger.warning("Could not load image for refinement, returning original components")
                return components
            
            # Convert components to the format expected by refinement
            boxes = []
            for comp in components:
                boxes.append({
                    'element': comp.name,
                    'x': comp.x,
                    'y': comp.y,
                    'width': comp.width,
                    'height': comp.height
                })
            
            # Apply refinement
            logger.info(f"Applying hybrid refinement to {len(boxes)} components (OCR: {enable_ocr})")
            refined_boxes = refine_bounding_boxes(image, boxes, enable_ocr=enable_ocr)
            
            # Convert back to UIComponent objects
            refined_components = []
            for i, box in enumerate(refined_boxes):
                original_comp = components[i]
                refined_components.append(UIComponent(
                    name=box.get('element', original_comp.name),
                    text=original_comp.text,
                    x=box['x'],
                    y=box['y'],
                    width=box['width'],
                    height=box['height'],
                    component_type=original_comp.component_type,
                    confidence=original_comp.confidence
                ))
            
            logger.info(f"Refinement completed: {len(refined_components)} components processed")
            return refined_components
            
        except Exception as e:
            logger.warning(f"Refinement failed: {e}, returning original components")
            return components


def main() -> None:
    """Main function for command-line usage."""
    parser = argparse.ArgumentParser(description="Run Phase 2 UI component analysis.")
    parser.add_argument("--screenshot", type=Path, required=True, help="Path to the input screenshot")
    parser.add_argument("--output", type=Path, default=DEFAULT_ANALYSIS_PATH, help="Path to save output JSON")
    parser.add_argument("--model", default=MODEL_NAME, help="OpenAI model name")
    parser.add_argument("--temperature", type=float, default=OPENAI_TEMPERATURE, help="Model temperature")
    parser.add_argument("--max-tokens", type=int, default=OPENAI_MAX_TOKENS, help="Maximum tokens")
    parser.add_argument("--retries", type=int, default=OPENAI_RETRY_ATTEMPTS, help="Number of retry attempts")
    parser.add_argument("--no-refinement", action="store_true", help="Disable hybrid refinement")
    parser.add_argument("--no-ocr", action="store_true", help="Disable OCR-based refinement")
    
    args = parser.parse_args()
    
    if not args.screenshot.exists():
        logger.error(f"Screenshot not found: {args.screenshot}")
        sys.exit(1)
        
    if not args.output.parent.exists():
        try:
            args.output.parent.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.error(f"Cannot create output directory: {e}")
            sys.exit(1)
    
    analyzer = UIAnalyzer(
        model=args.model,
        temperature=args.temperature,
        max_tokens=args.max_tokens
    )
    
    start = time.time()

    try:
        comps = analyzer.extract_components(args.screenshot, retries=args.retries)
        
        # Apply refinement unless disabled
        if not args.no_refinement:
            refined_comps = analyzer._apply_refinement(comps, args.screenshot, enable_ocr=not args.no_ocr)
        else:
            logger.info("Refinement disabled by user")
            refined_comps = comps
            
        result = {
            "success": True,
            "components": [c.to_dict() for c in refined_comps],
            "metadata": {
                "analysis_time": round(time.time() - start, 2),
                "model_used": args.model,
                "total_components": len(refined_comps),
                "temperature": args.temperature,
                "max_tokens": args.max_tokens,
                "refinement_applied": not args.no_refinement,
                "ocr_enabled": not args.no_ocr
            },
            "error": None
        }
        
        # Save full response to response.txt
        full_response = analyzer.get_full_response()
        if full_response:
            response_path = args.output.parent / "response.txt"
            with open(response_path, "w", encoding="utf-8") as resp_file:
                resp_file.write(full_response)
            logger.info(f"Full API response saved to {response_path}")
        
    except Exception as err:
        logger.error(f"Analysis failed: {err}")
        result = {
            "success": False, 
            "components": [], 
            "metadata": {
                "analysis_time": round(time.time() - start, 2),
                "model_used": args.model,
                "error": str(err)
            }, 
            "error": str(err)
        }

    with open(args.output, "w") as outf:
        json.dump(result, outf, indent=2)
    logger.info(f"Results written to {args.output}")


if __name__ == "__main__":
    main()
