// Beautiful Loading Screen for CamFlea
class LoadingScreen {
    constructor(options = {}) {
        this.options = {
            minDisplayTime: 1000, // Minimum time to show loading screen
            fadeOutDuration: 500, // Fade out animation duration
            showProgress: true, // Show progress bar
            showDots: true, // Show bouncing dots
            gradient: 'camflea-brand', // Default gradient theme
            ...options
        };
        
        this.startTime = Date.now();
        this.isCreated = false;
        this.loadingMessages = [
            "Loading your marketplace...",
            "Preparing amazing deals...",
            "Connecting to CamFlea...",
            "Almost ready...",
            "Loading student marketplace...",
            "Fetching latest items...",
            "Setting up your experience..."
        ];
        this.currentMessageIndex = 0;
        
        this.create();
    }
    
    create() {
        if (this.isCreated) return;
        
        // Create loading screen HTML
        const loadingHTML = `
            <div id="camflea-loading-screen" class="loading-screen ${this.options.gradient}">
                <div class="loading-container">
                    <div class="loading-logo">
                        <img src="Homepage_images/LOGO_WHITE.png" alt="CamFlea" onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=&quot;font-size:40px;color:#069210;font-weight:bold;&quot;>CF</span>'">
                    </div>
                    <h1 class="loading-title">CamFlea</h1>
                    <p class="loading-subtitle">Student Marketplace</p>
                    
                    <div class="loading-spinner">
                        <div class="spinner-ring"></div>
                    </div>
                    
                    ${this.options.showDots ? `
                        <div class="loading-dots">
                            <div class="dot"></div>
                            <div class="dot"></div>
                            <div class="dot"></div>
                        </div>
                    ` : ''}
                    
                    ${this.options.showProgress ? `
                        <div class="loading-progress">
                            <div class="progress-bar"></div>
                        </div>
                    ` : ''}
                    
                    <div class="loading-text" id="loading-message">
                        ${this.loadingMessages[0]}
                    </div>
                </div>
            </div>
        `;
        
        // Insert loading screen into page
        document.body.insertAdjacentHTML('afterbegin', loadingHTML);
        this.loadingElement = document.getElementById('camflea-loading-screen');
        this.messageElement = document.getElementById('loading-message');
        this.isCreated = true;
        
        // Start message rotation
        this.startMessageRotation();
        
        // Auto-hide after page load (fallback)
        if (document.readyState === 'loading') {
            window.addEventListener('load', () => {
                setTimeout(() => this.hide(), 500);
            });
        }
    }
    
    startMessageRotation() {
        this.messageInterval = setInterval(() => {
            this.currentMessageIndex = (this.currentMessageIndex + 1) % this.loadingMessages.length;
            if (this.messageElement) {
                this.messageElement.style.opacity = '0';
                setTimeout(() => {
                    this.messageElement.textContent = this.loadingMessages[this.currentMessageIndex];
                    this.messageElement.style.opacity = '1';
                }, 200);
            }
        }, 2000);
    }
    
    updateMessage(message) {
        if (this.messageElement) {
            this.messageElement.style.opacity = '0';
            setTimeout(() => {
                this.messageElement.textContent = message;
                this.messageElement.style.opacity = '1';
            }, 200);
        }
    }
    
    hide() {
        if (!this.loadingElement) return;
        
        // Ensure minimum display time
        const elapsed = Date.now() - this.startTime;
        const remainingTime = Math.max(0, this.options.minDisplayTime - elapsed);
        
        setTimeout(() => {
            this.loadingElement.classList.add('fade-out');
            
            // Clear message rotation
            if (this.messageInterval) {
                clearInterval(this.messageInterval);
            }
            
            // Remove from DOM after fade out
            setTimeout(() => {
                if (this.loadingElement && this.loadingElement.parentNode) {
                    this.loadingElement.parentNode.removeChild(this.loadingElement);
                }
                this.isCreated = false;
            }, this.options.fadeOutDuration);
        }, remainingTime);
    }
    
    show() {
        if (!this.isCreated) {
            this.create();
        } else if (this.loadingElement) {
            this.loadingElement.classList.remove('fade-out');
            this.loadingElement.style.display = 'flex';
        }
    }
    
    setGradient(gradientClass) {
        if (this.loadingElement) {
            // Remove existing gradient classes
            this.loadingElement.className = this.loadingElement.className.replace(/gradient-\d+|camflea-brand/g, '');
            this.loadingElement.classList.add(gradientClass);
        }
    }
}

// Initialize loading screen when script loads
let camfleaLoader;

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    // Only create if not already created
    if (!camfleaLoader) {
        camfleaLoader = new LoadingScreen({
            minDisplayTime: 1500,
            gradient: 'camflea-brand'
        });
    }
});

// Show loading screen immediately if DOM is still loading
if (document.readyState === 'loading') {
    camfleaLoader = new LoadingScreen({
        minDisplayTime: 1500,
        gradient: 'camflea-brand'
    });
}

// Global functions for easy access
window.showLoading = function(message = null) {
    if (!camfleaLoader) {
        camfleaLoader = new LoadingScreen();
    }
    if (message) {
        camfleaLoader.updateMessage(message);
    }
    camfleaLoader.show();
};

window.hideLoading = function() {
    if (camfleaLoader) {
        camfleaLoader.hide();
    }
};

window.updateLoadingMessage = function(message) {
    if (camfleaLoader) {
        camfleaLoader.updateMessage(message);
    }
};

// Hide loading screen when everything is loaded
window.addEventListener('load', () => {
    // Small delay to ensure smooth experience
    setTimeout(() => {
        if (camfleaLoader) {
            camfleaLoader.hide();
        }
    }, 800);
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoadingScreen;
}
