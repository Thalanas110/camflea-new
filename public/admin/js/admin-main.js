import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Secure configuration - gets credentials from server API
let supabase = null;

async function initializeSupabase() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error(`Failed to fetch config: ${response.status}`);
        }
        
        const config = await response.json();
        supabase = createClient(config.supabaseUrl, config.supabaseKey);
        return supabase;
    } catch (error) {
        console.error('Error initializing Supabase:', error);
        throw error;
    }
}

Chart.register(window.ChartDataLabels);

// Enhanced color palettes for different chart categories
const colorPalettes = {
    userAnalytics: {
        primary: ['#3498db', '#2980b9', '#1f77b4', '#aec7e8', '#ffbb78', '#ff7f0e'],
        gradient: 'linear-gradient(135deg, #3498db, #2980b9)'
    },
    marketplaceAnalytics: {
        primary: ['#e74c3c', '#c0392b', '#d62728', '#ff9f9b', '#2ca02c', '#98df8a'],
        gradient: 'linear-gradient(135deg, #e74c3c, #c0392b)'
    },
    pricingAnalytics: {
        primary: ['#f39c12', '#e67e22', '#ff7f0e', '#ffbb78', '#d62728', '#ff9f9b'],
        gradient: 'linear-gradient(135deg, #f39c12, #e67e22)'
    },
    transactionAnalytics: {
        primary: ['#9b59b6', '#8e44ad', '#9467bd', '#c5b0d5', '#17becf', '#9edae5'],
        gradient: 'linear-gradient(135deg, #9b59b6, #8e44ad)'
    },
    trendsAnalytics: {
        primary: ['#1abc9c', '#16a085', '#2ca02c', '#98df8a', '#ff7f0e', '#ffbb78'],
        gradient: 'linear-gradient(135deg, #1abc9c, #16a085)'
    }
};

// Enhanced chart options with animations and better styling
const getEnhancedChartOptions = (type, category) => {
    const baseOptions = {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: window.innerWidth < 768 ? 1.2 : 1.4,
        animation: {
            duration: 1500,
            easing: 'easeOutQuart'
        },
        plugins: {
            legend: {
                position: window.innerWidth < 768 ? 'bottom' : 'right',
                labels: {
                    padding: window.innerWidth < 768 ? 10 : 15,
                    font: {
                        size: window.innerWidth < 768 ? 11 : 13,
                        family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                    },
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: 'white',
                bodyColor: 'white',
                borderColor: colorPalettes[category].primary[0],
                borderWidth: 2,
                cornerRadius: 8,
                displayColors: true,
                callbacks: {
                    label: function(context) {
                        const total = context.chart._metasets[0]?.total || context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = total ? ((context.parsed / total) * 100).toFixed(1) : 0;
                        return `${context.label}: ${context.parsed} (${percentage}%)`;
                    }
                }
            }
        }
    };

    if (type === 'pie' || type === 'doughnut') {
        baseOptions.plugins.datalabels = {
            display: function(context) {
                const dataset = context.dataset;
                const total = dataset.data.reduce((sum, dataValue) => sum + dataValue, 0);
                const value = dataset.data[context.dataIndex];
                const percentage = total ? (value / total) * 100 : 0;
                return percentage > 3;
            },
            formatter: function(value, context) {
                const total = context.chart._metasets[context.datasetIndex].total;
                const percentage = total ? ((value / total) * 100).toFixed(1) : 0;
                return window.innerWidth < 480 ? `${percentage}%` : `${value}\n(${percentage}%)`;
            },
            color: '#fff',
            font: {
                weight: 'bold',
                size: window.innerWidth < 768 ? 10 : 12
            },
            textAlign: 'center',
            anchor: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: 4,
            padding: { top: 2, bottom: 2, left: 4, right: 4 }
        };
    } else if (type === 'bar' || type === 'line') {
        baseOptions.scales = {
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                    borderDash: [5, 5]
                },
                ticks: {
                    font: {
                        size: window.innerWidth < 768 ? 10 : 12
                    }
                },
                title: {
                    display: true,
                    font: {
                        size: window.innerWidth < 768 ? 11 : 14,
                        weight: 'bold'
                    }
                }
            },
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    font: {
                        size: window.innerWidth < 768 ? 9 : 11
                    },
                    maxRotation: 45
                }
            }
        };

        baseOptions.plugins.datalabels = {
            display: function(context) {
                return context.dataset.data[context.dataIndex] > 0;
            },
            anchor: 'end',
            align: 'top',
            offset: 2,
            formatter: function(value) {
                return type === 'line' ? value : Math.round(value);
            },
            color: '#2c3e50',
            font: {
                weight: 'bold',
                size: window.innerWidth < 768 ? 9 : 11
            }
        };
    }

    return baseOptions;
};

async function fetchUserStats() {
    // Fetch all students with stud_school and group in JS
    const { data: allStudents, error: allError } = await supabase
        .from('student')
        .select('stud_school');

    if (allError) {
        console.error('Error fetching all students:', allError);
        return {};
    }

    const schoolCounts = {};
    allStudents.forEach(student => {
        const school = student.stud_school || 'Unknown';
        schoolCounts[school] = (schoolCounts[school] || 0) + 1;
    });

    return schoolCounts;
}

async function fetchItemStats() {
    // Fetch available items by item_type (not sold)
    const { data: availableItems, error: availableError } = await supabase
        .from('item')
        .select('item_type, item_status')
        .neq('item_status', 'sold');

    if (availableError) {
        console.error('Error fetching available items:', availableError);
        return { availableItemsByType: {}, soldItemsByType: {} };
    }

    const availableItemsByType = {};
    availableItems.forEach(item => {
        const type = item.item_type || 'Unknown';
        availableItemsByType[type] = (availableItemsByType[type] || 0) + 1;
    });

    // Fetch sold items by item_type
    const { data: soldItems, error: soldError } = await supabase
        .from('item')
        .select('item_type')
        .eq('item_status', 'sold');

    if (soldError) {
        console.error('Error fetching sold items:', soldError);
        return { availableItemsByType, soldItemsByType: {} };
    }

    const soldItemsByType = {};
    soldItems.forEach(item => {
        const type = item.item_type || 'Unknown';
        soldItemsByType[type] = (soldItemsByType[type] || 0) + 1;
    });

    return { availableItemsByType, soldItemsByType };
}

async function fetchPriceRangeStats() {
    // Fetch items with price information
    const { data: items, error: itemsError } = await supabase
        .from('item')
        .select('item_price, item_price_type, item_price_min, item_price_max');

    if (itemsError) {
        console.error('Error fetching items for price range:', itemsError);
        return {};
    }

    // Define price ranges
    const priceRanges = {
        'Free': 0,
        '₱1 - ₱50': 0,
        '₱51 - ₱100': 0,
        '₱101 - ₱200': 0,
        '₱201 - ₱500': 0,
        '₱501 - ₱1,000': 0,
        '₱1,001+': 0
    };

    items.forEach(item => {
        let price = 0;

        // Determine the price to use based on item_price_type
        if (item.item_price_type === 'fixed' && item.item_price) {
            price = parseFloat(item.item_price);
        } else if (item.item_price_type === 'negotiable') {
            // For negotiable, use the average of min and max if both exist
            if (item.item_price_min && item.item_price_max) {
                price = (parseFloat(item.item_price_min) + parseFloat(item.item_price_max)) / 2;
            } else if (item.item_price_min) {
                price = parseFloat(item.item_price_min);
            } else if (item.item_price_max) {
                price = parseFloat(item.item_price_max);
            } else if (item.item_price) {
                price = parseFloat(item.item_price);
            }
        } else if (item.item_price_type === 'free' || item.item_price === 0) {
            priceRanges['Free']++;
            return;
        } else if (item.item_price) {
            price = parseFloat(item.item_price);
        }

        // Categorize into price ranges
        if (price === 0) {
            priceRanges['Free']++;
        } else if (price > 0 && price <= 50) {
            priceRanges['₱1 - ₱50']++;
        } else if (price > 50 && price <= 100) {
            priceRanges['₱51 - ₱100']++;
        } else if (price > 100 && price <= 200) {
            priceRanges['₱101 - ₱200']++;
        } else if (price > 200 && price <= 500) {
            priceRanges['₱201 - ₱500']++;
        } else if (price > 500 && price <= 1000) {
            priceRanges['₱501 - ₱1,000']++;
        } else if (price > 1000) {
            priceRanges['₱1,001+']++;
        }
    });

    return priceRanges;
}

async function fetchConditionStats() {
    // Fetch items with condition information
    const { data: items, error: itemsError } = await supabase
        .from('item')
        .select('item_condition');

    if (itemsError) {
        console.error('Error fetching items for condition:', itemsError);
        return {};
    }

    const conditionCounts = {
        'Brand New': 0,
        'Like New': 0,
        'Good': 0,
        'Fair': 0,
        'Poor': 0
    };

    items.forEach(item => {
        const condition = item.item_condition || 'Unknown';
        if (conditionCounts.hasOwnProperty(condition)) {
            conditionCounts[condition]++;
        } else {
            conditionCounts[condition] = 1;
        }
    });

    return conditionCounts;
}

async function fetchPriceTypeStats() {
    // Fetch items with price type information
    const { data: items, error: itemsError } = await supabase
        .from('item')
        .select('item_price_type');

    if (itemsError) {
        console.error('Error fetching items for price type:', itemsError);
        return {};
    }

    const priceTypeCounts = {
        'fixed': 0,
        'negotiable': 0,
        'free': 0
    };

    items.forEach(item => {
        const priceType = item.item_price_type || 'fixed';
        if (priceTypeCounts.hasOwnProperty(priceType)) {
            priceTypeCounts[priceType]++;
        } else {
            priceTypeCounts[priceType] = 1;
        }
    });

    return priceTypeCounts;
}

async function fetchListingTrendStats() {
    // Fetch items with creation date
    const { data: items, error: itemsError } = await supabase
        .from('item')
        .select('created_at')
        .order('created_at', { ascending: true });

    if (itemsError) {
        console.error('Error fetching items for listing trend:', itemsError);
        return { labels: [], data: [] };
    }

    // Group by week (last 12 weeks)
    const weeklyData = {};
    const now = new Date();
    
    items.forEach(item => {
        if (!item.created_at) return;
        
        const itemDate = new Date(item.created_at);
        const weeksDiff = Math.floor((now - itemDate) / (7 * 24 * 60 * 60 * 1000));
        
        // Only count items from last 12 weeks
        if (weeksDiff >= 0 && weeksDiff < 12) {
            const weekKey = `Week ${12 - weeksDiff}`;
            weeklyData[weekKey] = (weeklyData[weekKey] || 0) + 1;
        }
    });

    // Create labels and data arrays for the last 12 weeks
    const labels = [];
    const data = [];
    for (let i = 12; i >= 1; i--) {
        const weekLabel = `Week ${i}`;
        labels.push(weekLabel);
        data.push(weeklyData[weekLabel] || 0);
    }

    return { labels, data };
}

async function fetchTimeToSellStats() {
    // Use transactions (completed) joined with item to determine when an item was sold
    // This prevents relying on an `updated_at` column on `item` which doesn't exist.
    try {
        const { data: soldTrans, error: soldTransError } = await supabase
            .from('transactions')
            .select('updated_at, item(item_price_type, created_at)')
            .eq('status', 'completed');

        if (soldTransError) {
            console.error('Error fetching completed transactions for time to sell:', soldTransError);
            // Fallback: return empty structured data so render function can handle it
            return { avgTimeToSell: { fixed: 0, negotiable: 0, free: 0 }, counts: { fixed: 0, negotiable: 0, free: 0 } };
        }

        const timeByPriceType = {
            'fixed': [],
            'negotiable': [],
            'free': []
        };

        soldTrans.forEach(tx => {
            const item = tx.item;
            if (!item || !item.created_at || !tx.updated_at) return;

            const createdDate = new Date(item.created_at);
            const soldDate = new Date(tx.updated_at);
            const daysToSell = Math.floor((soldDate - createdDate) / (24 * 60 * 60 * 1000));

            if (daysToSell >= 0) {
                const priceType = item.item_price_type || 'fixed';
                if (timeByPriceType.hasOwnProperty(priceType)) {
                    timeByPriceType[priceType].push(daysToSell);
                }
            }
        });

        // Calculate averages
        const avgTimeToSell = {};
        for (const [priceType, days] of Object.entries(timeByPriceType)) {
            if (days.length > 0) {
                const sum = days.reduce((a, b) => a + b, 0);
                avgTimeToSell[priceType] = (sum / days.length).toFixed(1);
            } else {
                avgTimeToSell[priceType] = 0;
            }
        }

        return { avgTimeToSell, counts: Object.fromEntries(Object.entries(timeByPriceType).map(([k, v]) => [k, v.length])) };
    } catch (err) {
        console.error('Unexpected error in fetchTimeToSellStats:', err);
        return { avgTimeToSell: { fixed: 0, negotiable: 0, free: 0 }, counts: { fixed: 0, negotiable: 0, free: 0 } };
    }
}

async function fetchTransactionStats() {
    // Total ongoing transactions by status
    const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('status');

    if (transError) {
        console.error('Error fetching transactions:', transError);
        return { transactionsByStatus: {} };
    }

    const predefinedTransactionStatuses = [
        'pending',
        'completed',
        'cancelled',
        'reserved' // Added 'reserved' status
    ];

    const transactionsByStatus = {};
    predefinedTransactionStatuses.forEach(status => {
        transactionsByStatus[status] = 0;
    });

    transactions.forEach(tran => {
        const status = tran.status || 'Unknown';
        if (transactionsByStatus.hasOwnProperty(status)) {
            transactionsByStatus[status]++;
        } else {
            transactionsByStatus[status] = 1; // Add if it's a new type not in predefined list
        }
    });

    return { transactionsByStatus };
}

function renderUserStats(schoolCounts) {
    // Render enhanced doughnut chart for users by school
    const ctx = document.getElementById('userStatsPieChart').getContext('2d');
    const labels = Object.keys(schoolCounts);
    const data = Object.values(schoolCounts);

    if (window.userPieChart) {
        window.userPieChart.destroy();
    }

    // Create gradient backgrounds
    const gradients = labels.map((_, index) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        const color = colorPalettes.userAnalytics.primary[index % colorPalettes.userAnalytics.primary.length];
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color + '80');
        return gradient;
    });

    window.userPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Users by School',
                data: data,
                backgroundColor: gradients,
                borderColor: colorPalettes.userAnalytics.primary.slice(0, labels.length),
                borderWidth: 3,
                hoverBorderWidth: 4,
                hoverBorderColor: '#fff',
                hoverOffset: 8
            }]
        },
        options: {
            ...getEnhancedChartOptions('doughnut', 'userAnalytics'),
            cutout: '60%',
            plugins: {
                ...getEnhancedChartOptions('doughnut', 'userAnalytics').plugins,
                tooltip: {
                    ...getEnhancedChartOptions('doughnut', 'userAnalytics').plugins.tooltip,
                    callbacks: {
                        title: function(context) {
                            return 'School Distribution';
                        },
                        label: function(context) {
                            const total = context.chart._metasets[0].total;
                            const percentage = total ? ((context.parsed / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.parsed} students (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderItemStats(availableItemsByType, soldItemsByType) {
    // Render available items chart (doughnut chart without overlapping labels)
    renderAvailableItemsChart(availableItemsByType);
    
    // Render sold items chart and list
    renderSoldItemsChart(soldItemsByType);
}

function renderAvailableItemsChart(availableItemsByType) {
    const ctx = document.getElementById('itemsByTypeChart').getContext('2d');
    const labels = Object.keys(availableItemsByType);
    const data = Object.values(availableItemsByType);

    if (window.itemsChart) {
        window.itemsChart.destroy();
    }

    window.itemsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Available Items',
                data: data,
                backgroundColor: colorPalettes.marketplaceAnalytics.primary.slice(0, labels.length).map(color => color + '90'),
                borderColor: colorPalettes.marketplaceAnalytics.primary.slice(0, labels.length),
                borderWidth: 3,
                hoverBorderWidth: 4,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: window.innerWidth < 768 ? 1.2 : 1.4,
            cutout: '60%',
            animation: {
                duration: 1500,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: {
                    position: window.innerWidth < 768 ? 'bottom' : 'right',
                    labels: {
                        padding: window.innerWidth < 768 ? 10 : 15,
                        font: {
                            size: window.innerWidth < 768 ? 11 : 13,
                            family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                        },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: colorPalettes.marketplaceAnalytics.primary[0],
                    borderWidth: 2,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                        title: function(context) {
                            return 'Available Items Distribution';
                        },
                        label: function(context) {
                            const total = context.chart._metasets[0].total;
                            const percentage = total ? ((context.parsed / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.parsed} items (${percentage}%)`;
                        }
                    }
                },
                // Disable data labels to avoid overlap
                datalabels: {
                    display: false
                }
            }
        }
    });
}

function renderSoldItemsChart(soldItemsByType) {
    // Define all possible item categories
    const allCategories = [
        'clothes & accessories',
        'books & school supplies',
        'gadgets & electronics',
        'instruments & recreations',
        'crafted & collectibles',
        'sports & fitness'
    ];

    // Create complete data structure with all categories
    const completeData = {};
    allCategories.forEach(category => {
        completeData[category] = soldItemsByType[category] || 0;
    });

    // Add any additional categories that might exist in the data
    Object.keys(soldItemsByType).forEach(category => {
        if (!allCategories.includes(category)) {
            completeData[category] = soldItemsByType[category];
        }
    });

    const totalSold = Object.values(completeData).reduce((a, b) => a + b, 0);

    // Render bar chart for sold items
    const ctx = document.getElementById('soldItemsByTypeChart').getContext('2d');
    const labels = Object.keys(completeData);
    const data = Object.values(completeData);

    if (window.soldItemsChart) {
        window.soldItemsChart.destroy();
    }

    // Always show the chart, even with zero values
    // This gives a complete view of all categories

    // Create gradient backgrounds for each bar
    const gradients = data.map((value, index) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        const color = colorPalettes.marketplaceAnalytics.primary[index % colorPalettes.marketplaceAnalytics.primary.length];
        // Use different opacity based on whether there are sales or not
        const opacity = value > 0 ? '80' : '20';
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color + opacity);
        return gradient;
    });

    window.soldItemsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Sold Items',
                data: data,
                backgroundColor: gradients,
                borderColor: colorPalettes.marketplaceAnalytics.primary.slice(0, data.length),
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
                hoverBackgroundColor: colorPalettes.marketplaceAnalytics.primary.slice(0, data.length),
                hoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: window.innerWidth < 768 ? 1.2 : 1.4,
            animation: {
                duration: 1500,
                easing: 'easeOutQuart'
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)',
                        borderDash: [5, 5]
                    },
                    ticks: {
                        stepSize: 1,
                        font: {
                            size: window.innerWidth < 768 ? 10 : 12
                        }
                    },
                    title: {
                        display: true,
                        text: 'Number of Items Sold',
                        color: '#2c3e50',
                        font: {
                            size: window.innerWidth < 768 ? 11 : 14,
                            weight: 'bold'
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: window.innerWidth < 768 ? 9 : 11
                        },
                        maxRotation: 45
                    },
                    title: {
                        display: true,
                        text: 'Item Type',
                        color: '#2c3e50',
                        font: {
                            size: window.innerWidth < 768 ? 11 : 14,
                            weight: 'bold'
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: colorPalettes.marketplaceAnalytics.primary[0],
                    borderWidth: 2,
                    cornerRadius: 8,
                    callbacks: {
                        title: function(context) {
                            return 'Sales Performance by Category';
                        },
                        label: function(context) {
                            const value = context.parsed.y;
                            if (value === 0) {
                                return `${context.label}: No sales yet`;
                            }
                            const percentage = totalSold ? ((value / totalSold) * 100).toFixed(1) : 0;
                            return `${context.label}: ${value} items sold (${percentage}%)`;
                        }
                    }
                },
                datalabels: {
                    display: function(context) {
                        // Show all labels, including zeros
                        return true;
                    },
                    anchor: 'end',
                    align: 'top',
                    offset: 2,
                    formatter: function(value) {
                        return value === 0 ? '0' : Math.round(value);
                    },
                    color: function(context) {
                        // Gray color for zero values, normal color for others
                        return context.dataset.data[context.dataIndex] === 0 ? '#95a5a6' : '#2c3e50';
                    },
                    font: {
                        weight: 'bold',
                        size: window.innerWidth < 768 ? 9 : 11
                    }
                }
            }
        }
    });
}

function renderTransactionStats(transactionsByStatus) {
    // Render enhanced doughnut chart for transactions by status
    const ctx = document.getElementById('transactionStatusPieChart').getContext('2d');
    const labels = Object.keys(transactionsByStatus).map(status => 
        status.charAt(0).toUpperCase() + status.slice(1)
    );
    const data = Object.values(transactionsByStatus);

    if (window.transactionPieChart) {
        window.transactionPieChart.destroy();
    }

    window.transactionPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Transactions by Status',
                data: data,
                backgroundColor: colorPalettes.transactionAnalytics.primary.slice(0, labels.length).map(color => color + '90'),
                borderColor: colorPalettes.transactionAnalytics.primary.slice(0, labels.length),
                borderWidth: 3,
                hoverBorderWidth: 4,
                hoverOffset: 10
            }]
        },
        options: {
            ...getEnhancedChartOptions('doughnut', 'transactionAnalytics'),
            cutout: '55%',
            plugins: {
                ...getEnhancedChartOptions('doughnut', 'transactionAnalytics').plugins,
                tooltip: {
                    ...getEnhancedChartOptions('doughnut', 'transactionAnalytics').plugins.tooltip,
                    callbacks: {
                        title: function(context) {
                            return 'Transaction Status';
                        },
                        label: function(context) {
                            const total = context.chart._metasets[0].total;
                            const percentage = total ? ((context.parsed / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.parsed} transactions (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

async function fetchReportStats() {
    const { data: reports, error: reportsError } = await supabase
        .from('report')
        .select('violation_type');

    if (reportsError) {
        console.error('Error fetching reports:', reportsError);
        return {};
    }

    const predefinedViolationTypes = [
        'fake listings',
        'price manipulation',
        'identity theft',
        'misinformation',
        'Non-compliance with Transaction Protocol',
        'chargeback abuse',
        'other'
    ];

    const reportTypeCounts = {};
    predefinedViolationTypes.forEach(type => {
        reportTypeCounts[type] = 0;
    });

    reports.forEach(report => {
        const type = report.violation_type || 'Unknown';
        if (reportTypeCounts.hasOwnProperty(type)) {
            reportTypeCounts[type]++;
        } else {
            reportTypeCounts[type] = 1; // Add if it's a new type not in predefined list
        }
    });

    return reportTypeCounts;
}

function renderReportStats(reportTypeCounts) {
    const ctx = document.getElementById('reportTypePieChart').getContext('2d');
    const labels = Object.keys(reportTypeCounts).map(type => 
        type.charAt(0).toUpperCase() + type.slice(1)
    );
    const data = Object.values(reportTypeCounts);

    if (window.reportPieChart) {
        window.reportPieChart.destroy();
    }

    // Use red spectrum colors for violation reports to indicate severity
    const severityColors = [
        '#e74c3c', '#c0392b', '#a93226', '#922b21', '#7b241c', '#641e16', '#5d1a1a'
    ];

    window.reportPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Reports by Violation Type',
                data: data,
                backgroundColor: severityColors.slice(0, labels.length).map(color => color + '80'),
                borderColor: severityColors.slice(0, labels.length),
                borderWidth: 3,
                hoverBorderWidth: 4,
                hoverOffset: 8
            }]
        },
        options: {
            ...getEnhancedChartOptions('doughnut', 'trendsAnalytics'),
            cutout: '50%',
            plugins: {
                ...getEnhancedChartOptions('doughnut', 'trendsAnalytics').plugins,
                tooltip: {
                    ...getEnhancedChartOptions('doughnut', 'trendsAnalytics').plugins.tooltip,
                    backgroundColor: 'rgba(231, 76, 60, 0.9)',
                    callbacks: {
                        title: function(context) {
                            return 'Security Violation Reports';
                        },
                        label: function(context) {
                            const total = context.chart._metasets[0].total;
                            const percentage = total ? ((context.parsed / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.parsed} reports (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

async function fetchItemStatusStats() {
    // Total items by item_status
    const { data: items, error: itemsError } = await supabase
        .from('item')
        .select('item_status');

    if (itemsError) {
        console.error('Error fetching item statuses:', itemsError);
        return {};
    }

    const predefinedItemStatuses = [
        'available',
        'sold',
        'pending',
        'cancelled'
    ];

    const itemsByStatus = {};
    predefinedItemStatuses.forEach(status => {
        itemsByStatus[status] = 0;
    });

    items.forEach(item => {
        const status = item.item_status || 'Unknown';
        if (itemsByStatus.hasOwnProperty(status)) {
            itemsByStatus[status]++;
        } else {
            itemsByStatus[status] = 1; // Add if it's a new type not in predefined list
        }
    });

    return itemsByStatus;
}

function renderItemStatusStats(itemsByStatus) {
    // Render enhanced doughnut chart for items by item_status
    const ctx = document.getElementById('itemStatusPieChart').getContext('2d');
    const labels = Object.keys(itemsByStatus).map(status => 
        status.charAt(0).toUpperCase() + status.slice(1)
    );
    const data = Object.values(itemsByStatus);

    if (window.itemStatusPieChart instanceof Chart) {
        window.itemStatusPieChart.destroy();
    }

    // Custom colors for item status
    const statusColors = {
        'Available': '#27ae60',     // Green
        'Sold': '#e74c3c',          // Red
        'Pending': '#f39c12',       // Orange
        'Cancelled': '#95a5a6',     // Gray
        'Reserved': '#9b59b6'       // Purple
    };

    window.itemStatusPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Items by Status',
                data: data,
                backgroundColor: labels.map(label => (statusColors[label] || colorPalettes.marketplaceAnalytics.primary[0]) + '80'),
                borderColor: labels.map(label => statusColors[label] || colorPalettes.marketplaceAnalytics.primary[0]),
                borderWidth: 3,
                hoverBorderWidth: 4,
                hoverOffset: 8
            }]
        },
        options: {
            ...getEnhancedChartOptions('doughnut', 'marketplaceAnalytics'),
            cutout: '55%',
            plugins: {
                ...getEnhancedChartOptions('doughnut', 'marketplaceAnalytics').plugins,
                tooltip: {
                    ...getEnhancedChartOptions('doughnut', 'marketplaceAnalytics').plugins.tooltip,
                    callbacks: {
                        title: function(context) {
                            return 'Item Availability Status';
                        },
                        label: function(context) {
                            const total = context.chart._metasets[0].total;
                            const percentage = total ? ((context.parsed / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.parsed} items (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderPriceRangeStats(priceRanges) {
    // Render enhanced gradient bar chart for items by price range
    const ctx = document.getElementById('priceRangeChart').getContext('2d');
    const labels = Object.keys(priceRanges);
    const data = Object.values(priceRanges);

    if (window.priceRangeChart instanceof Chart) {
        window.priceRangeChart.destroy();
    }

    // Create gradient backgrounds for each bar
    const gradients = data.map((_, index) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        const color = colorPalettes.pricingAnalytics.primary[index % colorPalettes.pricingAnalytics.primary.length];
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color + '40');
        return gradient;
    });

    window.priceRangeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Items',
                data: data,
                backgroundColor: gradients,
                borderColor: colorPalettes.pricingAnalytics.primary.slice(0, data.length),
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
                hoverBackgroundColor: colorPalettes.pricingAnalytics.primary.slice(0, data.length),
                hoverBorderWidth: 3
            }]
        },
        options: {
            ...getEnhancedChartOptions('bar', 'pricingAnalytics'),
            scales: {
                ...getEnhancedChartOptions('bar', 'pricingAnalytics').scales,
                y: {
                    ...getEnhancedChartOptions('bar', 'pricingAnalytics').scales.y,
                    title: {
                        display: true,
                        text: 'Number of Items',
                        color: '#2c3e50',
                        font: {
                            size: window.innerWidth < 768 ? 11 : 14,
                            weight: 'bold'
                        }
                    }
                },
                x: {
                    ...getEnhancedChartOptions('bar', 'pricingAnalytics').scales.x,
                    title: {
                        display: true,
                        text: 'Price Range (PHP)',
                        color: '#2c3e50',
                        font: {
                            size: window.innerWidth < 768 ? 11 : 14,
                            weight: 'bold'
                        }
                    }
                }
            },
            plugins: {
                ...getEnhancedChartOptions('bar', 'pricingAnalytics').plugins,
                legend: {
                    display: false
                },
                tooltip: {
                    ...getEnhancedChartOptions('bar', 'pricingAnalytics').plugins.tooltip,
                    callbacks: {
                        title: function(context) {
                            return 'Price Range Analysis';
                        },
                        label: function(context) {
                            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const percentage = total ? ((context.parsed.y / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.parsed.y} items (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderConditionStats(conditionCounts) {
    const ctx = document.getElementById('conditionChart').getContext('2d');
    const labels = Object.keys(conditionCounts);
    const data = Object.values(conditionCounts);

    if (window.conditionChart instanceof Chart) {
        window.conditionChart.destroy();
    }

    // Custom colors for condition quality (green to red spectrum)
    const conditionColors = {
        'Brand New': '#27ae60',     // Green
        'Like New': '#2ecc71',      // Light Green  
        'Good': '#f39c12',          // Orange
        'Fair': '#e67e22',          // Dark Orange
        'Poor': '#e74c3c'           // Red
    };

    window.conditionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Items by Condition',
                data: data,
                backgroundColor: labels.map(label => (conditionColors[label] || '#95a5a6') + '90'),
                borderColor: labels.map(label => conditionColors[label] || '#95a5a6'),
                borderWidth: 3,
                hoverBorderWidth: 4,
                hoverOffset: 8
            }]
        },
        options: {
            ...getEnhancedChartOptions('doughnut', 'marketplaceAnalytics'),
            cutout: '50%',
            plugins: {
                ...getEnhancedChartOptions('doughnut', 'marketplaceAnalytics').plugins,
                tooltip: {
                    ...getEnhancedChartOptions('doughnut', 'marketplaceAnalytics').plugins.tooltip,
                    callbacks: {
                        title: function(context) {
                            return 'Item Condition Analysis';
                        },
                        label: function(context) {
                            const total = context.chart._metasets[0].total;
                            const percentage = total ? ((context.parsed / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.parsed} items (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderPriceTypeStats(priceTypeCounts) {
    const ctx = document.getElementById('priceTypeChart').getContext('2d');
    const labels = Object.keys(priceTypeCounts).map(type => {
        return type.charAt(0).toUpperCase() + type.slice(1);
    });
    const data = Object.values(priceTypeCounts);

    if (window.priceTypeChart instanceof Chart) {
        window.priceTypeChart.destroy();
    }

    window.priceTypeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Price Type Distribution',
                data: data,
                backgroundColor: colorPalettes.pricingAnalytics.primary.slice(0, 3).map(color => color + '80'),
                borderColor: colorPalettes.pricingAnalytics.primary.slice(0, 3),
                borderWidth: 3,
                hoverBorderWidth: 4,
                hoverOffset: 10
            }]
        },
        options: {
            ...getEnhancedChartOptions('doughnut', 'pricingAnalytics'),
            cutout: '60%',
            plugins: {
                ...getEnhancedChartOptions('doughnut', 'pricingAnalytics').plugins,
                tooltip: {
                    ...getEnhancedChartOptions('doughnut', 'pricingAnalytics').plugins.tooltip,
                    callbacks: {
                        title: function(context) {
                            return 'Pricing Strategy Distribution';
                        },
                        label: function(context) {
                            const total = context.chart._metasets[0].total;
                            const percentage = total ? ((context.parsed / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.parsed} items (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderListingTrendStats(trendData) {
    const ctx = document.getElementById('listingTrendChart').getContext('2d');

    if (window.listingTrendChart instanceof Chart) {
        window.listingTrendChart.destroy();
    }

    // Create gradient for the area fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, colorPalettes.trendsAnalytics.primary[0] + '60');
    gradient.addColorStop(1, colorPalettes.trendsAnalytics.primary[0] + '10');

    window.listingTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trendData.labels,
            datasets: [{
                label: 'Items Listed',
                data: trendData.data,
                backgroundColor: gradient,
                borderColor: colorPalettes.trendsAnalytics.primary[0],
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: colorPalettes.trendsAnalytics.primary[0],
                pointBorderColor: '#fff',
                pointBorderWidth: 3,
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: colorPalettes.trendsAnalytics.primary[0],
                pointHoverBorderWidth: 4
            }]
        },
        options: {
            ...getEnhancedChartOptions('line', 'trendsAnalytics'),
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                ...getEnhancedChartOptions('line', 'trendsAnalytics').scales,
                y: {
                    ...getEnhancedChartOptions('line', 'trendsAnalytics').scales.y,
                    title: {
                        display: true,
                        text: 'Items Listed',
                        color: '#2c3e50',
                        font: {
                            size: window.innerWidth < 768 ? 11 : 14,
                            weight: 'bold'
                        }
                    }
                },
                x: {
                    ...getEnhancedChartOptions('line', 'trendsAnalytics').scales.x,
                    title: {
                        display: true,
                        text: 'Time Period',
                        color: '#2c3e50',
                        font: {
                            size: window.innerWidth < 768 ? 11 : 14,
                            weight: 'bold'
                        }
                    }
                }
            },
            plugins: {
                ...getEnhancedChartOptions('line', 'trendsAnalytics').plugins,
                legend: {
                    display: false
                },
                tooltip: {
                    ...getEnhancedChartOptions('line', 'trendsAnalytics').plugins.tooltip,
                    callbacks: {
                        title: function(context) {
                            return `${context[0].label} - Listing Activity`;
                        },
                        label: function(context) {
                            return `Items Listed: ${context.parsed.y}`;
                        }
                    }
                }
            }
        }
    });
}

function renderTimeToSellStats(statsData) {
    const ctx = document.getElementById('timeToSellChart').getContext('2d');

    // Defensive: ensure statsData has the expected shape
    if (!statsData || !statsData.avgTimeToSell) {
        // Clear chart and show a placeholder in the list
        if (window.timeToSellChart instanceof Chart) {
            window.timeToSellChart.destroy();
        }
        const listElementEmpty = document.getElementById('timeToSellList');
        listElementEmpty.innerHTML = '<li class="no-data">No sold items data available.</li>';
        return;
    }

    const { avgTimeToSell, counts } = statsData;

    const labels = Object.keys(avgTimeToSell).map(type => type.charAt(0).toUpperCase() + type.slice(1));
    const data = Object.values(avgTimeToSell).map(val => parseFloat(val));

    // Update the list with enhanced detailed stats
    const listElement = document.getElementById('timeToSellList');
    listElement.innerHTML = '';
    Object.entries(avgTimeToSell).forEach(([type, avgDays]) => {
        const count = counts && counts[type] ? counts[type] : 0;
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="stat-item-row">
                <span class="stat-item-label">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                <span class="stat-item-value">${avgDays} days avg (${count} items)</span>
            </div>
        `;
        listElement.appendChild(li);
    });

    if (window.timeToSellChart instanceof Chart) {
        window.timeToSellChart.destroy();
    }

    // Create gradient backgrounds for performance visualization
    const gradients = data.map((value, index) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        const baseColor = colorPalettes.transactionAnalytics.primary[index % colorPalettes.transactionAnalytics.primary.length];
        // Create a simpler gradient without opacity calculations that can fail
        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(1, baseColor + '60'); // Fixed opacity
        return gradient;
    });

    window.timeToSellChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Days to Sell',
                data: data,
                backgroundColor: gradients,
                borderColor: colorPalettes.transactionAnalytics.primary.slice(0, data.length),
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            ...getEnhancedChartOptions('bar', 'transactionAnalytics'),
            scales: {
                ...getEnhancedChartOptions('bar', 'transactionAnalytics').scales,
                y: {
                    ...getEnhancedChartOptions('bar', 'transactionAnalytics').scales.y,
                    title: {
                        display: true,
                        text: 'Average Days to Sell',
                        color: '#2c3e50',
                        font: {
                            size: window.innerWidth < 768 ? 11 : 14,
                            weight: 'bold'
                        }
                    }
                },
                x: {
                    ...getEnhancedChartOptions('bar', 'transactionAnalytics').scales.x,
                    title: {
                        display: true,
                        text: 'Price Type',
                        color: '#2c3e50',
                        font: {
                            size: window.innerWidth < 768 ? 11 : 14,
                            weight: 'bold'
                        }
                    }
                }
            },
            plugins: {
                ...getEnhancedChartOptions('bar', 'transactionAnalytics').plugins,
                legend: {
                    display: false
                },
                tooltip: {
                    ...getEnhancedChartOptions('bar', 'transactionAnalytics').plugins.tooltip,
                    callbacks: {
                        title: function(context) {
                            return 'Sales Performance';
                        },
                        label: function(context) {
                            const count = counts[Object.keys(avgTimeToSell)[context.dataIndex]] || 0;
                            return `${context.label}: ${context.parsed.y.toFixed(1)} days average (${count} items sold)`;
                        }
                    }
                }
            }
        }
    });
}

async function loadStatistics() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const statCards = document.querySelectorAll('.stat-card');
    
    // Show loading state
    if (loadingIndicator) {
        loadingIndicator.classList.remove('hidden');
    }
    
    // Add loading class to cards
    statCards.forEach(card => card.classList.add('loading'));
    
    try {
        // Initialize Supabase configuration first
        if (!supabase) {
            await initializeSupabase();
        }
        
        // Load all statistics with some staggered timing for better UX
        const loadingTasks = [
            async () => {
                const userStats = await fetchUserStats();
                renderUserStats(userStats);
            },
            async () => {
                const { availableItemsByType, soldItemsByType } = await fetchItemStats();
                renderItemStats(availableItemsByType, soldItemsByType);
            },
            async () => {
                const { transactionsByStatus } = await fetchTransactionStats();
                renderTransactionStats(transactionsByStatus);
            },
            async () => {
                const itemsByStatus = await fetchItemStatusStats();
                renderItemStatusStats(itemsByStatus);
            },
            async () => {
                const reportStats = await fetchReportStats();
                renderReportStats(reportStats);
            },
            async () => {
                const priceRanges = await fetchPriceRangeStats();
                renderPriceRangeStats(priceRanges);
            },
            async () => {
                const conditionStats = await fetchConditionStats();
                renderConditionStats(conditionStats);
            },
            async () => {
                const priceTypeStats = await fetchPriceTypeStats();
                renderPriceTypeStats(priceTypeStats);
            },
            async () => {
                const listingTrend = await fetchListingTrendStats();
                renderListingTrendStats(listingTrend);
            },
            async () => {
                const timeToSellStats = await fetchTimeToSellStats();
                renderTimeToSellStats(timeToSellStats);
            }
        ];
        
        // Execute all tasks concurrently for better performance
        await Promise.all(loadingTasks.map(task => task()));
        
        // Hide loading indicator after a brief delay
        setTimeout(() => {
            if (loadingIndicator) {
                loadingIndicator.classList.add('hidden');
            }
            statCards.forEach(card => card.classList.remove('loading'));
        }, 500);
        
    } catch (error) {
        console.error('Error loading statistics:', error);
        
        // Hide loading indicator on error
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }
        statCards.forEach(card => card.classList.remove('loading'));
        
        // Show error message (you could enhance this further)
        alert('Error loading dashboard statistics. Please refresh the page.');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    loadStatistics();
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

document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-button');
    const currentPage = window.location.pathname.split('/').pop();

    navButtons.forEach(button => {
        if (button.getAttribute('data-page') === currentPage) {
            button.classList.add('active');
        }

        button.addEventListener('click', () => {
            // Remove active class from all buttons
            navButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to the clicked button
            button.classList.add('active');
            window.location.href = button.getAttribute('data-page');
        });
    });
});