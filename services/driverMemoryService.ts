export interface SavedDriver {
  id: string;
  driverName: string;
  driverPhone: string;
  plateNumber: string;
  lastUsed: number;
}

const STORAGE_KEY = 'SAVED_DRIVERS_MEMORY';

export const getSavedDrivers = (): SavedDriver[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
      }
    }
  } catch (e) {
    console.error('Failed to read saved drivers', e);
  }
  return [];
};

export const saveDriverToMemory = (driver: { driverName: string; driverPhone?: string; plateNumber?: string }) => {
  if (!driver.driverName && !driver.plateNumber) return;
  try {
    const current = getSavedDrivers();
    const cleanName = (driver.driverName || '').trim();
    const cleanPhone = (driver.driverPhone || '').trim();
    const cleanPlate = (driver.plateNumber || '').trim();

    // Check if driver already exists by name or plate
    const existingIndex = current.findIndex(d => 
      (cleanName && d.driverName.toLowerCase() === cleanName.toLowerCase()) ||
      (cleanPlate && d.plateNumber.replace(/\s/g, '') === cleanPlate.replace(/\s/g, ''))
    );

    if (existingIndex >= 0) {
      // Update existing
      current[existingIndex] = {
        ...current[existingIndex],
        driverName: cleanName || current[existingIndex].driverName,
        driverPhone: cleanPhone || current[existingIndex].driverPhone,
        plateNumber: cleanPlate || current[existingIndex].plateNumber,
        lastUsed: Date.now()
      };
    } else {
      // Add new
      current.push({
        id: 'driver_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        driverName: cleanName,
        driverPhone: cleanPhone,
        plateNumber: cleanPlate,
        lastUsed: Date.now()
      });
    }

    // Keep top 100 most recent
    const trimmed = current.slice(0, 100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save driver memory', e);
  }
};

export const searchSavedDrivers = (query: string): SavedDriver[] => {
  if (!query || query.trim().length === 0) {
    return getSavedDrivers().slice(0, 10);
  }
  const q = query.trim().toLowerCase();
  const all = getSavedDrivers();
  return all.filter(d => 
    d.driverName.toLowerCase().includes(q) ||
    d.driverPhone.includes(q) ||
    d.plateNumber.toLowerCase().includes(q)
  ).slice(0, 10);
};
