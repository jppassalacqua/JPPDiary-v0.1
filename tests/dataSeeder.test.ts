
import { describe, it, expect } from 'vitest';
import { seedDatabase } from '../services/dataSeeder';
import { db } from '../services/db';

describe('Data Seeder', () => {
    it('initializes test data for the test user', async () => {
        // Execute the seeder
        await seedDatabase();

        // Verify Users
        const users = await db.getUsers();
        const admin = users.find(u => u.username === 'admin');
        const testUser = users.find(u => u.username === 'test');

        expect(admin).toBeDefined();
        expect(testUser).toBeDefined();

        // Verify Data Generation
        if (testUser) {
            const entries = await db.getEntries(testUser.id);
            // We expect a significant number of entries (5 years * 12 months * ~5 entries = ~300+)
            expect(entries.length).toBeGreaterThan(100);
            
            const catalog = await db.getCatalog(testUser.id);
            expect(catalog.length).toBeGreaterThan(0);
        }
    });
});
