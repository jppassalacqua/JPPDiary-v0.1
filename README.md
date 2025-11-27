
# Gemini Diary

**Gemini Diary** is an intelligent Personal Knowledge Management (PKM) and journaling application. It combines traditional diary writing with AI-powered analysis, emotional tracking, and spatial visualization to help users reflect on their lives.

Built with a "Local-First" philosophy, it runs securely on your machine while leveraging either cloud AI (Google Gemini) or local LLMs (Ollama) for intelligence.

---

## 🌟 Key Features

### 📝 Smart Journaling
*   **Rich Text Editor**: Markdown support, tasks, tables, Mermaid diagrams, and internal linking.
*   **Multi-Modal**: Attach images, draw sketches, or record audio directly in the browser.
*   **AI Companion**: "Interview Mode" asks clarifying questions to flesh out details.

### 🧠 Deep Analysis
*   **Sentiment Tracking**: Automatically scores entries (-1 to 1) and detects moods (e.g., Joyful, Anxious).
*   **Entity Extraction**: Identifies people, places, and books mentioned in your text to build a personal **Catalog**.
*   **RAG Chat**: "Ask your Diary" — use AI to search your past memories (e.g., "What did I learn in Paris?").

### 🔭 Visualization
*   **Interactive Map**: Visualize memories geographically (Google Maps or OpenStreetMap).
*   **Knowledge Graph**: Force-directed graph showing connections between entries, tags, and entities.
*   **Calendar View**: Browse memories by Year, Month, or Day.

### 🛡️ Enterprise-Grade Logging
*   **Full Interception**: All data modifications (Create/Update/Delete) are automatically intercepted and logged.
*   **Audit Trail**: An integrated Admin Panel provides a `System Logs` viewer to track user actions and system errors.

---

## 🚀 Deployment Guide

Gemini Diary is designed to be deployed in various environments, from a developer's laptop to a production server.

### 1. Development (Windows/Linux)

Ideal for contributors or modifying code.

**Prerequisites:**
*   Node.js v18+
*   Git

**Steps:**
1.  **Clone:** `git clone https://github.com/jppassalacqua/Gemini-Diary.git`
2.  **Install:** `npm install`
3.  **Configure:** Create `.env` file:
    ```env
    VITE_GOOGLE_MAPS_API_KEY=optional_key
    ```
4.  **Run:** `npm run dev`
    *   Frontend runs on `http://localhost:3000`
    *   Backend runs on `http://localhost:8000` (In dev, frontend uses proxy).

### 2. User Acceptance Testing (UAT) / Staging

Simulates production behavior on a local machine. Serves the built frontend via the Express backend.

**Steps:**
1.  **Build Frontend:**
    ```bash
    npm run build
    ```
    This generates optimized assets in the `./dist` folder.
2.  **Start Server:**
    ```bash
    npm run server
    ```
3.  **Access:** Open `http://localhost:8000`. The application is now fully served by Node.js.

### 3. Production (Windows Service)

For permanent installation on a Windows Server or personal PC. The app runs in the background and restarts automatically on reboot.

**Prerequisites:**
*   Node.js installed.
*   Administrative privileges.

**Steps:**
1.  **Build:** Ensure `npm run build` has been executed.
2.  **Install Service:**
    Open PowerShell as **Administrator** and run:
    ```powershell
    npm run service:install
    ```
3.  **Verify:**
    *   Open `Services.msc` and check for **"Gemini Diary Service"**.
    *   Open Browser: `http://localhost:8000`.

**Uninstall:**
To remove the service: `npm run service:uninstall`

### 4. Production (Linux / Docker)

For Linux servers (Ubuntu/Debian/CentOS).

**Option A: Systemd Service**
1.  Build: `npm run build`
2.  Create service file `/etc/systemd/system/gemini-diary.service`:
    ```ini
    [Unit]
    Description=Gemini Diary
    After=network.target

    [Service]
    Type=simple
    User=youruser
    WorkingDirectory=/path/to/gemini-diary
    ExecStart=/usr/bin/node server.js
    Restart=on-failure
    Environment=PORT=8000

    [Install]
    WantedBy=multi-user.target
    ```
3.  Enable: `sudo systemctl enable --now gemini-diary`

**Option B: Docker (Recommended)**
1.  Create `Dockerfile`:
    ```dockerfile
    FROM node:18-alpine
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci --only=production
    COPY . .
    RUN npm run build
    EXPOSE 8000
    CMD ["node", "server.js"]
    ```
2.  Build & Run:
    ```bash
    docker build -t gemini-diary .
    docker run -d -p 8000:8000 -v $(pwd)/gemini_diary.db:/app/gemini_diary.db gemini-diary
    ```

---

## 📚 Functional Documentation

Detailed architecture and design documents have been moved to the `documentation/` folder:

*   [High-Level Design (HLD)](documentation/HLD.md)
*   [Low-Level Design (LLD)](documentation/LLD.md)

### User Roles
*   **Admin**: Can manage users (`/admin`), view system logs (`/admin/logs`), and perform full system backups/restores.
    *   Default Credentials: `admin` / `admin`
*   **User**: Can create entries, manage their own catalog, and use AI features.
    *   Default Test User: `test` / `test`

### Logging & Auditing
The application implements a centralized interception layer in `services/db.ts`. 
*   **Scope**: Every Create, Update, or Delete operation on Users, Entries, or Catalog items is captured.
*   **Visibility**: Logs are stored in the database (`logs` table) and viewable in the **Admin Panel > System Logs**.
*   **Retention**: Logs are automatically rotated (cleaned) based on `retentionDays` in config (default: 30 days).

---

## 🛠️ Architecture

*   **Frontend**: React 19, Vite, Tailwind CSS, Recharts.
*   **Backend**: Node.js (Express), SQLite3.
*   **AI**: Wrapper around Google Gemini API or Local OpenAI-compatible endpoints.
*   **Maps**: Dual-provider strategy (Leaflet for free OSM, Google Maps for advanced features).
