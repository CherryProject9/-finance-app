// --- FinanceOS Master app_v1.js ---
console.log("[FinanceOS] Initializing full logic...");

// 1. Initialize Supabase
const SUPABASE_URL = 'https://gqmqegrmydtqxfnzdpty.supabase.co';
const SUPABASE_KEY = 'YOUR_KEY_HERE'; // KEEP YOUR ACTUAL KEY HERE
const dbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Global State
let userSession = null;
let appState = {
    transactions: [],
    categories: ['Food', 'Housing', 'Transport', 'Utilities', 'Entertainment', 'Shopping', 'Other']
};

// --- AUTH LOGIC ---
dbClient.auth.onAuthStateChange((event, session) => {
    console.log("[Auth Event]:", event);
    userSession = session;
    if (session) {
        document.body.classList.add('authenticated');
        refreshUI();
    } else {
        document.body.classList.remove('authenticated');
    }
});

// --- UI ACTIONS ---
window.triggerAppAction = (action, val) => {
    console.log("[App Action]:", action, val);
    if (action === 'nav_to') {
        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        document.getElementById(val).classList.add('active');
        document.getElementById('view-title').textContent = val.charAt(0).toUpperCase() + val.slice(1);
    }
    
    if (action === 'add_entry') {
        const amount = prompt("Enter amount (₩):");
        const category = prompt("Enter category (Food, Housing, etc.):", "Other");
        if (amount) saveTransaction(parseFloat(amount), category);
    }
};

// --- DATA LOGIC ---
async function saveTransaction(amount, category) {
    if (!userSession) return alert("Please log in first!");
    
    const newEntry = {
        user_id: userSession.user.id,
        amount: amount,
        category: category,
        date: new Date().toISOString(),
        description: 'Manual Entry'
    };

    const { error } = await dbClient.from('finance_storage').insert([newEntry]);
    if (error) {
        console.error("Save Error:", error.message);
        alert("Error saving: " + error.message);
    } else {
        refreshUI();
    }
}

async function refreshUI() {
    if (!userSession) return;
    
    const { data, error } = await dbClient
        .from('finance_storage')
        .select('*')
        .eq('user_id', userSession.user.id);
        
    if (error) return console.error("Fetch Error:", error.message);
    
    appState.transactions = data || [];
    renderDashboard();
}

function renderDashboard() {
    const total = appState.transactions.reduce((sum, t) => sum + t.amount, 0);
    const budgetLeft = document.getElementById('dashboard-budget-left');
    if (budgetLeft) budgetLeft.textContent = '₩' + total.toLocaleString();
    
    // Initialize Chart if element exists
    const ctx = document.getElementById('netWorthChart');
    if (ctx && !window.myChart) {
        window.myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: appState.transactions.map(t => new Date(t.date).toLocaleDateString()),
                datasets: [{
                    label: 'Spent',
                    data: appState.transactions.map(t => t.amount),
                    borderColor: '#6366f1',
                    tension: 0.4
                }]
            }
        });
    }
}

window.handleLogout = async () => {
    await dbClient.auth.signOut();
    window.location.reload();
};
