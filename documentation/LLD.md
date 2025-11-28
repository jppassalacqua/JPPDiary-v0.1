
# Low-Level Design (LLD) - Gemini Diary

## 1. Database Schema (SQLite)

### 1.1 `users`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (UUID) | Primary Key |
| `username` | TEXT | Unique Identifier |
| `password` | TEXT | SHA-256 Hash |
| `preferences`| TEXT (JSON)| Theme, AI Config, etc. |

### 1.2 `entries`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (UUID) | Primary Key |
| `userId` | TEXT | FK -> users.id |
| `timestamp` | INTEGER | Event Date |
| `mood` | TEXT | Primary Mood (Indexed) |
| `sentimentScore`| REAL | AI Sentiment Value (-1 to 1) |
| `content` | TEXT | Markdown Content |
| `location_lat`| REAL | Latitude |
| `location_lng`| REAL | Longitude |
| `city` | TEXT | City Name (Indexed) |
| `country` | TEXT | Country Name |
| `analysis` | TEXT (JSON)| Full AI output (summary, raw data) |

### 1.3 `media`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (UUID) | Primary Key |
| `entryId` | TEXT | FK -> entries.id (Cascade Delete) |
| `type` | TEXT | 'image', 'video', 'audio' |
| `data` | TEXT | Base64 content |
| `timestamp`| INTEGER | Creation time |

### 1.4 `tags`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (UUID) | Primary Key |
| `userId` | TEXT | FK -> users.id |
| `name` | TEXT | Tag Name (Unique per user) |

### 1.5 `catalog` (Entities)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (UUID) | Primary Key |
| `userId` | TEXT | FK -> users.id |
| `name` | TEXT | Entity Name (e.g. "Paris") |
| `type` | TEXT | Person, Location, Concept, etc. |
| `description`| TEXT | Description or Bio |

### 1.6 Junction Tables
*   **`entry_tags`**: Links `entries` <-> `tags`.
*   **`entry_entities`**: Links `entries` <-> `catalog`. (Allows finding all entries mentioning "Paris").
*   **`catalog_tags`**: Links `catalog` <-> `tags`. (Allows tagging "Paris" as #travel).

### 1.7 `logs` (Audit Trail)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (UUID) | Primary Key |
| `timestamp` | INTEGER | Event time (ms) |
| `level` | TEXT | 'INFO', 'WARN', 'ERROR' |
| `source` | TEXT | Component Name |
| `message` | TEXT | Human readable description |
| `data` | TEXT (JSON)| Contextual debug data |

---

## 2. Component Implementation Details

### 2.1 DB Service Interception (`services/db.ts`)
The `db` service exports an object where every method is a wrapper around the actual data provider. This allows for centralized logging without cluttering UI components.

### 2.2 Configuration Management (`config/appConfig.ts`)
Central store for all static configuration (API keys, default prompts, UI defaults).

### 2.3 Unified Media Management
Handles input (Camera, Mic, Upload) and display (Gallery) of all media types attached to entries.

### 2.4 Auto-Cataloging
The backend (`server.js`) inspects the AI analysis of every saved entry. If entities are found, they are automatically upserted into the `catalog` table and linked via `entry_entities`.
