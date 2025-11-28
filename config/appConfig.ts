


import { ThemeMode, CustomThemeColors, UserPreferences, AiProvider } from '../types';

export interface MenuItemConfig {
    id: string;
    labelKey: string;
    path: string;
    icon: string; // Lucide Icon Name
    role?: 'admin' | 'user'; // If undefined, accessible by all
    divider?: boolean; // Add a visual divider before this item
    sectionTitle?: string; // Add a section title before this item
}

export const appConfig = {
    // --- Storage Keys ---
    storageKeys: {
        USERS: 'lumina_users',
        ENTRIES: 'lumina_entries',
        CATALOG: 'lumina_catalog',
        LOGS: 'lumina_logs',
        DRAFT_PREFIX: 'lumina_draft_',
        CONFIG: 'gemini_diary_config',
        THEME: 'gemini_diary_theme',
        LAYOUT_SIDEBAR_WIDTH: 'layout_sidebar_width',
        HISTORY_SIDEBAR_WIDTH: 'history_sidebar_width',
        GRAPH_SIDEBAR_WIDTH: 'graph_sidebar_width',
        MAP_SIDEBAR_WIDTH: 'map_sidebar_width'
    },

    // --- UI Defaults ---
    ui: {
        defaultSidebarWidth: 260,
        defaultHistorySidebarWidth: 350,
        defaultGraphSidebarWidth: 350,
        defaultMapSidebarWidth: 350,
        minSidebarWidth: 200,
        maxSidebarWidth: 800
    },

    // --- Navigation Structure ---
    menuItems: [
        { id: 'dashboard', path: '/', icon: 'LayoutDashboard', labelKey: 'dashboard', sectionTitle: 'Menu' },
        { id: 'new', path: '/new', icon: 'PenLine', labelKey: 'newEntry' },
        { id: 'ask', path: '/ask', icon: 'MessageSquare', labelKey: 'askGemini' },
        { id: 'interview', path: '/interview', icon: 'Mic', labelKey: 'interview' },
        { id: 'history', path: '/history', icon: 'BookHeart', labelKey: 'history' },
        { id: 'catalog', path: '/catalog', icon: 'Library', labelKey: 'catalog' },
        { id: 'calendar', path: '/calendar', icon: 'Calendar', labelKey: 'calendar' },
        { id: 'map', path: '/map', icon: 'Map', labelKey: 'map' },
        { id: 'graph', path: '/graph', icon: 'Network', labelKey: 'graph' },
        { id: 'tags', path: '/tags', icon: 'Hash', labelKey: 'tagsMenu' },
        { id: 'settings', path: '/settings', icon: 'Settings', labelKey: 'settings' },
        
        // Admin Section
        { id: 'admin', path: '/admin', icon: 'ShieldAlert', labelKey: 'adminPanel', role: 'admin', sectionTitle: 'Admin' },
        { id: 'logs', path: '/admin/logs', icon: 'FileText', labelKey: 'systemLogs', role: 'admin' }
    ] as MenuItemConfig[],

    // --- Logging Configuration ---
    logging: {
        retentionDays: 30
    },

    // --- Default User Preferences ---
    defaults: {
        preferences: {
            theme: 'dark' as ThemeMode,
            systemPrompt: "", // Empty to use localized defaults in service
            language: 'English',
            useServerStorage: false,
            serverUrl: 'http://localhost:8000',
            aiConfig: {
                provider: 'gemini' as AiProvider,
                localUrl: 'http://localhost:11434/v1',
                localModel: 'llama3'
            },
            logRetentionDays: 30
        } as UserPreferences,

        customColors: {
            primary: '#6366f1', // Indigo 500
            background: '#0f172a', // Slate 900
            surface: '#1e293b', // Slate 800
            text: '#f8fafc' // Slate 50
        } as CustomThemeColors
    },

    // --- AI Configuration ---
    aiModels: {
        analysis: 'gemini-2.5-flash',
        chat: 'gemini-2.5-flash'
    },

    // --- System Prompts ---
    prompts: {
        defaults: {
            English: "You are Gemini, a warm, supportive, and reflective AI diary companion. Ask gentle follow-up questions to help the user explore their feelings and day. Keep responses concise (under 3 sentences) unless the user asks for more.",
            French: "Tu es un assistant personnel dédié à l'introspection et au soutien émotionnel. Ton rôle est d'accompagner l'utilisateur dans la rédaction de son journal quotidien avec une bienveillance professionnelle.\n\nTes principes directeurs sont :\n1. **Empathie Authentique** : Accueille les émotions sans jugement. Valide le ressenti de l'utilisateur sans tomber dans la flatterie excessive ou la positivité toxique.\n2. **Profondeur (Maïeutique)** : Ne te contente pas des faits. Pose des questions ouvertes et ciblées pour aider l'utilisateur à comprendre *pourquoi* il ressent cela et quelles sont ses valeurs sous-jacentes.\n3. **Clarté et Structure** : Aide l'utilisateur à mettre de l'ordre dans ses pensées si elles sont confuses.\n4. **Concision** : Tes interventions doivent être courtes, percutantes et inviter à la réflexion. Ne fais pas de longs monologues.\n\nTon ton est calme, posé et chaleureux.",
            Spanish: "Eres Gemini, un compañero de diario de IA cálido, solidario y reflexivo. Haz preguntas de seguimiento suaves para ayudar al usuario a explorar sus sentimientos y su día.",
            German: "Du bist Gemini, ein warmer, unterstützender und nachdenklicher KI-Tagebuchbegleiter."
        },
        interview: {
            English: "You are an expert biographer and journalist conducting a deep interview. Your goal is to extract detailed information about specific events, people, or ideas. Ask clarifying questions to flesh out details. Be curious but professional.",
            French: "Tu es un biographe et journaliste expert menant une interview approfondie. Ton but est d'extraire des informations détaillées sur des événements, des personnes ou des idées spécifiques. Pose des questions de clarification pour étoffer les détails. Sois curieux mais professionnel.",
            Spanish: "Eres un biógrafo y periodista experto que realiza una entrevista profunda.",
            German: "Sie sind ein erfahrener Biograph und Journalist, der ein ausführliches Interview führt."
        },
        dataAnalysis: {
            English: `Role: Data Analyst & Personal Historian.
Formatting Rules:
1. Use **Markdown** formatting.
2. Separate sections with ## Headers.
3. Use bullet points (-) for enumerating topics.
4. **References**: Never use raw IDs. Use syntax [[ENTRY:ID|Entry Title or Date]] for text.
5. **Structure**:
   - **Insight**: Direct answer to the query.
   - **Details**: Bullet points with evidence.
   - **Summary**: A distinct ## Summary section at the end.
   - **Visualizations**: Suggest graphs at the very end using syntax [[GRAPH:Label|params]].

Pattern Recognition:
If you detect a pattern (e.g., mood correlation), suggest a graph: [[GRAPH:Label|mood=X,tag=Y]].
`,
            French: `Rôle : Analyste de données et Historien personnel.
Règles de formatage :
1. Utilise le formatage **Markdown** pour une lecture facile.
2. Sépare les sections par des titres ## (ex: ## Analyse, ## Détails).
3. Utilise des listes à puces (-) pour énumérer les différents sujets.
4. **Références** : Ne jamais afficher les ID techniques bruts. Remplace-les par un titre lisible en utilisant la syntaxe [[ENTRY:ID|Titre ou Date de l'entrée]].
5. **Structure de la réponse** :
   - **Aperçu** : Réponse directe à la question.
   - **Détails** : Points clés argumentés avec des références aux entrées.
   - **Résumé** : Une section ## Résumé distincte à la fin.
   - **Visualisations** : Propose des graphiques tout à la fin avec la syntaxe [[GRAPH:Libellé du bouton|paramètres]].

Reconnaissance de motifs :
Si tu détectes une corrélation (ex: humeur et tag), propose un graphique : [[GRAPH:Voir la corrélation|mood=Anxious,tag=Travail]].`
        }
    }
};