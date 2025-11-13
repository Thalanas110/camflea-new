require("dotenv").config();

console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY);

const express = require("express");
const bodyParser = require('body-parser');
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const port = process.env.PORT || 5001;

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Initialize Supabase client
const supabaseClient = createClient(supabaseUrl, supabaseKey, {
    persistSession: true, // Ensures session persistence across page reloads
});

// Configure CORS for production
const corsOptions = {
    origin: [
        'http://localhost:5001',
        'http://localhost:3000',
        'https://camflea.vercel.app',
        'https://updated-camflea.vercel.app',
        'https://updated-camflea-thalanas110s-projects.vercel.app',
        /\.vercel\.app$/
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to authenticate Supabase JWT token and extract user id
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ success: false, message: 'Authorization header missing' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token missing' });

    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser(token);
        if (error || !user) {
            console.error('Supabase token verification error:', error);
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }
        req.user = { uid: user.id };
        next();
    } catch (err) {
        console.error('Token verification error:', err);
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
}

// API endpoint to get notifications for authenticated user
app.get('/notifications', authenticateToken, async (req, res) => {
    try {
        const userSupabaseClient = createClient(supabaseUrl, supabaseKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${req.headers['authorization'].split(' ')[1]}`
                }
            }
        });

        const { data, error } = await userSupabaseClient
            .from('notifications')
            .select('*')
            .eq('receiver_uuid', req.user.uid)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching notifications:', error);
            return res.status(400).json({ success: false, message: error.message });
        }

        res.json({ success: true, notifications: data });
    } catch (err) {
        console.error('Server error fetching notifications:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// New API endpoint to mark item as sold using service role key, bypassing RLS
app.post('/item/:item_id/mark-sold', async (req, res) => {
    const itemId = req.params.item_id;

    try {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            console.error('Service role key not configured');
            return res.status(500).json({ success: false, message: 'Service role key not configured' });
        }
        const serviceSupabaseClient = createClient(supabaseUrl, serviceRoleKey);

        // Update the item status to "sold"
        const { data, error } = await serviceSupabaseClient
            .from('item')
            .update({ item_status: 'sold' })
            .eq('item_id', itemId)
            .select();

        if (error) {
            console.error('Error updating item status to sold:', error);
            return res.status(400).json({ success: false, message: error.message });
        }

        // Notify users with 'cart' transactions for this item
        try {
            const { data: cartTransactions, error: cartError } = await serviceSupabaseClient
                .from('transactions')
                .select('transac_id, buyer_id, buyer_uuid')
                .eq('item_uuid', itemId)
                .eq('status', 'cart');

            if (cartError) {
                console.error('Error fetching cart transactions for notifications:', cartError);
            } else if (cartTransactions && cartTransactions.length > 0) {
                for (const transaction of cartTransactions) {
                    const notificationType = 'item_sold';
                    const notificationContent = 'An item you requested notification for has been sold.';

                    try {
                        await serviceSupabaseClient
                            .from('notifications')
                            .insert([{
                                receiver_id: transaction.buyer_id,
                                sender_id: null,
                                receiver_uuid: transaction.buyer_uuid,
                                sender_uuid: null,
                                type: notificationType,
                                content: notificationContent,
                                metadata: { item_id: itemId }
                            }]);
                        // Update transaction status to 'cancelled'
                        await serviceSupabaseClient
                            .from('transactions')
                            .update({ status: 'cancelled' })
                            .eq('transac_id', transaction.transac_id);
                    } catch (notifErr) {
                        console.error('Error inserting notification or updating transaction:', notifErr);
                    }
                }
            }
        } catch (notifOuterErr) {
            console.error('Error in notification sending logic:', notifOuterErr);
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('Server error updating item status to sold:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// API endpoint to mark a notification as read
app.post('/notifications/:notif_id/read', authenticateToken, async (req, res) => {
    const notifId = req.params.notif_id;

    try {
        const userSupabaseClient = createClient(supabaseUrl, supabaseKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${req.headers['authorization'].split(' ')[1]}`
                }
            }
        });

        const { data, error } = await userSupabaseClient
            .from('notifications')
            .update({ is_read: true })
            .eq('notif_id', notifId)
            .eq('receiver_uuid', req.user.uid);

        if (error) {
            console.error('Error updating notification read status:', error);
            return res.status(400).json({ success: false, message: error.message });
        }

        res.json({ success: true, notification: data });
    } catch (err) {
        console.error('Server error updating notification:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Signup route
app.post('/signup', async (req, res) => {
    try {
        const { fname, lname, email, password, school, phone } = req.body;
        
        // Sign up the user with Supabase Auth
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    first_name: fname,
                    last_name: lname,
                    school: school,
                    phone: phone
                }
            }
        });

        if (error) {
            console.error('Signup error:', error);
            return res.status(400).json({ success: false, message: error.message });
        }

        res.json({ 
            success: true, 
            message: 'Account created successfully! Please check your email to verify your account.',
            user: data.user 
        });
    } catch (err) {
        console.error('Server error during signup:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Use authentication middleware for post-item route
app.post('/post-item', authenticateToken, async (req, res) => {
    const {
        user_id: payloadUserId,
        stud_id,
        item_name,
        item_description,
        item_price_type,
        item_price,
        item_price_min,
        item_price_max,
        item_condition,
        item_type,
        photos,
        meeting_place
    } = req.body;

    console.log('Authenticated user id (req.user.uid):', req.user.uid);
    console.log('User id from payload:', payloadUserId);

    if (!meeting_place) {
        return res.status(400).json({ success: false, message: 'Meeting place is required.' });
    }

    // Validate price fields based on price type
    if (item_price_type === 'single') {
        if (item_price === undefined || isNaN(parseFloat(item_price))) {
            return res.status(400).json({ success: false, message: 'Valid item_price is required for single price type.' });
        }
    } else if (item_price_type === 'range') {
        if (
            item_price_min === undefined || isNaN(parseFloat(item_price_min)) ||
            item_price_max === undefined || isNaN(parseFloat(item_price_max)) ||
            parseFloat(item_price_min) > parseFloat(item_price_max)
        ) {
            return res.status(400).json({ success: false, message: 'Valid item_price_min and item_price_max are required for range price type, and min must be <= max.' });
        }
    } else if (item_price_type === 'hidden') {
        // No price validation needed, item_price can be null
    } else {
        return res.status(400).json({ success: false, message: 'Invalid item_price_type.' });
    }

    try {
        // Create a Supabase client with the user's access token to enforce RLS
        const userSupabaseClient = createClient(supabaseUrl, supabaseKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${req.headers['authorization'].split(' ')[1]}`
                }
            }
        });

        const { error } = await userSupabaseClient
            .from('item')
            .insert([
                {
                    user_id: req.user.uid,
                    stud_id: parseInt(stud_id),
                    item_name,
                    item_description,
                    item_price: item_price_type === 'single' ? parseFloat(item_price) : null,
                    item_price_type,
                    item_price_min: item_price_type === 'range' ? parseFloat(item_price_min) : null,
                    item_price_max: item_price_type === 'range' ? parseFloat(item_price_max) : null,
                    item_condition,
                    item_type,
                    photos,
                    item_status: 'available',
                    meeting_place
                }
            ]);

        if (error) {
            console.error("Insert item error:", error);
            return res.status(400).json({ success: false, message: error.message });
        }

        res.status(201).json({ success: true, message: 'Item posted successfully!' });
    } catch (err) {
        console.error("Server error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// API endpoint to get student info by user_id
app.get('/student-info', authenticateToken, async (req, res) => {
    const userId = req.query.user_id;
    if (!userId) {
        return res.status(400).json({ success: false, message: 'Missing user_id query parameter' });
    }
    try {
        const userSupabaseClient = createClient(supabaseUrl, supabaseKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${req.headers['authorization'].split(' ')[1]}`
                }
            }
        });

        const { data, error } = await userSupabaseClient
            .from('student')
            .select('stud_id, stud_fname, stud_lname, stud_picture, user_id')
            .eq('user_id', userId)
            .single();

        if (error) {
            console.error('Error fetching student info:', error);
            return res.status(400).json({ success: false, message: error.message });
        }

        res.json({ success: true, student: data });
    } catch (err) {
        console.error('Server error fetching student info:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// API endpoint to insert a new notification (added for message_page.html notification insertion)
app.post('/notifications', authenticateToken, async (req, res) => {
    const { receiver_id, sender_id, receiver_uuid, sender_uuid, type, content, item_id } = req.body;

    if (!receiver_id || !sender_id || !receiver_uuid || !sender_uuid || !type || !content) {
        return res.status(400).json({ success: false, message: 'Missing required notification fields' });
    }

    try {
        const userSupabaseClient = createClient(supabaseUrl, supabaseKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${req.headers['authorization'].split(' ')[1]}`
                }
            }
        });

        const insertData = {
            receiver_id,
            sender_id,
            receiver_uuid,
            sender_uuid,
            type,
            content
        };

        if (item_id) {
            insertData.item_id = item_id;
        }

        const { data, error } = await userSupabaseClient
            .from('notifications')
            .insert([insertData])
            .select()
            .single();

        if (error) {
            console.error('Error inserting notification:', error);
            return res.status(400).json({ success: false, message: error.message });
        }

        res.status(201).json({ success: true, notification: data });
    } catch (err) {
        console.error('Server error inserting notification:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// API endpoint to update last_checked_at timestamp for authenticated user in student table
app.post('/notifications/last-checked', authenticateToken, async (req, res) => {
    try {
        const userSupabaseClient = createClient(supabaseUrl, supabaseKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${req.headers['authorization'].split(' ')[1]}`
                }
            }
        });

        const now = new Date().toISOString();

        // Update last_checked_at in student table for the authenticated user
        const { data, error } = await userSupabaseClient
            .from('student')
            .update({ last_checked_at: now })
            .eq('user_id', req.user.uid);

        if (error) {
            console.error('Error updating last_checked_at in student table:', error);
            return res.status(400).json({ success: false, message: error.message });
        }

        res.json({ success: true, message: 'last_checked_at updated in student table' });
    } catch (err) {
        console.error('Server error updating last_checked_at in student table:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// API endpoint to update item status by item_id
app.post('/item/:item_id/status', authenticateToken, async (req, res) => {
    const itemId = req.params.item_id;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ success: false, message: 'Status is required' });
    }

    try {
        const userSupabaseClient = createClient(supabaseUrl, supabaseKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${req.headers['authorization'].split(' ')[1]}`
                }
            }
        });

        // Update the item status
        const { data, error } = await userSupabaseClient
            .from('item')
            .update({ item_status: status })
            .eq('item_id', itemId);

        if (error) {
            console.error('Error updating item status:', error);
            return res.status(400).json({ success: false, message: error.message });
        }

        // If status is 'sold' or 'available', notify users who have 'cart' transactions for this item
        if (status === 'sold' || status === 'available') {
            // Get all transactions with status 'cart' for this item
            const { data: cartTransactions, error: cartError } = await userSupabaseClient
                .from('transactions')
                .select('transac_id, buyer_id, buyer_uuid')
                .eq('item_uuid', itemId)
                .eq('status', 'cart');

            if (cartError) {
                console.error('Error fetching cart transactions for notifications:', cartError);
            } else if (cartTransactions && cartTransactions.length > 0) {
                for (const transaction of cartTransactions) {
                    const notificationType = status === 'sold' ? 'item_sold' : 'item_available';
                    const notificationContent = status === 'sold'
                        ? `An item you requested notification for has been sold.`
                        : `An item you requested notification for is now available.`;

                    try {
                        await userSupabaseClient
                            .from('notifications')
                            .insert([{
                                receiver_id: transaction.buyer_id,
                                sender_id: null,
                                receiver_uuid: transaction.buyer_uuid,
                                sender_uuid: null,
                                type: notificationType,
                                content: notificationContent,
                                metadata: { item_id: itemId }
                            }]);
                        // Update or remove the 'cart' transaction since item is sold or available
                        if (status === 'sold') {
                            // Update transaction status to 'cancelled' or remove transaction
                            // Here, we choose to update status to 'cancelled'
                            await userSupabaseClient
                                .from('transactions')
                                .update({ status: 'cancelled' })
                                .eq('transac_id', transaction.transac_id);
                        }
                    } catch (notifErr) {
                        console.error('Error inserting notification or updating transaction:', notifErr);
                    }
                }
            }
        }

        res.json({ success: true, message: 'Item status updated', data });
    } catch (err) {
        console.error('Server error updating item status:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// New API endpoint to handle buy confirmation and update item status to "reserved" on behalf of seller
app.post('/item/:item_id/buy', authenticateToken, async (req, res) => {
    const itemId = req.params.item_id;
    const buyerId = req.user.uid;

    console.log('Buy confirmation request received for itemId:', itemId, 'by buyerId:', buyerId);

    try {
        // Create a supabase client with service role key to bypass RLS
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            console.error('Server Error: SUPABASE_SERVICE_ROLE_KEY not configured in environment.');
            return res.status(500).json({ success: false, message: 'Server configuration error: Service role key missing.' });
        }
        const serviceSupabaseClient = createClient(supabaseUrl, serviceRoleKey);

        console.log('Debug: Buy endpoint - itemId:', itemId, 'buyerId:', buyerId);

        // Verify buyer has a transaction with status 'requested' or 'cart' for this item
        console.log('Debug: Fetching transactions for buyer and item...');
        const { data: transactions, error: transError } = await serviceSupabaseClient
            .from('transactions')
            .select('*')
            .eq('buyer_uuid', buyerId)
            .eq('item_uuid', itemId)
            .in('status', ['requested', 'cart'])
            .limit(1);

        if (transError) {
            console.error('Error fetching transactions:', transError);
            return res.status(400).json({ success: false, message: `Database error fetching transactions: ${transError.message}` });
        }

        console.log('Debug: Transactions found:', transactions);

        if (!transactions || transactions.length === 0) {
            console.error('Error: No valid transaction found for buyer and item.');
            return res.status(403).json({ success: false, message: 'No valid transaction found for buyer and item.' });
        }

        // Get the seller's user_id for the item
        console.log('Debug: Fetching item data for itemId:', itemId);
        const { data: itemDataArray, error: itemError } = await serviceSupabaseClient
            .from('item')
            .select('stud_id')
            .eq('item_id', itemId);

        console.log('Debug: itemDataArray:', itemDataArray);

        if (itemError || !itemDataArray || itemDataArray.length === 0) {
            console.error('Error fetching item data:', itemError);
            return res.status(400).json({ success: false, message: `Database error fetching item data: ${itemError ? itemError.message : 'Item not found'}` });
        }

        const itemData = itemDataArray[0];
        console.log('Debug: Item data:', itemData);

        // Update the item status to "reserved"
        console.log('Debug: Updating item status to "reserved" for itemId:', itemId);
        const { data, error } = await serviceSupabaseClient
            .from('item')
            .update({ item_status: 'reserved' })
            .eq('item_id', itemId);

        if (error) {
            console.error('Error updating item status:', error);
            return res.status(400).json({ success: false, message: `Database error updating item status: ${error.message}` });
        }

        console.log('Debug: Item status updated successfully to reserved.');

        res.json({ success: true, message: 'Item status updated to reserved', data });
    } catch (err) {
        console.error('Critical Server Error in /item/:item_id/buy endpoint:', err.message, err.stack);
        res.status(500).json({ success: false, message: `An unexpected server error occurred: ${err.message}` });
    }
});

// New API endpoint to set item status to "available" using service role key, bypassing RLS
app.post('/item/:item_id/set-available', async (req, res) => {
    const itemId = req.params.item_id;

    try {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            console.error('Service role key not configured');
            return res.status(500).json({ success: false, message: 'Service role key not configured' });
        }
        const serviceSupabaseClient = createClient(supabaseUrl, serviceRoleKey);

        // Update the item status to "available"
        const { data, error } = await serviceSupabaseClient
            .from('item')
            .update({ item_status: 'available' })
            .eq('item_id', itemId)
            .select();

        if (error) {
            console.error('Error updating item status to available:', error);
            return res.status(400).json({ success: false, message: error.message });
        }

        // Notify users with 'cart' transactions for this item
        try {
            const { data: cartTransactions, error: cartError } = await serviceSupabaseClient
                .from('transactions')
                .select('transac_id, buyer_id, buyer_uuid')
                .eq('item_uuid', itemId)
                .eq('status', 'cart');

            if (cartError) {
                console.error('Error fetching cart transactions for notifications:', cartError);
            } else if (cartTransactions && cartTransactions.length > 0) {
                for (const transaction of cartTransactions) {
                    const notificationType = 'item_available';
                    const notificationContent = 'An item you requested notification for is now available.';

                    try {
                        await serviceSupabaseClient
                            .from('notifications')
                            .insert([{
                                receiver_id: transaction.buyer_id,
                                sender_id: null,
                                receiver_uuid: transaction.buyer_uuid,
                                sender_uuid: null,
                                type: notificationType,
                                content: notificationContent,
                                metadata: { item_id: itemId }
                            }]);
                    } catch (notifErr) {
                        console.error('Error inserting notification:', notifErr);
                    }
                }
            }
        } catch (notifOuterErr) {
            console.error('Error in notification sending logic:', notifOuterErr);
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('Server error updating item status to available:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Endpoint to mark transaction as completed and item as sold (bypassing RLS)
app.post('/complete-transaction', authenticateToken, async (req, res) => {
    const { item_id, buyer_id } = req.body;
    if (!item_id || !buyer_id) {
        return res.status(400).json({ success: false, message: 'Missing item_id or buyer_id' });
    }

    try {
        // Use service role key to bypass RLS
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            return res.status(500).json({ success: false, message: 'Service role key not configured' });
        }
        const serviceSupabaseClient = createClient(supabaseUrl, serviceRoleKey);

        // Get item_uuid from item_id (integer)
        const { data: itemData, error: itemError } = await serviceSupabaseClient
            .from('item')
            .select('item_id, item_uuid')
            .eq('item_id', item_id)
            .single();

        if (itemError || !itemData) {
            return res.status(404).json({ success: false, message: 'Item not found.' });
        }

        const itemUuid = itemData.item_uuid;

        // Check that the transaction exists and belongs to the buyer
        const { data: transaction, error: transError } = await serviceSupabaseClient
            .from('transactions')
            .select('*')
            .eq('item_uuid', itemUuid)
            .eq('buyer_id', buyer_id)
            .single();

        if (transError || !transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found or does not belong to buyer.' });
        }

        // Update transaction status to 'completed'
        const { error: updateTransError } = await serviceSupabaseClient
            .from('transactions')
            .update({ status: 'completed' })
            .eq('item_uuid', itemUuid)
            .eq('buyer_id', buyer_id);

        if (updateTransError) {
            return res.status(400).json({ success: false, message: 'Failed to update transaction.' });
        }

        // Update item status to 'sold'
        const { error: updateItemError } = await serviceSupabaseClient
            .from('item')
            .update({ item_status: 'sold' })
            .eq('item_id', item_id);

        if (updateItemError) {
            return res.status(400).json({ success: false, message: 'Failed to update item.' });
        }

        res.json({ success: true, message: 'Transaction completed and item marked as sold.' });
    } catch (err) {
        console.error('Server error in /complete-transaction:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// API endpoint to update user password in auth.users using service role
app.post('/update-password', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    try {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            console.error('Service role key not configured');
            return res.status(500).json({ success: false, message: 'Service role key not configured' });
        }
        const serviceSupabaseClient = createClient(supabaseUrl, serviceRoleKey);

        // Get user_id from student table
        const { data: student, error: studentError } = await serviceSupabaseClient
            .from('student')
            .select('user_id')
            .eq('stud_email', email)
            .single();

        if (studentError || !student) {
            console.error('User not found in student table:', studentError);
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Update auth user password using admin API
        const { error: updateError } = await serviceSupabaseClient.auth.admin.updateUserById(student.user_id, {
            password: password
        });

        if (updateError) {
            console.error('Error updating auth user password:', updateError);
            return res.status(400).json({ success: false, message: updateError.message });
        }

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('Server error updating password:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Start the server
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

module.exports = app;
