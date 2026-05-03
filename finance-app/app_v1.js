// --- FinanceOS app_v1.js (Crash-Proof Edition) ---
console.log("[FinanceOS] Initializing app_v1.js...");

// Initialize Supabase (Using existing credentials)
const SUPABASE_URL = 'https://gqmqegrmydtqxfnzdpty.supabase.co';
const SUPABASE_KEY = 'YOUR_KEY_HERE'; // This is already in your file
const dbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State
let userSession = null;

// --- Helper: Safe UI Update ---
function updateElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// --- Auth Monitoring ---
dbClient.auth.onAuthStateChange((event, session) => {
    console.log("[Auth Event]:", event);
    userSession = session;
    
    if (session) {
        document.body.classList.add('authenticated');
        // Hide the overlay just in case
        const overlay = document.getElementById('auth-overlay');
        if (overlay) overlay.style.display = 'none';
        
        // Refresh data
        if (typeof refreshUI === 'function') {
            refreshUI();
        } else {
            console.warn("refreshUI not defined yet, skipping...");
        }
    } else {
        document.body.classList.remove('authenticated');
    }
});

// --- UI Refresh Logic ---
async function refreshUI() {
    console.log("[FinanceOS] Refreshing UI...");
    try {
        // Fetch data Safely
        const { data, error } = await dbClient.from('finance_storage').select('*').limit(1);
        if (error) throw error;
        
        // Update dashboard (with safety checks)
        updateElementText('dashboard-budget-left', '₩' + (data?.[0]?.amount || 0).toLocaleString());
    } catch (err) {
        console.error("[Data Error]:", err.message);
    }
}

// --- Logout ---
window.handleLogout = async () => {
    await dbClient.auth.signOut();
    window.location.reload();
};

// --- Emergency Reveal ---
// If we have an access token in the URL, force the app to show after 1 second
if (window.location.hash.includes('access_token')) {
    setTimeout(() => {
        document.body.classList.add('authenticated');
    }, 1000);
}
