/**
 * Universal Modal System for Camflea
 * Replaces all alert() calls with a modern modal interface
 */

class ModalSystem {
    constructor() {
        this.isInitialized = false;
        this.init();
    }

    init() {
        if (this.isInitialized) return;

        // Check if DOM is ready
        if (!document.head || !document.body) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
            } else {
                // DOM is ready but head/body not available, retry later
                setTimeout(() => this.init(), 10);
            }
            return;
        }

        // Create modal HTML structure
        const modalHTML = `
            <div id="universal-modal" class="modal-overlay" style="display: none;">
                <div class="modal-container">
                    <div class="modal-header">
                        <h3 id="modal-title">Notification</h3>
                        <button class="modal-close" id="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="modal-icon" class="modal-icon"></div>
                        <p id="modal-message"></p>
                    </div>
                    <div class="modal-footer">
                        <button id="modal-ok-btn" class="modal-btn modal-btn-primary">OK</button>
                        <button id="modal-cancel-btn" class="modal-btn modal-btn-secondary" style="display: none;">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        // Create CSS styles
        const modalCSS = `
            <style id="modal-system-styles">
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.3s ease-out;
                }

                .modal-container {
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    max-width: 400px;
                    width: 90%;
                    max-height: 80vh;
                    overflow: hidden;
                    animation: slideIn 0.3s ease-out;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px 16px 24px;
                    border-bottom: 1px solid #e5e5e5;
                }

                .modal-header h3 {
                    margin: 0;
                    color: #333;
                    font-size: 18px;
                    font-weight: 600;
                }

                .modal-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    color: #666;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                }

                .modal-close:hover {
                    background-color: #f5f5f5;
                    color: #333;
                }

                .modal-body {
                    padding: 24px;
                    display: flex;
                    align-items: flex-start;
                    gap: 16px;
                }

                .modal-icon {
                    width: 24px;
                    height: 24px;
                    flex-shrink: 0;
                    margin-top: 2px;
                }

                .modal-icon.info::before {
                    content: "ℹ️";
                    font-size: 24px;
                }

                .modal-icon.success::before {
                    content: "✅";
                    font-size: 24px;
                }

                .modal-icon.warning::before {
                    content: "⚠️";
                    font-size: 24px;
                }

                .modal-icon.error::before {
                    content: "❌";
                    font-size: 24px;
                }

                .modal-body p {
                    margin: 0;
                    color: #555;
                    line-height: 1.5;
                    flex: 1;
                }

                .modal-footer {
                    padding: 16px 24px 24px 24px;
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                }

                .modal-btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                    min-width: 80px;
                }

                .modal-btn-primary {
                    background-color: #007bff;
                    color: white;
                }

                .modal-btn-primary:hover {
                    background-color: #0056b3;
                    transform: translateY(-1px);
                }

                .modal-btn-secondary {
                    background-color: #6c757d;
                    color: white;
                }

                .modal-btn-secondary:hover {
                    background-color: #545b62;
                    transform: translateY(-1px);
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slideIn {
                    from { transform: translateY(-20px) scale(0.95); opacity: 0; }
                    to { transform: translateY(0) scale(1); opacity: 1; }
                }

                /* Responsive design */
                @media (max-width: 480px) {
                    .modal-container {
                        width: 95%;
                        margin: 20px;
                    }

                    .modal-header,
                    .modal-body,
                    .modal-footer {
                        padding-left: 16px;
                        padding-right: 16px;
                    }
                }
            </style>
        `;

        // Add CSS to head
        document.head.insertAdjacentHTML('beforeend', modalCSS);

        // Add modal HTML to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Bind events
        this.bindEvents();
        this.isInitialized = true;
    }

    bindEvents() {
        const modal = document.getElementById('universal-modal');
        const closeBtn = document.getElementById('modal-close-btn');
        const okBtn = document.getElementById('modal-ok-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');

        // Close modal events
        const closeModal = () => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };

        closeBtn.addEventListener('click', closeModal);
        okBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display !== 'none') {
                closeModal();
            }
        });
    }

    show(message, options = {}) {
        const {
            title = 'Notification',
            type = 'info', // info, success, warning, error
            showCancel = false,
            onOk = null,
            onCancel = null
        } = options;

        // Get modal elements
        const modal = document.getElementById('universal-modal');
        const titleEl = document.getElementById('modal-title');
        const messageEl = document.getElementById('modal-message');
        const iconEl = document.getElementById('modal-icon');
        const okBtn = document.getElementById('modal-ok-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');

        // Set content
        titleEl.textContent = title;
        messageEl.textContent = message;
        
        // Set icon
        iconEl.className = `modal-icon ${type}`;
        
        // Show/hide cancel button
        cancelBtn.style.display = showCancel ? 'inline-block' : 'none';

        // Remove existing event listeners and add new ones
        const newOkBtn = okBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        // Add new event listeners
        newOkBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            if (onOk) onOk();
        });

        newCancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            if (onCancel) onCancel();
        });

        // Show modal
        document.body.style.overflow = 'hidden';
        modal.style.display = 'flex';
    }

    // Convenience methods
    info(message, title = 'Information') {
        this.show(message, { title, type: 'info' });
    }

    success(message, title = 'Success') {
        this.show(message, { title, type: 'success' });
    }

    warning(message, title = 'Warning') {
        this.show(message, { title, type: 'warning' });
    }

    error(message, title = 'Error') {
        this.show(message, { title, type: 'error' });
    }

    confirm(message, options = {}) {
        const {
            title = 'Confirm',
            onConfirm = null,
            onCancel = null
        } = options;

        this.show(message, {
            title,
            type: 'warning',
            showCancel: true,
            onOk: onConfirm,
            onCancel: onCancel
        });
    }
}

// Create global instance
window.ModalSystem = new ModalSystem();

// Override the native alert function
window.originalAlert = window.alert;
window.alert = function(message) {
    if (window.ModalSystem) {
        // Determine the type based on message content
        let type = 'info';
        let title = 'Notification';
        
        if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') || message.toLowerCase().includes('cannot')) {
            type = 'error';
            title = 'Error';
        } else if (message.toLowerCase().includes('success') || message.toLowerCase().includes('successfully')) {
            type = 'success';
            title = 'Success';
        } else if (message.toLowerCase().includes('warning') || message.toLowerCase().includes('must be')) {
            type = 'warning';
            title = 'Warning';
        }
        
        window.ModalSystem.show(message, { title, type });
    } else {
        // Fallback to original alert if modal system isn't available
        window.originalAlert(message);
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalSystem;
}

/**
 * Utility function to format numbers with commas
 * @param {number|string} number - The number to format
 * @returns {string} - Formatted number with commas
 */
function formatPrice(number) {
    if (number === null || number === undefined || number === '') {
        return '0';
    }
    
    // Convert to number if it's a string
    const num = typeof number === 'string' ? parseFloat(number) : number;
    
    // Check if it's a valid number
    if (isNaN(num)) {
        return '0';
    }
    
    // Format with commas and remove unnecessary decimals
    return num.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

// Make formatPrice globally available
window.formatPrice = formatPrice;
