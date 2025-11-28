
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

---

## 3. Security Implementation (`server.js`)

The backend implements several layers of security countermeasures against common web application threats.

### 3.1 Threat: Sensitive Data Exposure
*   **Risk**: Leaking user password hashes in API responses.
*   **Countermeasure**: **Output Sanitization**. The `parseUser` function explicitly destructures the `password` field out of the User object before JSON serialization in `GET /users` responses.

### 3.2 Threat: Information Disclosure
*   **Risk**: Returning raw database stack traces (e.g., "SQL syntax error near...") allows attackers to map the schema.
*   **Countermeasure**: **Error Masking**. The `handleServerErr` helper logs the full error details to the server console for debugging but returns a generic `500 Internal Server Error` JSON payload to the client.

### 3.3 Threat: Brute Force Attacks
*   **Risk**: Automated scripts attempting to guess passwords via the `/users` endpoint.
*   **Countermeasure**: **Rate Limiting**. A custom middleware `rateLimiter` tracks request counts per IP address in memory.
    *   **Policy**: 50 requests per 15 minutes for sensitive endpoints.

### 3.4 Threat: Injection Attacks (SQLi)
*   **Risk**: Malicious SQL commands embedded in user input.
*   **Countermeasure**: **Parameterized Queries**. All database interactions utilize `sqlite3` prepared statements (e.g., `db.run("... VALUES (?, ?)", [val1, val2])`). No string concatenation is used for SQL construction.

### 3.5 Threat: Client-Side Attacks (XSS, Clickjacking)
*   **Risk**: Embedding the app in malicious iframes or sniffing MIME types to execute non-executable files.
*   **Countermeasure**: **Security Headers**.
    *   `X-Content-Type-Options: nosniff`: Prevents MIME type sniffing.
    *   `X-Frame-Options: DENY`: Prevents clickjacking via iframes.
    *   `X-XSS-Protection: 1; mode=block`: Enables browser XSS filters.
    *   `Strict-Transport-Security`: Enforces HTTPS (HSTS).

### 3.6 Threat: Invalid Input Processing
*   **Risk**: Passing malformed IDs causing database driver crashes or unexpected behavior.
*   **Countermeasure**: **Input Validation**. The `isValidUUID` regex check enforces strict UUID v4 format on `userId` and `entryId` parameters before any database operation is attempted.
