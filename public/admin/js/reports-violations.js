// Sidenav toggle functionality
const menuToggle = document.getElementById('menuToggle');
const sidenav = document.getElementById('sidenav');
const sidenavOverlay = document.getElementById('sidenavOverlay');

// reports table elements
const reportsTableBody = document.querySelector('#reportsTable tbody');
const resolvedReportsTableBody = document.querySelector('#resolvedReportsTable tbody');
const logoutBtn = document.getElementById('logoutBtn');
const exportUnresolvedPdfBtn = document.getElementById('exportUnresolvedPdfBtn');
const exportResolvedPdfBtn = document.getElementById('exportResolvedPdfBtn');


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
    } 
    catch (error) {
        console.error('Error initializing Supabase:', error);
        throw error;
    }
}


logoutBtn.addEventListener('click', () => {
    window.location.href = '/login_page.html';
});

// PDF Export functionality for Unresolved Reports
exportUnresolvedPdfBtn.addEventListener('click', () => {
    exportReportsToPDF('unresolved');
});

// PDF Export functionality for Resolved Reports
exportResolvedPdfBtn.addEventListener('click', () => {
    exportReportsToPDF('resolved');
});

function exportReportsToPDF(type) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape'); // Use landscape for wider tables
    
    const tableId = type === 'unresolved' ? '#reportsTable' : '#resolvedReportsTable';
    const currentReports = [];
    const tableRows = document.querySelectorAll(`${tableId} tbody tr`);
    
    tableRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
            currentReports.push([
                cells[0].textContent, // Report ID
                cells[1].textContent, // Reporter User
                cells[2].textContent, // Reported User
                cells[3].textContent, // Violation Type
                cells[4].textContent, // Violation Details
                cells[5].textContent === 'View Photo(s)' ? 'Yes' : 'None', // Photo URLs
                cells[6].textContent  // Created At
            ]);
        }
    });
    
    // Add title
    doc.setFontSize(18);
    doc.setTextColor(8, 79, 106);
    const title = type === 'unresolved' ? 'Unresolved Reports' : 'Resolved Reports';
    doc.text(`CamFlea - ${title}`, 14, 20);
    
    // Add export date
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    
    // Add total count
    doc.text(`Total Reports: ${currentReports.length}`, 14, 34);
    
    // Create table
    doc.autoTable({
        head: [['Report ID', 'Reporter', 'Reported User', 'Violation Type', 'Details', 'Photos', 'Created At']],
        body: currentReports,
        startY: 40,
        theme: 'grid',
        styles: {
            fontSize: 9,
            cellPadding: 3,
        },
        headStyles: {
            fillColor: [8, 79, 106],
            textColor: 255,
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [249, 249, 249]
        },
        columnStyles: {
            0: { cellWidth: 20 },  // Report ID
            1: { cellWidth: 35 },  // Reporter
            2: { cellWidth: 35 },  // Reported User
            3: { cellWidth: 40 },  // Violation Type
            4: { cellWidth: 70 },  // Details
            5: { cellWidth: 20 },  // Photos
            6: { cellWidth: 40 }   // Created At
        }
    });
    
    // Save the PDF
    const fileName = `CamFlea_${title.replace(' ', '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
}

async function fetchReports() {
    // Fetch reports from report table with public URLs for photos
    const { data, error } = await supabase
        .from('report')
        .select(`
            report_id,
            reporter_user_id(stud_fname, stud_lname),
            reported_user_id(stud_fname, stud_lname),
            violation_type,
            violation_details,
            photo_urls,
            created_at
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching reports:', error);
        reportsTableBody.innerHTML = '<tr><td colspan="8">Error loading reports.</td></tr>';
        return;
    }

    displayReports(data || []);
}

// Photo modal state variables
let currentPhotoIndex = 0;
let currentPhotos = [];
let modal = null;
let img = null;
let controls = null;
let zoomed = false;

function createModalElements() {
    // Create modal container
    modal = document.createElement('div');
    Object.assign(modal.style, {
        id: 'photoModal',
        display: 'none',
        position: 'fixed',
        zIndex: '10000',
        left: '0',
        top: '0',
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        cursor: 'zoom-out'
    });

    // Create close button
    const closeBtn = document.createElement('button');
    Object.assign(closeBtn.style, {
        position: 'absolute',
        top: '20px',
        right: '30px',
        fontSize: '2rem',
        color: 'white',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        zIndex: '10001'
    });
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', closeModal);

    // Create image container for positioning
    const imageContainer = document.createElement('div');
    Object.assign(imageContainer.style, {
        position: 'relative',
        maxWidth: '80vw',
        maxHeight: '80vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
    });

    // Create image element
    img = document.createElement('img');
    Object.assign(img.style, {
        maxWidth: '100%',
        maxHeight: '100%',
        borderRadius: '10px',
        transition: 'transform 0.3s ease',
        cursor: 'zoom-in',
        display: 'none' // Initially hidden until loaded
    });
    img.addEventListener('click', toggleImageZoom);

    // Create loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'photo-loading-overlay';
    loadingOverlay.id = 'photoLoadingOverlay';

    // Create spinner
    const spinner = document.createElement('div');
    spinner.className = 'photo-spinner';

    // Create loading text
    const loadingText = document.createElement('div');
    loadingText.className = 'photo-loading-text';
    loadingText.textContent = 'Loading Image...';

    const loadingSubtext = document.createElement('div');
    loadingSubtext.className = 'photo-loading-subtext';
    loadingSubtext.textContent = 'Please wait while the image loads';

    // Assemble loading overlay
    loadingOverlay.append(spinner, loadingText, loadingSubtext);

    // Assemble image container
    imageContainer.append(img, loadingOverlay);

    // Create navigation controls
    controls = createNavigationControls();

    // Assemble modal
    modal.append(imageContainer, controls, closeBtn);
    document.body.appendChild(modal);

    // Modal click to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function createNavigationControls() {
    const controlsDiv = document.createElement('div');
    Object.assign(controlsDiv.style, {
        marginTop: '10px',
        display: 'flex',
        gap: '10px'
    });

    const buttonStyle = {
        padding: '8px 16px',
        fontSize: '1rem',
        cursor: 'pointer'
    };

    const prevBtn = document.createElement('button');
    Object.assign(prevBtn.style, buttonStyle);
    prevBtn.textContent = 'Previous';
    prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPhoto(currentPhotoIndex - 1);
    });

    const nextBtn = document.createElement('button');
    Object.assign(nextBtn.style, buttonStyle);
    nextBtn.textContent = 'Next';
    nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPhoto(currentPhotoIndex + 1);
    });

    controlsDiv.append(prevBtn, nextBtn);
    return controlsDiv;
}

function closeModal() {
    modal.style.display = 'none';
    img.style.transform = 'scale(1)';
    img.style.display = 'none'; // Hide image when closing
    zoomed = false;
    
    // Reset loading state
    hidePhotoLoading();
}

function toggleImageZoom() {
    if (!zoomed) {
        img.style.transform = 'scale(2)';
        img.style.cursor = 'zoom-out';
        zoomed = true;
    } else {
        img.style.transform = 'scale(1)';
        img.style.cursor = 'zoom-in';
        zoomed = false;
    }
}

function displayReports(reports) {
    reportsTableBody.innerHTML = '';
    
    if (reports.length === 0) {
        document.getElementById('noResults').style.display = 'block';
        return;
    } else {
        document.getElementById('noResults').style.display = 'none';
    }

    // Initialize modal if not already created
    if (!modal) {
        createModalElements();
    }

    // Display the reports data
    displayReportsData(reports);
    
    // Update statistics
    updateStatistics(reports);
}

function updateStatistics(reports) {
    const resolvedReports = getResolvedReports();
    const unresolvedCount = reports.filter(report => !resolvedReports.includes(report.report_id)).length;
    const resolvedCount = reports.filter(report => resolvedReports.includes(report.report_id)).length;
    
    // Update counter displays with animation
    animateCounter('pendingCount', unresolvedCount);
    animateCounter('resolvedCount', resolvedCount);
}

function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const startValue = parseInt(element.textContent) || 0;
    const duration = 800; // Animation duration in ms
    const startTime = performance.now();
    
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out animation
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(startValue + (targetValue - startValue) * easeOut);
        
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    }
    
    requestAnimationFrame(updateCounter);
}

function showPhoto(index) {
    // Handle wraparound for navigation
    if (index < 0) {
        index = currentPhotos.length - 1;
    } else if (index >= currentPhotos.length) {
        index = 0;
    }
    
    currentPhotoIndex = index;
    const url = currentPhotos[currentPhotoIndex];
    
    if (!url) {
        console.error('Photo URL is undefined or null at index', currentPhotoIndex);
        showPhotoError('Invalid photo URL');
        return;
    }
    
    // Show loading state
    showPhotoLoading();
    
    // Create new image to preload
    const newImg = new Image();
    let loadTimeout;
    
    newImg.onload = function() {
        // Image loaded successfully
        console.log('Photo loaded successfully:', url);
        clearTimeout(loadTimeout);
        img.src = url;
        img.style.display = 'block';
        hidePhotoLoading();
    };
    
    newImg.onerror = function() {
        // Image failed to load
        console.error('Failed to load photo:', url);
        clearTimeout(loadTimeout);
        showPhotoError('Failed to load image');
    };
    
    // Set timeout for loading (30 seconds)
    loadTimeout = setTimeout(() => {
        console.error('Photo loading timeout:', url);
        showPhotoError('Image loading timeout - please check your connection');
    }, 30000);
    
    // Start loading the image
    console.log('Loading photo URL:', url);
    newImg.src = url;
    
    // Show/hide navigation controls based on photo count
    controls.style.display = currentPhotos.length <= 1 ? 'none' : 'flex';
}

function showPhotoLoading() {
    const loadingOverlay = document.getElementById('photoLoadingOverlay');
    if (loadingOverlay) {
        // Hide image while loading
        img.style.display = 'none';
        
        // Reset loading overlay to show spinner
        loadingOverlay.innerHTML = `
            <div class="photo-spinner"></div>
            <div class="photo-loading-text" id="loadingText">Loading Image...</div>
            <div class="photo-loading-subtext">Please wait while the image loads</div>
        `;
        loadingOverlay.style.display = 'flex';
        
        // Start animated loading text
        startLoadingAnimation();
    }
}

function startLoadingAnimation() {
    const loadingText = document.getElementById('loadingText');
    if (!loadingText) return;
    
    const texts = [
        'Loading Image...',
        'Loading Image.',
        'Loading Image..',
        'Loading Image...'
    ];
    let textIndex = 0;
    
    const animationInterval = setInterval(() => {
        if (loadingText && loadingText.parentElement) {
            loadingText.textContent = texts[textIndex % texts.length];
            textIndex++;
        } else {
            clearInterval(animationInterval);
        }
    }, 500);
    
    // Store interval ID to clear it later
    loadingText.dataset.animationInterval = animationInterval;
}

function hidePhotoLoading() {
    const loadingOverlay = document.getElementById('photoLoadingOverlay');
    if (loadingOverlay) {
        // Stop loading animation
        const loadingText = document.getElementById('loadingText');
        if (loadingText && loadingText.dataset.animationInterval) {
            clearInterval(parseInt(loadingText.dataset.animationInterval));
        }
        
        loadingOverlay.style.display = 'none';
    }
}

function showPhotoError(errorMessage) {
    const loadingOverlay = document.getElementById('photoLoadingOverlay');
    if (loadingOverlay) {
        // Hide image on error
        img.style.display = 'none';
        
        // Show error state
        loadingOverlay.innerHTML = `
            <div class="photo-error-state">
                <div class="photo-error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="photo-error-title">Unable to Load Image</div>
                <div class="photo-error-message">${errorMessage}</div>
                <button class="photo-retry-btn" onclick="retryPhotoLoad()">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
        loadingOverlay.style.display = 'flex';
    }
}

function retryPhotoLoad() {
    // Retry loading the current photo
    showPhoto(currentPhotoIndex);
}

function showPhotoModal(photoUrls) {
    currentPhotos = photoUrls;
    
    // Show modal immediately with loading state
    modal.style.display = 'flex';
    
    // Start loading the first photo
    showPhoto(0);
}

// Function to separate and display resolved and unresolved reports
function displayReportsData(reports) {
    const resolvedReports = getResolvedReports();
    const unresolvedReports = reports.filter(report => !resolvedReports.includes(report.report_id));
    const currentResolvedReports = reports.filter(report => resolvedReports.includes(report.report_id));

    // Helper function to display reports in a table
    const displayReportsInTable = (reportsList, tableBody, noResultsElementId, isResolved) => {
        tableBody.innerHTML = '';
        const noResultsElement = document.getElementById(noResultsElementId);
        
        if (reportsList.length === 0) {
            noResultsElement.style.display = 'block';
        } else {
            noResultsElement.style.display = 'none';
            reportsList.forEach(report => {
                tableBody.appendChild(createReportRow(report, isResolved));
            });
        }
    };

    // Display both unresolved and resolved reports
    displayReportsInTable(unresolvedReports, reportsTableBody, 'noResults', false);
    displayReportsInTable(currentResolvedReports, resolvedReportsTableBody, 'noResolvedResults', true);
}


function createReportRow(report, isResolved) {
    const tr = document.createElement('tr');
    const getName = (user) => user ? `${user.stud_fname} ${user.stud_lname}` : 'N/A';
    
    // Create photo cell content
    const photoCellContent = report.photo_urls?.length > 0 
        ? `<a href="#" class="photo-link" style="cursor: pointer;" onclick="event.preventDefault(); showPhotoModal(${JSON.stringify(report.photo_urls).replace(/"/g, '&quot;')});"><i class="fas fa-eye"></i> View Photo(s)</a>`
        : '<span style="color: #a0aec0; font-style: italic;"><i class="fas fa-times-circle"></i> None</span>';

    tr.innerHTML = `
        <td>${report.report_id}</td>
        <td>${getName(report.reporter_user_id)}</td>
        <td>${getName(report.reported_user_id)}</td>
        <td>${report.violation_type}</td>
        <td>${report.violation_details || ''}</td>
        <td>${photoCellContent}</td>
        <td>${new Date(report.created_at).toLocaleString()}</td>
        <td>
            <button class="action-btn ${isResolved ? 'unresolve' : 'resolve'}-btn" 
                    onclick="${isResolved ? 'unresolveReport' : 'resolveReport'}(${report.report_id})">
                <i class="fas ${isResolved ? 'fa-undo' : 'fa-check'}"></i>
                ${isResolved ? 'Unresolve' : 'Resolve'}
            </button>
        </td>
    `;

    return tr;
}

function getResolvedReports() {
    const resolved = localStorage.getItem('resolvedReports');
    return resolved ? JSON.parse(resolved) : [];
}

function setResolvedReports(resolvedReports) {
    localStorage.setItem('resolvedReports', JSON.stringify(resolvedReports));
}

function resolveReport(reportId) {
    let resolvedReports = getResolvedReports();
    if (!resolvedReports.includes(reportId)) {
        resolvedReports.push(reportId);
        setResolvedReports(resolvedReports);
        fetchReports(); // Re-fetch and display to update tables
    }
}

function unresolveReport(reportId) {
    let resolvedReports = getResolvedReports();
    const index = resolvedReports.indexOf(reportId);
    if (index > -1) {
        resolvedReports.splice(index, 1);
        setResolvedReports(resolvedReports);
        fetchReports(); // Re-fetch and display to update tables
    }
}

// Initial fetch
window.addEventListener('DOMContentLoaded', async () => {
    // Initialize Supabase configuration first
    if (!supabase) {
        await initializeSupabase();
    }
    
    fetchReports();
});