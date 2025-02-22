import logging
import sys

# Configure logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Create stdout handler for INFO level
stdout_handler = logging.StreamHandler(sys.stdout)
stdout_handler.setLevel(logging.INFO)
stdout_handler.addFilter(lambda record: record.levelno <= logging.INFO)

# Create stderr handler for ERROR level and above
stderr_handler = logging.StreamHandler(sys.stderr)
stderr_handler.setLevel(logging.ERROR)

# Create formatter
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
stdout_handler.setFormatter(formatter)
stderr_handler.setFormatter(formatter)

# Add handlers to logger
logger.addHandler(stdout_handler)
logger.addHandler(stderr_handler)

# Export logger
__all__ = ["logger"]
