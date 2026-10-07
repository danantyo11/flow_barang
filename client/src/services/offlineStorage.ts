export interface OfflineDraftPR {
  id: string; // temporary client uuid
  createdAt: string;
  data: any;
  synced: boolean;
}

const DRAFTS_KEY = 'golden_offline_pr_drafts';
const CACHED_ITEMS_KEY = 'golden_cached_items';

export const OfflineStorage = {
  // Save items for offline lookup
  cacheItems(items: any[]) {
    try {
      localStorage.setItem(CACHED_ITEMS_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Failed to cache items offline', e);
    }
  },

  getCachedItems(): any[] {
    try {
      const data = localStorage.getItem(CACHED_ITEMS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  // Save an offline draft PR
  saveDraftPR(prData: any): OfflineDraftPR {
    const drafts = this.getDraftPRs();
    const newDraft: OfflineDraftPR = {
      id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
      data: prData,
      synced: false,
    };
    drafts.push(newDraft);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    return newDraft;
  },

  getDraftPRs(): OfflineDraftPR[] {
    try {
      const data = localStorage.getItem(DRAFTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  removeDraftPR(id: string) {
    const drafts = this.getDraftPRs().filter((d) => d.id !== id);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  },

  clearAllDrafts() {
    localStorage.removeItem(DRAFTS_KEY);
  },
};
