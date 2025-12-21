import { useState, useEffect, useCallback, useMemo } from 'react';

export type KanbanDensity = 'comfortable' | 'compact' | 'tv';

interface KanbanDensityConfig {
  columnWidth: string;
  columnMinWidth: string;
  columnMaxWidth: string;
  cardHeight: string;
  headerHeight: string;
  gap: string;
  showFullHeader: boolean;
  showFullCard: boolean;
  cardViewMode: 'full' | 'compact' | 'micro';
}

const DENSITY_CONFIGS: Record<KanbanDensity, KanbanDensityConfig> = {
  comfortable: {
    columnWidth: '280px',
    columnMinWidth: '280px',
    columnMaxWidth: '320px',
    cardHeight: 'auto',
    headerHeight: '48px',
    gap: '12px',
    showFullHeader: true,
    showFullCard: true,
    cardViewMode: 'full',
  },
  compact: {
    columnWidth: '180px',
    columnMinWidth: '160px',
    columnMaxWidth: '200px',
    cardHeight: '40px',
    headerHeight: '32px',
    gap: '6px',
    showFullHeader: false,
    showFullCard: false,
    cardViewMode: 'compact',
  },
  tv: {
    columnWidth: '1fr',
    columnMinWidth: '100px',
    columnMaxWidth: '1fr',
    cardHeight: '28px',
    headerHeight: '28px',
    gap: '4px',
    showFullHeader: false,
    showFullCard: false,
    cardViewMode: 'micro',
  },
};

const STORAGE_KEY = 'kanban-density-preference';
const AUTO_DETECT_KEY = 'kanban-density-auto-detect';

// Sidebar width constants (must match sidebar.tsx)
const SIDEBAR_WIDTH_OPEN = 224; // 14rem = 224px
const SIDEBAR_WIDTH_COLLAPSED = 56; // 3.5rem = 56px

// Calculate optimal density based on available width and phase count
function calculateOptimalDensity(
  screenWidth: number, 
  phaseCount: number,
  sidebarOpen: boolean = true
): KanbanDensity {
  // Calculate available width after sidebar and padding
  const sidebarWidth = sidebarOpen ? SIDEBAR_WIDTH_OPEN : SIDEBAR_WIDTH_COLLAPSED;
  const availableWidth = screenWidth - sidebarWidth - 48; // 48px for padding

  // Column widths for each mode (approximate with gaps)
  const comfortableColWidth = 300; // 280px + gap
  const compactColWidth = 190;     // 180px + gap

  // Calculate how many columns fit in each mode
  const comfortableFit = Math.floor(availableWidth / comfortableColWidth);
  const compactFit = Math.floor(availableWidth / compactColWidth);

  // Decision logic based on available width (not screen width)
  if (comfortableFit >= phaseCount && availableWidth >= 1200) {
    return 'comfortable';
  }
  
  if (compactFit >= phaseCount || availableWidth >= 1000) {
    return 'compact';
  }
  
  return 'tv';
}

interface UseKanbanDensityOptions {
  phaseCount?: number;
}

export function useKanbanDensity(options: UseKanbanDensityOptions = {}) {
  const { phaseCount = 15 } = options;
  
  const [autoDetect, setAutoDetectState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(AUTO_DETECT_KEY);
    return stored === null ? true : stored === 'true';
  });

  const [manualDensity, setManualDensity] = useState<KanbanDensity | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['comfortable', 'compact', 'tv'].includes(stored)) {
      return stored as KanbanDensity;
    }
    return null;
  });

  const [screenWidth, setScreenWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });

  // Track screen width changes
  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate auto density
  const autoDensity = useMemo(() => {
    return calculateOptimalDensity(screenWidth, phaseCount);
  }, [screenWidth, phaseCount]);

  // Final density based on auto or manual
  const density = autoDetect ? autoDensity : (manualDensity || autoDensity);

  const setDensity = useCallback((newDensity: KanbanDensity) => {
    setManualDensity(newDensity);
    setAutoDetectState(false);
    localStorage.setItem(STORAGE_KEY, newDensity);
    localStorage.setItem(AUTO_DETECT_KEY, 'false');
  }, []);

  const setAutoDetect = useCallback((enabled: boolean) => {
    setAutoDetectState(enabled);
    localStorage.setItem(AUTO_DETECT_KEY, String(enabled));
    if (enabled) {
      localStorage.removeItem(STORAGE_KEY);
      setManualDensity(null);
    }
  }, []);

  const cycleDensity = useCallback(() => {
    const order: KanbanDensity[] = ['comfortable', 'compact', 'tv'];
    const currentIndex = order.indexOf(density);
    const nextIndex = (currentIndex + 1) % order.length;
    setDensity(order[nextIndex]);
  }, [density, setDensity]);

  const config = DENSITY_CONFIGS[density];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          setDensity('comfortable');
        } else if (e.key === '2') {
          e.preventDefault();
          setDensity('compact');
        } else if (e.key === '3') {
          e.preventDefault();
          setDensity('tv');
        } else if (e.key === '0') {
          e.preventDefault();
          setAutoDetect(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setDensity, setAutoDetect]);

  // Suggested density for UI hints
  const suggestedDensity = autoDensity;
  const isUsingOptimal = density === autoDensity;

  return {
    density,
    setDensity,
    cycleDensity,
    config,
    isComfortable: density === 'comfortable',
    isCompact: density === 'compact',
    isTV: density === 'tv',
    // Auto-detect features
    autoDetect,
    setAutoDetect,
    suggestedDensity,
    isUsingOptimal,
    screenWidth,
  };
}
