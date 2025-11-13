// Admin Configuration Module
// Securely fetches Supabase configuration from server API endpoint
// This prevents hardcoding sensitive keys in client-side code

class AdminConfig {
    constructor() {
        this.supabaseUrl = null;
        this.supabaseKey = null;
        this.supabase = null;
        this.configPromise = null;
    }

    async loadConfig() {
        if (this.configPromise) {
            return this.configPromise;
        }

        this.configPromise = this._fetchConfig();
        return this.configPromise;
    }

    async _fetchConfig() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error(`Failed to fetch config: ${response.status}`);
            }
            
            const config = await response.json();
            this.supabaseUrl = config.supabaseUrl;
            this.supabaseKey = config.supabaseKey;
            
            // Initialize Supabase client
            if (window.supabase && window.supabase.createClient) {
                this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);
            } else {
                throw new Error('Supabase library not loaded');
            }
            
            return {
                supabaseUrl: this.supabaseUrl,
                supabaseKey: this.supabaseKey,
                supabase: this.supabase
            };
        } catch (error) {
            console.error('Error loading admin config:', error);
            throw error;
        }
    }

    async getSupabase() {
        if (!this.supabase) {
            await this.loadConfig();
        }
        return this.supabase;
    }

    async getConfig() {
        if (!this.supabaseUrl || !this.supabaseKey) {
            await this.loadConfig();
        }
        return {
            supabaseUrl: this.supabaseUrl,
            supabaseKey: this.supabaseKey,
            supabase: this.supabase
        };
    }
}

// Create a singleton instance
window.adminConfig = new AdminConfig();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminConfig;
}