# Base image
FROM python:3

# Set working directory
WORKDIR /app

# Copy requirements file to working directory
COPY requirements.txt .

# Install dependencies
RUN apt-get update && \
    apt-get install -y \
        default-libmysqlclient-dev \
    && rm -rf /var/lib/apt/lists/* 

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files to working directory
COPY . .

# Expose port
EXPOSE 3000

# Start application
CMD ["python", "app.py"]
