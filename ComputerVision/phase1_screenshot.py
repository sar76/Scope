"""
Phase 1: Screenshot Capture
This script takes a screenshot of a website with consistent sizing and optimization.
Optimized for the 3-phase computer vision pipeline.
"""

import argparse
import logging
import re
import sys
import time
from pathlib import Path
from typing import Optional, Tuple, Dict, Any
from urllib.parse import urlparse

# Selenium imports
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

# WebDriver manager for automatic ChromeDriver management
from webdriver_manager.chrome import ChromeDriverManager

# Image processing
from PIL import Image, ImageOps

# Add the parent directory to sys.path to import config
sys.path.append(str(Path(__file__).parent.parent))
from ComputerVision.config import (
    DEFAULT_SCREENSHOT_PATH, 
    DEFAULT_CHROME_OPTIONS, 
    LOG_LEVEL
)

# Configure logging
logging.basicConfig(level=LOG_LEVEL, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class WebDriverContext:
    """Context manager for WebDriver to ensure proper cleanup."""
    
    def __init__(self, chrome_options: Options) -> None:
        self.chrome_options = chrome_options
        self.driver: Optional[webdriver.Chrome] = None
        
    def __enter__(self) -> webdriver.Chrome:
        """Initialize and return the WebDriver instance."""
        try:
            # Use webdriver-manager to automatically manage ChromeDriver
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=self.chrome_options)
            logger.info("WebDriver initialized successfully")
            return self.driver
        except Exception as e:
            logger.error(f"Failed to initialize WebDriver: {e}")
            raise
            
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Ensure WebDriver is properly closed."""
        if self.driver:
            try:
                self.driver.quit()
                logger.info("WebDriver closed successfully")
            except Exception as e:
                logger.warning(f"Error closing WebDriver: {e}")

def validate_url(url: str) -> bool:
    """Validate URL format using urllib.parse.urlparse."""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False

def validate_output_path(path: Path) -> bool:
    """Validate that the output path is writable."""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        # Test write access
        with open(path, 'wb') as f:
            pass
        path.unlink()  # Remove test file
        return True
    except Exception as e:
        logger.error(f"Output path not writable: {e}")
        return False

def build_chrome_options(flags: Dict[str, Any]) -> Options:
    """Build Chrome options from configuration flags."""
    options = Options()
    
    if flags.get("headless", True):
        options.add_argument("--headless=new")
    if flags.get("disable_gpu", True):
        options.add_argument("--disable-gpu")
    if flags.get("no_sandbox", True):
        options.add_argument("--no-sandbox")
    if flags.get("disable_dev_shm_usage", True):
        options.add_argument("--disable-dev-shm-usage")
    
    window_size = flags.get("window_size", (1920, 1080))
    options.add_argument(f"--window-size={window_size[0]},{window_size[1]}")
    
    # Additional performance and stability options
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-plugins")
    options.add_argument("--disable-images")  # Faster loading for screenshots
    options.add_argument("--disable-javascript")  # Optional: disable JS for faster loading
    
    return options

def enforce_image_size(
    image_path: Path,
    target_size: Tuple[int, int],
    logger: logging.Logger
) -> None:
    """
    Crop or pad the image at image_path to exactly target_size (width, height).
    Overwrites the image if changed.
    """
    with Image.open(image_path) as img:
        current_size = img.size
        if current_size == target_size:
            return  # No action needed
        target_width, target_height = target_size
        # Crop if too large
        if current_size[0] > target_width or current_size[1] > target_height:
            left = max(0, (current_size[0] - target_width) // 2)
            top = max(0, (current_size[1] - target_height) // 2)
            right = left + target_width
            bottom = top + target_height
            img = img.crop((left, top, right, bottom))
            logger.warning(f"Cropped screenshot from {current_size} to {target_size}")
        # Pad if too small
        if img.size[0] < target_width or img.size[1] < target_height:
            pad_width = max(0, target_width - img.size[0])
            pad_height = max(0, target_height - img.size[1])
            padding = (
                pad_width // 2,
                pad_height // 2,
                pad_width - pad_width // 2,
                pad_height - pad_height // 2
            )
            img = ImageOps.expand(img, padding, fill=(255, 255, 255))
            logger.warning(f"Padded screenshot from {img.size} to {target_size}")
        img.save(image_path)

def take_screenshot(
    url: str,
    output_filename: Path = DEFAULT_SCREENSHOT_PATH,
    wait_time: int = 2,
    window_size: Tuple[int, int] = (1920, 1080),
    chrome_flags: Optional[Dict[str, Any]] = None,
    enforce_size: bool = False
) -> Dict[str, Any]:
    """
    Take a screenshot of a website with validation and error handling.
    
    Args:
        url: The URL to capture
        output_filename: Path to save the screenshot
        wait_time: Time to wait for page load
        window_size: Browser window size (width, height)
        chrome_flags: Additional Chrome options
        enforce_size: Whether to crop or pad the screenshot to exact window size
        
    Returns:
        Dictionary with success status and metadata
    """
    start_time: Optional[float] = None
    
    try:
        # Validate inputs
        if not validate_url(url):
            logger.error(f"Invalid URL: {url}")
            return {"success": False, "error": "Invalid URL"}
            
        if not validate_output_path(output_filename):
            return {"success": False, "error": "Output path not writable"}
        
        start_time = time.time()
        
        # Build Chrome options
        flags = DEFAULT_CHROME_OPTIONS.copy()
        if chrome_flags:
            flags.update(chrome_flags)
        flags["window_size"] = window_size
        
        options = build_chrome_options(flags)
        
        # Use context manager for WebDriver
        with WebDriverContext(options) as driver:
            driver.set_page_load_timeout(15)
            logger.info(f"Navigating to {url}")
            
            driver.get(url)
            
            # Wait for page to load
            try:
                WebDriverWait(driver, wait_time).until(
                    EC.presence_of_element_located((By.TAG_NAME, "body"))
                )
                logger.info("Page loaded successfully")
            except Exception as e:
                logger.warning(f"Smart wait failed: {e}, using minimal wait")
                time.sleep(1)
            
            # Verify window size
            window_rect = driver.get_window_rect()
            actual_width = window_rect['width']
            actual_height = window_rect['height']
            logger.info(f"Actual window size: {actual_width}x{actual_height}")
            
            if actual_width != window_size[0] or actual_height != window_size[1]:
                logger.warning(f"Window size mismatch! Expected: {window_size[0]}x{window_size[1]}, Got: {actual_width}x{actual_height}")
                try:
                    driver.set_window_size(window_size[0], window_size[1])
                    time.sleep(0.5)
                    window_rect = driver.get_window_rect()
                    actual_width = window_rect['width']
                    actual_height = window_rect['height']
                    logger.info(f"Resized window to: {actual_width}x{actual_height}")
                except Exception as e:
                    logger.error(f"Failed to resize window: {e}")
            
            # Take screenshot
            driver.save_screenshot(str(output_filename))
            
            # Validate screenshot dimensions
            with Image.open(output_filename) as img:
                screenshot_width, screenshot_height = img.size
                logger.info(f"Screenshot dimensions: {screenshot_width}x{screenshot_height}")
                
                if screenshot_width != actual_width or screenshot_height != actual_height:
                    logger.warning(f"Screenshot size mismatch! Window: {actual_width}x{actual_height}, Screenshot: {screenshot_width}x{screenshot_height}")
            
            # Enforce exact size if requested
            if enforce_size:
                enforce_image_size(output_filename, window_size, logger)
        
        processing_time = round(time.time() - start_time, 2)
        logger.info(f"Screenshot saved as {output_filename} in {processing_time}s")
        
        return {
            "success": True,
            "output_filename": str(output_filename),
            "url": url,
            "window_size": (actual_width, actual_height),
            "processing_time": processing_time,
            "error": None
        }
        
    except Exception as e:
        processing_time = round(time.time() - start_time, 2) if start_time else None
        logger.error(f"Error taking screenshot: {e}")
        return {
            "success": False,
            "output_filename": None,
            "url": url,
            "window_size": None,
            "processing_time": processing_time,
            "error": str(e)
        }

def main() -> None:
    """Main function for command-line usage."""
    parser = argparse.ArgumentParser(description="Take a screenshot of a website.")
    parser.add_argument("--url", required=True, help="URL to capture")
    parser.add_argument("--output", type=Path, default=DEFAULT_SCREENSHOT_PATH, help="Output filename")
    parser.add_argument("--wait", type=int, default=2, help="Wait time in seconds")
    parser.add_argument("--width", type=int, default=1920, help="Window width")
    parser.add_argument("--height", type=int, default=1080, help="Window height")
    parser.add_argument("--headless", action="store_true", default=True, help="Run in headless mode")
    parser.add_argument("--no-headless", dest="headless", action="store_false", help="Run with browser visible")
    parser.add_argument("--enforce-size", action="store_true", help="Crop or pad screenshot to exact window size after capture")
    
    args = parser.parse_args()
    
    # Take screenshot with specified parameters
    result = take_screenshot(
        url=args.url,
        output_filename=args.output,
        wait_time=args.wait,
        window_size=(args.width, args.height),
        chrome_flags={"headless": args.headless},
        enforce_size=args.enforce_size
    )
    
    if result["success"]:
        logger.info(f"Screenshot completed successfully: {result['output_filename']}")
    else:
        logger.error(f"Screenshot failed: {result['error']}")
        sys.exit(1)

if __name__ == "__main__":
    main() 