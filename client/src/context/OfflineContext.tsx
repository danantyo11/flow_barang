import React, { createContext, useContext, useState, useEffect } from 'react';
import { OfflineStorage, OfflineDraftPR } from '../services/offlineStorage.js';
import { api } from '../services/api.js';

export type SyncStatus = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'SYNCED' | 'SYNC ERROR';

interface OfflineContextType {
  isOnline: boolean;
  syncStatus: SyncStatus;
  offlineDraftsCount: number;
  syncNow: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(navigator.onLine ? 'ONLINE' : 'OFFLINE');
  const [draftsCount, setDraftsCount] = useState(0);

  const updateDraftsCount = () => {
    const drafts = OfflineStorage.getDraftPRs();
    setDraftsCount(drafts.length);
  };

  const syncNow = async () => {
    if (!navigator.onLine) {
      setSyncStatus('OFFLINE');
      return;
    }

    const drafts = OfflineStorage.getDraftPRs();
    if (drafts.length === 0) {
      setSyncStatus('SYNCED');
      return;
    }

    setSyncStatus('SYNCING');
    let successCount = 0;

    for (const draft of drafts) {
      try {
        await api.post('/purchase-requests', draft.data);
        OfflineStorage.removeDraftPR(draft.id);
        successCount++;
      } catch (err) {
        console.error('Failed to sync draft PR:', draft.id, err);
      }
    }

    updateDraftsCount();
    if (successCount === drafts.length) {
      setSyncStatus('SYNCED');
    } else {
      setSyncStatus('SYNC ERROR');
    }
  };

  useEffect(() => {
    updateDraftsCount();

    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('ONLINE');
      syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('OFFLINE');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <OfflineContext.Provider value={{ isOnline, syncStatus, offlineDraftsCount: draftsCount, syncNow }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};
