
import { db } from './db';
import { User, DiaryEntry, CatalogEntry, Mood, EntryMode, CatalogItemType } from '../types';
import { appConfig } from '../config/appConfig';

export const seedDatabase = async () => {
    try {
        const users = await db.getUsers();
        
        // 1. Admin User
        // Password 'admin' -> sha256 -> 8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918
        if (!users.find(u => u.username === 'admin')) {
            const adminUser: User = {
                id: 'admin-id-default',
                username: 'admin',
                password: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
                displayName: 'Administrator',
                role: 'admin',
                preferences: { ...appConfig.defaults.preferences },
                bio: 'System Administrator'
            };
            await db.saveUser(adminUser);
            console.log("[Seeder] Initialized default admin user");
        }

        // 2. Test User
        // Password 'test' -> sha256 -> 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
        let testUser = users.find(u => u.username === 'test');
        if (!testUser) {
            testUser = {
                id: 'test-id-default',
                username: 'test',
                password: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
                displayName: 'Test User',
                role: 'user',
                preferences: { ...appConfig.defaults.preferences },
                bio: 'Demo User with 5 years of history.'
            };
            await db.saveUser(testUser);
            console.log("[Seeder] Initialized default test user");
        }

        // 3. Generate Data if empty
        const entries = await db.getEntries(testUser!.id);
        if (entries.length === 0) {
            console.log("[Seeder] Generating 5 years of test data for 'test' user...");
            
            const moods = Object.values(Mood);
            const entryModes = [EntryMode.Manual, EntryMode.Chat];
            const entitiesPool = [
                { name: "Alice", type: "Person" }, { name: "Bob", type: "Person" }, { name: "Charlie", type: "Person" },
                { name: "Paris", type: "Location" }, { name: "London", type: "Location" }, { name: "Tokyo", type: "Location" },
                { name: "The Matrix", type: "Movie" }, { name: "Inception", type: "Movie" },
                { name: "1984", type: "Book" }, { name: "Dune", type: "Book" },
                { name: "Freedom", type: "Concept" }, { name: "Anxiety", type: "Concept" }
            ];
            
            const templates = [
                "Today was {Mood}. I met {Entity} and we talked about {Entity2}.",
                "Feeling {Mood} about the upcoming {Entity}.",
                "Visited {Entity} today. It was quite {Mood}.",
                "Thinking about {Entity}. {Mood} thoughts.",
                "Just a simple note. Feeling {Mood}.",
                "Had a long conversation with {Entity} regarding {Entity2}."
            ];

            const generatedEntries: DiaryEntry[] = [];
            const generatedCatalog: CatalogEntry[] = [];
            const catalogMap = new Set<string>();

            const startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() - 5);
            const endDate = new Date();

            let cursorDate = new Date(startDate);

            while (cursorDate < endDate) {
                // 5 to 10 entries per month
                const count = Math.floor(Math.random() * 6) + 5;
                
                for (let i = 0; i < count; i++) {
                    // Random date within this month
                    const entryDate = new Date(cursorDate);
                    entryDate.setDate(Math.floor(Math.random() * 28) + 1);
                    entryDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
                    
                    if (entryDate > endDate) continue;

                    const mood = moods[Math.floor(Math.random() * moods.length)];
                    const ent1 = entitiesPool[Math.floor(Math.random() * entitiesPool.length)];
                    const ent2 = entitiesPool[Math.floor(Math.random() * entitiesPool.length)];
                    
                    let content = templates[Math.floor(Math.random() * templates.length)]
                        .replace("{Mood}", mood.toLowerCase())
                        .replace("{Entity}", ent1.name)
                        .replace("{Entity2}", ent2.name);

                    const entryId = crypto.randomUUID();
                    
                    // Some locations
                    const hasLocation = Math.random() > 0.6;
                    const lat = 35 + (Math.random() * 20); 
                    const lng = -10 + (Math.random() * 40);

                    const entry: DiaryEntry = {
                        id: entryId,
                        userId: testUser!.id,
                        timestamp: entryDate.getTime(),
                        content: content,
                        mode: entryModes[Math.floor(Math.random() * entryModes.length)],
                        analysis: {
                            mood: mood,
                            sentimentScore: (Math.random() * 2) - 1,
                            summary: content,
                            entities: [
                                { name: ent1.name, type: ent1.type as CatalogItemType },
                                { name: ent2.name, type: ent2.type as CatalogItemType }
                            ],
                            manualTags: [mood.toLowerCase(), "generated"]
                        },
                        location: hasLocation ? { lat, lng } : undefined,
                        country: hasLocation ? "GenLand" : undefined,
                        city: hasLocation ? "GenCity" : undefined
                    };

                    generatedEntries.push(entry);

                    // Add to catalog
                    [ent1, ent2].forEach(ent => {
                        const key = `${ent.name}-${ent.type}`;
                        if (!catalogMap.has(key)) {
                            catalogMap.add(key);
                            generatedCatalog.push({
                                id: crypto.randomUUID(),
                                userId: testUser!.id,
                                sourceEntryId: entryId,
                                name: ent.name,
                                type: ent.type as CatalogItemType,
                                description: "Generated entity",
                                tags: ["auto"],
                                timestamp: Date.now()
                            });
                        }
                    });
                }
                cursorDate.setMonth(cursorDate.getMonth() + 1);
            }

            for (const e of generatedEntries) await db.saveEntry(e);
            for (const c of generatedCatalog) await db.saveCatalogEntry(c);
            
            console.log(`[Seeder] Generated ${generatedEntries.length} entries for test user.`);
        }
    } catch (e) {
        console.warn("[Seeder] Failed to initialize test data", e);
    }
};
