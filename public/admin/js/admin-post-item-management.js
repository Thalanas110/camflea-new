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

let loggedInAdminUUID = null; // To store the admin's UUID

const itemsContainer = document.getElementById('items-container');
const schoolFilter = document.getElementById('school-filter');
const itemTypeCheckboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');
const statusPills = document.querySelectorAll('.status-pill');
const clearFiltersBtn = document.getElementById('clear-filters-btn');
const paginationControls = document.getElementById('pagination-controls');
const logoutBtn = document.getElementById('logoutBtn');

let currentPage = 1;
const itemsPerPage = 15;

logoutBtn.addEventListener('click', () => {
    // Use absolute lowercase path to the login redirect
    window.location.href = '/Login_page.html';
});

clearFiltersBtn.addEventListener('click', () => {
    schoolFilter.value = '';
    itemTypeCheckboxes.forEach(checkbox => checkbox.checked = false);
    statusPills.forEach(pill => pill.classList.remove('active'));
    currentPage = 1;
    updateFilterCount();
    fetchAndDisplayItems();
});

// Event listeners for filters
schoolFilter.addEventListener('change', () => {
    currentPage = 1;
    updateFilterCount();
    fetchAndDisplayItems();
});

itemTypeCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        currentPage = 1;
        updateFilterCount();
        fetchAndDisplayItems();
    });
});

statusPills.forEach(pill => {
    pill.addEventListener('click', () => {
        pill.classList.toggle('active');
        currentPage = 1;
        updateFilterCount();
        fetchAndDisplayItems();
    });
});

function getSelectedItemTypes() {
    return Array.from(itemTypeCheckboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);
}

function getSelectedStatuses() {
    return Array.from(statusPills)
        .filter(pill => pill.classList.contains('active'))
        .map(pill => pill.dataset.status);
}

function updateFilterCount() {
    const schoolSelected = schoolFilter.value ? 1 : 0;
    const itemTypesSelected = getSelectedItemTypes().length;
    const statusesSelected = getSelectedStatuses().length;
    const totalActive = schoolSelected + itemTypesSelected + statusesSelected;
    
    const filterCount = document.getElementById('filterCount');
    if (filterCount) {
        filterCount.textContent = totalActive === 0 ? '0 active' : 
                                 totalActive === 1 ? '1 active' : 
                                 `${totalActive} active`;
    }
}

async function fetchAndDisplayItems() {
    try {
        const { data, error, count } = await buildAndExecuteQuery();
        
        if (error) {
            console.error('Error fetching items:', error);
            showError('Error loading items.');
            return;
        }

        const { pinned, verified, regular } = categorizeItems(data);
        
        renderItemSections(pinned, verified, regular);
        displayPagination(count);
        
    } catch (error) {
        console.error('Unexpected error:', error);
        showError('Error loading items.');
    }
}

async function buildAndExecuteQuery() {
    let query = supabase
        .from('item')
        .select(`
            item_id, item_name, item_description, item_condition, item_status,
            item_type, item_price_type, item_price_min, item_price_max, item_price,
            photos, created_at, stud_id, student:stud_id (stud_school)
        `, { count: 'exact' });

    // Apply school filter
    if (schoolFilter.value) {
        const studentIds = await getStudentIdsBySchool(schoolFilter.value);
        if (studentIds.length === 0) {
            showError('No items found for the selected school.');
            return { data: [], error: null, count: 0 };
        }
        query = query.in('stud_id', studentIds);
    }

    // Apply other filters
    const itemTypes = getSelectedItemTypes();
    const statuses = getSelectedStatuses();
    
    if (itemTypes.length > 0) query = query.in('item_type', itemTypes);
    if (statuses.length > 0) query = query.in('item_status', statuses);

    // Apply pagination and ordering
    const from = (currentPage - 1) * itemsPerPage;
    query = query.range(from, from + itemsPerPage - 1).order('created_at', { ascending: false });

    return await query;
}

async function getStudentIdsBySchool(school) {
    const { data: students, error } = await supabase
        .from('student')
        .select('stud_id')
        .eq('stud_school', school);
    
    if (error) {
        console.error('Error fetching students for school filter:', error);
        return [];
    }
    
    return students.map(s => s.stud_id);
}

function categorizeItems(items) {
    const pinnedIds = getPinnedItems();
    const verifiedIds = getVerifiedItems();
    
    return items.reduce((acc, item) => {
        if (pinnedIds.includes(item.item_id)) {
            acc.pinned.push(item);
        } else if (verifiedIds.includes(item.item_id)) {
            acc.verified.push(item);
        } else {
            acc.regular.push(item);
        }
        return acc;
    }, { pinned: [], verified: [], regular: [] });
}

function renderItemSections(pinned, verified, regular) {
    const pinnedContainer = document.getElementById('pinned-items');
    const verifiedContainer = document.getElementById('verified-items-container');
    const verifiedSection = document.getElementById('verified-items-section');

    displayItems(pinned, pinnedContainer, true);
    
    verifiedSection.style.display = verified.length > 0 ? 'block' : 'none';
    if (verified.length > 0) {
        displayItems(verified, verifiedContainer, false, true);
    }
    
    displayItems(regular, itemsContainer);
}

function showError(message) {
    itemsContainer.innerHTML = `<p>${message}</p>`;
    paginationControls.innerHTML = '';
}

// function to add items to container.
function displayItems(items, container, isPinnedSection = false, isVerifiedSection = false) {
    container.innerHTML = ''; // Clear the container before adding items
    if (!items || items.length === 0) {
        if (isPinnedSection) {
            document.getElementById('pinned-items-container').style.display = 'none';
        } else if (isVerifiedSection) {
            // Do nothing, the section display is handled in fetchAndDisplayItems
        } else {
            // For main items container, show a message if no items
            if (itemsContainer.innerHTML === '') { // Only if main container is empty
                itemsContainer.innerHTML = '<p>No items found matching your filters.</p>';
            }
        }
        return;
    } else {
        if (isPinnedSection) {
            document.getElementById('pinned-items-container').style.display = 'block';
        }
    }

    items.forEach(item => {
        const photoUrl = item.photos?.[0] || 'https://via.placeholder.com/250x200?text=No+Image';
        const school = item.student?.stud_school || 'No School Found';
        const timeAgoText = timeAgo(item.created_at);
        const isPinned = getPinnedItems().includes(item.item_id);
        const isVerified = getVerifiedItems().includes(item.item_id);

        let priceDisplay = '';
        if (item.item_price_type === 'single') {
            priceDisplay = `₱${item.item_price}`;
        } else if (item.item_price_type === 'range') {
            priceDisplay = `₱${item.item_price_min} - ₱${item.item_price_max}`;
        } else if (item.item_price_type === 'hidden') {
            priceDisplay = 'Price hidden';
        } else {
            priceDisplay = 'Price not available';
        }

        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <img src="${photoUrl}" alt="${item.item_name}" />
            <h3>${item.item_name}</h3>
            <div class="price-time">
                <span class="price">${priceDisplay}</span>
                <span class="time-ago">${timeAgoText}</span>
            </div>
            <div class="condition">${item.item_condition}</div>
            <div class="rating-status">
                <span class="status" style="color: ${item.item_status === 'available' ? 'green' : item.item_status === 'reserved' ? 'orange' : item.item_status === 'sold' ? 'blue' : 'gray'}; font-weight: bold;">
                    ${item.item_status.charAt(0).toUpperCase() + item.item_status.slice(1)}
                </span>
            </div>
            <div class="school-location">
                <i class="fas fa-map-marker-alt"></i>
                <span>${school}</span>
            </div>
        `;

        // Add click event listener to the card
        card.addEventListener('click', () => {
            if (!item.item_id) {
                console.error("Item ID is undefined for this item:", item);
                alert("Failed to load item details. Please try again.");
                return;
            }
            // Open modal and load detailed post in iframe
            const modal = document.getElementById('detailedPostModal');
            const iframe = document.getElementById('detailedPostIframe');
            iframe.src = `/Detailed_post.html?item_id=${item.item_id}&embedded=1`;
            modal.style.display = 'flex';
        });

        const pinButton = document.createElement('button');
        pinButton.className = 'pin-btn';
        pinButton.setAttribute('data-item-id', item.item_id);
        pinButton.style.cssText = "background-color: transparent; border: none; cursor: pointer; font-size: 1rem; color: #049516; display: flex; align-items: center; gap: 5px; margin-right: 10px;"; // Added margin-right
        pinButton.title = isPinned ? 'Unpin' : 'Pin';
        pinButton.innerHTML = `
            <i class="${isPinned ? 'fa-solid fa-thumbtack' : 'fa-regular fa-thumbtack'}"></i>
            <span>${isPinned ? 'Pinned' : 'Pin'}</span>
        `;

        pinButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent card click event if any
            console.log('Pin button clicked directly!');
            togglePinItem(item.item_id, pinButton);
        });

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn';
        deleteButton.setAttribute('data-item-id', item.item_id);
        deleteButton.setAttribute('data-item-name', item.item_name);
        deleteButton.setAttribute('data-seller-id', item.stud_id); // Seller's stud_id
        deleteButton.style.cssText = "background-color: transparent; border: none; cursor: pointer; font-size: 1rem; color: #E74C3C; display: flex; align-items: center; gap: 5px;";
        deleteButton.title = 'Delete Item';
        deleteButton.innerHTML = `
            <i class="fa-solid fa-trash-can"></i>
            <span>Delete</span>
        `;

        deleteButton.addEventListener('click', async (event) => {
            event.stopPropagation(); // Prevent card click event if any
            console.log('Delete button clicked!');
            await deleteItem(item.item_id, item.item_name, item.stud_id, item.photos);
        });

        const verifyButton = document.createElement('button');
        verifyButton.className = 'verify-btn';
        verifyButton.setAttribute('data-item-id', item.item_id);
        verifyButton.style.cssText = "background-color: #28a745; color: white; border: none; border-radius: 5px; padding: 5px 10px; cursor: pointer; font-size: 0.8rem; margin-top: 5px;";
        verifyButton.textContent = isVerified ? 'Unverify' : 'Verify';

        verifyButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent card click event if any
            console.log('Verify button clicked for item ID:', item.item_id);
            toggleVerifyItem(item.item_id);
        });

        // Append the buttons to the rating-status div
        const ratingStatusDiv = card.querySelector('.rating-status');
        ratingStatusDiv.appendChild(pinButton);
        ratingStatusDiv.appendChild(deleteButton);
        card.appendChild(verifyButton); // Append verify button directly to the card
        container.appendChild(card);
        console.log(`Item ID: ${item.item_id}, isPinned: ${isPinned}, isVerified: ${isVerified}, Button HTML: ${pinButton.innerHTML}`);
    });
}

// Function to handle item verification
function toggleVerifyItem(itemId) {
    console.log('toggleVerifyItem called for itemId:', itemId);
    let verifiedItems = getVerifiedItems();
    const index = verifiedItems.indexOf(itemId);
    if (index === -1) {
        // Verify item
        verifiedItems.push(itemId);
        console.log('Item verified. New verifiedItems:', verifiedItems);
    } else {
        // Unverify item
        verifiedItems.splice(index, 1);
        console.log('Item unverified. New verifiedItems:', verifiedItems);
    }
    setVerifiedItems(verifiedItems);
    fetchAndDisplayItems(); // Re-fetch and display to update sections
}

// Store verified item IDs in localStorage
function getVerifiedItems() {
    const verified = localStorage.getItem('verifiedItems');
    const parsed = verified ? JSON.parse(verified) : [];
    console.log('getVerifiedItems: Retrieved', parsed);
    return parsed;
}

function setVerifiedItems(verifiedItems) {
    console.log('setVerifiedItems: Storing', verifiedItems);
    localStorage.setItem('verifiedItems', JSON.stringify(verifiedItems));
}

// function to delete the item
async function deleteItem(itemId, itemName, sellerId, photos) {
    console.log('Attempting to delete item:', { itemId, itemName, sellerId });

    try {
        await deletePhotos(photos);
        await deleteItemFromDatabase(itemId, itemName);
        await sendDeletionNotification(sellerId, itemName);
        fetchAndDisplayItems();
    } catch (error) {
        console.error('An unexpected error occurred during item deletion:', error);
        alert('An unexpected error occurred during item deletion.');
    }
}

// function to delete photos from storage
async function deletePhotos(photos) {
    if (!photos?.length) return;
    
    const filePaths = photos.map(url => url.split('/').pop());
    const { error } = await supabase.storage.from('item-photos').remove(filePaths);
    
    if (error) {
        console.error('Error deleting photos from storage:', error);
        alert('Failed to delete some item photos from storage. Item might still be deleted.');
    } else {
        console.log('Photos deleted from storage:', filePaths);
    }
}

// function to delete an item from database
async function deleteItemFromDatabase(itemId, itemName) {
    const { data, error, count } = await supabase
        .from('item')
        .delete()
        .eq('item_id', itemId);

    console.log('Supabase delete item result:', { data, error, count });

    if (error) {
        console.error('Error deleting item from database:', error);
        alert('Failed to delete item from database: ' + error.message);
        return;
    }

    if (data && data.length === 0 && count === 0) {
        console.warn(`No item found with ID ${itemId} to delete, or deletion was prevented by a policy/trigger.`);
        alert(`Failed to delete item "${itemName}". It might not exist or deletion was prevented.`);
        return;
    }

    console.log(`Item "${itemName}" (ID: ${itemId}) deleted successfully. Rows affected: ${count}`);
    alert(`Item "${itemName}" has been successfully deleted.`);
}

// function to send deletion notification to seller
async function sendDeletionNotification(sellerId, itemName) {
    const { data: seller, error } = await supabase
        .from('student')
        .select('user_id')
        .eq('stud_id', sellerId)
        .single();

    const sellerUUID = error || !seller ? null : seller.user_id;
    
    if (error || !seller) {
        console.error('Error fetching seller UUID for notification:', error);
        console.log('sellerStudentError details:', error);
        console.log('sellerStudent data:', seller);
    } else {
        console.log('Fetched sellerStudent:', seller);
        console.log('Extracted sellerUUID:', sellerUUID);
    }

    if (sellerUUID && loggedInAdminUUID) {
        try {
            const response = await fetch('/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken') || ''}`
                },
                body: JSON.stringify({
                    sender_uuid: loggedInAdminUUID,
                    receiver_uuid: sellerUUID,
                    type: 'admin_item_removal',
                    content: `The item "${itemName}" has been removed by the admin as it violated the rules and regulation of the app.`,
                    is_read: false,
                    profile_image: 'Homepage_images/LOGO_WHITE.png'
                })
            });

            if (response.ok) {
                console.log('Notification sent to seller successfully.');
            } else {
                console.error('Failed to send notification to seller via server');
            }
        } catch (notificationError) {
            console.error('Error sending notification to seller:', notificationError);
        }
    } else {
        console.warn('Notification skipped: Seller UUID or Admin UUID not found.', { sellerUUID, loggedInAdminUUID });
    }
}

function displayPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    paginationControls.innerHTML = '';

    const prevButton = document.createElement('button');
    prevButton.textContent = '← Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            fetchAndDisplayItems();
        }
    });

    const pageIndicator = document.createElement('span');
    pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next →';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            fetchAndDisplayItems();
        }
    });

    paginationControls.appendChild(prevButton);
    paginationControls.appendChild(pageIndicator);
    paginationControls.appendChild(nextButton);
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return `${seconds} sec${seconds !== 1 ? 's' : ''} ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
}

// Store pinned item IDs in localStorage
function getPinnedItems() {
    const pinned = localStorage.getItem('pinnedItems');
    return pinned ? JSON.parse(pinned) : [];
}

function setPinnedItems(pinnedItems) {
    localStorage.setItem('pinnedItems', JSON.stringify(pinnedItems));
}

function togglePinItem(itemId, button) {
    let pinnedItems = getPinnedItems();
    const index = pinnedItems.indexOf(itemId);
    if (index === -1) {
        // Pin item
        pinnedItems.push(itemId);
    } else {
        // Unpin item
        pinnedItems.splice(index, 1);
    }
    setPinnedItems(pinnedItems);
    fetchAndDisplayItems(); // Re-fetch and display to update sections
}

async function fetchLoggedInAdmin() {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
        console.error('No active session found for admin:', sessionError);
        // Redirect to login or handle unauthorized access
        window.location.href = '/login_page.html';
        return null;
    }
    loggedInAdminUUID = sessionData.session.user.id;
    console.log('Logged in admin UUID:', loggedInAdminUUID);

    return loggedInAdminUUID;
}

// Initial fetch
window.addEventListener('DOMContentLoaded', async () => {
    // Initialize Supabase configuration first
    if (!supabase) {
        await initializeSupabase();
    }
    
    await fetchLoggedInAdmin(); // Fetch admin UUID first
    updateFilterCount(); // Initialize filter count
    fetchAndDisplayItems();
});

// Delegate pin button clicks to container
document.addEventListener('click', (event) => {
    const button = event.target.closest('.pin-btn');
    if (button) {
        console.log('Pin button clicked!');
        const itemId = parseInt(button.getAttribute('data-item-id')); // Ensure itemId is a number
        togglePinItem(itemId, button);
    }
});

// Close button event listener for detailed post modal
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('closeDetailedPostModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const modal = document.getElementById('detailedPostModal');
            const iframe = document.getElementById('detailedPostIframe');
            iframe.src = ''; // Clear iframe source
            modal.style.display = 'none';
        });
    }

    // Ensure modal is hidden and iframe src cleared on page load to prevent empty modal showing
    const detailedModal = document.getElementById('detailedPostModal');
    const detailedIframe = document.getElementById('detailedPostIframe');
    if (detailedModal) detailedModal.style.display = 'none';
    if (detailedIframe) detailedIframe.src = '';
});

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