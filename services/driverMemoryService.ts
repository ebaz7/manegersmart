export interface SavedDriver {
  id: string;
  driverName: string;
  driverPhone: string;
  plateNumber: string;
  lastUsed: number;
}

const STORAGE_KEY = 'SAVED_DRIVERS_MEMORY';

// Normalize Persian/Arabic text and digits for uniform comparison
export const normalizeText = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/[۰-۹]/g, d => (d.charCodeAt(0) - 1776).toString())
    .replace(/[٠-٩]/g, d => (d.charCodeAt(0) - 1632).toString())
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

export const normalizePlate = (plate: string): string => {
  if (!plate) return '';
  return normalizeText(plate)
    .replace(/\s+/g, '')
    .replace(/[-|_/]/g, '')
    .replace(/ایران/g, '');
};

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
  const cleanName = (driver.driverName || '').trim();
  const cleanPhone = (driver.driverPhone || '').trim();
  const cleanPlate = (driver.plateNumber || '').trim();

  if (!cleanName && !cleanPlate) return;

  try {
    const current = getSavedDrivers();

    const normName = normalizeText(cleanName);
    const normPlate = normalizePlate(cleanPlate);

    // Check if driver already exists by name or plate
    const existingIndex = current.findIndex(d => {
      const dName = normalizeText(d.driverName);
      const dPlate = normalizePlate(d.plateNumber);
      return (normName && dName === normName) || (normPlate && dPlate === normPlate);
    });

    if (existingIndex >= 0) {
      // Update existing driver information so changes are instantly reflected
      current[existingIndex] = {
        ...current[existingIndex],
        driverName: cleanName || current[existingIndex].driverName,
        driverPhone: cleanPhone !== undefined && cleanPhone !== '' ? cleanPhone : current[existingIndex].driverPhone,
        plateNumber: cleanPlate !== undefined && cleanPlate !== '' ? cleanPlate : current[existingIndex].plateNumber,
        lastUsed: Date.now()
      };
    } else {
      // Add new driver
      current.unshift({
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

    // Dispatch custom event to notify all components to refresh suggestions / chips
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('driver-memory-updated', { detail: current[0] }));
    }
  } catch (e) {
    console.error('Failed to save driver memory', e);
  }
};

export const findDriverByName = (name: string): SavedDriver | undefined => {
  if (!name || name.trim().length === 0) return undefined;
  const norm = normalizeText(name);
  const all = getSavedDrivers();
  
  // 1. Exact normalized match
  const exact = all.find(d => normalizeText(d.driverName) === norm);
  if (exact) return exact;

  // 2. Starts with or includes if query has at least 3 characters
  if (norm.length >= 3) {
    const prefixMatch = all.find(d => {
      const dNorm = normalizeText(d.driverName);
      return dNorm.startsWith(norm) || norm.startsWith(dNorm);
    });
    if (prefixMatch) return prefixMatch;

    const partial = all.find(d => normalizeText(d.driverName).includes(norm));
    if (partial) return partial;
  }

  return undefined;
};

export const findDriverByPlate = (plate: string): SavedDriver | undefined => {
  if (!plate || plate.trim().length === 0) return undefined;
  const normP = normalizePlate(plate);
  if (normP.length < 2) return undefined;

  const all = getSavedDrivers();
  // 1. Exact plate match
  const exact = all.find(d => normalizePlate(d.plateNumber) === normP);
  if (exact) return exact;

  // 2. Contains match if length >= 4
  if (normP.length >= 4) {
    const partial = all.find(d => {
      const dPlate = normalizePlate(d.plateNumber);
      return dPlate && (dPlate.includes(normP) || normP.includes(dPlate));
    });
    if (partial) return partial;
  }

  return undefined;
};

export const searchSavedDrivers = (query: string): SavedDriver[] => {
  const all = getSavedDrivers();
  if (!query || query.trim().length === 0) {
    return all.slice(0, 10);
  }
  const qNorm = normalizeText(query);
  const qPlate = normalizePlate(query);

  return all.filter(d => {
    const dName = normalizeText(d.driverName);
    const dPhone = (d.driverPhone || '');
    const dPlate = normalizePlate(d.plateNumber);

    return (
      dName.includes(qNorm) ||
      dPhone.includes(qNorm) ||
      (qPlate.length >= 2 && dPlate.includes(qPlate))
    );
  }).slice(0, 10);
};

// Sync historical records (from exit permits or security logs) into driver memory
export const syncDriversFromRecords = (records: Array<{ driverName?: string; driverPhone?: string; plateNumber?: string }>) => {
  if (!Array.isArray(records) || records.length === 0) return;
  try {
    const current = getSavedDrivers();
    let modified = false;

    for (const r of records) {
      const name = (r.driverName || '').trim();
      const phone = (r.driverPhone || '').trim();
      const plate = (r.plateNumber || '').trim();

      if (!name && !plate) continue;

      const normN = normalizeText(name);
      const normP = normalizePlate(plate);

      const existsIdx = current.findIndex(d => {
        const dN = normalizeText(d.driverName);
        const dP = normalizePlate(d.plateNumber);
        return (normN && dN === normN) || (normP && dP === normP);
      });

      if (existsIdx >= 0) {
        // Update missing fields if new record has them
        if (!current[existsIdx].driverPhone && phone) {
          current[existsIdx].driverPhone = phone;
          modified = true;
        }
        if (!current[existsIdx].plateNumber && plate) {
          current[existsIdx].plateNumber = plate;
          modified = true;
        }
      } else {
        current.push({
          id: 'driver_sync_' + Math.random().toString(36).substring(2, 8),
          driverName: name,
          driverPhone: phone,
          plateNumber: plate,
          lastUsed: Date.now() - 1000000 // lower priority than actively used
        });
        modified = true;
      }
    }

    if (modified) {
      const trimmed = current.slice(0, 100);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    }
  } catch (e) {
    console.error('Error syncing drivers from records:', e);
  }
};

