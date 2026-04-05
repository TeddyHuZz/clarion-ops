FROM python:3.12-slim

WORKDIR /app

# Ensure Python can find the 'app' package
ENV PYTHONPATH=/app

# Copy dependency files
COPY pyproject.toml .

# Install dependencies using standard pip
RUN pip install --no-cache-dir .

# Copy source code
COPY app/ ./app/

# Expose metrics port
EXPOSE 8001

# Command to run the application (using module notation for robustness)
CMD ["python", "-m", "app.main"]
