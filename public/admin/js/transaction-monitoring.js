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

// Secure configuration - gets credentials from server API
let supabase = null;

async function initializeSupabase() {
    try {
        console.log('🔧 Initializing Supabase configuration...');
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
        }
        
        const config = await response.json();
        console.log('✅ Config fetched successfully:', { 
            hasUrl: !!config.supabaseUrl, 
            hasKey: !!config.supabaseKey,
            urlLength: config.supabaseUrl?.length || 0
        });
        
        supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
        console.log('✅ Supabase client created successfully');
        return supabase;
    } 
    catch (error) {
        console.error('❌ Error initializing Supabase:', error);
        console.error('Stack trace:', error.stack);
        throw error;
    }
}

const transactionsTableBody = document.querySelector('#transactionsTable tbody');
const searchBar = document.getElementById('searchBar');
const logoutBtn = document.getElementById('logoutBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');

logoutBtn.addEventListener('click', () => {
    window.location.href = '/login_page.html';
});

// PDF Export functionality
exportPdfBtn.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Get the currently displayed transactions (respects search filter)
    const currentTransactions = [];
    const tableRows = document.querySelectorAll('#transactionsTable tbody tr');
    
    tableRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
            currentTransactions.push([
                cells[0].textContent, // Transaction ID
                cells[1].textContent, // Buyer Name
                cells[2].textContent, // Seller Name
                cells[3].textContent, // Product Name
                cells[4].textContent, // Status
                cells[5].textContent, // Created At
                cells[6].textContent  // Updated At
            ]);
        }
    });
    
    // Add title
    doc.setFontSize(18);
    doc.setTextColor(8, 79, 106);
    doc.text('CamFlea - Transaction Monitoring Report', 14, 20);
    
    // Add export date
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    
    // Add total count
    doc.text(`Total Transactions: ${currentTransactions.length}`, 14, 34);
    
    // Create table
    doc.autoTable({
        head: [['Transaction ID', 'Buyer', 'Seller', 'Product', 'Status', 'Created At', 'Updated At']],
        body: currentTransactions,
        startY: 40,
        theme: 'grid',
        styles: {
            fontSize: 8,
            cellPadding: 2,
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
            0: { cellWidth: 25 }, // Transaction ID
            1: { cellWidth: 30 }, // Buyer
            2: { cellWidth: 30 }, // Seller
            3: { cellWidth: 35 }, // Product
            4: { cellWidth: 20 }, // Status
            5: { cellWidth: 30 }, // Created At
            6: { cellWidth: 30 }  // Updated At
        }
    });
    
    // Save the PDF
    const fileName = `CamFlea_Transactions_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
});



// start code  here
let transactions = [];

async function fetchTransactions() {
    try {
        console.log('🔄 Starting to fetch transactions...');
        
        // Check if Supabase is initialized
        if (!supabase) {
            throw new Error('Supabase client not initialized');
        }
        
        // Get the current session for authorization
        console.log('🔐 Getting current session...');
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
            throw new Error(`Session error: ${sessionError.message}`);
        }
        
        const token = sessionData.session?.access_token;
        console.log('🎫 Token status:', { 
            hasToken: !!token, 
            tokenLength: token?.length || 0,
            sessionExists: !!sessionData.session
        });
        
        if (!token) {
            console.error('❌ No access token available');
            transactionsTableBody.innerHTML = '<tr><td colspan="7">Authentication required.</td></tr>';
            return;
        }
        
        // Use admin API to fetch all transactions (bypasses RLS)
        console.log('📡 Attempting to fetch via admin API...');
        const adminResponse = await fetch('/api/admin/transactions', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📡 Admin API response status:', adminResponse.status);
        
        if (!adminResponse.ok) {
            const errorText = await adminResponse.text();
            console.error('❌ Admin API failed:', { status: adminResponse.status, error: errorText });
            throw new Error(`Admin API failed: ${adminResponse.status} - ${errorText}`);
        }
        
        const adminData = await adminResponse.json();
        console.log('📊 Admin API response:', { 
            success: adminData.success, 
            dataCount: adminData.data?.length || 0,
            hasError: !!adminData.error
        });
        
        if (adminData.success) {
            transactions = adminData.data || [];
            console.log(`✅ Successfully fetched ${transactions.length} transactions via admin API`);
            displayTransactions(transactions);
            return;
        }
        
        // Fallback to direct Supabase query
        console.log('🔄 Falling back to direct Supabase query...');
        const { data, error } = await supabase
            .from('transactions')
            .select(`
                transac_id,
                status,
                created_at,
                updated_at,
                buyer:buyer_id (
                    stud_id,
                    stud_fname,
                    stud_lname
                ),
                seller:seller_id (
                    stud_id,
                    stud_fname,
                    stud_lname
                ),
                item:item_uuid (
                    item_id,
                    item_name
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Supabase query error:', error);
            console.error('Error details:', { 
                code: error.code, 
                message: error.message, 
                details: error.details,
                hint: error.hint
            });
            transactionsTableBody.innerHTML = '<tr><td colspan="7">Error loading transactions.</td></tr>';
            return;
        }

        transactions = data || [];
        console.log(`✅ Successfully fetched ${transactions.length} transactions via direct Supabase query`);
        displayTransactions(transactions);
    }
    catch (error) {
        console.error('❌ Critical error in fetchTransactions:', error);
        console.error('Error stack:', error.stack);
        console.error('Error type:', typeof error);
        console.error('Error constructor:', error.constructor.name);
        
        // More detailed error information
        const errorDetails = {
            message: error.message,
            name: error.name,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        console.error('🔍 Detailed error info:', errorDetails);
        
        transactionsTableBody.innerHTML = `<tr><td colspan="7">Error loading transactions: ${error.message}</td></tr>`;
        return;
    }
}

function displayTransactions(transactionsToDisplay) {
    try {
        console.log(`🎨 Displaying ${transactionsToDisplay.length} transactions...`);
        
        transactionsTableBody.innerHTML = '';
        if (transactionsToDisplay.length === 0) {
            console.log('ℹ️ No transactions to display');
            document.getElementById('noResults').style.display = 'block';
            return;
        } else {
            document.getElementById('noResults').style.display = 'none';
        }
        
        // Log sample transaction structure for debugging
        if (transactionsToDisplay.length > 0) {
            console.log('📋 Sample transaction structure:', {
                keys: Object.keys(transactionsToDisplay[0]),
                sample: transactionsToDisplay[0]
            });
        }

        transactionsToDisplay.forEach((tran, index) => {
            try {
                const tr = document.createElement('tr');
                
                // Enhanced data extraction with better error handling
                const buyerName = tran.buyer ? 
                    ((tran.buyer.stud_fname || '') + ' ' + (tran.buyer.stud_lname || '')).trim() || 'Unnamed' : 'N/A';
                const sellerName = tran.seller ? 
                    ((tran.seller.stud_fname || '') + ' ' + (tran.seller.stud_lname || '')).trim() || 'Unnamed' : 'N/A';
                const itemName = tran.item?.item_name || 'N/A';
                const status = tran.status || 'Unknown';
                
                // Date formatting with error handling
                let createdAt, updatedAt;
                try {
                    createdAt = tran.created_at ? new Date(tran.created_at).toLocaleString() : 'N/A';
                } catch (e) {
                    createdAt = 'Invalid Date';
                    console.warn(`Invalid created_at date for transaction ${index}:`, tran.created_at);
                }
                
                try {
                    updatedAt = tran.updated_at ? new Date(tran.updated_at).toLocaleString() : 'N/A';
                } catch (e) {
                    updatedAt = 'Invalid Date';
                    console.warn(`Invalid updated_at date for transaction ${index}:`, tran.updated_at);
                }
                
                tr.innerHTML = `
                    <td>${tran.transac_id || 'N/A'}</td>
                    <td>${buyerName}</td>
                    <td>${sellerName}</td>
                    <td>${itemName}</td>
                    <td>${status}</td>
                    <td>${createdAt}</td>
                    <td>${updatedAt}</td>
                `;
                transactionsTableBody.appendChild(tr);
            } catch (rowError) {
                console.error(`❌ Error displaying transaction at index ${index}:`, rowError);
                console.error('Transaction data:', tran);
            }
        });
        
        console.log(`✅ Successfully displayed ${transactionsToDisplay.length} transactions`);
    }
    catch (error) {
        console.error('Error displaying transactions:', error);
        transactionsTableBody.innerHTML = '<tr><td colspan="7">Error displaying transactions.</td></tr>';
    }
}

searchBar.addEventListener('input', () => {
    const query = searchBar.value.toLowerCase();
    const filtered = transactions.filter(tran => {
        return (
            tran.transac_id.toString().toLowerCase().includes(query) || (((tran.buyer?.stud_fname || '') + ' ' + (tran.buyer?.stud_lname || '')).toLowerCase().includes(query)) ||
            (((tran.seller?.stud_fname || '') + ' ' + (tran.seller?.stud_lname || '')).toLowerCase().includes(query)) ||
            (tran.item?.item_name?.toLowerCase().includes(query))
        );
    });
    displayTransactions(filtered);
});

// Initial fetch
window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 Page loaded, initializing transaction monitoring...');
        console.log('🌐 Environment info:', {
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        });
        
        // Initialize Supabase configuration first
        if (!supabase) {
            console.log('🔧 Supabase not initialized, calling initializeSupabase...');
            await initializeSupabase();
        } else {
            console.log('✅ Supabase already initialized');
        }
        
        console.log('📊 Starting initial transaction fetch...');
        await fetchTransactions();
        console.log('🎉 Transaction monitoring initialization complete');
    } catch (error) {
        console.error('❌ Critical error during initialization:', error);
        console.error('Initialization error stack:', error.stack);
        
        // Display error to user
        if (transactionsTableBody) {
            transactionsTableBody.innerHTML = `<tr><td colspan="7">Initialization failed: ${error.message}</td></tr>`;
        }
    }
});