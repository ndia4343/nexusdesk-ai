# Hugging Face Spaces Compatible Dockerfile for NexusDesk AI
FROM python:3.11-slim

# Install minimal system dependencies
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set up user with UID 1000 for Hugging Face Spaces security standards
RUN useradd -m -u 1000 user
USER user

ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PORT=7860

WORKDIR $HOME/app

# Copy requirements and install dependencies
COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Copy application code with user ownership
COPY --chown=user:user . .

# Pre-initialize SQLite database schema during build
RUN python -c "from backend.database import init_db; init_db()" || true

# Hugging Face Spaces expects traffic on port 7860
EXPOSE 7860

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
