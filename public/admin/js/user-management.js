// Secure configuration - gets credentials from server API
let supabase = null;

async function initializeSupabase() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error(`Failed to fetch config: ${response.status}`);
        }
        
        const config = await response.json();
        supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
        return supabase;
    } catch (error) {
        console.error('Error initializing Supabase:', error);
        throw error;
    }
}

// Sidenav toggle functionality
const menuToggle = document.getElementById('menuToggle');
const sidenav = document.getElementById('sidenav');
const sidenavOverlay = document.getElementById('sidenavOverlay');

function toggleSidenav() {
    sidenav.classList.toggle('open');
    sidenavOverlay.classList.toggle('active');
}

function closeSidenav() {
    sidenav.classList.remove('open');
    sidenavOverlay.classList.remove('active');
}

menuToggle.addEventListener('click', toggleSidenav);
sidenavOverlay.addEventListener('click', closeSidenav);

// Close sidenav when navigating on mobile
const navButtons = document.querySelectorAll('.nav-button');
navButtons.forEach(button => {
    button.addEventListener('click', () => {
        if (window.innerWidth < 1000) {
            closeSidenav();
        }
    });
});

// Handle window resize
window.addEventListener('resize', () => {
    if (window.innerWidth >= 1000) {
        closeSidenav();
    }
});

const searchInput = document.getElementById('searchInput');
const schoolFilter = document.getElementById('schoolFilter');
const usersTableBody = document.querySelector('#usersTable tbody');
const noResults = document.getElementById('noResults');

let allUsers = [];

async function fetchUsers() {
    const { data, error } = await supabase
        .from('student')
        .select('stud_id, stud_fname, stud_lname, stud_school, stud_email, stud_picture, stud_warning_count, stud_phone, is_role')
        .neq('is_role', 1);

    if (error) {
        console.error('Error fetching users:', error);
        usersTableBody.innerHTML = '<tr><td colspan="8">Error loading users.</td></tr>';
        return;
    }

    allUsers = data || [];
    populateSchoolFilter();
    updateStatistics();
    renderUsers(allUsers);
}

function updateStatistics() {
    if (!allUsers || allUsers.length === 0) return;

    // Calculate statistics
    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter(user => user.is_role === 0 && (user.stud_warning_count || 0) === 0).length;
    const flaggedUsers = allUsers.filter(user => 
        user.is_role === 2 || // Banned users
        user.is_role === 3 || // Restricted users  
        (user.stud_warning_count || 0) >= 1 // Users with warnings
    ).length;

    // Animate counters
    animateCounter(document.getElementById('totalUsersCount'), totalUsers);
    animateCounter(document.getElementById('activeUsersCount'), activeUsers);
    animateCounter(document.getElementById('flaggedUsersCount'), flaggedUsers);
}

function animateCounter(element, targetValue) {
    if (!element) return;
    
    const startValue = parseInt(element.textContent) || 0;
    const duration = 1200; // Animation duration in ms
    const startTime = performance.now();
    
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out animation for smooth effect
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(startValue + (targetValue - startValue) * easeOut);
        
        element.textContent = currentValue.toLocaleString();
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    }
    
    requestAnimationFrame(updateCounter);
}


// bruh

function renderUsers(users) {
    const usersTableBody = document.getElementById('usersTable');
    if (!usersTableBody) return;

    // Update displayed results count
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
        resultsCount.textContent = `${users.length} result${users.length !== 1 ? 's' : ''}`;
    }

    // Handle empty state
    if (users.length === 0) {
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <div class="empty-content">
                        <i class="fas fa-users"></i>
                        <h3>No users found</h3>
                        <p>Try adjusting your search criteria or filters</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Render users with modern styling
    usersTableBody.innerHTML = users.map(user => {
        const avatar = user.stud_profile_image_url ? 
            `<img src="${user.stud_profile_image_url}" alt="${user.stud_fname}" onerror="this.src='../images/profile-placeholder.png'">` : 
            `<div class="placeholder-avatar"><i class="fas fa-user"></i></div>`;

        const status = getStatusDisplay(user);
        const school = user.stud_school || 'Unknown';
        const warningCount = user.stud_warning_count || 0;
        
        return `
            <tr class="user-row" data-user-id="${user.stud_id}" onclick="viewUserDetails(${user.stud_id})">
                <td>
                    <div class="user-info">
                        <div class="user-avatar">
                            ${avatar}
                        </div>
                        <div class="user-details">
                            <div class="user-name">${user.stud_fname || 'Unknown'} ${user.stud_lname || ''}</div>
                            <div class="user-email">${user.stud_email || 'No email'}</div>
                        </div>
                    </div>
                </td>
                <td><span class="school-name">${school}</span></td>
                <td>
                    <div class="status-container">
                        ${status.badge}
                        ${warningCount > 0 ? `<span class="warning-badge">${warningCount} warning${warningCount > 1 ? 's' : ''}</span>` : ''}
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        ${getActionButtons(user)}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getStatusDisplay(user) {
    if (user.is_role === 2) {
        return {
            badge: '<span class="status-badge banned">Banned</span>',
            class: 'banned'
        };
    } else if (user.is_role === 3) {
        return {
            badge: '<span class="status-badge restricted">Restricted</span>',
            class: 'restricted'
        };
    } else if ((user.stud_warning_count || 0) >= 1) {
        return {
            badge: '<span class="status-badge warned">Warned</span>',
            class: 'warned'
        };
    } else {
        return {
            badge: '<span class="status-badge active">Active</span>',
            class: 'active'
        };
    }
}

function getActionButtons(user) {
    let buttons = `
        <button class="action-btn view-btn" onclick="event.stopPropagation(); viewUserDetails(${user.stud_id})" title="View Details">
            <i class="fas fa-eye"></i>
        </button>
    `;

    if (user.is_role === 2) { // Banned user
        buttons += `
            <button class="action-btn unban-btn" onclick="event.stopPropagation(); unbanUser(${user.stud_id})" title="Unban User">
                <i class="fas fa-check"></i>
            </button>
        `;
    } else if (user.is_role === 3) { // Restricted user
        buttons += `
            <button class="action-btn unrestrict-btn" onclick="event.stopPropagation(); unrestrictUser(${user.stud_id})" title="Remove Restriction">
                <i class="fas fa-unlock"></i>
            </button>
        `;
    } else { // Normal user
        buttons += `
            <button class="action-btn warn-btn" onclick="event.stopPropagation(); warnUser(${user.stud_id})" title="Warn User">
                <i class="fas fa-exclamation-triangle"></i>
            </button>
            <button class="action-btn restrict-btn" onclick="event.stopPropagation(); restrictUser(${user.stud_id})" title="Restrict User">
                <i class="fas fa-lock"></i>
            </button>
            <button class="action-btn ban-btn" onclick="event.stopPropagation(); banUser(${user.stud_id})" title="Ban User">
                <i class="fas fa-ban"></i>
            </button>
        `;
    }

    return buttons;
}

// View user details function
function viewUserDetails(studId) {
    window.location.href = `../View_other.html?stud_id=${encodeURIComponent(studId)}`;
}

// Custom Modal System
let currentModalAction = null;
let currentModalData = null;

function showCustomModal(title, message, confirmText = 'Confirm', confirmClass = '', action = null, data = null) {
    const modal = document.getElementById('customModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    confirmBtn.textContent = confirmText;
    confirmBtn.className = `modal-btn confirm-btn ${confirmClass}`;
    
    currentModalAction = action;
    currentModalData = data;
    
    modal.classList.add('show');
    modal.style.display = 'flex';
}

function closeCustomModal() {
    const modal = document.getElementById('customModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
    currentModalAction = null;
    currentModalData = null;
}

function confirmModalAction() {
    if (currentModalAction && typeof currentModalAction === 'function') {
        currentModalAction(currentModalData);
    }
    closeCustomModal();
}

function showAlert(message, type = 'info', title = 'Notification') {
    const modal = document.getElementById('alertModal');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const alertIcon = document.getElementById('alertIcon');
    
    alertTitle.textContent = title;
    alertMessage.textContent = message;
    
    // Reset icon classes
    alertIcon.className = 'fas';
    alertIcon.parentElement.className = 'alert-icon';
    
    // Set icon based on type
    switch(type) {
        case 'success':
            alertIcon.classList.add('fa-check-circle');
            alertIcon.parentElement.classList.add('success');
            break;
        case 'error':
            alertIcon.classList.add('fa-exclamation-circle');
            alertIcon.parentElement.classList.add('error');
            break;
        case 'warning':
            alertIcon.classList.add('fa-exclamation-triangle');
            alertIcon.parentElement.classList.add('warning');
            break;
        default:
            alertIcon.classList.add('fa-info-circle');
            alertIcon.parentElement.classList.add('info');
    }
    
    modal.classList.add('show');
    modal.style.display = 'flex';
}

function closeAlertModal() {
    const modal = document.getElementById('alertModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
}

// Close modals on escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeCustomModal();
        closeAlertModal();
    }
});

// Close modals on overlay click
document.getElementById('customModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeCustomModal();
    }
});

document.getElementById('alertModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeAlertModal();
    }
});

async function banUser(studId) {
    showCustomModal(
        'Ban User Confirmation',
        `Are you sure you want to BAN user with ID: ${studId}? This action will prevent them from accessing the platform.`,
        'Ban User',
        'danger',
        async function(userId) {
            const { error } = await supabase
                .from('student')
                .update({ is_role: 2 })
                .eq('stud_id', userId);

            if (error) {
                console.error('Error banning user:', error);
                showAlert('Failed to ban user. Please try again.', 'error', 'Ban Failed');
            } else {
                showAlert('User has been banned successfully!', 'success', 'User Banned');
                fetchUsers(); // Re-fetch and re-render users
            }
        },
        studId
    );
}

async function unbanUser(studId) {
    showCustomModal(
        'Unban User Confirmation',
        `Are you sure you want to UNBAN user with ID: ${studId}? This will restore their access to the platform.`,
        'Unban User',
        '',
        async function(userId) {
            const { error } = await supabase
                .from('student')
                .update({ is_role: 0 }) // Revert to normal role (assuming 0 is normal)
                .eq('stud_id', userId);

            if (error) {
                console.error('Error unbanning user:', error);
                showAlert('Failed to unban user. Please try again.', 'error', 'Unban Failed');
            } else {
                showAlert('User has been unbanned successfully!', 'success', 'User Unbanned');
                fetchUsers(); // Re-fetch and re-render users
            }
        },
        studId
    );
}

async function unrestrictUser(studId) {
    showCustomModal(
        'Unrestrict User Confirmation',
        `Are you sure you want to UNRESTRICT user with ID: ${studId}? This will remove their current restrictions.`,
        'Unrestrict User',
        '',
        async function(userId) {
            const { error } = await supabase
                .from('student')
                .update({ is_role: 0, restriction_start_date: null }) // Revert to normal role (assuming 0 is normal) and clear date
                .eq('stud_id', userId);

            if (error) {
                console.error('Error unrestricting user:', error);
                showAlert('Failed to unrestrict user. Please try again.', 'error', 'Unrestrict Failed');
            } else {
                showAlert('User restrictions have been removed successfully!', 'success', 'User Unrestricted');
                fetchUsers(); // Re-fetch and re-render users
            }
        },
        studId
    );
}

async function restrictUser(studId) {
    showCustomModal(
        'Restrict User Confirmation',
        `Are you sure you want to RESTRICT user with ID: ${studId} for 7 days? This will limit their platform access.`,
        'Restrict User',
        'warning',
        async function(userId) {
            // For restriction, we set is_role to 3 and set the restriction_start_date to now.
            const { error } = await supabase
                .from('student')
                .update({ is_role: 3, restriction_start_date: new Date().toISOString() })
                .eq('stud_id', userId);

            if (error) {
                console.error('Error restricting user:', error);
                showAlert('Failed to restrict user. Please try again.', 'error', 'Restriction Failed');
            } else {
                showAlert('User has been restricted for 7 days!', 'success', 'User Restricted');
                fetchUsers(); // Re-fetch and re-render users
            }
        },
        studId
    );
}

async function warnUser(studId, currentWarningCount) {
    const newWarningCount = (currentWarningCount || 0) + 1;
    showCustomModal(
        'Warn User Confirmation',
        `Are you sure you want to WARN user with ID: ${studId}? This will be their ${newWarningCount}${getOrdinalSuffix(newWarningCount)} warning.`,
        'Send Warning',
        'warning',
        async function(userId) {
            const { error } = await supabase
                .from('student')
                .update({ stud_warning_count: newWarningCount })
                .eq('stud_id', userId);

            if (error) {
                console.error('Error warning user:', error);
                showAlert('Failed to warn user. Please try again.', 'error', 'Warning Failed');
            } else {
                // Send notification for the warned user via server endpoint
                try {
                    const response = await fetch('/notifications', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('adminToken') || ''}`
                        },
                        body: JSON.stringify({
                            receiver_id: userId,
                            type: 'warning',
                            content: `You have received a warning from admin, please always follow the rules and regulation of the app (current warning: ${newWarningCount})`,
                            is_read: false
                        })
                    });

                    if (response.ok) {
                        showAlert(`User warned successfully! New warning count: ${newWarningCount}`, 'success', 'Warning Sent');
                    } else {
                        console.error('Failed to send warning notification via server');
                        showAlert('User warned successfully, but failed to send notification.', 'warning', 'Warning Sent');
                    }
                } catch (notificationError) {
                    console.error('Error sending warning notification:', notificationError);
                    showAlert('User warned successfully, but failed to send notification.', 'warning', 'Warning Sent');
                }
                fetchUsers(); // Re-fetch and re-render users
            }
        },
        studId
    );
}

// Helper function for ordinal suffixes
function getOrdinalSuffix(num) {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
}

function populateSchoolFilter() {
    const schools = Array.from(new Set(allUsers.map(user => user.stud_school || 'Unknown'))).sort();
    schools.forEach(school => {
        const option = document.createElement('option');
        option.value = school;
        option.textContent = school;
        schoolFilter.appendChild(option);
    });
}

function filterUsers() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedSchool = schoolFilter.value;
    const selectedStatus = document.getElementById('statusFilter').value;
    
    // Show/hide clear search button
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) {
        clearBtn.style.display = searchTerm ? 'flex' : 'none';
    }

    const filtered = allUsers.filter(user => {
        const name = ((user.stud_fname || '') + ' ' + (user.stud_lname || '')).toLowerCase();
        const email = (user.stud_email || '').toLowerCase();
        const matchesSearch = name.includes(searchTerm) || 
                            (user.stud_id + '').toLowerCase().includes(searchTerm) ||
                            email.includes(searchTerm);
        const matchesSchool = selectedSchool === '' || (user.stud_school || 'Unknown') === selectedSchool;
        
        // Status filtering
        let matchesStatus = true;
        if (selectedStatus) {
            switch (selectedStatus) {
                case 'active':
                    matchesStatus = user.is_role === 0 && (user.stud_warning_count || 0) === 0;
                    break;
                case 'banned':
                    matchesStatus = user.is_role === 2;
                    break;
                case 'restricted':
                    matchesStatus = user.is_role === 3;
                    break;
                case 'warned':
                    matchesStatus = (user.stud_warning_count || 0) >= 1 && user.is_role !== 2 && user.is_role !== 3;
                    break;
            }
        }
        
        return matchesSearch && matchesSchool && matchesStatus;
    });

    renderUsers(filtered);
}

// Enhanced event listeners
searchInput.addEventListener('input', filterUsers);
schoolFilter.addEventListener('change', filterUsers);

// Add status filter listener
const statusFilter = document.getElementById('statusFilter');
if (statusFilter) {
    statusFilter.addEventListener('change', filterUsers);
}

// Clear search functionality
const clearSearchBtn = document.getElementById('clearSearchBtn');
if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        filterUsers();
    });
}

// Refresh functionality
const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        refreshBtn.disabled = true;
        
        try {
            await fetchUsers();
        } finally {
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Data';
            refreshBtn.disabled = false;
        }
    });
}

// Export functionality placeholder
const exportUsersBtn = document.getElementById('exportUsersBtn');
if (exportUsersBtn) {
    exportUsersBtn.addEventListener('click', () => {
        // TODO: Implement CSV export functionality
        showAlert('Export functionality is coming soon! We are working on implementing CSV export for user data.', 'info', 'Feature Coming Soon');
    });
}

const logoutBtn = document.getElementById('logoutBtn');
logoutBtn.addEventListener('click', () => {
    // Redirect to lowercase login redirect page
    window.location.href = '/login_page.html';
});

window.addEventListener('DOMContentLoaded', async () => {
    // Initialize Supabase configuration first
    if (!supabase) {
        await initializeSupabase();
    }
    
    fetchUsers();
});