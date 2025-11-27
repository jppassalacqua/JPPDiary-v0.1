
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
| `content` | TEXT | Markdown / JSON |
| `analysis` | TEXT (JSON)| Mood, Sentiment, Entities |
| `images` | TEXT (JSON)| Array of Base64 strings |

### 1.3 `logs` (Audit Trail)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (UUID) | Primary Key |
| `timestamp` | INTEGER | Event time (ms) |
| `level` | TEXT | 'INFO', 'WARN', 'ERROR' |
| `source` | TEXT | Component Name (e.g. 'Database', 'Auth') |
| `message` | TEXT | Human readable description |
| `data` | TEXT (JSON)| Contextual debug data |

---

## 2. Component Implementation Details

### 2.1 DB Service Interception (`services/db.ts`)
The `db` service exports an object where every method is a wrapper around the actual data provider. This allows for centralized logging without cluttering UI components.

**Pattern:**
```typescript
saveEntry: async (entry) => {
    try {
        await provider.saveEntry(entry); // Actual Logic
        logInternal('INFO', 'Database', `Entry saved: ${entry.id}`); // Interception
    } catch (e) {
        logInternal('ERROR', 'Database', `Save failed`, e); // Error Capture
        throw e;
    }
}
```
*   **`logInternal`**: A private helper function that writes to the `logs` table using a "fire-and-forget" approach to avoid blocking the main UI thread.

### 2.2 Configuration Management (`config/appConfig.ts`)
*   **Centralization**: All static keys, default UI dimensions, and AI prompts are stored in a single immutable object.
*   **Usage**: Components import `appConfig` instead of hardcoding strings (e.g., `localStorage.getItem(appConfig.storageKeys.USERS)`).

### 2.3 AI Service (`services/geminiService.ts`)
*   **Adapter Pattern**: facade for Cloud (Gemini) vs Local (Ollama) providers.
*   **Error Handling**: All API failures are caught and logged via the `logger` service before returning fallback values to the UI.

### 2.4 Error Boundary (`components/ErrorBoundary.tsx`)
*   **Global Catch**: Catches React render cycle errors.
*   **Logging**: Automatically logs stack traces to the `logs` table for admin review.

### 2.5 Data Seeder (`services/dataSeeder.ts`)
*   **Purpose**: Bootstrapping the application with initial data for development and demonstration.
*   **Behavior**: Runs on application startup (`index.tsx`). Checks for the existence of `admin` and `test` users. If the `test` user has no history, it generates approximately 5 years of synthetic diary entries, moods, and catalog entities to populate the dashboard and graphs immediately.

## 3. Synchronization & Backup
*   **Reconciliation**: The `/admin/import` endpoint uses `INSERT OR REPLACE` logic to merge backups rather than wiping data, ensuring data safety during sync.
