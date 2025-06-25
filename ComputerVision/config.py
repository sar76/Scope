import os
import sys
from pathlib import Path
from typing import Dict, Any

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

def validate_required_env_var(var_name: str, value: str) -> str:
    """Validate that a required environment variable is set and not empty."""
    if not value or value.strip() == "":
        print(f"❌ Error: Required environment variable '{var_name}' is not set or empty.")
        print(f"   Please set {var_name} in your environment or .env file.")
        sys.exit(1)
    return value.strip()

def validate_optional_env_var(var_name: str, value: str, default: str) -> str:
    """Validate an optional environment variable, returning default if not set."""
    if not value or value.strip() == "":
        return default
    return value.strip()

# Centralized configuration with validation
BASE_DIR = Path(__file__).resolve().parent.parent

# Required environment variables
OPENAI_API_KEY = "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"

# Model configuration - using latest GPT-4 Omni model
MODEL_NAME = validate_optional_env_var("MODEL_NAME", os.getenv("MODEL_NAME", ""), "gpt-4o")

# Default paths
DEFAULT_SCREENSHOT_PATH = BASE_DIR / "screenshot.png"
DEFAULT_ANALYSIS_PATH = BASE_DIR / "ui_components_analysis.json"
DEFAULT_BOUNDING_PATH = BASE_DIR / "bounding.png"

# Chrome options (can be overridden by env or CLI)
DEFAULT_CHROME_OPTIONS = {
    "headless": os.getenv("CHROME_HEADLESS", "true").lower() == "true",
    "window_size": (
        int(os.getenv("CHROME_WIDTH", "1920")),
        int(os.getenv("CHROME_HEIGHT", "1080"))
    ),
    "disable_gpu": os.getenv("CHROME_DISABLE_GPU", "true").lower() == "true",
    "no_sandbox": os.getenv("CHROME_NO_SANDBOX", "true").lower() == "true",
    "disable_dev_shm_usage": os.getenv("CHROME_DISABLE_DEV_SHM", "true").lower() == "true",
}

# Logging config
LOG_LEVEL = validate_optional_env_var("LOG_LEVEL", os.getenv("LOG_LEVEL", ""), "INFO")

# Visualization settings
FONT_SIZE = int(os.getenv("FONT_SIZE", "12"))
OUTPUT_FILENAME = validate_optional_env_var("OUTPUT_FILENAME", os.getenv("OUTPUT_FILENAME", ""), "bounding.png")

# API settings
OPENAI_MAX_TOKENS = int(os.getenv("OPENAI_MAX_TOKENS", "4000"))
OPENAI_TEMPERATURE = float(os.getenv("OPENAI_TEMPERATURE", "0.1"))
OPENAI_RETRY_ATTEMPTS = int(os.getenv("OPENAI_RETRY_ATTEMPTS", "3"))
OPENAI_BACKOFF_FACTOR = float(os.getenv("OPENAI_BACKOFF_FACTOR", "2.0"))

# Validation on import
if __name__ == "__main__":
    print("✅ Configuration validation passed!")
    print(f"📋 Model: {MODEL_NAME}")
    print(f"🔑 API Key: {'*' * 8 + OPENAI_API_KEY[-4:] if len(OPENAI_API_KEY) > 8 else 'Not set'}")
    print(f"📁 Base Directory: {BASE_DIR}")
    print(f"📊 Log Level: {LOG_LEVEL}")
    print(f"🌐 Chrome Headless: {DEFAULT_CHROME_OPTIONS['headless']}")
    print(f"🖼️  Window Size: {DEFAULT_CHROME_OPTIONS['window_size']}") 