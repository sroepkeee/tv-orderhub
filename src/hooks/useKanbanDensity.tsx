import { useState, useEffect, useCallback } from 'react';

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

export function useKanbanDensity() {
  const [density, setDensityState] = useState<KanbanDensity>(() => {
    if (typeof window === 'undefined') return 'comfortable';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['comfortable', 'compact', 'tv'].includes(stored)) {
      return stored as KanbanDensity;
    }
    return 'comfortable';
  });

  const setDensity = useCallback((newDensity: KanbanDensity) => {
    setDensityState(newDensity);
    localStorage.setItem(STORAGE_KEY, newDensity);
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
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setDensity]);

  return {
    density,
    setDensity,
    cycleDensity,
    config,
    isComfortable: density === 'comfortable',
    isCompact: density === 'compact',
    isTV: density === 'tv',
  };
}
