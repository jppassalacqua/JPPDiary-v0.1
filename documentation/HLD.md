
# High-Level Design (HLD) - Gemini Diary

## 1. Introduction
Gemini Diary is a sophisticated Personal Knowledge Management (PKM) application enhanced by AI. It adheres to a **"Local-First, Cloud-Optional"** philosophy, running entirely on a user's machine while leveraging AI services for intelligence.

## 2. System Architecture

The application implements a modern **Client-Server** architecture packaged for local deployment.

```mermaid
graph TD
    User[User Device] -->|HTTP/HTTPS| Frontend[Frontend (React SPA)]
    Frontend -->|REST API| Backend[Backend (Node.js/Express)]
    Frontend -->|WebSocket/HTTP| LocalLLM[Local LLM (Ollama)]
    Frontend -->|HTTPS| CloudAI[Google Gemini API]
    
    subgraph "Data & Logic Layer"
        Frontend_Logic[Services: DB, AI, Logger]
        Backend_Logic[API Routes]
        DB[(SQLite Database)]
    end

    Frontend_Logic -->|Interception| Logger[Logging Service]
    Frontend_Logic -->|Persistence| Backend
    Backend --> DB
```

### 2.1 Core Components

1.  **Frontend (React 19 + Vite)**
    *   **Responsibility**: UI rendering, state management, AI interaction, data visualization.
    *   **Key Tech**: TypeScript, Tailwind, Recharts, Leaflet/Google Maps.
    *   **Media Handling**: `MediaManager` consolidates Camera, Audio, and Drawing inputs; `MediaGallery` standardizes display.

2.  **Backend (Node.js + Express)**
    *   **Responsibility**: Persistence layer, system administration, static asset serving.
    *   **Key Tech**: SQLite3, Express, Node-Windows.
    *   **Auto-Cataloging**: Automatically extracts entities from entries and links them in the database for graph analysis.

3.  **Interception Layer**
    *   **Responsibility**: Capturing all data modification events (CUD) and application errors.
    *   **Implementation**: A wrapper around the Database Service (`services/db.ts`) that hooks into every save/delete call to generate audit logs transparently.

## 3. Data Flow & Security

### 3.1 Data Storage
*   **Primary**: SQLite database file (`gemini_diary.db`).
*   **Schema**: Fully Normalized Relational Model.
    *   `entries`: Core text and metadata.
    *   `media`: Binary data (Images/Audio).
    *   `catalog`: Entities extracted from entries.
    *   `entry_entities`: Junction table linking memories to concepts.
    *   `tags`: Normalized user-defined tags.
    *   `logs`: System audit trail.

### 3.2 Security
*   **Authentication**: Session-based via LocalStorage tokens.
*   **Passwords**: SHA-256 Client-side hashing.
*   **API Keys**: Stored in environment variables or user preferences.

## 4. Key Features
| Feature | Description | Tech Implementation |
| :--- | :--- | :--- |
| **Smart Journaling** | Rich text editing + AI Chat | Markdown Editor, Chat Interface |
| **Analytics** | Mood tracking & scoring | Google Gemini Analysis, Recharts |
| **Geo-Life** | Map visualization | Google Maps / Leaflet + Clustering |
| **Audit Logging** | System-wide event tracking | Interception Pattern in DB Service |
| **RAG Chat** | "Talk to your Diary" | Context window construction |
| **Unified Media** | Audio/Video/Image/Draw | `MediaManager` Component |
| **Cataloging** | Entity extraction & linking | Auto-Cataloging Backend Logic |

## 5. Deployment Strategy
The application supports multiple deployment targets:
1.  **Desktop App**: via PWA installation.
2.  **Windows Service**: Background execution using `node-windows`.
3.  **Docker Container**: For NAS or Linux server deployment.
