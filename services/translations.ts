
import { useAuth } from '../context/AuthContext';

// Define supported languages
export type Language = 'English' | 'French' | 'Spanish' | 'German';

// Dictionary Structure
type Dictionary = Record<string, string>;

const translations: Record<Language, Dictionary> = {
  English: {
    // Layout
    dashboard: "Dashboard",
    newEntry: "New Entry",
    history: "History",
    calendar: "Calendar",
    graph: "Graph View",
    map: "Map View",
    tagsMenu: "Tags",
    catalog: "Catalog",
    settings: "Settings",
    adminPanel: "Admin Panel",
    systemLogs: "System Logs",
    signOut: "Sign Out",
    interview: "Interview",
    askGemini: "Ask AI",
    
    // Dashboard
    welcomeUser: "Welcome, {name}",
    welcomeGeneric: "Welcome to Gemini Diary",
    createFirst: "Create First Entry",
    totalEntries: "Total Entries",
    avgSentiment: "Avg Sentiment",
    latestMood: "Latest Mood",
    sentimentTimeline: "Sentiment Timeline",
    moodDist: "Mood Distribution",
    loading: "Loading data...",
    noEntries: "No entries match your filters.",
    
    // New Entry
    manualEntry: "Manual Entry",
    aiCompanion: "AI Companion",
    saving: "Saving...",
    analyzing: "Analyzing...",
    saved: "Saved",
    saveAnalyze: "Save & Analyze",
    startPrompt: "Dear Diary, today I felt...",
    chatPlaceholder: "Type a message...",
    chatStart: "How was your day?",
    locationAdded: "Location added",
    exportChat: "Export Chat",
    noChatHistory: "No chat history to export.",
    addTagsPlaceholder: "Add tags (press Enter)...",
    camera: "Take Photo",
    gallery: "Gallery",
    locationTools: "Location Tools",
    entryDate: "Entry Date",
    draw: "Sketch",
    recordAudio: "Record Audio",
    stopRecording: "Stop Recording",
    suggestTags: "Suggest Tags",
    generatingTags: "Generating tags...",
    
    // Interview
    interviewTitle: "Interview Mode",
    interviewDesc: "Record a conversation or import text to build your catalog.",
    chatMode: "Chat Recording",
    importMode: "Import Text",
    startInterview: "Start Interview",
    interviewPlaceholder: "I'm ready to answer your questions...",
    importPlaceholder: "Paste interview transcript here...",
    analyzeCatalog: "Analyze & Extract",
    catalogProposal: "Catalog Proposal",
    catalogDesc: "The AI found these entities in your interview. Select the ones you want to save to your catalog.",
    saveToCatalog: "Save to Catalog",
    selectAll: "Select All",
    deselectAll: "Deselect All",
    
    // Catalog View
    catalogTitle: "Catalog",
    catalogViewDesc: "Entities and concepts extracted from your memories.",
    entities: "Entities",
    relatedEntries: "Related Entries",
    viewEntries: "View Entries",
    
    // Ask Gemini (RAG)
    askTitle: "Deep Reflection",
    askDesc: "Chat with your entire history. Ask for patterns, advice, or specific memories.",
    askPlaceholder: "e.g., 'What makes me anxious usually?' or 'Show me memories about Paris'",
    contextLoaded: "{count} memories loaded into context.",
    
    // Catalog Types
    cat_Person: "Person",
    cat_Location: "Location",
    cat_Event: "Event",
    cat_Concept: "Concept",
    cat_Book: "Book",
    cat_Movie: "Movie",
    cat_Other: "Other",

    // Editor Tools
    tool_bold: "Bold",
    tool_italic: "Italic",
    tool_strikethrough: "Strikethrough",
    tool_highlight: "Highlight",
    tool_code: "Inline Code",
    tool_codeblock: "Code Block",
    tool_quote: "Quote",
    tool_link: "Link",
    tool_link_entry: "Link Entry",
    tool_image: "Image",
    tool_table: "Table",
    tool_mermaid: "Diagram (Mermaid)",
    tool_hr: "Horizontal Rule",
    
    // History
    searchPlaceholder: "Search memories...",
    deleteConfirm: "Are you sure you want to delete this memory?",
    aiInsight: "AI Insight",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    updateLocation: "Update Location",
    enterAddress: "Enter address (Google Maps format)",
    search: "Search",
    useGps: "Use GPS",
    noLocation: "No location set",
    removeImage: "Remove Image",
    uploadImage: "Upload Image",
    locationUpdated: "Location updated",
    addressNotFound: "Address not found",
    readAloud: "Read Aloud",
    stopReading: "Stop Reading",
    
    // Tags View
    tagsTitle: "My Tags",
    totalTags: "Total Tags",
    tagsDescription: "Explore, rename, or organize the themes of your life.",
    addTag: "Add Tag",
    enterTagName: "Enter new tag name",
    renameTag: "Rename Tag",
    deleteTag: "Delete Tag",
    deleteTagConfirm: "Are you sure? This will remove the tag from {count} entries.",
    tagAdded: "Tag added successfully.",
    tagRenamed: "Tag renamed in {count} entries.",
    tagDeleted: "Tag deleted from {count} entries.",
    processing: "Processing...",

    // Settings
    profile: "Profile",
    appearance: "Appearance",
    themeMode: "Theme Mode",
    aiPersona: "AI Persona",
    aiEngine: "AI Engine (LLM)",
    aiProvider: "Provider",
    localUrl: "Local Server URL",
    localModel: "Model Name",
    localUrlPlaceholder: "e.g., http://localhost:11434/v1",
    localModelPlaceholder: "e.g., llama3",
    language: "Language",
    systemPrompt: "System Prompt",
    bio: "Bio / Personal Context",
    dataStorage: "Data & Storage",
    serverStorage: "Personal Server Storage",
    localBackup: "Local File Backup",
    saveChanges: "Save Changes",
    exportCsv: "Export JSON",
    importCsv: "Import JSON",
    exportZip: "Export ZIP Archive",
    exportZipDesc: "Download all memories with media in a structured folder hierarchy.",
    logRetention: "Log Retention (Days)",
    logRetentionHelp: "System logs older than this will be automatically deleted.",
    
    // Themes
    theme_system: "System Default",
    theme_light: "Light",
    theme_dark: "Dark",
    theme_high_contrast: "High Contrast",
    theme_custom: "Custom Palette",
    custom_primary: "Primary Color",
    custom_background: "Background Color",
    custom_surface: "Card/Surface Color",
    custom_text: "Text Color",
    
    // Filter
    filterTitle: "Filters",
    dateRange: "Date Range",
    sentimentRange: "Sentiment Range",
    moods: "Moods",
    tags: "Tags",
    entitiesFilter: "Entities",
    mediaFilter: "Media & Context",
    country: "Country",
    city: "City",
    allCountries: "All Countries",
    allCities: "All Cities",
    allMoods: "All Moods",
    allTags: "All Tags",
    apply: "Apply",
    reset: "Reset",
    
    media_hasImage: "Has Images",
    media_hasAudio: "Has Audio",
    media_hasLocation: "Has Location",
    
    // Map
    selectArea: "Select Area",
    cancelSelection: "Cancel Selection",
    viewSelection: "View {count} Memories",

    // Login
    username: "Username",
    password: "Password",
    displayName: "Display Name",
    signIn: "Sign In",
    register: "Register",
    createAccount: "Create Account",
    serverConfig: "Connection Settings",
    useRemote: "Use Remote Server",

    // Moods
    mood_Joyful: "Joyful",
    mood_Happy: "Happy",
    mood_Neutral: "Neutral",
    mood_Sad: "Sad",
    mood_Anxious: "Anxious",
    mood_Angry: "Angry",
    mood_Reflective: "Reflective",
    mood_Tired: "Tired"
  },
  French: {
    // Layout
    dashboard: "Tableau de bord",
    newEntry: "Nouvelle entrée",
    history: "Historique",
    calendar: "Calendrier",
    graph: "Vue Graphique",
    map: "Carte",
    tagsMenu: "Tags",
    catalog: "Catalogue",
    settings: "Paramètres",
    adminPanel: "Administration",
    systemLogs: "Journaux Système",
    signOut: "Déconnexion",
    interview: "Interview",
    askGemini: "Assistant IA",
    
    // Dashboard
    welcomeUser: "Bienvenue, {name}",
    welcomeGeneric: "Bienvenue sur Gemini Diary",
    createFirst: "Créer une première entrée",
    totalEntries: "Total des entrées",
    avgSentiment: "Sentiment moyen",
    latestMood: "Dernière humeur",
    sentimentTimeline: "Chronologie des sentiments",
    moodDist: "Distribution des humeurs",
    loading: "Chargement...",
    noEntries: "Aucune entrée ne correspond à vos filtres.",

    // New Entry
    manualEntry: "Entrée manuelle",
    aiCompanion: "Compagnon IA",
    saving: "Enregistrement...",
    analyzing: "Analyse...",
    saved: "Enregistré",
    saveAnalyze: "Enregistrer & Analyser",
    startPrompt: "Cher Journal, aujourd'hui je me suis senti...",
    chatPlaceholder: "Écrivez un message...",
    chatStart: "Comment s'est passée votre journée ?",
    locationAdded: "Localisation ajoutée",
    exportChat: "Exporter la discussion",
    noChatHistory: "Aucun historique de discussion à exporter.",
    addTagsPlaceholder: "Ajouter des tags (Entrée)...",
    camera: "Prendre Photo",
    gallery: "Galerie",
    locationTools: "Outils de localisation",
    entryDate: "Date de l'entrée",
    draw: "Dessiner",
    recordAudio: "Enregistrer Audio",
    stopRecording: "Arrêter l'enregistrement",
    suggestTags: "Suggérer des Tags",
    generatingTags: "Génération des tags...",
    
    // Interview
    interviewTitle: "Mode Interview",
    interviewDesc: "Enregistrez une conversation ou importez un texte pour enrichir votre catalogue.",
    chatMode: "Enregistrement Chat",
    importMode: "Importer Texte",
    startInterview: "Démarrer l'Interview",
    interviewPlaceholder: "Je suis prêt à répondre à vos questions...",
    importPlaceholder: "Collez la transcription de l'interview ici...",
    analyzeCatalog: "Analyser & Extraire",
    catalogProposal: "Proposition de Catalogue",
    catalogDesc: "L'IA a identifié ces entités. Sélectionnez celles à sauvegarder.",
    saveToCatalog: "Sauvegarder au Catalogue",
    selectAll: "Tout sélectionner",
    deselectAll: "Tout désélectionner",

    // Catalog View
    catalogTitle: "Catalogue",
    catalogViewDesc: "Entités et concepts extraits de vos souvenirs.",
    entities: "Entités",
    relatedEntries: "Entrées liées",
    viewEntries: "Voir les entrées",

    // Ask Gemini
    askTitle: "Réflexion Profonde",
    askDesc: "Discutez avec votre historique complet. Cherchez des tendances ou des souvenirs précis.",
    askPlaceholder: "ex: 'Qu'est-ce qui me rend anxieux ?' ou 'Montre-moi les souvenirs de Paris'",
    contextLoaded: "{count} souvenirs chargés dans le contexte.",

    // Catalog Types
    cat_Person: "Personne",
    cat_Location: "Lieu",
    cat_Event: "Événement",
    cat_Concept: "Concept",
    cat_Book: "Livre",
    cat_Movie: "Film",
    cat_Other: "Autre",
    
    // Editor Tools
    tool_bold: "Gras",
    tool_italic: "Italique",
    tool_strikethrough: "Barré",
    tool_highlight: "Surligné",
    tool_code: "Code en ligne",
    tool_codeblock: "Bloc de code",
    tool_quote: "Citation",
    tool_link: "Lien",
    tool_link_entry: "Lier une entrée",
    tool_image: "Image",
    tool_table: "Table",
    tool_mermaid: "Diagramme (Mermaid)",
    tool_hr: "Ligne horizontale",
    
    // History
    searchPlaceholder: "Rechercher...",
    deleteConfirm: "Êtes-vous sûr de vouloir supprimer ce souvenir ?",
    aiInsight: "Aperçu IA",
    edit: "Modifier",
    delete: "Supprimer",
    save: "Enregistrer",
    cancel: "Annuler",
    updateLocation: "Mettre à jour la localisation",
    enterAddress: "Entrez une adresse",
    search: "Rechercher",
    useGps: "Utiliser GPS",
    noLocation: "Aucune localisation",
    removeImage: "Supprimer l'image",
    uploadImage: "Ajouter une image",
    locationUpdated: "Localisation mise à jour",
    addressNotFound: "Adresse introuvable",
    readAloud: "Lire à haute voix",
    stopReading: "Arrêter la lecture",
    
    // Tags View
    tagsTitle: "Mes Tags",
    totalTags: "Total des Tags",
    tagsDescription: "Explorez, renommez ou organisez les thèmes de votre vie.",
    addTag: "Ajouter un Tag",
    enterTagName: "Entrez le nom du tag",
    renameTag: "Renommer le Tag",
    deleteTag: "Supprimer le Tag",
    deleteTagConfirm: "Êtes-vous sûr ? Cela supprimera le tag de {count} entrées.",
    tagAdded: "Tag ajouté avec succès.",
    tagRenamed: "Tag renommé dans {count} entrées.",
    tagDeleted: "Tag supprimé de {count} entrées.",
    processing: "Traitement...",
    
    // Settings
    profile: "Profil",
    appearance: "Apparence",
    themeMode: "Mode Thème",
    aiPersona: "Persona IA",
    aiEngine: "Moteur IA (LLM)",
    aiProvider: "Fournisseur",
    localUrl: "URL Serveur Local",
    localModel: "Nom du Modèle",
    localUrlPlaceholder: "ex: http://localhost:11434/v1",
    localModelPlaceholder: "ex: llama3",
    language: "Langue",
    systemPrompt: "Prompt Système",
    bio: "Biographie / Contexte Personnel",
    dataStorage: "Données et Stockage",
    serverStorage: "Stockage Serveur Personnel",
    localBackup: "Sauvegarde Locale",
    saveChanges: "Sauvegarder",
    exportCsv: "Exporter JSON",
    importCsv: "Importer JSON",
    exportZip: "Exporter Archive ZIP",
    exportZipDesc: "Télécharger tous les souvenirs avec médias dans une structure hiérarchique.",
    logRetention: "Rétention des logs (Jours)",
    logRetentionHelp: "Les journaux système plus anciens seront automatiquement supprimés.",
    
    // Themes
    theme_system: "Système",
    theme_light: "Clair",
    theme_dark: "Sombre",
    theme_high_contrast: "Contraste Élevé",
    theme_custom: "Palette Personnalisée",
    custom_primary: "Couleur Principale",
    custom_background: "Couleur de Fond",
    custom_surface: "Couleur des Cartes",
    custom_text: "Couleur du Texte",
    
    // Filter
    filterTitle: "Filtres",
    dateRange: "Plage de dates",
    sentimentRange: "Plage de sentiment",
    moods: "Humeurs",
    tags: "Tags",
    entitiesFilter: "Entités",
    mediaFilter: "Médias & Contexte",
    country: "Pays",
    city: "Ville",
    allCountries: "Tous les pays",
    allCities: "Toutes les villes",
    allMoods: "Toutes les humeurs",
    allTags: "Tous les tags",
    apply: "Appliquer",
    reset: "Réinitialiser",
    
    media_hasImage: "Avec Images",
    media_hasAudio: "Avec Audio",
    media_hasLocation: "Avec Localisation",
    
    // Map
    selectArea: "Sélectionner",
    cancelSelection: "Annuler Sélection",
    viewSelection: "Voir {count} Souvenirs",

    // Login
    username: "Nom d'utilisateur",
    password: "Mot de passe",
    displayName: "Nom d'affichage",
    signIn: "Se connecter",
    register: "S'inscrire",
    createAccount: "Créer un compte",
    serverConfig: "Paramètres de connexion",
    useRemote: "Utiliser un serveur distant",

    // Moods
    mood_Joyful: "Joyeux",
    mood_Happy: "Heureux",
    mood_Neutral: "Neutre",
    mood_Sad: "Triste",
    mood_Anxious: "Anxieux",
    mood_Angry: "En colère",
    mood_Reflective: "Pensif",
    mood_Tired: "Fatigué"
  },
  Spanish: {}, 
  German: {}
};

export const useTranslation = () => {
  const { user } = useAuth();
  // Default to English if user preference isn't set or language not found
  const lang = (user?.preferences?.language as Language) || 'English';
  
  const t = (key: string, params?: Record<string, string>) => {
    // Fallback to English if translation missing in target language
    const dict = translations[lang] && translations[lang][key] ? translations[lang] : translations['English'];
    let text = dict[key] || key;
    
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };

  return { t, lang };
};
