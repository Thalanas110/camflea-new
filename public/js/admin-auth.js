// Admin Authentication Check
// This script must be included in all admin pages to prevent unauthorized access

(async function() {
    // Get environment variables from server
    const response = await fetch('/api/config');
    const config = await response.json();
    
    const supabaseUrl = config.supabaseUrl;
    const supabaseKey = config.supabaseKey;
    
    if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase configuration not available');
        window.location.href = 'Login_page.html';
        return;
    }
    
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    
    try {
        // Check if user is authenticated
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !sessionData.session) {
            console.error('No active session found');
            window.location.href = 'Login_page.html';
            return;
        }
        
        const userId = sessionData.session.user.id;
        
        // Verify admin status via server endpoint
        const adminCheckResponse = await fetch('/api/verify-admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionData.session.access_token}`
            },
            body: JSON.stringify({ userId })
        });
        
        const adminCheckResult = await adminCheckResponse.json();
        
        if (!adminCheckResult.success || !adminCheckResult.isAdmin) {
            console.error('User is not an admin');
            alert('Access denied. You do not have administrator privileges.');
            window.location.href = 'index.html';
            return;
        }
        
        // User is authenticated and is an admin, allow access
        console.log('Admin access granted');
        
    } catch (error) {
        console.error('Error during admin authentication check:', error);
        window.location.href = 'Login_page.html';
    }
})();
