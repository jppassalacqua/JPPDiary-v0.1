

// Function to get environment variable safely
const getEnvVar = (key: string, processKey: string) => {
    try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        return import.meta.env[key] || '';
      }
    } catch (e) {}
    try {
      if (typeof process !== 'undefined' && process.env) {
        return process.env[processKey] || '';
      }
    } catch (e) {}
    return '';
};

const GOOGLE_MAPS_API_KEY = getEnvVar('VITE_GOOGLE_MAPS_API_KEY', 'REACT_APP_GOOGLE_MAPS_API_KEY');

interface LocationDetails {
    address: string;
    city: string;
    country: string;
}

export const mapService = {
  /**
   * Converts a text address into coordinates using Google Geocoding API or OSM Nominatim
   */
  geocodeAddress: async (address: string): Promise<{ lat: number; lng: number } | null> => {
    // 1. Google Maps (Preferred if Key exists)
    if (GOOGLE_MAPS_API_KEY) {
        try {
            const encoded = encodeURIComponent(address);
            const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_MAPS_API_KEY}`);
            const data = await response.json();

            if (data.status === 'OK' && data.results.length > 0) {
                const location = data.results[0].geometry.location;
                return {
                    lat: location.lat,
                    lng: location.lng
                };
            }
        } catch (error) {
            console.error("Google Geocoding fetch error:", error);
        }
    } 
    
    // 2. OpenStreetMap Nominatim (Fallback - Free)
    try {
        const encoded = encodeURIComponent(address);
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encoded}`, {
            headers: {
                'Accept-Language': 'en-US,en;q=0.9',
                // It is good practice to include a user agent or identifying header
                // 'User-Agent': 'GeminiDiary/1.0' 
            }
        });
        const data = await response.json();

        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        }
    } catch (error) {
        console.error("Nominatim Geocoding error:", error);
    }

    return null;
  },

  /**
   * Converts coordinates into Address, City, Country
   */
  reverseGeocode: async (lat: number, lng: number): Promise<LocationDetails> => {
    const result: LocationDetails = { address: '', city: '', country: '' };
    
    // 1. Google Maps (Preferred)
    if (GOOGLE_MAPS_API_KEY) {
        try {
            const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`);
            const data = await response.json();

            if (data.status === 'OK' && data.results.length > 0) {
                const components = data.results[0].address_components;
                result.address = data.results[0].formatted_address;

                components.forEach((comp: any) => {
                    if (comp.types.includes('locality')) {
                        result.city = comp.long_name;
                    } else if (!result.city && comp.types.includes('administrative_area_level_2')) {
                        result.city = comp.long_name;
                    }
                    
                    if (comp.types.includes('country')) {
                        result.country = comp.long_name;
                    }
                });
                return result;
            }
        } catch (error) {
            console.error("Google Reverse geocoding error:", error);
        }
    }

    // 2. OpenStreetMap Nominatim (Fallback)
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
            headers: {
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        const data = await response.json();

        if (data && data.address) {
            result.address = data.display_name;
            result.city = data.address.city || data.address.town || data.address.village || data.address.county || '';
            result.country = data.address.country || '';
        }
    } catch (error) {
        console.error("Nominatim Reverse geocoding error:", error);
    }

    return result;
  },

  /**
   * Get current GPS position wrapped in a promise
   */
  getCurrentPosition: (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported"));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                });
            },
            (err) => reject(err)
        );
    });
  }
};