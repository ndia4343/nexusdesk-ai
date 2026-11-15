import os, sys
from pathlib import Path

os.environ["HOME"] = "/tmp"
os.environ["TMPDIR"] = "/tmp"

ROOT_DIR = str(Path(__file__).resolve().parent.parent)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.main import app
