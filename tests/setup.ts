import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock LocalStorage
const localStorageMock = (function() {
  let store: Record<string, string> = {};
  return {
    getItem: function(key: string) {
      return store[key] || null;
    },
    setItem: function(key: string, value: string) {
      store[key] = value.toString();
    },
    removeItem: function(key: string) {
      delete store[key];
    },
    clear: function() {
      store = {};
    }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock ResizeObserver (Required for Recharts)
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Canvas (Required for GraphView/Drawing)
HTMLCanvasElement.prototype.getContext = () => {
    return {
        fillRect: () => {},
        clearRect: () => {},
        getImageData: () => ({ data: [] }),
        putImageData: () => {},
        createImageData: () => ([]),
        setTransform: () => {},
        drawImage: () => {},
        save: () => {},
        fillText: () => {},
        restore: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        stroke: () => {},
        translate: () => {},
        scale: () => {},
        rotate: () => {},
        arc: () => {},
        fill: () => {},
        measureText: () => ({ width: 0 }),
        transform: () => {},
        rect: () => {},
        clip: () => {},
    } as any;
};

HTMLCanvasElement.prototype.toDataURL = () => "";

// Mock Geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn()
};
// @ts-ignore
globalThis.navigator.geolocation = mockGeolocation;

// Mock SpeechSynthesis
Object.defineProperty(window, 'speechSynthesis', {
    value: {
        speak: vi.fn(),
        cancel: vi.fn(),
        onvoiceschanged: null,
        getVoices: () => []
    }
});
globalThis.SpeechSynthesisUtterance = vi.fn() as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Google & Leaflet globals (just existence)
(globalThis as any).google = undefined;
(globalThis as any).L = {
    map: () => ({
        setView: () => ({
            addTo: () => {}
        }),
        remove: () => {},
        invalidateSize: () => {},
        fitBounds: () => {}
    }),
    tileLayer: () => ({ addTo: () => {} }),
    layerGroup: () => ({ addTo: () => ({ clearLayers: () => {}, addLayer: () => {} }) }),
    divIcon: () => {},
    marker: () => ({ bindPopup: () => ({}) }),
    latLngBounds: () => ({ extend: () => {} }),
    polyline: () => ({ addTo: () => {} })
};