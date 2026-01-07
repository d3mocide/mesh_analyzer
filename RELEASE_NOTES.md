# Release Notes - v0.2-rc

## MeshRF - The Branding Update

This release brings a polished identity to the project and important configuration fixes for deployment.

### 🎨 Branding & Identity

- **New Name**: Officially renamed to **MeshRF**.
- **New Icon**: Added a sleek, cyber-aesthetic SVG icon (Gradient Hexagon).
- **UI Updates**: Updated title in Browser Tab and Sidebar.

### ⚙️ configuration & Troubleshooting

- **Custom Domains**: Added `ALLOWED_HOSTS` support for deploying behind reverse proxies or on custom domains (fixes "Blocked host" errors).
- **Docker Publishing**: Workflow now explicitly builds and pushes the `latest` tag to GHCR.
- **Documentation**: Updated `README.md` with correct clone URLs and Docker run commands.
