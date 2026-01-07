# meshRF 📡

A professional-grade RF propagation and link analysis tool designed for LoRa Mesh networks (Meshtastic, Reticulum, Sidewinder). Built with **React**, **Leaflet**, and a high-fidelity **Geodetic Physics Engine**.

![Link Analysis Demo](./public/meshrf-preview.png)

## ✨ Features

### 📡 Advanced Link Analysis

- **Geodetic Physics Engine**: Calculates **Earth Bulge** and effective terrain height based on link distance and configurable **K-Factor**.
- **WISP-Grade Quality**: Evaluates links using the strict **60% Fresnel Zone Clearance** rule (Excellent/Good/Marginal/Obstructed).
- **Multi-Variable Profile**: Visualizes Terrain, Earth Curvature, Line of Sight (LOS), and Fresnel Zones on a dynamic 2D chart.
- **Clutter Awareness**: Simulates signal loss through trees or urban "clutter" layers.

### ⚡ Batch Operations

- **Bulk Link Matrix**: Import a simple CSV of nodes (`Name, Lat, Lon`) and instantly compute link budgets for every possible pair.
- **Automated Reporting**: Export detailed CSV reports containing RSSI, Signal Margin, and Clearance values for hundreds of potential links.

### 🛠️ Hardware Simulation

- **Device Presets**: Pre-loaded specs for popular mesh hardware (Heltec V3, T-Beam, RAK4631, Station G2).
- **Radio Config**: Adjust Spreading Factor (SF), Bandwidth (BW), and Coding Rate (CR) to simulate real-world LoRa modulation (LongFast, ShortFast).
- **Antenna Modeling**: Select standard antennas (Stubby, Dipole, Yagi) or input custom gain figures.

### 🎨 Modern Experience

- **Responsive UI**: "Glassmorphism" design with a collapsible sidebar and mobile-friendly drawer navigation.
- **Dynamic Maps**: Seamlessly switch between **Dark Matter**, **Light**, **Topography**, and **Satellite** basemaps.
- **Metric/Imperial**: Toggle between Metric (km/m) and Imperial (mi/ft) units on the fly.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+) **OR** [Docker](https://www.docker.com/)

### 🐳 Running with Docker (Recommended)

1. **Pull and Run**:

   ```bash
   docker run -d -p 5173:5173 ghcr.io/d3mocide/meshrf:latest
   ```

2. **Custom Configuration (Docker Compose)**:
   You can configure the default map location and elevation source via environment variables.

   ```yaml
   services:
     app:
       image: ghcr.io/d3mocide/meshrf:latest
       ports:
         - "5173:5173"
       environment:
         - VITE_MAP_LAT=45.5152 # Default Latitude (Portland, OR)
         - VITE_MAP_LNG=-122.6784 # Default Longitude
         - VITE_ELEVATION_API_URL=https://api.open-meteo.com/v1/elevation
         - ALLOWED_HOSTS=my-meshrf.com # For reverse proxies
   ```

3. Open `http://localhost:5173` in your browser.

### 💻 Running Locally (Development)

1.  Clone the repository:

    ```bash
    git clone https://github.com/d3mocide/meshrf.git
    cd meshrf
    ```

2.  Install dependencies:

    ```bash
    npm install
    ```

3.  Start the dev server:
    ```bash
    npm run dev
    ```

---

## 📐 Usage Guide

1.  **Placement**: Click on the map to place **TX** (Point A) and **RX** (Point B).
    - _Tip: Click again to move points._
2.  **Configuration**: Open the sidebar to select your specific device hardware and antenna height.
3.  **Environment**: Adjust **Refraction (K)** for atmospheric conditions and **Clutter** (e.g., 10m for trees) to see real-world impact.
4.  **Analysis**:
    - **Green**: Good/Excellent Connection (>60% Fresnel Clearance).
    - **Yellow**: Marginal (LOS exists but Fresnel is infringed).
    - **Red**: Obstructed (Earth or Terrain blocking).
5.  **Batch**: Use the "Import Nodes" button to upload a CSV and generate a full mesh network report.

---

## 🏗️ Project Structure

- `src/components`: UI components (Map, Sidebar, Charts).
- `src/context`: Global RF state and batch processing logic.
- `src/utils`:
  - `rfMath.js`: Core physics engine (Geodetic calc, Fresnel, Path Loss).
  - `elevation.js`: DEM data fetching and processing.
- `src/data`: Hardware definition libraries.

## 📄 License

MIT License. Free to use and modify.

## ⚠️ Disclaimer

This tool is a simulation based on mathematical models. Real-world RF propagation is affected by complex factors (interference, buildings, weather) not fully modeled here. Always verify with field testing.
