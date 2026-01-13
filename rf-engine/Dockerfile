FROM python:3.9-slim

# Install system dependencies
# splat: RF analysis tool
# gdal-bin, libgdal-dev: Geospatial library (for rasterio compilation on ARM64)
# gfortran, libopenblas-dev: For scipy compilation on ARM64
# wget, unzip: For downloading terrain data
# build-essential: For compiling Python packages
RUN apt-get update && apt-get install -y \
    splat \
    gdal-bin \
    libgdal-dev \
    gfortran \
    libopenblas-dev \
    liblapack-dev \
    pkg-config \
    wget \
    unzip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for GDAL (required for rasterio on ARM64)
ENV GDAL_CONFIG=/usr/bin/gdal-config

ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose port and define entrypoint
EXPOSE 5001
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5001"]
