class DataCache {
    constructor() {
        this.cache = new Map();
        this.maxAge = 5 * 60 * 1000; // 5 minutes cache
    }
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() - item.timestamp > this.maxAge) {
            this.cache.delete(key);
            return null;
        }
        
        return item.data;
    }
    
    set(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }
    
    clear() {
        this.cache.clear();
    }
}

// Global cache instance
window.dataCache = new DataCache();