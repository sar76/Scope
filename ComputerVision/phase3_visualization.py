"""
Phase 3: Bounding Box Visualization
This script takes the screenshot from Phase 1 and the JSON analysis from Phase 2,
then draws bounding boxes around all detected UI components and saves as "bounding.png".
Highly optimized for fastest runtime using PIL/Pillow.
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional
from PIL import Image, ImageDraw, ImageFont
import cv2

# Add the parent directory to sys.path to import config
sys.path.append(str(Path(__file__).parent.parent))
from ComputerVision.config import (
    DEFAULT_SCREENSHOT_PATH, 
    DEFAULT_ANALYSIS_PATH, 
    DEFAULT_BOUNDING_PATH, 
    LOG_LEVEL,
    FONT_SIZE,
    OUTPUT_FILENAME
)

# Import advanced refinement
from ComputerVision.advanced_refinement import advanced_refine_bounding_boxes

logger = logging.getLogger(__name__)
logging.basicConfig(level=LOG_LEVEL, format='%(asctime)s - %(levelname)s - %(message)s')

class BoundingBoxVisualizer:
    """
    High-performance bounding box visualizer using PIL/Pillow.
    Optimized for fastest runtime and memory efficiency.
    """
    
    def __init__(self, font_size: int = FONT_SIZE, color_palette: Optional[Dict[str, Tuple[int, int, int, int]]] = None) -> None:
        """Initialize the visualizer with optimized settings."""
        self.colors = color_palette or {
            'button': (255, 0, 0, 255),      # Red
            'link': (0, 255, 0, 255),        # Green
            'input': (0, 0, 255, 255),       # Blue
            'image': (255, 255, 0, 255),     # Yellow
            'text': (255, 0, 255, 255),      # Magenta
            'icon': (0, 255, 255, 255),      # Cyan
            'menu': (255, 165, 0, 255),      # Orange
            'header': (128, 0, 128, 255),    # Purple
            'footer': (64, 64, 64, 255),     # Dark Gray
            'navigation': (0, 128, 0, 255),  # Dark Green
            'form': (255, 140, 0, 255),      # Dark Orange
            'table': (75, 0, 130, 255),      # Indigo
            'list': (220, 20, 60, 255),      # Crimson
            'unknown': (128, 128, 128, 255)  # Gray
        }
        
        # Default settings
        self.line_width = 2
        self.font_size = font_size
        self.text_padding = 5
        self.font = self._load_font(font_size)
        
    def _load_font(self, font_size: int) -> ImageFont.FreeTypeFont:
        """Load font with fallback to default font."""
        try:
            return ImageFont.truetype("arial.ttf", font_size)
        except Exception:
            try:
                return ImageFont.truetype("DejaVuSans.ttf", font_size)
            except Exception:
                try:
                    return ImageFont.truetype("/System/Library/Fonts/Arial.ttf", font_size)
                except Exception:
                    logger.warning("Could not load system fonts, using default font")
                    return ImageFont.load_default()
    
    def load_json_data(self, json_path: Path) -> Dict[str, Any]:
        """
        Load and validate JSON data from Phase 2 analysis.
        
        Args:
            json_path (Path): Path to the JSON file from Phase 2
            
        Returns:
            Dict[str, Any]: Parsed JSON data
        """
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if not data.get('success', False):
                raise ValueError("JSON data indicates analysis was not successful")
            
            if 'components' not in data:
                raise ValueError("No components found in JSON data")
            
            logger.info(f"Loaded {len(data['components'])} components from JSON")
            return data
            
        except Exception as e:
            logger.error(f"Error loading JSON data: {e}")
            raise
    
    def load_screenshot(self, screenshot_path: Path) -> Image.Image:
        """
        Load screenshot image with optimized settings.
        
        Args:
            screenshot_path (Path): Path to the screenshot from Phase 1
            
        Returns:
            Image.Image: Loaded image object
        """
        try:
            # Load image with optimized settings
            image = Image.open(screenshot_path)
            
            # Convert to RGBA if not already (for transparency support)
            if image.mode != 'RGBA':
                image = image.convert('RGBA')
            
            logger.info(f"Loaded screenshot: {image.size[0]}x{image.size[1]}")
            return image
            
        except Exception as e:
            logger.error(f"Error loading screenshot: {e}")
            raise
    
    def get_component_color(self, component_type: str) -> Tuple[int, int, int, int]:
        """
        Get color for a component type.
        
        Args:
            component_type (str): Type of the component
            
        Returns:
            Tuple[int, int, int, int]: RGBA color tuple
        """
        return self.colors.get(component_type.lower(), self.colors['unknown'])
    
    def validate_and_fix_coordinates(self, coords: List[Tuple[int, int, int, int]], image_width: int, image_height: int) -> List[Tuple[int, int, int, int]]:
        """
        Validate and fix coordinates to ensure they are within image bounds.
        
        Args:
            coords: List of coordinate tuples (x, y, width, height)
            image_width: Image width in pixels
            image_height: Image height in pixels
            
        Returns:
            List of validated coordinate tuples
        """
        validated_coords = []
        for i, (x, y, width, height) in enumerate(coords):
            # Validate and fix coordinates
            x = max(0, min(x, image_width - 1))
            y = max(0, min(y, image_height - 1))
            width = max(1, min(width, image_width - x))
            height = max(1, min(height, image_height - y))
            
            validated_coords.append((x, y, width, height))
            
        return validated_coords
    
    def validate_and_fix_component_coordinates(self, component: Dict[str, Any], image_width: int, image_height: int, issues: List[str], idx: int) -> Dict[str, Any]:
        """
        Validate and fix coordinates for a single component.
        
        Args:
            component (Dict[str, Any]): Component data with coordinates
            image_width (int): Image width in pixels
            image_height (int): Image height in pixels
            issues (List[str]): List to store issues
            idx (int): Index of the component
            
        Returns:
            Dict[str, Any]: Component with validated/fixed coordinates
        """
        coords = component.get('coordinates', {})
        x = coords.get('x', 0)
        y = coords.get('y', 0)
        width = coords.get('width', 0)
        height = coords.get('height', 0)
        orig = (x, y, width, height)
        
        # Validate and fix coordinates
        if x < 0 or y < 0 or width <= 0 or height <= 0 or x >= image_width or y >= image_height or x + width > image_width or y + height > image_height:
            issues.append(f"Component {idx} ({component.get('name', 'unknown')}): original ({orig}) out of bounds, auto-corrected.")
        
        x = max(0, min(x, image_width - 1))
        y = max(0, min(y, image_height - 1))
        width = max(1, min(width, image_width - x))
        height = max(1, min(height, image_height - y))
        
        # Update component with validated coordinates
        component['coordinates'] = {
            'x': x,
            'y': y,
            'width': width,
            'height': height
        }
        
        # Update bounding box if present
        if 'bounding_box' in component:
            component['bounding_box'] = [x, y, width, height]
        
        return component
    
    def draw_bounding_boxes(self, image: Image.Image, components: List[Dict[str, Any]], issues: List[str]) -> Image.Image:
        """
        Draw bounding boxes on the image for all components.
        Highly optimized for fastest runtime with coordinate validation.
        
        Args:
            image (Image.Image): Original screenshot image
            components (List[Dict[str, Any]]): List of component data from JSON
            issues (List[str]): List to store issues
            
        Returns:
            Image.Image: Image with bounding boxes drawn
        """
        # Create a copy of the image to avoid modifying the original
        result_image = image.copy()
        draw = ImageDraw.Draw(result_image)
        
        # Get image dimensions
        image_width, image_height = image.size
        logger.info(f"Image dimensions: {image_width}x{image_height}")
        
        valid_components = 0
        for i, component in enumerate(components):
            try:
                # Validate and fix coordinates
                component = self.validate_and_fix_component_coordinates(component, image_width, image_height, issues, i)
                
                # Extract validated coordinates
                coords = component.get('coordinates', {})
                x = coords.get('x', 0)
                y = coords.get('y', 0)
                width = coords.get('width', 0)
                height = coords.get('height', 0)
                
                # Skip invalid coordinates
                if width <= 0 or height <= 0:
                    issues.append(f"Component {i}: invalid dimensions ({width}x{height})")
                    continue
                
                # Calculate bounding box coordinates
                x1, y1 = x, y
                x2, y2 = x + width, y + height
                
                # Get component type and color
                component_type = component.get('component_type', 'unknown')
                color = self.get_component_color(component_type)
                
                # Draw bounding box rectangle
                draw.rectangle([x1, y1, x2, y2], outline=color, width=self.line_width)
                
                # Draw component name/label
                name = component.get('name', '')
                if name:
                    # Calculate text position (above the bounding box)
                    text_y = max(0, y1 - self.font_size - self.text_padding)
                    
                    # Get text bounding box for background
                    bbox = draw.textbbox((x1, text_y), name, font=self.font)
                    text_width = bbox[2] - bbox[0]
                    text_height = bbox[3] - bbox[1]
                    
                    # Ensure text doesn't go off-screen
                    text_x = max(0, min(x1, image_width - text_width - self.text_padding * 2))
                    
                    # Draw text background
                    bg_rect = [
                        text_x, text_y,
                        text_x + text_width + self.text_padding * 2,
                        text_y + text_height + self.text_padding * 2
                    ]
                    draw.rectangle(bg_rect, fill=(0, 0, 0, 180))  # Semi-transparent black
                    
                    # Draw text
                    draw.text((text_x + self.text_padding, text_y + self.text_padding), 
                             name, fill=(255, 255, 255, 255), font=self.font)
                
                # Draw component type indicator
                type_text = f"({component_type})"
                type_bbox = draw.textbbox((x2 + 5, y1), type_text, font=self.font)
                type_width = type_bbox[2] - type_bbox[0]
                type_height = type_bbox[3] - type_bbox[1]
                
                # Ensure type indicator doesn't go off-screen
                type_x = min(x2 + 5, image_width - type_width - 4)
                type_y = max(0, min(y1, image_height - type_height - 4))
                
                # Draw type background
                type_bg_rect = [
                    type_x, type_y,
                    type_x + type_width + 4,
                    type_y + type_height + 4
                ]
                draw.rectangle(type_bg_rect, fill=color)
                
                # Draw type text
                draw.text((type_x + 2, type_y + 2), type_text, 
                         fill=(255, 255, 255, 255), font=self.font)
                
                valid_components += 1
                
            except Exception as e:
                issues.append(f"Error drawing component {i}: {e}")
                continue
        
        logger.info(f"Drew {valid_components} valid bounding boxes out of {len(components)} components")
        return result_image
    
    def save_result(self, image: Image.Image, output_path: Path) -> bool:
        """
        Save the result image with optimized settings.
        
        Args:
            image (Image.Image): Image with bounding boxes
            output_path (Path): Output file path
            
        Returns:
            bool: True if saved successfully, False otherwise
        """
        try:
            # Save with optimized settings for fastest runtime
            image.save(output_path, 'PNG', optimize=True, compress_level=6)
            logger.info(f"Result saved to {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving result: {e}")
            return False

def visualize_bounding_boxes(
    screenshot_path: Path,
    json_path: Path,
    output_path: Path = DEFAULT_BOUNDING_PATH,
    font_size: int = FONT_SIZE,
    color_palette: Optional[Dict[str, Tuple[int, int, int, int]]] = None
) -> Dict[str, Any]:
    """
    Main function to visualize bounding boxes on screenshot.
    Takes Phase 1 screenshot and Phase 2 JSON analysis, outputs annotated image.
    
    Args:
        screenshot_path (Path): Path to the screenshot from Phase 1
        json_path (Path): Path to the JSON analysis from Phase 2
        output_path (Path): Output file path for the annotated image
        font_size (int): Font size for labels
        color_palette (Optional[Dict[str, Tuple[int, int, int, int]]]): Color palette for components
    
    Returns:
        Dict[str, Any]: Result dictionary with success status and metadata
    """
    start_time = time.time()
    
    try:
        # Initialize visualizer
        visualizer = BoundingBoxVisualizer(font_size=font_size, color_palette=color_palette)
        
        # Load JSON data
        json_data = visualizer.load_json_data(json_path)
        components = json_data.get('components', [])
        
        # Load screenshot
        screenshot = visualizer.load_screenshot(screenshot_path)
        image_width, image_height = screenshot.size
        
        # Validate coordinates before processing
        issues: List[str] = []
        for i, component in enumerate(components):
            coords = component.get('coordinates', {})
            x = coords.get('x', 0)
            y = coords.get('y', 0)
            width = coords.get('width', 0)
            height = coords.get('height', 0)
            
            # Check for coordinate issues
            if x < 0 or y < 0 or x >= image_width or y >= image_height:
                issues.append(f"Component {i} ({component.get('name', 'unknown')}): coordinates ({x},{y}) outside image bounds")
            if width <= 0 or height <= 0:
                issues.append(f"Component {i} ({component.get('name', 'unknown')}): invalid dimensions ({width}x{height})")
            if x + width > image_width or y + height > image_height:
                issues.append(f"Component {i} ({component.get('name', 'unknown')}): extends beyond image bounds")
        
        if issues:
            logger.warning(f"Found {len(issues)} coordinate issues:")
            for issue in issues:
                logger.warning(f"  - {issue}")
            logger.info("Coordinates will be automatically corrected during processing")
        
        # Draw bounding boxes
        result_image = visualizer.draw_bounding_boxes(screenshot, components, issues)
        
        # Save result
        success = visualizer.save_result(result_image, output_path)
        
        if success:
            result = {
                "success": True,
                "output_path": str(output_path) if success else None,
                "components_processed": len(components),
                "processing_time": round(time.time() - start_time, 3),
                "image_size": screenshot.size,
                "coordinate_issues": issues,
                "error": None if success else "Failed to save result image"
            }
            logger.info(f"Visualization completed in {result['processing_time']}s")
            if issues:
                logger.warning(f"Coordinate issues found: {len(issues)}. See log for details.")
            return result
        else:
            return {
                "success": False,
                "output_path": None,
                "components_processed": 0,
                "processing_time": round(time.time() - start_time, 3),
                "image_size": None,
                "coordinate_issues": issues,
                "error": "Failed to save result image"
            }
            
    except Exception as e:
        logger.error(f"Error in visualization: {e}")
        return {
            "success": False,
            "output_path": None,
            "components_processed": 0,
            "processing_time": round(time.time() - start_time, 3),
            "image_size": None,
            "coordinate_issues": [],
            "error": str(e)
        }

def run_phase3_visualization(screenshot_path: Path = DEFAULT_SCREENSHOT_PATH, 
                           json_path: Path = DEFAULT_ANALYSIS_PATH,
                           output_path: Path = DEFAULT_BOUNDING_PATH,
                           font_size: int = FONT_SIZE) -> Dict[str, Any]:
    """
    Convenience function to run Phase 3 visualization with default settings.
    
    Args:
        screenshot_path (Path): Path to the screenshot from Phase 1
        json_path (Path): Path to the JSON analysis from Phase 2
        output_path (Path): Output file path for the annotated image
        font_size (int): Font size for labels
    
    Returns:
        Dict[str, Any]: Complete visualization results
    """
    return visualize_bounding_boxes(screenshot_path, json_path, output_path, font_size)

def draw_boxes_on_image(image_path, json_path, output_path, use_advanced=False):
    # Load image
    img = cv2.imread(str(image_path))
    if img is None:
        print(f"Could not load image: {image_path}")
        return
    # Load JSON
    with open(json_path, 'r') as f:
        data = json.load(f)
    boxes = data.get('components', [])
    # Optionally apply advanced refinement
    if use_advanced:
        boxes = advanced_refine_bounding_boxes(img, boxes)
    # Draw each box
    for box in boxes:
        x, y, w, h = box['x'], box['y'], box['width'], box['height']
        label = box.get('name', '')
        color = (0, 0, 255) if use_advanced else (0, 255, 0)
        cv2.rectangle(img, (x, y), (x + w, y + h), color, 4)
        if label:
            cv2.putText(img, label, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 2, color, 4)
    # Save output
    cv2.imwrite(str(output_path), img)
    print(f"Output image with boxes saved to {output_path}")

def main() -> None:
    """Main function for command-line usage."""
    parser = argparse.ArgumentParser(description="Run Phase 3 bounding box visualization.")
    parser.add_argument('--screenshot', type=Path, default=DEFAULT_SCREENSHOT_PATH, help="Path to screenshot.png")
    parser.add_argument('--json', type=Path, default=DEFAULT_ANALYSIS_PATH, help="Path to JSON analysis file")
    parser.add_argument('--output', type=Path, default=DEFAULT_BOUNDING_PATH, help="Path to output PNG file")
    parser.add_argument('--font-size', type=int, default=FONT_SIZE, help="Font size for labels")
    args = parser.parse_args()

    SCREENSHOT_PATH = args.screenshot
    JSON_PATH = args.json
    OUTPUT_PATH = args.output

    print(f"Using screenshot: {SCREENSHOT_PATH}")
    print(f"Using JSON analysis: {JSON_PATH}")
    print(f"Output will be saved to: {OUTPUT_PATH}")

    # Check if required files exist
    if not SCREENSHOT_PATH.exists():
        print(f"Error: Screenshot not found at {SCREENSHOT_PATH}")
        print("Please run Phase 1 first to generate a screenshot.")
        sys.exit(1)
    elif not JSON_PATH.exists():
        print(f"Error: JSON analysis not found at {JSON_PATH}")
        print("Please run Phase 2 first to generate the analysis.")
        sys.exit(1)
    else:
        # Run Phase 3 visualization
        print("Starting Phase 3: Bounding Box Visualization...")
        result = run_phase3_visualization(SCREENSHOT_PATH, JSON_PATH, OUTPUT_PATH, args.font_size)
        
        if result["success"]:
            print(f"✅ Visualization completed successfully!")
            print(f"📊 Processed {result['components_processed']} components")
            print(f"⏱️  Processing time: {result['processing_time']}s")
            print(f"🖼️  Image size: {result['image_size'][0]}x{result['image_size'][1]}")
            print(f"💾 Output saved to: {result['output_path']}")
            
            # Show coordinate validation results
            if result.get('coordinate_issues'):
                print(f"\n⚠️  Coordinate Issues Found ({len(result['coordinate_issues'])}):")
                for issue in result['coordinate_issues']:
                    print(f"   • {issue}")
                print("   ✅ All coordinates were automatically corrected during processing")
            else:
                print(f"✅ All coordinates are valid and within image bounds")
            
        else:
            print(f"❌ Visualization failed: {result['error']}")
            if result.get('coordinate_issues'):
                print(f"\n⚠️  Coordinate Issues Found ({len(result['coordinate_issues'])}):")
                for issue in result['coordinate_issues']:
                    print(f"   • {issue}")
            sys.exit(1)

    # Draw original refined boxes (green)
    draw_boxes_on_image(
        image_path=Path("google_screenshot.png"),
        json_path=Path("google_ui.json"),
        output_path=Path("google_bounding.png"),
        use_advanced=False
    )
    # Draw advanced refined boxes (red)
    draw_boxes_on_image(
        image_path=Path("google_screenshot.png"),
        json_path=Path("google_ui.json"),
        output_path=Path("google_bounding_advanced.png"),
        use_advanced=True
    )

if __name__ == "__main__":
    main()
