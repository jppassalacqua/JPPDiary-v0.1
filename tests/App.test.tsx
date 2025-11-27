
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '../App';
import { act } from 'react-dom/test-utils';

// Mock AuthContext to simulate logged in user for protected routes
const mockUser = {
    id: 'test-id',
    username: 'testuser',
    displayName: 'Test User',
    role: 'user',
    preferences: {
        theme: 'dark',
        language: 'English',
        systemPrompt: ''
    }
};

// Helper to render app
const renderApp = () => render(<App />);

describe('Gemini Diary App Integration', () => {
    
    it('renders login page initially when no user is authenticated', async () => {
        renderApp();
        expect(screen.getByText(/Gemini Diary/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/e.g., star_gazer/i)).toBeInTheDocument();
    });

    it('allows a user to "login" (mocked) and see the dashboard', async () => {
        // We need to mock the DB service or AuthContext for a real flow, 
        // or we can manually set localStorage to simulate a session before render
        
        // Mocking local storage for "remembered" session
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
            if (key === 'lumina_session_user_id') return 'test-user-id';
            if (key === 'lumina_users') return JSON.stringify([mockUser]);
            return null;
        });

        // Mock DB getUserById
        const dbModule = await import('../services/db');
        vi.spyOn(dbModule.db, 'getUserById').mockResolvedValue(mockUser as any);
        vi.spyOn(dbModule.db, 'getEntries').mockResolvedValue([]);

        await act(async () => {
            renderApp();
        });

        // Check for Dashboard elements
        await waitFor(() => {
            expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
            expect(screen.getByText(/New Entry/i)).toBeInTheDocument();
        });
    });

    it('navigates to different views without crashing', async () => {
        // Setup authenticated session
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
            if (key === 'lumina_session_user_id') return 'test-id';
            return null;
        });
        const dbModule = await import('../services/db');
        vi.spyOn(dbModule.db, 'getUserById').mockResolvedValue(mockUser as any);
        vi.spyOn(dbModule.db, 'getEntries').mockResolvedValue([]);

        await act(async () => {
            renderApp();
        });

        // 1. Go to History
        const historyLink = screen.getByText('History');
        fireEvent.click(historyLink);
        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Search memories/i)).toBeInTheDocument();
        });

        // 2. Go to Map (Critical check for crash)
        const mapLink = screen.getByText('Map View');
        fireEvent.click(mapLink);
        await waitFor(() => {
            // Should render the map container and not crash
            expect(screen.getByText(/Map View/i)).toBeInTheDocument();
        });

        // 3. Go to Calendar
        const calendarLink = screen.getByText('Calendar');
        fireEvent.click(calendarLink);
        await waitFor(() => {
            expect(screen.getByText(/Month View/i)).toBeInTheDocument();
        });
    });
});
