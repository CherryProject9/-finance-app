function bootstrap() {
    if (window.financeOS_booted) return;
    window.financeOS_booted = true;
    console.log('[FinanceOS] Bootstrap v=120...');
    console.log('[FinanceOS] Origin:', window.location.origin);
    console.log('[FinanceOS] API URL:', typeof API_URL !== 'undefined' ? API_URL : 'pending');
    
    // Removed diagnostic that could cause issues on some mobile browsers


    // --- Supabase Configuration ---
    const SUPABASE_URL = 'https://gqmqegrmydtqxfnzdpty.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_UHVHuIwKWVGuMGgqD-ti6A_mFMAxXr9';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const STORAGE_ID = '00000000-0000-0000-0000-000000000000';

    window.updateSyncDebug = function(msg) {
        console.log('[Sync] ' + msg);
    };

    try {
        // 1. Instant Data Load: Hydrate state before initializing UI components
        const localDataRaw = localStorage.getItem('financeOS_master_data');
        if (localDataRaw) {
            const data = JSON.parse(localDataRaw);
            if (data.monthlyBudgetsState) monthlyBudgetsState = data.monthlyBudgetsState;
            else if (data.budgetState) monthlyBudgetsState[currentMonthView] = data.budgetState;
            
            if (data.transactionsState) transactionsState = data.transactionsState;
            if (data.customCategoryRules) customCategoryRules = data.customCategoryRules;
            if (data.investmentsState) investmentsState = data.investmentsState;
            console.log('[FinanceOS] Local state hydrated.');
        }

        // 2. Initialize UI Components & Event Handlers
        const initFns = [
            initThemeToggle, initNavigation, initBudgetState, 
            initRetirementCalculator, initOCRScanner, 
            initSettingsRules, initInvestments, initTransactionModal,
            initCategoryManagement
        ];
        
        initFns.forEach(fn => {
            try {
                if (typeof fn === 'function') fn();
            } catch (e) {
                console.warn(`[FinanceOS] Non-fatal error initializing ${fn.name}:`, e);
                if (window.updateSyncDebug) window.updateSyncDebug(`Warn: ${fn.name} failed`);
            }
        });

        // 3. Immediate UI Render
        refreshAllUI();
        console.log('[FinanceOS] Initial render complete.');
        
        // v95: Hide the loading fallback immediately
        const fallback = document.getElementById('loading-fallback');
        if (fallback) fallback.style.display = 'none';

        // 4. Non-blocking Cloud Sync
        loadData().then(success => {
            if (success) {
                migrateLegacyData().then(() => {
                    refreshAllUI();
                    console.log(`[FinanceOS] Background sync complete.`);
                    if (window.updateSyncDebug) window.updateSyncDebug('Sync complete!');
                });
            } else {
                if (window.updateSyncDebug) window.updateSyncDebug('Sync returned false');
            }
        }).catch(e => {
            console.warn("[FinanceOS] Background sync error:", e);
            if (window.updateSyncDebug) window.updateSyncDebug('Fatal sync error: ' + (e.message || e));
            if (window.showSyncErrorBanner) window.showSyncErrorBanner("Cloud Sync Unavailable (Offline)");
        });

        // 5. Developer & Simulator Tools
        const mobileToggle = document.getElementById('dev-mobile-toggle');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', () => {
                const container = document.querySelector('.app-container');
                if (container) {
                    container.classList.toggle('mobile-simulator');
                    setTimeout(() => {
                        if (typeof initCharts === 'function') initCharts();
                        if (typeof updateRetirementProjection === 'function') updateRetirementProjection();
                    }, 400); 
                }
            });
        }

        // 6. Polling disabled in v120 to stop 'Death Loop'

    } catch (e) {
        console.error("[FinanceOS] Critical bootstrap error:", e);
        const fallback = document.getElementById('loading-fallback');
        if (fallback) fallback.style.display = 'none';
        if (window.updateSyncDebug) window.updateSyncDebug('Fatal bootstrap error: ' + e.message);
        if (window.showSyncErrorBanner) window.showSyncErrorBanner("Startup Error: Check Console");
    }
}

// Global entry point
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}

// --- Safe UI Architecture (v122) ---
const appActions = {
    'ocr_upload': () => {
        if (window.handleHeaderOCR) window.handleHeaderOCR();
        else showToast('Scanner system not ready.');
    },
    'toggle_theme': () => {
        if (window.toggleTheme) window.toggleTheme();
        else showToast('Theme toggle not ready.');
    },
    'show_alerts': () => {
        showToast('No new notifications.');
    },
    'add_entry': () => {
        if (window.showAddTransactionModal) window.showAddTransactionModal();
        else showToast('Transaction modal not found.');
    },
    'add_asset': () => {
        if (window.showAddInvestmentModal) window.showAddInvestmentModal();
        else showToast('Add Asset feature not found.');
    },
    'menu_more': () => {
        if (window.showCategoryManagementModal) window.showCategoryManagementModal();
        else showToast('Menu options coming soon.');
    },
    'nav_to': (viewId) => {
        if (window.switchView) window.switchView(viewId);
        else showToast(`Navigation to ${viewId} failed.`);
    },
    'change_month': (delta) => {
        if (window.changeMonth) window.changeMonth(delta);
        else showToast('Month navigation failed.');
    },
    'set_sort': (field) => {
        if (window.setSort) window.setSort(field);
        else showToast('Sorting not available.');
    },
    'set_tx_type': (type) => {
        if (window.setModalTxType) window.setModalTxType(type);
    },
    'add_rule': () => {
        if (window.addRule) window.addRule();
        else showToast('Automation rules not available.');
    }
};

// --- Core UI Actions Implementation ---
window.toggleTheme = function() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('financeOS_theme', newTheme);
    
    // Update icons if they exist in the header
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    if (sunIcon && moonIcon) {
        if (newTheme === 'dark') {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        } else {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        }
    }
    
    showToast(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode enabled.`);
};

window.handleHeaderOCR = function() {
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.click();
    } else {
        showToast('Scanner system error.');
    }
};

window.triggerAppAction = function(actionKey, ...args) {
    console.log(`[FinanceOS] Triggering action: ${actionKey}`, args);
    try {
        const action = appActions[actionKey];
        if (typeof action === 'function') {
            action(...args);
        } else {
            console.warn(`[FinanceOS] Action "${actionKey}" not implemented.`);
            showToast('Feature not available yet.');
        }
    } catch (err) {
        console.error(`[FinanceOS] Action "${actionKey}" failed:`, err);
        showToast('Something went wrong.');
    }
};

window.showToast = function(message, duration = 3000) {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('visible'), 10);
    
    // Remove after duration
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
    }, duration);
};

window.hideAppLoading = function() {
    const overlay = document.getElementById('app-loading-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        setTimeout(() => {
            overlay.style.display = 'none';
            document.body.style.overflow = ''; // Restore scroll
        }, 500);
    }
};

function syncMonthLabels() {
    const [year, month] = currentMonthView.split('-').map(Number);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    const labelOld = document.getElementById('current-month-label');
    const labelNew = document.getElementById('current-month-display');
    
    if (labelOld) labelOld.textContent = `${year}년 ${month}월`;
    if (labelNew) labelNew.textContent = `${monthNames[month-1]} ${year}`;
}

let isUIRefreshing = false;
function refreshAllUI() {
    if (isUIRefreshing) return;
    isUIRefreshing = true;
    
    console.log(`[FinanceOS] refreshAllUI triggered. Current View Month: ${currentMonthView}`);
    
    // [FIX] Removed auto-jump logic that caused month to "snap back" to data months, preventing free navigation.
    syncMonthLabels();

    const activeSection = document.querySelector('.view-section.active');
    const currentView = activeSection ? activeSection.id : 'dashboard';
    
    renderBudgetUI();
    renderPortfolioSummary();
    
    if (currentView === 'dashboard') {
        renderDashboardTransactions();
        if (typeof Chart !== 'undefined') initCharts();
    } else if (currentView === 'budget') {
        renderConfirmedTransactions();
        if (typeof Chart !== 'undefined') renderBudgetChart();
    } else if (currentView === 'investments') {
        renderInvestments();
    } else if (currentView === 'retirement') {
        updateRetirementProjection();
    }

    if (window.updateSyncDebug) {
        window.updateSyncDebug(`UI Sync: ${transactionsState.length} tx total.`);
    }
    
    isUIRefreshing = false;
}
window.refreshAllUI = refreshAllUI;


// --- Global UI State ---
let activeTxId = null;
let modalTxType = 'expense';

// Replace toggleTxActions with row activation
window.toggleTxActions = function(id, event) {
    if (event) {
        const isButton = event.target.closest('button, .action-btn');
        if (isButton) return;
        event.stopPropagation();
    }
    
    // Use event.currentTarget if available for reliable multi-instance support
    const row = (event && event.currentTarget) ? event.currentTarget : document.querySelector(`[data-tx-id="${id}"]`);
    if (!row) return;

    const isActive = row.classList.contains('active-row');
    
    // Close all rows/items globally
    document.querySelectorAll('.active-row').forEach(el => el.classList.remove('active-row'));
    
    // Toggle clicked element if it wasn't already active
    if (!isActive) {
        row.classList.add('active-row');
    }
};

// Global click listener to collapse rows/items
document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-tx-id]')) {
        document.querySelectorAll('.active-row').forEach(el => el.classList.remove('active-row'));
    }
});

window.setModalTxType = function(type) {
    modalTxType = type;
    const expenseTab = document.querySelector('#modal-tx-type-toggle .toggle-item.expense');
    const incomeTab = document.querySelector('#modal-tx-type-toggle .toggle-item.income');
    
    if (type === 'expense') {
        if (expenseTab) expenseTab.classList.add('active');
        if (incomeTab) incomeTab.classList.remove('active');
    } else {
        if (expenseTab) expenseTab.classList.remove('active');
        if (incomeTab) incomeTab.classList.add('active');
    }
};

function initCategoryManagement() {
    const modal = document.getElementById('modal-category-mgmt');
    if (!modal) return;

    window.showCategoryManagementModal = () => {
        window.renderCategoryMgmtList();
        modal.style.display = 'flex';
    };

    window.closeCategoryManagementModal = () => {
        modal.style.display = 'none';
        window.hideCategoryEditForm();
    };

    window.renderCategoryMgmtList = () => {
        const list = document.getElementById('cat-mgmt-list');
        if (!list) return;

        const activeBudget = getActiveBudget();
        list.innerHTML = '';

        activeBudget.categories.forEach((cat, index) => {
            const html = `
                <div class="cat-mgmt-item">
                    <div class="cat-mgmt-color" style="background: ${cat.colorHex};"></div>
                    <div class="cat-mgmt-info">
                        <span class="cat-mgmt-name">${cat.name}</span>
                        <span class="cat-mgmt-limit">₩${(cat.limit || 0).toLocaleString()}</span>
                    </div>
                    <div class="cat-mgmt-actions">
                        <button class="btn-cat-action" onclick="window.moveCategory(${index}, -1)" title="Move Up">↑</button>
                        <button class="btn-cat-action" onclick="window.moveCategory(${index}, 1)" title="Move Down">↓</button>
                        <button class="btn-cat-action" onclick="window.showCategoryEditForm(${index})" title="Edit">✎</button>
                        <button class="btn-cat-action" onclick="window.deleteCategory(${index})" title="Delete">🗑</button>
                    </div>
                </div>
            `;
            list.insertAdjacentHTML('beforeend', html);
        });
    };

    window.showCategoryEditForm = (index) => {
        const form = document.getElementById('cat-edit-form');
        const addBtnWrap = document.getElementById('cat-mgmt-add-btn-wrap');
        const list = document.getElementById('cat-mgmt-list');
        
        const activeBudget = getActiveBudget();
        const cat = activeBudget.categories[index];
        if (!cat) return;

        document.getElementById('cat-form-title').innerText = '카테고리 수정';
        document.getElementById('cat-edit-index').value = index;
        document.getElementById('cat-edit-name').value = cat.name;
        document.getElementById('cat-edit-limit').value = (cat.limit || 0).toLocaleString();
        
        window.renderColorGrid(cat.colorHex);

        if (form) form.style.display = 'block';
        if (addBtnWrap) addBtnWrap.style.display = 'none';
        if (list) list.style.display = 'none';
    };

    window.showCategoryAddForm = () => {
        const form = document.getElementById('cat-edit-form');
        const addBtnWrap = document.getElementById('cat-mgmt-add-btn-wrap');
        const list = document.getElementById('cat-mgmt-list');

        const titleEl = document.getElementById('cat-form-title');
        if (titleEl) titleEl.innerText = '새 카테고리 추가';
        
        const indexEl = document.getElementById('cat-edit-index');
        if (indexEl) indexEl.value = 'new';
        
        const nameEl = document.getElementById('cat-edit-name');
        if (nameEl) nameEl.value = '';
        
        const limitEl = document.getElementById('cat-edit-limit');
        if (limitEl) limitEl.value = '0';
        
        window.renderColorGrid('#6366F1');

        if (form) form.style.display = 'block';
        if (addBtnWrap) addBtnWrap.style.display = 'none';
        if (list) list.style.display = 'none';
    };

    window.hideCategoryEditForm = () => {
        const form = document.getElementById('cat-edit-form');
        const addBtnWrap = document.getElementById('cat-mgmt-add-btn-wrap');
        const list = document.getElementById('cat-mgmt-list');

        if (form) form.style.display = 'none';
        if (addBtnWrap) addBtnWrap.style.display = 'block';
        if (list) list.style.display = 'flex';
    };

    window.renderColorGrid = (selectedColor) => {
        const grid = document.getElementById('cat-color-grid');
        if (!grid) return;
        grid.innerHTML = '';
        categoryPalette.forEach(color => {
            const active = color.toLowerCase() === selectedColor.toLowerCase() ? 'active' : '';
            const html = `<div class="color-swatch ${active}" style="background: ${color};" onclick="window.selectCategoryColor('${color}', this)"></div>`;
            grid.insertAdjacentHTML('beforeend', html);
        });
        grid.dataset.selectedColor = selectedColor;
    };

    window.selectCategoryColor = (color, el) => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
        document.getElementById('cat-color-grid').dataset.selectedColor = color;
    };

    window.saveCategoryEdit = () => {
        const index = document.getElementById('cat-edit-index').value;
        const name = document.getElementById('cat-edit-name').value.trim();
        const limit = parseInt(document.getElementById('cat-edit-limit').value.replace(/,/g, '')) || 0;
        const color = document.getElementById('cat-color-grid').dataset.selectedColor;

        if (!name) { showToast('Please enter a category name.'); return; }

        const activeBudget = getActiveBudget();

        if (index === 'new') {
            activeBudget.categories.push({ name, limit, colorHex: color });
            showToast('Category added.');
        } else {
            const idx = parseInt(index);
            const oldName = activeBudget.categories[idx].name;
            activeBudget.categories[idx] = { name, limit, colorHex: color };
            
            // If name changed, update transactions
            if (oldName !== name) {
                transactionsState.forEach(tx => {
                    if (tx.category === oldName) tx.category = name;
                });
            }
            showToast('Category updated.');
        }

        saveData();
        refreshAllUI();
        window.hideCategoryEditForm();
        window.renderCategoryMgmtList();
    };

    window.deleteCategory = (index) => {
        const activeBudget = getActiveBudget();
        const catName = activeBudget.categories[index].name;
        
        if (!confirm(`Delete category "${catName}"? Existing transactions will be moved to "기타".`)) return;

        // Reassign transactions
        transactionsState.forEach(tx => {
            if (tx.category === catName) tx.category = '기타';
        });

        activeBudget.categories.splice(index, 1);
        
        saveData();
        refreshAllUI();
        window.renderCategoryMgmtList();
        showToast('Category deleted.');
    };

    window.moveCategory = (index, direction) => {
        const activeBudget = getActiveBudget();
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= activeBudget.categories.length) return;

        const temp = activeBudget.categories[index];
        activeBudget.categories[index] = activeBudget.categories[newIndex];
        activeBudget.categories[newIndex] = temp;

        saveData();
        refreshAllUI();
        window.renderCategoryMgmtList();
    };
}

function initTransactionModal() {
    const modal = document.getElementById('modal-tx-detail');
    const btnClose = document.getElementById('btn-close-tx-modal');
    const btnCancelEdit = document.getElementById('btn-cancel-edit-tx-modal');
    const btnSave = document.getElementById('btn-save-tx-modal');
    const btnDelete = document.getElementById('btn-delete-tx-modal-new'); 

    if (!modal) return;

    const closeModal = () => {
        modal.style.display = 'none';
        delete modal.dataset.txId;
    };

    if (btnClose) btnClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeModal);

    if (btnSave) btnSave.addEventListener('click', () => {
        const id = modal.dataset.txId ? parseInt(modal.dataset.txId) : null;
        saveTransactionFromModal(id);
        closeModal();
    });

    if (btnDelete) btnDelete.addEventListener('click', () => {
        const id = parseInt(modal.dataset.txId);
        if (confirm('이 거래 내역을 삭제하시겠습니까? (Delete this transaction?)')) {
            window.deleteConfirmedTx(id);
            closeModal();
        }
    });
}

window.showTransactionDetail = function(id) {
    const tx = transactionsState.find(t => t.id === id);
    if (!tx) return;

    const modal = document.getElementById('modal-tx-detail');
    if (!modal) return;

    modal.dataset.txId = id;
    
    // Set type (default to expense unless it's an income category)
    const isIncome = tx.category === '수입' || tx.category === 'Income' || tx.category === 'Salary';
    window.setModalTxType(isIncome ? 'income' : 'expense');

    modal.style.display = 'flex';
};

function setupEditMode(id) {
    const tx = transactionsState.find(t => t.id === id);
    if (!tx) return;

    const dateEl     = document.getElementById('tx-date');
    const merchantEl = document.getElementById('tx-merchant');
    const amountEl   = document.getElementById('tx-amount');
    const catEl      = document.getElementById('tx-category');

    if (dateEl)     dateEl.value     = formatToISO(tx.date);
    if (merchantEl) merchantEl.value = tx.merchant || '';
    if (amountEl)   amountEl.value   = (tx.amount || 0).toLocaleString();

    // Set button text for edit mode
    const btnSave = document.getElementById('btn-save-tx-modal');
    if (btnSave) btnSave.innerText = '수정 저장';

    // Show Delete button in edit mode
    const btnDelete = document.getElementById('btn-delete-tx-modal-new');
    if (btnDelete) btnDelete.style.display = 'inline-flex';

    // Populate category dropdown
    if (catEl) {
        const activeBudget = getActiveBudget();
        catEl.innerHTML = '';
        activeBudget.categories.forEach(cat => {
            const selected = cat.name === tx.category ? 'selected' : '';
            catEl.insertAdjacentHTML('beforeend', `<option value="${cat.name}" ${selected}>${cat.name}</option>`);
        });
    }
}

window.showAddTransactionModal = function() {
    const modal = document.getElementById('modal-tx-detail');
    if (!modal) return;

    delete modal.dataset.txId; // Clear ID — this is Add mode

    // Reset all fields safely
    const dateEl     = document.getElementById('tx-date');
    const merchantEl = document.getElementById('tx-merchant');
    const amountEl   = document.getElementById('tx-amount');
    const catEl      = document.getElementById('tx-category');

    if (dateEl)     dateEl.value     = new Date().toISOString().split('T')[0];
    if (merchantEl) merchantEl.value = '';
    if (amountEl)   amountEl.value   = '';

    // Set button text for add mode
    const btnSave = document.getElementById('btn-save-tx-modal');
    if (btnSave) btnSave.innerText = '저장';

    // Hide Delete button in add mode
    const btnDelete = document.getElementById('btn-delete-tx-modal-new');
    if (btnDelete) btnDelete.style.display = 'none';

    window.setModalTxType('expense');

    // Populate category dropdown
    if (catEl) {
        const activeBudget = getActiveBudget();
        catEl.innerHTML = '';
        activeBudget.categories.forEach(cat => {
            catEl.insertAdjacentHTML('beforeend', `<option value="${cat.name}">${cat.name}</option>`);
        });
    }

    modal.style.display = 'flex';
};

function saveTransactionFromModal(id) {
    const dateEl     = document.getElementById('tx-date');
    const merchantEl = document.getElementById('tx-merchant');
    const amountEl   = document.getElementById('tx-amount');
    const catEl      = document.getElementById('tx-category');

    if (!dateEl || !merchantEl || !amountEl || !catEl) {
        console.error('[FinanceOS] Modal fields missing — cannot save.');
        return;
    }

    const newDate     = dateEl.value || new Date().toISOString().split('T')[0];
    const newMerchant = merchantEl.value.trim() || 'No Merchant';
    const newAmount   = parseInt(amountEl.value.replace(/,/g, '')) || 0;
    const newCategory = catEl.value;

    if (id) {
        // --- Edit Mode ---
        const tx = transactionsState.find(t => t.id === id);
        if (!tx) return;

        const oldAmount = tx.amount;
        const oldCategory = tx.category;

        // Update Budget
        const activeBudget = getActiveBudget();
        let oldCatObj = activeBudget.categories.find(c => c.name === oldCategory);
        if (oldCatObj) oldCatObj.spent = Math.max(0, oldCatObj.spent - oldAmount);
        
        let newCatObj = activeBudget.categories.find(c => c.name === newCategory);
        if (newCatObj) newCatObj.spent += newAmount;

        // Update Transaction
        tx.date = newDate;
        tx.merchant = newMerchant;
        tx.amount = newAmount;
        tx.category = newCategory;
    } else {
        // --- Add Mode ---
        const newTx = {
            id: Date.now(),
            date: newDate,
            merchant: newMerchant,
            amount: newAmount,
            category: newCategory,
            type: modalTxType // Capture income/expense type
        };
        
        transactionsState.unshift(newTx);
        
        // Update Budget ONLY if it's an expense
        if (modalTxType === 'expense') {
            const activeBudget = getActiveBudget();
            let catObj = activeBudget.categories.find(c => c.name === newCategory);
            if (catObj) catObj.spent += newAmount;
        }
    }

    saveData();
    renderBudgetUI();
    renderConfirmedTransactions();
    const dashTx = document.getElementById('dashboard-recent-tx-list');
    if(dashTx) renderDashboardTransactions();
    
    // Refresh category detail if active
    const catDetailView = document.getElementById('category-detail'); if (activeDetailCategory && catDetailView && catDetailView.style.display !== 'none') {
        window.showCategoryDetail(activeDetailCategory);
    }
}

// --- Settings & Utils ---
const API_BASE = (window.location.protocol === 'file:') ? 'http://localhost:8080' : window.location.origin;
const API_URL = '/api/data';

async function saveData() {
    const data = {
        monthlyBudgetsState: monthlyBudgetsState,
        transactionsState: transactionsState,
        customCategoryRules: customCategoryRules,
        investmentsState: investmentsState,
        lastUpdated: Date.now()
    };

    // 1. Save to LocalStorage immediately (instant feedback)
    localStorage.setItem('financeOS_master_data', JSON.stringify(data));

    // 2. Sync to Supabase
    try {
        const { error } = await supabase
            .from('finance_storage')
            .upsert({ id: STORAGE_ID, state: data });
            
        if (error) throw error;
        return true;
    } catch (e) {
        console.warn("[Supabase] Save failed:", e);
        if (window.updateSyncDebug) window.updateSyncDebug('Cloud save failed');
        return false;
    }
}

async function loadData() {
    let cloudData = null;
    
    // 1. Try to fetch from Supabase
    try {
        if (window.updateSyncDebug) window.updateSyncDebug('Fetching from Supabase...');
        
        const { data, error } = await supabase
            .from('finance_storage')
            .select('state')
            .eq('id', STORAGE_ID)
            .single();
            
        if (error) {
            if (error.code === 'PGRST116') {
                console.log("[Supabase] No existing data found. Initializing...");
                return true; 
            }
            throw error;
        }
        
        cloudData = data.state;
        if (window.updateSyncDebug) window.updateSyncDebug('Cloud data loaded!');
    } catch (e) {
        console.warn('[Supabase] Load failed. Fallback to local.', e);
        if (window.updateSyncDebug) window.updateSyncDebug('Cloud load error');
    }

    // 2. Load from localStorage as fallback
    let localData = null;
    try {
        const localDataRaw = localStorage.getItem('financeOS_master_data');
        localData = localDataRaw ? JSON.parse(localDataRaw) : null;
    } catch (e) {
        console.error('[FinanceOS] Failed to parse local data', e);
    }

    // 3. Merge Logic
    let finalData = cloudData || localData;
    
    if (cloudData && localData) {
        const cloudTs = cloudData.lastUpdated || 0;
        const localTs = localData.lastUpdated || 0;
        
        if (localTs > cloudTs) {
            console.log("[FinanceOS] LocalStorage is newer. Using local.");
            finalData = localData;
        } else {
            console.log("[FinanceOS] Cloud data is newer or equal.");
            finalData = cloudData;
        }
    }

    if (finalData) {
        if (finalData.monthlyBudgetsState) monthlyBudgetsState = finalData.monthlyBudgetsState;
        if (finalData.transactionsState) transactionsState = finalData.transactionsState;
        if (finalData.customCategoryRules) customCategoryRules = finalData.customCategoryRules;
        if (finalData.investmentsState) investmentsState = finalData.investmentsState;
        return true;
    }
    
    return false;
}

async function migrateLegacyData() {
    try {
        const savedTx = localStorage.getItem('financeOS_transactionsState');
        const savedBudget = localStorage.getItem('financeOS_budgetState');
        let modificationsMade = false;

        if (savedTx) {
            const oldTx = JSON.parse(savedTx);
            if (Array.isArray(oldTx) && oldTx.length > 0) {
                const currentIds = new Set(transactionsState.map(t => typeof t.id === 'string' ? t.id : String(t.id)));
                const recoveredTx = oldTx.filter(t => !currentIds.has(typeof t.id === 'string' ? t.id : String(t.id)));
                
                if (recoveredTx.length > 0) {
                    transactionsState = transactionsState.concat(recoveredTx);
                    modificationsMade = true;
                }
            }
        }

        if (savedBudget) {
            const oldBudget = JSON.parse(savedBudget);
            if (oldBudget) {
                const activeBudget = getActiveBudget();
                if (oldBudget.categories) {
                    oldBudget.categories.forEach(oldCat => {
                        const newCat = activeBudget.categories.find(c => c.name === oldCat.name);
                        if (newCat && oldCat.spent > newCat.spent) {
                            newCat.spent = oldCat.spent;
                            modificationsMade = true;
                        }
                    });
                }
            }
        }

        if (modificationsMade) {
            const success = await saveData();
            if (success) {
                console.log("Legacy data successfully recovered and uploaded to Server.");
                localStorage.removeItem('financeOS_transactionsState');
                localStorage.removeItem('financeOS_budgetState');
            } else {
                console.warn("Legacy data recovered locally but server save failed. Keeping localStorage as backup.");
            }
        }
    } catch (e) {
        console.error("Data recovery failed", e);
    }
}

const formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const formatKRW = (value) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);

const formatToMMDD = (str) => {
    if (!str || typeof str !== 'string' || str === '오늘' || str === '분석필요') return str;
    // Standardize to MM/DD for compact display
    let m = str.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (m) return `${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}`;
    m = str.match(/(\d{1,2})[-./](\d{1,2})/);
    if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}`;
    return str;
};

const formatToISO = (str) => {
    if (!str || typeof str !== 'string') return new Date().toISOString().split('T')[0];
    // Convert various formats to YYYY-MM-DD for date input
    let m = str.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = str.match(/(\d{1,2})[-./](\d{1,2})/);
    if (m) return `${new Date().getFullYear()}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    return new Date().toISOString().split('T')[0];
};

/**
 * Robustly normalizes any date string into YYYY-MM-DD format.
 * Uses contextYYYYMM to fill in the year if only MM/DD is provided.
 */
function normalizeDateValue(dateStr, contextYYYYMM) {
    if (!dateStr) return '';
    let str = dateStr.toString().trim();
    const contextParts = contextYYYYMM ? contextYYYYMM.split('-') : [new Date().getFullYear().toString(), '01'];
    const year = contextParts[0];
    
    // Match 1: YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
    let m = str.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    
    // Match 2: MM-DD, MM.DD, MM/DD
    m = str.match(/^(\d{1,2})[-./](\d{1,2})/);
    if (m) return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    
    // Fallback: try native Date parsing
    try {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
        }
    } catch(e) {}
    
    return str;
}

function getCategoryStyle(categoryName, isTag = false) {
    const activeBudget = getActiveBudget();
    const cat = activeBudget.categories.find(c => c.name === categoryName);
    const color = cat ? cat.colorHex : '#475569';
    if (isTag) {
        // More intense background for merchant tags to match category pills
        return `background-color: ${color}99;`; // 99 = 0.60 opacity
    }
    return `background-color: ${color}; color: #fff;`;
}

function renderHybridDatePicker(value, idx, field, id = '') {
    const isoDate = formatToISO(value);
    const displayDate = isoDate; // Internal is always ISO YYYY-MM-DD
    const shortDisplay = formatToMMDD(value); // MM/DD for mobile display space
    const idAttr = id ? `id="${id}"` : '';
    const dataAttrs = idx !== null ? `data-idx="${idx}" data-field="${field}"` : '';

    return `
        <div class="date-input-wrapper">
            <input type="text" class="editable-input hybrid-text-input" value="${displayDate}" ${idAttr} ${dataAttrs} placeholder="YYYY-MM-DD" inputmode="numeric" oninput="window.syncHybridDate(this, 'text')"/>
            <input type="date" class="hidden-date-picker" value="${isoDate}" onchange="window.syncHybridDate(this, 'date')"/>
            <button class="date-picker-icon-btn" tabindex="-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </button>
        </div>
    `;
}

window.syncHybridDate = function(el, type) {
    const wrapper = el.closest('.date-input-wrapper');
    const textInput = wrapper.querySelector('.hybrid-text-input');
    const dateInput = wrapper.querySelector('.hidden-date-picker');
    
    if (type === 'date') {
        textInput.value = dateInput.value;
        // Trigger the input event on the text input so it saves to state
        textInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        // If typing, try to sync back to date picker if valid
        if (el.value.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dateInput.value = el.value;
        }
    }
};

const chartColors = {
    primary: '#6366f1',
    secondary: '#a855f7',
    positive: '#10b981',
    negative: '#ef4444',
    warning: '#f59e0b',
    gridLines: 'rgba(255, 255, 255, 0.05)',
    text: '#94a3b8'
};

if (typeof Chart !== 'undefined') {
    Chart.defaults.color = chartColors.text;
    Chart.defaults.font.family = "'Inter', sans-serif";
}

let retirementChartInstance = null;
let budgetChartInstance = null;
let transactionsState = [];
let editingTxId = null;
let isEditingLimits = false;
let txSortCol = 'date';
let txSortOrder = 'desc';

// Category Detail Sorting State
let detailSortCol = 'date';
let detailSortOrder = 'desc';
let activeDetailCategory = null;

// --- Global Investments State ---
let investmentsState = [];
let usdToKrwRate = 1350; // Fallback rate

// --- Custom Categorization Rules ---
let customCategoryRules = [
    { id: 1, pattern: '우와한형제들', category: '식비' },
    { id: 2, pattern: '우아한형제들', category: '식비' }
];

// --- Monthly Budget Navigation State ---
let currentMonthView = new Date().toISOString().substring(0, 7); // "YYYY-MM"
let monthlyBudgetsState = {}; // { "YYYY-MM": { totalLimit, categories: [...] } }
const categoryPalette = [
    '#1E3A8A', // Navy
    '#2563EB', // Blue
    '#06B6D4', // Cyan
    '#14B8A6', // Teal
    '#10B981', // Green
    '#84CC16', // Lime
    '#EAB308', // Yellow
    '#F97316', // Orange
    '#EF4444', // Red
    '#F43F5E', // Rose
    '#EC4899', // Pink
    '#8B5CF6', // Purple
    '#64748B', // Slate
    '#A16207'  // Brown
];

const defaultBudgetStructure = {
    totalLimit: 4000000,
    categories: [
        { name: '주거비', limit: 1500000, colorHex: '#6366F1' },
        { name: '식비', limit: 500000, colorHex: '#0EA5E9' },
        { name: '외식', limit: 300000, colorHex: '#EF4444' },
        { name: '교통비', limit: 300000, colorHex: '#64748B' },
        { name: '여가비', limit: 200000, colorHex: '#F59E0B' },
        { name: '공과금', limit: 200000, colorHex: '#10B981' },
        { name: '의료비', limit: 100000, colorHex: '#F97316' },
        { name: '기타', limit: 400000, colorHex: '#475569' },
        { name: '쇼핑', limit: 200000, colorHex: '#ec4899' }
    ]
};

function getActiveBudget() {
    if (!monthlyBudgetsState[currentMonthView]) {
        initBudgetForMonth(currentMonthView);
    }
    return monthlyBudgetsState[currentMonthView];
}

function initBudgetForMonth(month) {
    if (monthlyBudgetsState[month]) return;

    // Try to find the most recent previous budget to clone structure from
    const months = Object.keys(monthlyBudgetsState).sort().reverse();
    const prevMonth = months.find(m => m < month);
    
    if (prevMonth) {
        // Clone structure but reset spent counts (spent is calculated dynamically anyway)
        const prevBudget = monthlyBudgetsState[prevMonth];
        monthlyBudgetsState[month] = {
            totalLimit: prevBudget.totalLimit,
            categories: prevBudget.categories.map(c => Object.assign({}, c))
        };
    } else {
        // Use defaults
        monthlyBudgetsState[month] = {
            totalLimit: defaultBudgetStructure.totalLimit,
            categories: defaultBudgetStructure.categories.map(c => Object.assign({}, c))
        };
    }
}

window.changeMonth = function(delta) {
    let [year, month] = currentMonthView.split('-').map(Number);
    
    month += delta;
    if (month > 12) {
        month = 1;
        year += 1;
    } else if (month < 1) {
        month = 12;
        year -= 1;
    }
    
    const monthStr = month.toString().padStart(2, '0');
    currentMonthView = `${year}-${monthStr}`;
    
    // Global UI Sync for the new month
    window.refreshAllUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Standardized Color Logic Helper
function getCategoryColor(categoryName) {
    const activeBudget = getActiveBudget();
    const cat = activeBudget.categories.find(c => c.name === categoryName);
    return cat ? cat.colorHex : '#94a3b8'; // Default Slate
}

let currentEditingCatIdx = null;
let selectedColorHex = categoryPalette[0];

function initBudgetState() {
    renderBudgetUI();
    const btnEdit = document.getElementById('btn-edit-budget');
    if (btnEdit) {
        btnEdit.addEventListener('click', () => {
            if (isEditingLimits) {
                // Parse and save new limits
                const activeBudget = getActiveBudget();
                const inputTotal = document.getElementById('input-total-limit');
                if (inputTotal) activeBudget.totalLimit = parseInt(inputTotal.value.replace(/,/g, '')) || 0;
                
                document.querySelectorAll('.cat-limit-input').forEach(input => {
                    const idx = input.getAttribute('data-idx');
                    activeBudget.categories[idx].limit = parseInt(input.value.replace(/,/g, '')) || 0;
                });
                saveData();
            }
            
            isEditingLimits = !isEditingLimits;
            
            // Toggle aesthetics
            if (isEditingLimits) {
                btnEdit.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                btnEdit.classList.add('btn-primary');
                btnEdit.classList.remove('btn-icon');
                btnEdit.style.color = '#fff';
            } else {
                btnEdit.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
                btnEdit.classList.remove('btn-primary');
                btnEdit.classList.add('btn-icon');
                btnEdit.style.color = '';
            }
            renderBudgetUI();
            renderBudgetChart();
        });
    }
}

// --- Helper: Get Transactions for Month ---
function getTransactionsForMonth(monthYYYYMM) {
    const filtered = transactionsState.filter(tx => {
        if (!tx.date) return false;
        const normDate = normalizeDateValue(tx.date, monthYYYYMM);
        return normDate.startsWith(monthYYYYMM);
    });

    console.log(`[FinanceOS] Filtered ${filtered.length} tx for ${monthYYYYMM}`);
    return filtered;
}

function renderBudgetUI() {
    const monthTx = getTransactionsForMonth(currentMonthView);

    // --- Calculation Helpers ---
    // Transactions from your API have no 'type' field — treat all as expenses
    const isExpenseFn = (tx) => {
        const type = String(tx.type || tx.kind || '').toLowerCase();
        if (type.includes('income') || type.includes('수입') || type.includes('in')) return false;
        
        const rawAmt = tx.amount ?? tx.value ?? tx.price ?? tx.amt ?? 0;
        const amount = typeof rawAmt === 'string' ? parseFloat(rawAmt.replace(/[^0-9.-]/g, '')) : parseFloat(rawAmt);
        const hasExpenseKeyword = type.includes('expense') || type.includes('spending') || type.includes('지출') || type.includes('out');
        const isNegative = amount < 0;
        const isEmptyType = type === '' || type === 'null' || type === 'undefined';
        return hasExpenseKeyword || isNegative || (isEmptyType && Math.abs(amount) > 0);
    };

    const getCleanAmount = (tx) => {
        const rawAmt = tx.amount ?? tx.value ?? tx.price ?? tx.amt ?? 0;
        const amt = typeof rawAmt === 'string' ? parseFloat(rawAmt.replace(/[^0-9.-]/g, '')) : parseFloat(rawAmt);
        return Math.abs(amt || 0);
    };

    const activeBudget = getActiveBudget();

    // --- Compute per-category spent ---
    if (activeBudget && activeBudget.categories) {
        activeBudget.categories.forEach(cat => {
            cat.spent = monthTx.reduce((sum, tx) => {
                const txCat = (tx.category || tx.cat || '기타').trim();
                if (txCat === cat.name.trim() && isExpenseFn(tx)) {
                    return sum + getCleanAmount(tx);
                }
                return sum;
            }, 0);
        });
    }

    const totalSpent = monthTx.reduce((sum, tx) => {
        return isExpenseFn(tx) ? sum + getCleanAmount(tx) : sum;
    }, 0);

    const totalBudget = activeBudget?.totalLimit || 0;
    const budgetLeft = totalBudget - totalSpent;
    const savingsRate = totalBudget > 0 ? Math.round(((totalBudget - totalSpent) / totalBudget) * 100) : 0;

    console.log(`[v120] monthTx=${monthTx.length}, totalSpent=${totalSpent}, totalBudget=${totalBudget}`);

    // --- Always update all metric elements (Dashboard + Budget page) ---
    const metrics = {
        'budget-total-limit': formatKRW(totalBudget),
        'dashboard-budget-left': formatKRW(budgetLeft),
        'budget-remaining-value': formatKRW(budgetLeft),
        'dashboard-monthly-spent': formatKRW(totalSpent),
        'budget-total-spent': formatKRW(totalSpent),
        'budget-savings-rate': savingsRate + '%'
    };

    Object.entries(metrics).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
            // Use bsc-value for both dashboard and budget summary cards
            const baseClass = 'bsc-value';
            
            // Only apply red/green to Budget Left/Remaining and Savings Rate.
            // Monthly Spent should stay neutral/dark unless it's specifically a 'left' metric.
            const isSpentMetric = id.includes('spent') || id.includes('limit');
            const isLeftMetric = id.includes('left') || id.includes('remaining') || id.includes('rate');
            
            if (isLeftMetric) {
                el.className = `${baseClass} ${budgetLeft < 0 ? 'negative' : 'positive'}`;
            } else {
                el.className = baseClass; // Stay neutral/dark
            }
        }
    });

    // --- Render category rows (only if container exists in current view) ---
    const listContainer = document.getElementById('budget-category-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    activeBudget.categories.forEach((cat, index) => {
        if (cat.limit === 0 && cat.spent === 0 && cat.name === '기타' && !isEditingLimits) return;

        let limitToUse = cat.limit > 0 ? cat.limit : 1;
        let pct = (cat.spent / limitToUse) * 100;

        let displayColor = cat.colorHex;
        if (pct > 100) displayColor = '#EF4444';

        let limitHtml = `${formatKRW(cat.limit)}`;
        if (isEditingLimits) {
            let limitCommas = cat.limit.toLocaleString();
            limitHtml = `<input type="text" class="edit-limit-input cat-limit-input" data-idx="${index}" value="${limitCommas}" oninput="this.value = this.value.replace(/[^0-9]/g, '').replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',')" style="margin-left: 8px;"/>`;
        }

        const html = `
            <div class="budget-item" onclick="window.showCategoryDetail('${cat.name.replace(/'/g, "\\'")}')" style="cursor: pointer;">
                <div class="budget-item-header">
                    <span class="li-badge" style="background-color: ${cat.colorHex}15; color: ${cat.colorHex}; border: 1px solid ${cat.colorHex}30;">${cat.name}</span>
                    <div class="budget-item-values">
                        ${!isEditingLimits ? '<span class="spent-val" style="font-weight: 900 !important; font-family: \'Inter\', sans-serif !important;">' + formatKRW(cat.spent) + '</span><span class="sep">/</span>' : ''} 
                        <span class="limit-val" style="font-weight: 900 !important; font-family: \'Inter\', sans-serif !important; color: var(--text-muted) !important; opacity: 1 !important;">${limitHtml}</span>
                    </div>
                </div>
                <div class="cat-progress-track">
                    <div class="cat-progress-bar" style="width: ${Math.min(pct, 100)}%; background: ${displayColor};"></div>
                </div>
            </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', html);
    });
}




// --- Components Initialization ---
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-view]');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = item.getAttribute('data-view');
            window.switchView(viewId);
        });
    });
}

window.switchView = function(viewId) {
    if (!viewId) viewId = 'dashboard';
    
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
    });
    
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active');
        document.body.setAttribute('data-active-view', viewId);
        
        const title = document.getElementById('view-title');
        const globalMonthNav = document.getElementById('global-month-nav');
        
        if (title) {
            const labels = {
                'dashboard': 'Dashboard',
                'budget': 'Budget',
                'investments': 'Portfolio',
                'retirement': 'Retirement Planner',
                'settings': 'Settings',
                'category-detail': 'Category Detail'
            };
            title.textContent = labels[viewId] || viewId.charAt(0).toUpperCase() + viewId.slice(1);
            
            // Toggle Main Header and Month Navigation visibility
            const mainHeader = document.getElementById('main-header');
            if (mainHeader) {
                // Use !important to override mobile CSS media query !important rules
                if (viewId === 'category-detail') {
                    mainHeader.style.setProperty('display', 'none', 'important');
                } else {
                    mainHeader.style.setProperty('display', '', ''); // Restore to CSS default (grid on mobile)
                }
            }

            if (globalMonthNav) {
                if (viewId === 'budget') {
                    globalMonthNav.style.setProperty('display', 'flex', 'important');
                } else {
                    globalMonthNav.style.setProperty('display', 'none', 'important');
                }
                // Hide title text on budget view to make room for month nav if needed
                title.style.display = (viewId === 'budget') ? 'none' : 'block';
            }
        }
        
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-view') === viewId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Use the centralized UI refresher
        window.refreshAllUI();
    }
};

// Fix for missing category management function to prevent crashes
window.showCategoryManagementModal = function() {
    console.log('[FinanceOS] showCategoryManagementModal triggered');
    alert('Category Management is coming soon!');
};

// --- Charts Orchestration ---
const chartInstances = {};

function initCharts() {
    renderNetWorthChart();
    renderBudgetChart();
}

// 1. Dashboard Net Worth Chart (Line)
function renderNetWorthChart() {
    const ctxNetWorth = document.getElementById('netWorthChart');
    if (ctxNetWorth) {
        let gradientPrimary = ctxNetWorth.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradientPrimary.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
        gradientPrimary.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

        if (chartInstances['netWorthChart']) chartInstances['netWorthChart'].destroy();
        chartInstances['netWorthChart'] = new Chart(ctxNetWorth, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Net Worth',
                    data: [310000, 315000, 314000, 320000, 328000, 340000, 355000, 370000, 385000, 400000, 418000, 428500],
                    borderColor: chartColors.primary,
                    backgroundColor: gradientPrimary,
                    borderWidth: 3,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: chartColors.primary,
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: getDefaultChartOptions()
        });
    }

    renderBudgetChart();

    // 3. Asset Allocation Chart (Doughnut)
    const ctxAlloc = document.getElementById('allocationChart');
    if (ctxAlloc) {
        if (chartInstances['allocationChart']) chartInstances['allocationChart'].destroy();
        chartInstances['allocationChart'] = new Chart(ctxAlloc, {
            type: 'pie',
            data: {
                labels: ['US Equities', 'Intl Equities', 'Bonds', 'Crypto', 'Cash'],
                datasets: [{
                    data: [65, 15, 10, 5, 5],
                    backgroundColor: [
                        chartColors.primary,
                        chartColors.secondary,
                        chartColors.warning,
                        chartColors.positive,
                        '#64748b'
                    ],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right' } }
            }
        });
    }
}

function renderBudgetChart() {
    const canvas = document.getElementById('budgetChart');
    if (!canvas) return;

    const activeBudget = getActiveBudget();
    const dataLabels = activeBudget.categories.map(c => c.name);
    const dataSpent = activeBudget.categories.map(c => c.spent || 0);
    const dataColors = activeBudget.categories.map(c => c.colorHex);

    const totalSpent = dataSpent.reduce((a, b) => a + b, 0);
    const container = canvas.parentElement;

    if (chartInstances['budgetChart']) {
        chartInstances['budgetChart'].destroy();
    }

    if (totalSpent === 0) {
        // Show placeholder
        let placeholder = document.getElementById('chart-no-data');
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.id = 'chart-no-data';
            placeholder.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:var(--text-muted);font-size:0.9rem;font-weight:500;';
            placeholder.innerText = '이번 달 지출 내역이 없습니다.';
            container.appendChild(placeholder);
        }
        canvas.style.opacity = '0';
        return;
    } else {
        const placeholder = document.getElementById('chart-no-data');
        if (placeholder) placeholder.remove();
        canvas.style.opacity = '1';
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    chartInstances['budgetChart'] = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: dataLabels,
            datasets: [{
                data: dataSpent,
                backgroundColor: dataColors,
                borderWidth: 0,
                hoverOffset: 12
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { 
                    position: 'bottom',
                    labels: {
                        color: isDark ? '#94a3b8' : '#64748b',
                        padding: 20,
                        usePointStyle: true,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    titleColor: isDark ? '#f8fafc' : '#1e293b',
                    bodyColor: isDark ? '#94a3b8' : '#64748b',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    borderWidth: 1,
                    cornerRadius: 12,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            const pct = ((val / totalSpent) * 100).toFixed(1);
                            return ` ${context.label}: ₩${val.toLocaleString()} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

function initRetirementCalculator() {
    const inputs = ['currentSavings', 'monthlyContribution', 'yearsToRetire', 'expectedReturn'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', updateRetirementProjection);
    });
    updateRetirementProjection();
}

function updateRetirementProjection() {
    const elAge = document.getElementById('current-age');
    if(!elAge) return;

    const currentAge = parseFloat(elAge.value) || 30;
    const retirementAge = parseFloat(document.getElementById('retirement-age').value) || 65;
    
    // We don't have currentSavings input, default to portfolio total or 0
    let P = 0; 
    const elPMT = document.getElementById('monthly-contribution');
    const PMT = elPMT ? parseFloat(elPMT.value.replace(/,/g, '')) || 0 : 0;
    const t = Math.max(0, retirementAge - currentAge);
    const r = (parseFloat(document.getElementById('annual-return').value) || 7) / 100;
    
    // Some values might not exist in the DOM, wrap in try/catch or if checks
    const valCurrent = document.getElementById('currentSavingsVal');
    const valContrib = document.getElementById('monthlyContributionVal');
    const valYears = document.getElementById('yearsToRetireVal');
    const valReturn = document.getElementById('expectedReturnVal');
    
    if (valCurrent) valCurrent.textContent = formatCurrency(P);
    if (valContrib) valContrib.textContent = formatCurrency(PMT);
    if (valYears) valYears.textContent = t;
    if (valReturn) valReturn.textContent = (r * 100).toFixed(1) + '%';
    
    const labels = [];
    const principalData = [];
    const interestData = [];
    
    let currentBalance = P;
    let totalContributions = P;

    for (let year = 0; year <= t; year++) {
        labels.push(`Year ${year}`);
        if (year > 0) {
            const interestEarned = currentBalance * r;
            currentBalance += interestEarned + (PMT * 12);
            totalContributions += (PMT * 12);
        }
        principalData.push(totalContributions);
        interestData.push(currentBalance - totalContributions);
    }

    const elTotal = document.getElementById('retirement-total-value');
    if (elTotal) elTotal.textContent = formatCurrency(currentBalance);

    const ctxRetire = document.getElementById('retirementChart');
    if (ctxRetire) {
        if (chartInstances['retirementChart']) chartInstances['retirementChart'].destroy();
        
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

        chartInstances['retirementChart'] = new Chart(ctxRetire, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Total Contributions', data: principalData, backgroundColor: '#6366f1', stacked: true },
                    { label: 'Interest Earned', data: interestData, backgroundColor: '#a855f7', stacked: true }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { 
                        stacked: true, 
                        grid: { display: false },
                        ticks: { color: textColor }
                    },
                    y: { 
                        stacked: true, 
                        grid: { color: gridColor, drawBorder: false }, 
                        ticks: { 
                            color: textColor,
                            callback: v => '₩' + (v / 10000) + '만' 
                        } 
                    }
                },
                plugins: { 
                    legend: {
                        labels: { color: textColor }
                    },
                    tooltip: { 
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        titleColor: isDark ? '#f8fafc' : '#1e293b',
                        bodyColor: isDark ? '#94a3b8' : '#64748b',
                        mode: 'index', 
                        intersect: false, 
                        callbacks: { label: c => c.dataset.label + ': ' + formatKRW(c.raw) } 
                    } 
                }
            }
        });
    }
}

function getDefaultChartOptions() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                titleColor: isDark ? '#f8fafc' : '#1e293b',
                bodyColor: isDark ? '#94a3b8' : '#64748b',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                borderWidth: 1,
                cornerRadius: 8,
                padding: 12,
                displayColors: false,
                callbacks: {
                    label: function(context) {
                        return formatKRW(context.parsed.y || context.parsed);
                    }
                }
            }
        },
        scales: {
            y: {
                grid: {
                    color: gridColor,
                    drawBorder: false
                },
                ticks: {
                    color: textColor,
                    font: { size: 11 },
                    callback: (value) => {
                        if (value >= 1000000) return (value/1000000).toFixed(1) + 'M';
                        if (value >= 1000) return (value/1000).toFixed(0) + 'K';
                        return value;
                    }
                }
            },
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: textColor,
                    font: { size: 11 }
                }
            }
        },
        interaction: { mode: 'index', intersect: false }
    };
}

function initThemeToggle() {
    try {
        const themeToggle = document.getElementById('theme-toggle');
        if (!themeToggle) return;

        const sunIcon = document.getElementById('theme-icon-sun') || themeToggle.querySelector('.sun-icon');
        const moonIcon = document.getElementById('theme-icon-moon') || themeToggle.querySelector('.moon-icon');

        const updateIcons = (theme) => {
            if (theme === 'dark') {
                if (sunIcon) sunIcon.style.display = 'block';
                if (moonIcon) moonIcon.style.display = 'none';
            } else {
                if (sunIcon) sunIcon.style.display = 'none';
                if (moonIcon) moonIcon.style.display = 'block';
            }
        };

        // Initial icon state
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        updateIcons(currentTheme);

        themeToggle.addEventListener('click', () => {
            const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('financeOS_theme', theme);
            updateIcons(theme);
            
            // Refresh charts with new theme colors
            if (typeof initCharts === 'function') initCharts();
            if (typeof updateRetirementProjection === 'function') updateRetirementProjection();
        });
    } catch (e) {
        console.warn('[FinanceOS] Non-fatal error in initThemeToggle:', e);
    }
}

// --- OCR Receipt Scanner Logic v=61 ---
let pendingTransactions = [];

function initOCRScanner() {
    const addTxBtns = document.querySelectorAll('#btn-add-transaction, #btn-add-transaction-header');
    addTxBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e) e.preventDefault();
            window.showAddTransactionModal();
        });
    });

    const fileInput = document.getElementById('file-input');
    const btnUploadHeader = document.getElementById('btn-upload-header');
    const btnCancel = document.getElementById('btn-cancel-ocr');
    const btnConfirm = document.getElementById('btn-confirm-ocr');
    
    if(!fileInput) return;

    if (btnUploadHeader) {
        btnUploadHeader.addEventListener('click', () => {
            // Switch to budget view if not already there
            const budgetNav = document.querySelector('.nav-item[data-view="budget"]');
            if (budgetNav) budgetNav.click();
            fileInput.click();
        });
    }

    const handleAddManual = (e) => {
        if (e) e.preventDefault();
        // Switch view if needed
        const budgetNav = document.querySelector('.nav-item[data-view="budget"]');
        const budgetView = document.getElementById('budget');
        if (budgetNav && (!budgetView || !budgetView.classList.contains('active'))) {
            budgetNav.click();
        }
        
        document.getElementById('drop-zone').style.display = 'none';
        document.getElementById('ocr-loading').style.display = 'none';
        
        // Ensure manual entry starts with ISO date for the calendar picker (YYYY-MM-DD)
        pendingTransactions.unshift({
            id: Date.now(), 
            date: new Date().toISOString().split('T')[0], 
            merchant: '', 
            amount: 0, 
            category: '식비' 
        });
        showOCRPreview(pendingTransactions);
    };



    addTxBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e) e.preventDefault();
            window.showAddTransactionModal();
        });
    });

    // Removed Drag & Drop as requested for cleaner UI
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) processImageFile(e.target.files[0]);
    });

    // Handle Paste (Ctrl+V)
    document.addEventListener('paste', (e) => {
        // Only care if we are in budget view
        const isBudget = document.getElementById('budget').classList.contains('active');
        if (!isBudget) return;
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            let item = items[index];
            if (item.kind === 'file' && item.type.includes('image')) {
                processImageFile(item.getAsFile());
                break;
            }
        }
    });

    // Handle Actions
    if (btnCancel) {
        btnCancel.addEventListener('click', hideOCRPreview);
    }
    
    // pointerdown/touchstart for faster response on mobile
    if (btnConfirm) {
        const handleConfirm = (e) => {
            if (!btnConfirm.classList.contains('btn-disabled')) {
                if (e) e.preventDefault();
                saveParsedTransactions();
            }
        };
        btnConfirm.addEventListener('pointerdown', handleConfirm);
        btnConfirm.addEventListener('touchstart', handleConfirm, {passive: false});
        // click fallback/prevention
        btnConfirm.addEventListener('click', (e) => e.preventDefault());
    }
}

async function processImageFile(file) {
    if(!file.type.startsWith('image/')) return;
    
    document.getElementById('drop-zone').style.display = 'none';
    document.getElementById('ocr-loading').style.display = 'block';
    
    try {
        const worker = await Tesseract.createWorker(["kor", "eng"], 1, {
            workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
            langPath: 'https://tessdata.projectnaptha.com/4.0.0',
            corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0',
            logger: m => {
                const statusText = document.getElementById('ocr-status-text');
                if(m.status === 'recognizing text') {
                    document.getElementById('ocr-progress').style.width = `${Math.floor(m.progress * 100)}%`;
                    statusText.textContent = `텍스트 인식중 (${Math.floor(m.progress * 100)}%)`;
                } else {
                    statusText.textContent = `엔진 준비중: ${m.status}`;
                }
            }
        });
        const { data: { text } } = await worker.recognize(file);
        await worker.terminate();

        const parsedData = parseKoreanReceiptText(text);
        showOCRPreview(parsedData);
    } catch (e) {
        console.error("OCR Error: ", e);
        alert("OCR 처리에 실패했습니다. 브라우저 콘솔을 확인하세요.");
        hideOCRPreview();
    }
}

function parseKoreanReceiptText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const transactions = [];
    const currentYear = new Date().getFullYear();

    const isAmount = (str) => /[\d,]{3,}\s*(?:원|KRW|₩)|(?:원|KRW|₩|\\)\s*[\d,]{3,}/i.test(str) || /(?:^|\s)[\-\+]?[\d,]{4,}(?:$|\s)/.test(str);
    const extractAmount = (str) => parseInt(str.replace(/[^\d]/g, ''), 10);
    
    const isSummaryLine = (str) => /(총계|합계|계|Total|결제금액|납부금액|Balance|지급내역|거래처별)/i.test(str);

    const isDateStr = (str) => {
        let clean = str.replace(/[^\d\-\.\/월일]/g, '').trim();
        return /(?:\d{2,4}[\-\.\/]\s*)?\d{1,2}[\-\.\/]\s*\d{1,2}/.test(clean) || /\d{1,2}월\s*\d{1,2}일/.test(str);
    };

    const extractDate = (str) => {
        // Try YYYY-MM-DD or MM-DD
        let m = str.match(/(?:(\d{2,4})[\-\.\/]\s*)?(\d{1,2})[\-\.\/]\s*(\d{1,2})/) || str.match(/(\d{1,2})월\s*(\d{1,2})일/);
        if (m) {
            let year = m[1] || currentYear;
            if (year.toString().length === 2) year = '20' + year; // assume 20xx
            let month = m[2].toString().padStart(2, '0');
            let day = m[3].toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        return new Date().toISOString().split('T')[0]; // Default to today ISO
    };

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Rule: IGNORE totals, balances, and summary rows
        if (isSummaryLine(line)) continue;
        
        // Skip purely informative status lines unless they have an amount
        if (/(승인|취소|일시불|할부|잔액|포인트)/.test(line) && !isAmount(line) && line.replace(/[^\d]/g,'').length < 3) continue;

        if (isAmount(line)) {
            let amount = extractAmount(line);
            if (amount <= 100) continue; 
            
            // Look for context nearby
            let date = new Date().toISOString().split('T')[0];
            let merchant = '';
            let category = '기타';

            let contextStartIndex = Math.max(0, i - 4);
            let contextEndIndex = Math.min(lines.length - 1, i + 2);
            let searchContext = lines.slice(contextStartIndex, contextEndIndex + 1);

            // 1. Attempt to look for the "Category · Date" format first
            for (let j = contextStartIndex; j <= contextEndIndex; j++) {
                if (lines[j].includes('·') || lines[j].includes('.')) {
                    let parts = lines[j].split(/[\·\.]/);
                    if (parts.length >= 2) {
                        let potentialCat = parts[0].trim();
                        let potentialDate = parts[1].trim();
                        if (isDateStr(potentialDate)) {
                            category = potentialCat;
                            date = extractDate(potentialDate);
                            // Merchant is likely the line immediately preceding this category line
                            if (j > 0) {
                                merchant = lines[j-1].replace(/(?:원|KRW|₩|\\)?\s*[\d,]{3,}\s*(?:원|KRW|₩)?/i, '').replace(/[\-\+]/g, '').trim();
                            }
                            break;
                        }
                    }
                }
            }

            // 2. Fallback logic if explicit category/date format isn't found
            if (!merchant || date === new Date().toISOString().split('T')[0]) {
                for (let j = contextStartIndex; j <= contextEndIndex; j++) {
                    if(j === i) continue;
                    if (isDateStr(lines[j])) {
                        date = extractDate(lines[j]);
                    }
                }

                for (let j = i - 1; j >= contextStartIndex; j--) {
                    let cl = lines[j];
                    if (isDateStr(cl) || /\d{2}:\d{2}/.test(cl) || isAmount(cl) || isSummaryLine(cl)) continue;
                    if (/(삼성|신한|국민|롯데|현대|하나|우리|농협|비씨)카드/.test(cl)) continue;
                    
                    // Extract merchant as written
                    merchant = cl.replace(/(승인|취소|일시불|할부|결제|잔액|포인트)/g, '').trim();
                    if (merchant.length >= 1) break;
                }

                if (!merchant) merchant = line.replace(/[\d,\.\s원KRW₩:\-\+]+/ig, '').trim() || '가맹점 알 수 없음';
                
                let searchTarget = merchant + ' ' + searchContext.join(' ');
                category = '기타';
                
                let customMatch = customCategoryRules.find(rule => searchTarget.includes(rule.pattern));
                if (customMatch) {
                    category = customMatch.category;
                } else if (/(스타벅스|카페|커피|투썸|이디야|할리스|메가커피|빽다방|우주라이크|버거킹|맥도날드|롯데리아|맘스터치|서브웨이|치킨|교촌|BBQ|BHC|피자|파파존스|도미노|식당|음식|배달의민족|요기요|쿠팡이츠|고기|본죽|돈까스|횟집|우동|김밥|마라)/i.test(searchTarget)) {
                    category = '외식';
                } else if (/(이마트|홈플러스|롯데마트|트레이더스|코스트코|노브랜드|마켓컬리|농협|하나로마트|슈퍼|편의점|CU|GS25|세븐일레븐|식품|베이커리|파리바게뜨|뚜레쥬르)/i.test(searchTarget)) {
                    category = '식비';
                } else if (/(쿠팡|로켓|네이버페이|11번가|지마켓|옥션|위메프|티몬|무신사|올리브영|다이소|백화점|아울렛|롯데백화점|신세계|현대백화점|스타필드|의류|신발|가방|화장품|옷|쇼핑)/i.test(searchTarget)) {
                    category = '쇼핑';
                } else if (/(택시|카카오T|우버|코레일|KTX|SRT|지하철|티머니|캐시비|버스|주유소|GS칼텍스|에쓰오일|SK엔크린|현대오일뱅크|주차|하이패스|쏘카|그린카|항공|대한항공|아시아나|제주항공)/i.test(searchTarget)) {
                    category = '교통비';
                } else if (/(가구|인테리어|세탁|청소|월세|부동산)/i.test(searchTarget)) {
                    category = '주거비';
                } else if (/(CGV|메가박스|롯데시네마|넷플릭스|유튜브|티빙|웨이브|왓챠|디즈니|멜론|지니|플로|스팀|블리자드|넥슨|엔씨|PC방|오락|엔터|골프|당구|볼링|헬스|필라테스|요가|레저|테니스|교보문고|알라딘|예스24)/i.test(searchTarget)) {
                    category = '여가비';
                } else if (/(한전|한국전력|우체국|SKT|KT|LGU|엘지유플러스|케이티|에스케이|전기요금|가스요금|도시가스|수도요금|건강보험|국민연금|세금|주민센터|관리비)/i.test(searchTarget)) {
                    category = '공과금';
                } else if (/(병원|약국|의원|치과|한의원|피부과|안과|산부인과)/i.test(searchTarget)) {
                    category = '의료비';
                }
            } else {
                let customMatch = customCategoryRules.find(rule => merchant.includes(rule.pattern));
                if (customMatch) category = customMatch.category;
            }

            transactions.push({ id: Date.now()+i, date, merchant, amount, category });
        }
    }

    // fallback extraction for generic apps layout
    if (transactions.length === 0) {
        lines.forEach((l, i) => {
            let numMatch = l.match(/[\d,]{4,}/); // 4 digits min
            if (numMatch && !isDateStr(l)) {
                let amount = extractAmount(numMatch[0]);
                if(amount > 1000) transactions.push({ id: Date.now()+i, date: '분석필요', merchant: '자동 파싱 (부분성공)', amount, category: '기타' });
            }
        });
    }

    // Quick deduplicate
    const unique = [];
    const seen = new Set();
    transactions.forEach(t => {
        let merchantLower = t.merchant ? t.merchant.toLowerCase() : '';
        let key = `${t.amount}-${merchantLower}-${t.date}`;
        if (!seen.has(key)) { unique.push(t); seen.add(key); }
    });
    
    return unique;
}

function showOCRPreview(data) {
    document.getElementById('ocr-loading').style.display = 'none';
    const previewArea = document.getElementById('ocr-preview');
    const tbody = document.getElementById('parsed-tx-body');
    
    pendingTransactions = data;
    renderOCRTable();
    
    previewArea.style.display = 'block';
}

function renderOCRTable() {
    const tbody = document.getElementById('parsed-tx-body');
    tbody.innerHTML = '';
    
    let totalAmount = 0;
    
    const activeBudget = getActiveBudget();
    const catOptions = activeBudget.categories.map(c => c.name);

    if (pendingTransactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted)">파싱된 결제 내역이 없습니다. (이미지가 선명한지 확인하세요)</td></tr>`;
    }

    pendingTransactions.forEach((tx, idx) => {
        totalAmount += tx.amount;
        
        // Ensure date is in ISO format for the picker
        const isoDate = formatToISO(tx.date);
        
        let selectHtml = `<select class="editable-select" data-idx="${idx}" data-field="category">`;
        catOptions.forEach(c => {
            selectHtml += `<option value="${c}" ${c === tx.category ? 'selected' : ''}>${c}</option>`;
        });
        selectHtml += `</select>`;

        const row = `
            <tr>
                <td style="padding: 6px 10px;">
                    <div class="ocr-date-cat-group">
                        <div style="font-size: 0.75rem;">${renderHybridDatePicker(tx.date, idx, 'date')}</div>
                        <div style="font-size: 0.75rem;">${selectHtml}</div>
                    </div>
                </td>
                <td><input type="text" class="editable-input" value="${tx.merchant}" data-idx="${idx}" data-field="merchant" placeholder="가맹점명 입력"/></td>
                <td><input type="text" class="editable-input" value="${tx.amount.toLocaleString()}" data-idx="${idx}" data-field="amount" oninput="this.value = this.value.replace(/[^0-9]/g, '').replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',')"/></td>
                <td><button class="btn btn-icon btn-danger" onclick="removePendingTx(${idx})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });

    updateOCRConfirmButton();

    // Attach listeners for dynamic input sync
    document.querySelectorAll('.editable-input, .editable-select').forEach(input => {
        const eventType = input.tagName === 'SELECT' ? 'change' : 'input';
        
        input.addEventListener(eventType, (e) => {
            const index = e.target.getAttribute('data-idx');
            const field = e.target.getAttribute('data-field');
            if(field === 'amount') {
                pendingTransactions[index][field] = parseInt(e.target.value.replace(/,/g, '')) || 0;
                updateOCRConfirmButton(); // trigger real-time button update
            } else {
                pendingTransactions[index][field] = e.target.value;
            }
        });

        // Add Enter key listener for fast submission
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveParsedTransactions();
            }
        });
    });
}

function updateOCRConfirmButton() {
    const btnConfirm = document.getElementById('btn-confirm-ocr');
    if (!btnConfirm) return;
    
    let total = 0;
    pendingTransactions.forEach(tx => {
        total += tx.amount;
    });

    if (total > 0) {
        btnConfirm.textContent = `예산 및 내역 반영 (+${formatKRW(total)})`;
        btnConfirm.classList.remove('btn-disabled');
    } else {
        btnConfirm.textContent = `예산 반영하기`;
        btnConfirm.classList.add('btn-disabled');
    }
}

// Global scope expose for the inline HTML onclick handler
window.removePendingTx = function(idx) {
    pendingTransactions.splice(idx, 1);
    renderOCRTable();
};

function hideOCRPreview() {
    document.getElementById('ocr-preview').style.display = 'none';
    document.getElementById('ocr-loading').style.display = 'none';
    document.getElementById('drop-zone').style.display = 'block';
    
    // Reset inputs
    document.getElementById('file-input').value = '';
    document.getElementById('ocr-progress').style.width = '0%';
    pendingTransactions = [];
}

function saveParsedTransactions() {
    // FINAL CAPTURE: Ensure latest DOM values are in state before saving
    // This protects against race conditions on mobile virtual keyboards
    const tbody = document.getElementById('parsed-tx-body');
    if (tbody) {
        tbody.querySelectorAll('.editable-input, .editable-select').forEach(input => {
            const index = input.getAttribute('data-idx');
            const field = input.getAttribute('data-field');
            if (index !== null && field) {
                if (field === 'amount') {
                    pendingTransactions[index][field] = parseInt(input.value.replace(/,/g, '')) || 0;
                } else {
                    pendingTransactions[index][field] = input.value;
                }
            }
        });
    }

    if (pendingTransactions.length === 0) return hideOCRPreview();

    // Safety check for disabled state
    const btnConfirm = document.getElementById('btn-confirm-ocr');
    if (btnConfirm && btnConfirm.classList.contains('btn-disabled')) return;

    // Loop through confirmed items and apply to budgetState
    pendingTransactions.forEach(tx => {
        tx.id = Date.now() + Math.floor(Math.random() * 10000); // ensure unique ID for deletion
        
        // Only update budget for expenses
        const isExpense = (tx.type === 'expense' || !tx.type); 
        if (isExpense) {
            let activeBudget = getActiveBudget();
            let cat = activeBudget.categories.find(c => c.name === tx.category);
            if (cat) {
                cat.spent += tx.amount;
            } else {
                let etcCat = activeBudget.categories.find(c => c.name === '기타');
                if (etcCat) etcCat.spent += tx.amount;
            }
        }
        
        transactionsState.push(Object.assign({}, tx));
    });

    // Re-render UI
    renderBudgetUI();
    renderBudgetChart();
    renderConfirmedTransactions();
    saveData();
    
    // Cleanup
    hideOCRPreview();
}

function renderConfirmedTransactions() {
    const tbody = document.getElementById('confirmed-tx-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Filter transactions for active month view using robust helper
    const monthTx = getTransactionsForMonth(currentMonthView);

    // Sort transactions by date descending (default) or amount
    const sorted = monthTx.slice().sort((a, b) => {
        if (txSortCol === 'date') {
            const valA = normalizeDateValue(a.date, currentMonthView);
            const valB = normalizeDateValue(b.date, currentMonthView);
            
            // Debug Log for 04/01 entries as requested
            if (String(a.date).includes('04/01') || String(a.date).includes('04-01')) {
                console.log(`[Date Sort Debug] "${a.date}" normalized to "${valA}"`);
            }

            if (txSortOrder === 'desc') {
                return valB.localeCompare(valA);
            } else {
                return valA.localeCompare(valB);
            }
        } else {
            return txSortOrder === 'desc' ? (b.amount - a.amount) : (a.amount - b.amount);
        }
    });

    if (sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 2rem;">최근 지출 내역이 없습니다. (No Data)</td></tr>`;
        return;
    }

    sorted.forEach((tx) => {
        const activeBudget = getActiveBudget();
        const cat = activeBudget.categories.find(c => c.name === tx.category);
        const catColor = cat ? cat.colorHex : 'var(--accent-primary)';
        
        // Premium Row Layout matching reference
        const row = `
        <tr onclick="window.toggleTxActions(${tx.id}, event)" class="li-row" data-tx-id="${tx.id}">
            <td class="budget-date-cell">
                <span class="li-date-short">${formatToMMDD(tx.date)}</span>
            </td>
            <td class="budget-merchant-cell">
                <div class="li-color-bar" style="background: ${catColor};"></div>
                <div class="li-content">
                    <div class="li-merchant">${tx.merchant}</div>
                    <div class="li-sub">
                        <span class="li-badge" style="background: ${catColor}15; color: ${catColor}; border: 1px solid ${catColor}30;">${tx.category}</span>
                    </div>
                </div>
            </td>
            <td class="budget-amount-cell">
                <span class="li-amount">${formatKRW(tx.amount)}</span>
            </td>
            <td class="budget-actions-cell">
                <div class="row-actions">
                    <button class="action-btn edit" onclick="event.stopPropagation(); window.showTransactionDetail(${tx.id}); setupEditMode(${tx.id});" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="action-btn delete" onclick="event.stopPropagation(); if(confirm('이 거래 내역을 삭제하시겠습니까?')) window.deleteConfirmedTx(${tx.id});" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            </td>
        </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

function renderDashboardTransactions() {
    const list = document.getElementById('dashboard-recent-tx-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (transactionsState.length === 0) {
        list.innerHTML = `<li class="transaction-item" style="justify-content: center; color: var(--text-muted); border: none;">최근 거래 내역이 없습니다. (No Transactions)</li>`;
        return;
    }
    
    const recent = transactionsState.slice().reverse().slice(0, 5);
    
    recent.forEach(tx => {
        const activeBudget = getActiveBudget();
        const cat = activeBudget.categories.find(c => c.name === tx.category);
        const catColor = cat ? cat.colorHex : 'var(--accent-primary)';
        const pillStyle = `background: ${catColor}22; color: ${catColor}; padding: 2px 8px; border-radius: 4px; font-size: 0.85em;`;
        
        let iconClass = 'sub';
        if (tx.category === '식비' || tx.category === '외식') iconClass = 'grocery';
        else if (tx.category === '쇼핑' || tx.category === '여가비') iconClass = 'invest';
        else if (tx.category === '공과금' || tx.category === '주거비' || tx.category === '의료비') iconClass = 'income';

        const html = `
            <li class="transaction-item" onclick="window.toggleTxActions(${tx.id}, event)" style="cursor: pointer; border-left: 8px solid ${catColor} !important; position: relative;" data-tx-id="${tx.id}">
                <div class="tx-info">
                    <div>
                        <h4><span class="merchant-tag" style="${pillStyle}">${tx.merchant}</span></h4>
                        <p>${tx.category} • ${formatToMMDD(tx.date)}</p>
                    </div>
                </div>
                <div class="tx-right-side" style="display: flex; align-items: center; gap: 8px;">
                    <div class="row-actions">
                        <button class="action-btn edit" onclick="event.stopPropagation(); window.showTransactionDetail(${tx.id}); setupEditMode(${tx.id});" title="Edit" style="width: 28px; height: 28px;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="action-btn delete" onclick="event.stopPropagation(); if(confirm('이 거래 내역을 삭제하시겠습니까?')) window.deleteConfirmedTx(${tx.id});" title="Delete" style="width: 28px; height: 28px;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                    <span class="tx-amount negative">-${formatKRW(tx.amount)}</span>
                </div>
            </li>
        `;
        list.insertAdjacentHTML('beforeend', html);
    });
}

window.sortConfirmedTx = function(col) {
    if (txSortCol === col) {
        txSortOrder = txSortOrder === 'desc' ? 'asc' : 'desc';
    } else {
        txSortCol = col;
        txSortOrder = 'desc';
    }
    
    // Update sort icons in the new redesign
    const dIcon = document.getElementById('sort-icon-date');
    const aIcon = document.getElementById('sort-icon-amount');
    const dBtn = document.getElementById('sort-date');
    const aBtn = document.getElementById('sort-amount');
    
    const inactiveOpacity = '0.3';
    const activeOpacity = '1';
    
    // Reset buttons
    if (dBtn) dBtn.classList.remove('active');
    if (aBtn) aBtn.classList.remove('active');
    if (dIcon) { dIcon.textContent = '↕'; dIcon.style.opacity = inactiveOpacity; }
    if (aIcon) { aIcon.textContent = '↕'; aIcon.style.opacity = inactiveOpacity; }
    
    const arrow = txSortOrder === 'desc' ? '▼' : '▲';
    
    if (col === 'date') {
        if (dBtn) dBtn.classList.add('active');
        if (dIcon) { dIcon.textContent = arrow; dIcon.style.opacity = activeOpacity; }
    } else if (col === 'amount') {
        if (aBtn) aBtn.classList.add('active');
        if (aIcon) { aIcon.textContent = arrow; aIcon.style.opacity = activeOpacity; }
    }
    
    renderConfirmedTransactions();
};

window.setSort = window.sortConfirmedTx;

window.editConfirmedTx = function(id) {
    editingTxId = id;
    renderConfirmedTransactions();
};

window.cancelEditTx = function() {
    editingTxId = null;
    renderConfirmedTransactions();
};

window.saveConfirmedTx = function(id) {
    const idx = transactionsState.findIndex(t => t.id === id);
    if (idx === -1) return;
    
    const tx = transactionsState[idx];
    const oldAmount = tx.amount;
    const oldCategory = tx.category;
    
    // Read new values
    const newDate = document.getElementById(`edit-date-${id}`).value.trim();
    const newMerchant = document.getElementById(`edit-merchant-${id}`).value.trim();
    const newAmount = parseInt(document.getElementById(`edit-amount-${id}`).value.replace(/,/g, '')) || 0;
    const newCategory = document.getElementById(`edit-cat-${id}`).value;
    
    // Deduct old amount from old category (if it was an expense)
    let activeBudget = getActiveBudget();
    const wasExpense = (tx.type === 'expense' || !tx.type);
    
    if (wasExpense) {
        let oldCat = activeBudget.categories.find(c => c.name === oldCategory);
        if (oldCat) {
            oldCat.spent = Math.max(0, oldCat.spent - oldAmount);
        } else {
            let undefOldCat = activeBudget.categories.find(c => c.name === '기타');
            if (undefOldCat) undefOldCat.spent = Math.max(0, undefOldCat.spent - oldAmount);
        }
    }
    
    // Add new amount to new category (if it's an expense)
    if (wasExpense) {
        let newCat = activeBudget.categories.find(c => c.name === newCategory);
        if (newCat) {
            newCat.spent += newAmount;
        } else {
            let undefNewCat = activeBudget.categories.find(c => c.name === '기타');
            if (undefNewCat) undefNewCat.spent += newAmount;
        }
    }
    
    // Update tx data
    tx.date = newDate;
    tx.merchant = newMerchant;
    tx.amount = newAmount;
    tx.category = newCategory;
    
    editingTxId = null;
    saveData();
    
    renderConfirmedTransactions();
    renderBudgetUI();
    renderBudgetChart();
};

window.deleteConfirmedTx = function(id) {
    const idx = transactionsState.findIndex(t => t.id === id);
    if (idx === -1) return;
    
    const tx = transactionsState[idx];
    
    // Deduct from budget ONLY if it was an expense
    const isExpense = (tx.type === 'expense' || !tx.type);
    if (isExpense) {
        let activeBudget = getActiveBudget();
        let cat = activeBudget.categories.find(c => c.name === tx.category);
        if (cat) {
            cat.spent = Math.max(0, cat.spent - tx.amount);
        } else {
            let undefCat = activeBudget.categories.find(c => c.name === '기타');
            if (undefCat) undefCat.spent = Math.max(0, undefCat.spent - tx.amount);
        }
    }
    
    transactionsState.splice(idx, 1);
    saveData();
    
    renderConfirmedTransactions();
    renderBudgetUI();
    renderBudgetChart();

    // Refresh category detail if active
    const catDetailView = document.getElementById('category-detail'); if (activeDetailCategory && catDetailView && catDetailView.style.display !== 'none') {
        window.showCategoryDetail(activeDetailCategory);
    }
};

// --- Settings View Logic ---
function initSettingsRules() {
    const select = document.getElementById('rule-category-select');
    if (select) {
        select.innerHTML = '';
        budgetState.categories.forEach(cat => {
            select.insertAdjacentHTML('beforeend', `<option value="${cat.name}">${cat.name}</option>`);
        });
    }
    renderSettingsRules();
    loadBackups();
}

window.addCustomRule = function() {
    const patternInput = document.getElementById('rule-pattern-input');
    const catSelect = document.getElementById('rule-category-select');
    if (!patternInput || !patternInput.value.trim()) return;

    customCategoryRules.push({
        id: Date.now(),
        pattern: patternInput.value.trim(),
        category: catSelect.value
    });
    
    saveData();
    patternInput.value = '';
    renderSettingsRules();
};

window.deleteCustomRule = function(id) {
    customCategoryRules = customCategoryRules.filter(r => r.id !== id);
    saveData();
    renderSettingsRules();
};

window.updateCustomRule = function(id, field, element) {
    const idx = customCategoryRules.findIndex(r => r.id === id);
    if(idx === -1) return;
    
    customCategoryRules[idx][field] = element.value.trim();
    saveData();
};

function renderSettingsRules() {
    const tbody = document.getElementById('rules-tx-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (customCategoryRules.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted)">활성화된 규칙이 없습니다.</td></tr>`;
        return;
    }
    
    const activeBudget = getActiveBudget();
    const catOptions = activeBudget.categories.map(c => c.name);
    
    customCategoryRules.forEach(rule => {
        let selectHtml = `<select class="editable-select" onchange="updateCustomRule(${rule.id}, 'category', this)" style="padding: 4px; min-width: 100px;">`;
        catOptions.forEach(c => {
            selectHtml += `<option value="${c}" ${c === rule.category ? 'selected' : ''}>${c}</option>`;
        });
        selectHtml += `</select>`;

        const row = `
            <tr>
                <td><input type="text" class="editable-input" value="${rule.pattern}" onchange="updateCustomRule(${rule.id}, 'pattern', this)" style="padding: 4px; width: 100%;"></td>
                <td>${selectHtml}</td>
                <td>
                    <button class="btn btn-icon btn-danger" onclick="deleteCustomRule(${rule.id})" title="삭제">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}
// --- Database Backup & Restore Engine ---
async function loadBackups() {
    const listBody = document.getElementById('backup-list-body');
    if (!listBody) return;
    
    try {
        const URL = `${API_BASE}/api/backups`;
        const res = await fetch(URL);
        if (res.ok) {
            const backups = await res.json();
            listBody.innerHTML = '';
            
            if (backups.length === 0) {
                listBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">저장된 스냅샷이 없습니다.</td></tr>';
                return;
            }
            
            backups.forEach(bak => {
                const timestampExtracted = bak.filename.replace('database_bak_', '').replace('.json', '');
                const formattedTime = timestampExtracted.replace(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/, '$1-$2-$3 $4:$5:$6');
                const szKB = (bak.size / 1024).toFixed(1) + ' KB';
                
                listBody.insertAdjacentHTML('beforeend', `
                    <tr>
                        <td>${formattedTime}</td>
                        <td>${szKB}</td>
                        <td>
                            <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.8rem;" onclick="window.restoreBackup('${bak.filename}')">복원 (Restore)</button>
                        </td>
                    </tr>
                `);
            });
        }
    } catch (e) {
        console.error("Failed to load backups", e);
        listBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">오류가 발생했습니다 (Error)</td></tr>';
    }
}

window.restoreBackup = async function(filename) {
    if (!confirm('경고: 복원하면 현재 데이터가 지워지고 해당 시간의 스냅샷으로 되돌아갑니다. 진행할까요?')) return;
    try {
        const URL = `${API_BASE}/api/restore`;
        const res = await fetch(URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: filename })
        });
        if (res.ok) {
            alert('성공적으로 복원되었습니다! (Successfully restored!)');
            window.location.reload();
        } else {
            alert('복원에 실패했습니다. (Failed to restore)');
        }
    } catch(e) {
        alert('서버 연결 오류 (Server connection error)');
    }
};

// --- Investments Module ---
async function fetchExchangeRate() {
    try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        if (res.ok) {
            const data = await res.json();
            if (data.rates && data.rates.KRW) {
                usdToKrwRate = data.rates.KRW;
                renderExchangeRate();
                renderPortfolioSummary();
                renderInvestments(); 
            }
        }
    } catch (e) {
        console.warn("Failed to fetch live exchange rate, using fallback:", e);
    }
}

function renderExchangeRate() {
    const header = document.querySelector('#investments .invest-grid');
    if (!header) return;

    let rateDisplay = document.getElementById('exchange-rate-display');
    if (!rateDisplay) {
        const pill = document.createElement('div');
        pill.id = 'exchange-rate-display';
        pill.className = 'exchange-rate-pill';
        pill.style.cssText = 'position: absolute; top: -40px; left: 0; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; background: var(--glass-bg); padding: 4px 12px; border-radius: 20px; border: 1px solid var(--glass-border);';
        header.style.position = 'relative';
        header.prepend(pill);
        rateDisplay = pill;
    }
    
    rateDisplay.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
        USD/KRW: <strong>${usdToKrwRate.toLocaleString()}</strong>
    `;
}

function initInvestments() {
    fetchExchangeRate();
    renderInvestments();
    
    // Add logic for "Add Asset" button
    const btnAdd = document.getElementById('btn-add-asset');
    const modal = document.getElementById('modal-add-asset');
    const btnClose = document.getElementById('btn-close-asset-modal');
    const btnCancel = document.getElementById('btn-cancel-asset');
    const btnSave = document.getElementById('btn-save-asset');

    if (btnAdd && modal) {
        btnAdd.addEventListener('click', () => {
             modal.style.display = 'flex';
        });
    }

    const closeModal = () => {
        if (modal) {
            modal.style.display = 'none';
            delete modal.dataset.editId;
            modal.querySelector('h3').textContent = 'Add New Asset';
            document.getElementById('asset-modal-actions-add').style.display = 'flex';
            document.getElementById('asset-modal-actions-view').style.display = 'none';
            
            // Re-enable inputs if they were disabled for "Detail" view
            ['asset-name', 'asset-detail', 'asset-shares', 'asset-cost', 'asset-currency'].forEach(id => {
                const el = document.getElementById(id);
                if(el) el.disabled = false;
            });
        }
        ['asset-name', 'asset-detail', 'asset-shares', 'asset-cost'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.value = '';
        });
    };

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    if (btnSave) {
        btnSave.addEventListener('click', () => {
            const id = document.getElementById('modal-add-asset').dataset.editId;
            const name = document.getElementById('asset-name').value;
            const detail = document.getElementById('asset-detail').value;
            const shares = parseFloat(document.getElementById('asset-shares').value.replace(/,/g, ''));
            const avgCost = parseFloat(document.getElementById('asset-cost').value.replace(/,/g, ''));
            const currency = document.getElementById('asset-currency').value;

            if (!name || isNaN(shares) || isNaN(avgCost)) {
                alert("Please fill in all fields correctly.");
                return;
            }

            const assetData = {
                id: id ? parseInt(id) : Date.now(),
                name,
                detail,
                shares,
                avgCost,
                currentPrice: avgCost, 
                currency
            };

            if (id) {
                const idx = investmentsState.findIndex(a => a.id === parseInt(id));
                if (idx !== -1) investmentsState[idx] = assetData;
            } else {
                investmentsState.push(assetData);
            }

            saveData();
            renderInvestments();
            renderPortfolioSummary();
            closeModal();
        });
    }

    // New detailed view buttons
    const btnDetail = document.getElementById('btn-detail-asset');
    const btnEditFromView = document.getElementById('btn-edit-asset-from-view');
    const btnRemoveFromView = document.getElementById('btn-remove-asset-from-view');

    if (btnDetail) {
        btnDetail.addEventListener('click', () => {
            // "Detail" button acts as a reset or simply showing current view
            alert("Viewing details for: " + document.getElementById('asset-name').value);
        });
    }

    if (btnEditFromView) {
        btnEditFromView.addEventListener('click', () => {
            const id = parseInt(modal.dataset.editId);
            window.editInvestment(id);
        });
    }

    if (btnRemoveFromView) {
        btnRemoveFromView.addEventListener('click', () => {
            const id = parseInt(modal.dataset.editId);
            window.deleteInvestment(id);
            closeModal();
        });
    }
}

window.viewAsset = function(id) {
    const asset = investmentsState.find(a => a.id === id);
    if (!asset) return;

    const modal = document.getElementById('modal-add-asset');
    if (!modal) return;

    modal.dataset.editId = id;
    modal.querySelector('h3').textContent = 'Asset Details';
    
    document.getElementById('asset-name').value = asset.name;
    document.getElementById('asset-detail').value = asset.detail;
    document.getElementById('asset-shares').value = asset.shares;
    document.getElementById('asset-cost').value = asset.avgCost;
    document.getElementById('asset-currency').value = asset.currency;

    // Set to view mode
    document.getElementById('asset-modal-actions-add').style.display = 'none';
    document.getElementById('asset-modal-actions-view').style.display = 'flex';
    
    ['asset-name', 'asset-detail', 'asset-shares', 'asset-cost', 'asset-currency'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.disabled = true;
    });

    modal.style.display = 'flex';
};

window.editInvestment = function(id) {
    const asset = investmentsState.find(a => a.id === id);
    if (!asset) return;

    const modal = document.getElementById('modal-add-asset');
    if (!modal) return;

    modal.dataset.editId = id;
    modal.querySelector('h3').textContent = 'Edit Asset';
    
    // Ensure inputs are enabled
    ['asset-name', 'asset-detail', 'asset-shares', 'asset-cost', 'asset-currency'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.disabled = false;
    });

    document.getElementById('asset-name').value = asset.name;
    document.getElementById('asset-detail').value = asset.detail;
    document.getElementById('asset-shares').value = asset.shares;
    document.getElementById('asset-cost').value = asset.avgCost;
    document.getElementById('asset-currency').value = asset.currency;

    document.getElementById('asset-modal-actions-add').style.display = 'flex';
    document.getElementById('asset-modal-actions-view').style.display = 'none';

    modal.style.display = 'flex';
};

function addInvestment(asset) {
    investmentsState.push(asset);
    saveData();
    renderInvestments();
    renderPortfolioSummary();
}

window.deleteInvestment = function(id) {
    if (!confirm("Remove this asset?")) return;
    investmentsState = investmentsState.filter(a => a.id !== id);
    saveData();
    renderInvestments();
    renderPortfolioSummary();
};

function renderInvestments() {
    const tbody = document.querySelector('#investments .data-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    const sortedHoldings = investmentsState.slice().sort((a, b) => {
        const valA = a.shares * a.currentPrice * (a.currency === 'USD' ? 1 : 1/usdToKrwRate);
        const valB = b.shares * b.currentPrice * (b.currency === 'USD' ? 1 : 1/usdToKrwRate);
        return valB - valA;
    });

    sortedHoldings.forEach(asset => {
        const totalValueUSD = asset.currency === 'USD' ? (asset.shares * asset.currentPrice) : (asset.shares * asset.currentPrice / usdToKrwRate);
        const returnPct = ((asset.currentPrice - asset.avgCost) / asset.avgCost * 100).toFixed(1);
        const returnClass = returnPct >= 0 ? 'positive' : 'negative';
        
        const row = `
            <tr class="clickable-row" onclick="window.viewAsset(${asset.id})">
                <td><strong>${asset.name}</strong><br><small class="asset-detail-text">${asset.detail}</small></td>
                <td class="mobile-hide">${asset.shares}</td>
                <td class="mobile-hide">${asset.currency === 'USD' ? '$' : '₩'}${asset.avgCost.toLocaleString()}</td>
                <td>${asset.currency === 'USD' ? '$' : '₩'}${asset.currentPrice.toLocaleString()}</td>
                <td>$${totalValueUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td class="${returnClass}">${returnPct >= 0 ? '+' : ''}${returnPct}%</td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
    
    updateAllocationChart();
}

function renderPortfolioSummary() {
    const totalEl = document.getElementById('portfolio-total-value');
    if (!totalEl) return;

    let totalUSD = 0;
    let totalCostUSD = 0;

    investmentsState.forEach(asset => {
        const valUSD = asset.currency === 'USD' ? (asset.shares * asset.currentPrice) : (asset.shares * asset.currentPrice / usdToKrwRate);
        const costUSD = asset.currency === 'USD' ? (asset.shares * asset.avgCost) : (asset.shares * asset.avgCost / usdToKrwRate);
        totalUSD += valUSD;
        totalCostUSD += costUSD;
    });

    const totalKRW = totalUSD * usdToKrwRate;
    const overallReturn = totalCostUSD > 0 ? ((totalUSD - totalCostUSD) / totalCostUSD * 100).toFixed(1) : 0;
    const returnClass = overallReturn >= 0 ? 'positive' : 'negative';

    // Update Portfolio detail view
    totalEl.textContent = formatKRW(totalKRW);
    const dayChangeEl = document.getElementById('portfolio-day-change');
    if (dayChangeEl) {
        dayChangeEl.textContent = `${overallReturn >= 0 ? '+' : ''}${overallReturn}%`;
        dayChangeEl.className = `metric-value ${returnClass}`;
    }
    
    // Update Dashboard view
    const dashInvest = document.getElementById('dashboard-invest-value');
    if (dashInvest) {
        if (investmentsState.length === 0) {
            dashInvest.textContent = '₩0';
            const dashSub = document.getElementById('dash-investments-subtitle');
            if (dashSub) dashSub.textContent = 'No investments found';
        } else {
            dashInvest.textContent = formatKRW(totalKRW);
            const dashSub = document.getElementById('dash-investments-subtitle');
            if (dashSub) dashSub.textContent = `Total Portfolio: $${totalUSD.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
        }
    }
    console.log(`- computedInvestments: ${totalKRW}`);
    console.log(`[FinanceOS] Dashboard Render Complete`);

}

function updateAllocationChart() {
    const ctx = document.getElementById('allocationChart');
    if (!ctx || !chartInstances['allocationChart']) return;

    const allocation = {};
    investmentsState.forEach(asset => {
        const valUSD = asset.currency === 'USD' ? (asset.shares * asset.currentPrice) : (asset.shares * asset.currentPrice / usdToKrwRate);
        const name = asset.currency === 'USD' ? 'US Equities' : 'KR Equities'; 
        allocation[name] = (allocation[name] || 0) + valUSD;
    });

    const labels = Object.keys(allocation);
    const data = Object.values(allocation);

    chartInstances['allocationChart'].data.labels = labels;
    chartInstances['allocationChart'].data.datasets[0].data = data;
    chartInstances['allocationChart'].update();
}
// --- Category Management Logic ---
window.showCategoryManagement = function() {
    renderCategoryManagementList();
    document.getElementById('modal-cat-mgmt').style.display = 'flex';
};

window.moveCategory = function(index, direction) {
    const activeBudget = getActiveBudget();
    const targetIndex = index + direction;
    
    // Bounds check
    if (targetIndex < 0 || targetIndex >= activeBudget.categories.length) return;
    
    // Swap
    const temp = activeBudget.categories[index];
    activeBudget.categories[index] = activeBudget.categories[targetIndex];
    activeBudget.categories[targetIndex] = temp;
    
    saveData();
    renderCategoryManagementList();
    renderBudgetUI();
    if (typeof updateAllocationChart === 'function') updateAllocationChart();
};

function renderCategoryManagementList() {
    const list = document.getElementById('cat-mgmt-list');
    if (!list) return;
    list.innerHTML = '';
    
    const activeBudget = getActiveBudget();
    activeBudget.categories.forEach((cat, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === activeBudget.categories.length - 1;
        const html = `
            <div class="cat-mgmt-item">
                <div class="cat-info">
                    <div class="cat-color-dot" style="background: ${cat.colorHex}"></div>
                    <span class="cat-name">${cat.name}</span>
                </div>
                <div class="cat-actions" style="display: flex; gap: 4px;">
                    <button class="btn btn-icon" onclick="window.moveCategory(${idx}, -1)" ${isFirst ? 'disabled style="opacity:0.3"' : ''} title="Move Up">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><polyline points="18 15 12 9 6 15"></polyline></svg>
                    </button>
                    <button class="btn btn-icon" onclick="window.moveCategory(${idx}, 1)" ${isLast ? 'disabled style="opacity:0.3"' : ''} title="Move Down">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                    <div style="width: 1px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
                    <button class="btn btn-icon" onclick="window.showAddEditCategoryModal(${idx})" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn btn-icon" onclick="window.deleteCategory(${idx})" style="color: #ef4444;" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', html);
    });
}

// --- Currency Input Formatting Helper ---
window.formatCurrencyInput = function(input) {
    let cursorPosition = input.selectionStart;
    let oldVal = input.value;
    
    // Keep digits and at most one decimal point
    let rawValue = oldVal.replace(/[^0-9.]/g, '');
    let parts = rawValue.split('.');
    if (parts.length > 2) {
        parts = [parts[0], parts.slice(1).join('')];
    }
    
    let formattedValue = '';
    if (parts[0]) {
        formattedValue = parseInt(parts[0], 10).toLocaleString('en-US');
    }
    if (parts.length > 1) {
        formattedValue += '.' + parts[1];
    }
    
    // For trailing decimal point that user just typed
    if (oldVal.endsWith('.') && parts.length === 1 && formattedValue) {
        formattedValue += '.';
    }
    
    input.value = formattedValue;
    
    // Restore cursor position logic based on logical characters
    let validCharsBeforeCursor = (oldVal.substring(0, cursorPosition).replace(/[^0-9.]/g, '')).length;
    let newCursorPos = 0;
    let charsCounted = 0;
    
    if (validCharsBeforeCursor > 0) {
        for (let i = 0; i < formattedValue.length; i++) {
            if (/[0-9.]/.test(formattedValue[i])) {
                charsCounted++;
            }
            if (charsCounted === validCharsBeforeCursor) {
                newCursorPos = i + 1;
                break;
            }
        }
    }
    
    input.setSelectionRange(newCursorPos, newCursorPos);
};

// --- Helper for HSL to Hex ---
function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

window.showAddEditCategoryModal = function(index = null) {
    currentEditingCatIdx = index;
    const title = document.getElementById('cat-detail-title');
    const inputName = document.getElementById('cat-name-input');
    const inputLimit = document.getElementById('cat-limit-input-modal');
    const honeycombContainer = document.getElementById('honeycomb-picker-container');
    const hexInput = document.getElementById('cat-color-hex');
    
    const activeBudget = getActiveBudget();
    let initialColor = '#1E3A8A'; // Default Navy
    
    if (index !== null) {
        const cat = activeBudget.categories[index];
        title.textContent = '카테고리 편집';
        inputName.value = cat.name;
        if (inputLimit) inputLimit.value = cat.limit;
        initialColor = cat.colorHex || initialColor;
    } else {
        title.textContent = '새 카테고리 추가';
        inputName.value = '';
        if (inputLimit) inputLimit.value = '';
    }
    
    selectedColorHex = initialColor.toUpperCase();
    if (hexInput) hexInput.value = selectedColorHex;
    
    // Generate Honeycomb
    if (honeycombContainer) {
        honeycombContainer.innerHTML = '<div class="honeycomb-picker" id="honeycomb-grid"></div>';
        const grid = document.getElementById('honeycomb-grid');
        
        const hexRadius = 14;
        const hexWidth = Math.sqrt(3) * hexRadius; // ~24.2
        const rowHeight = 1.5 * hexRadius; // 21
        const center = 120; // Half of 240px container
        
        for (let q = -8; q <= 8; q++) {
            for (let r = -8; r <= 8; r++) {
                const x = center + hexWidth * (q + r/2);
                const y = center + rowHeight * r;
                
                const dist = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));
                if (dist < 115) { // Confine to circle
                    const angle = Math.atan2(y - center, x - center);
                    let hue = (angle * 180 / Math.PI + 360) % 360;
                    
                    // Saturation increases from center out
                    let sat = Math.min(100, (dist / 115) * 100 + 20); 
                    // Lightness shifts slightly so edge isn't completely black
                    let light = 80 - (dist / 115) * 40; // 80 (center) to 40 (edge)
                    
                    const hexColor = hslToHex(hue, sat, light);
                    const isActive = hexColor === selectedColorHex;
                    
                    const cell = document.createElement('div');
                    cell.className = `honeycomb-cell ${isActive ? 'active' : ''}`;
                    // Offset center properly: position represents center of cell
                    cell.style.left = `${x - 12}px`; // width 24/2
                    cell.style.top = `${y - 14}px`; // height 28/2
                    cell.style.backgroundColor = hexColor;
                    
                    cell.onclick = () => {
                        selectedColorHex = hexColor;
                        if (hexInput) hexInput.value = hexColor;
                        document.querySelectorAll('.honeycomb-cell').forEach(c => c.classList.remove('active'));
                        cell.classList.add('active');
                    };
                    
                    grid.appendChild(cell);
                }
            }
        }
    }
    
    if (hexInput) {
        hexInput.oninput = (e) => {
            let val = e.target.value;
            if (!val.startsWith('#')) val = '#' + val;
            if (/^#[0-9A-F]{6}$/i.test(val)) {
                selectedColorHex = val.toUpperCase();
                // We won't reconstruct the grid on manual type to avoid lag, but it will save correctly
            }
        };
    }
    
    document.getElementById('modal-cat-detail').style.display = 'flex';
};

window.saveCategory = function() {
    const nameInput = document.getElementById('cat-name-input');
    const limitInput = document.getElementById('cat-limit-input-modal');
    
    const newName = nameInput.value.trim();
    let newLimit = 0;
    if (limitInput) {
        newLimit = parseInt(limitInput.value.replace(/,/g, '')) || 0;
    }
    
    if (!newName) return alert('이름을 입력해주세요.');
    
    // Check for duplicates
    const activeBudget = getActiveBudget();
    const isDuplicate = activeBudget.categories.some((cat, idx) => cat.name === newName && idx !== currentEditingCatIdx);
    if (isDuplicate) return alert('이미 존재하는 카테고리 이름입니다.');
    
    if (currentEditingCatIdx !== null) {
        const oldName = activeBudget.categories[currentEditingCatIdx].name;
        
        // Update category in state
        activeBudget.categories[currentEditingCatIdx].name = newName;
        activeBudget.categories[currentEditingCatIdx].limit = newLimit;
        activeBudget.categories[currentEditingCatIdx].colorHex = selectedColorHex;
        
        // Update transactions if name changed
        if (oldName !== newName) {
            transactionsState.forEach(tx => {
                if (tx.category === oldName) tx.category = newName;
            });
        }
    } else {
        // Add new category
        activeBudget.categories.push({
            name: newName,
            spent: 0,
            limit: newLimit,
            colorHex: selectedColorHex
        });
    }
    
    saveData();
    renderCategoryManagementList();
    renderBudgetUI();
    renderConfirmedTransactions();
    if (typeof updateAllocationChart === 'function') updateAllocationChart();
    document.getElementById('modal-cat-detail').style.display = 'none';
};

window.deleteCategory = function(index) {
    const activeBudget = getActiveBudget();
    const cat = activeBudget.categories[index];
    const hasTransactions = transactionsState.some(tx => tx.category === cat.name);
    
    let msg = `"${cat.name}" 카테고리를 삭제하시겠습니까?`;
    if (hasTransactions) msg += `\n주의: 이 카테고리를 사용하는 내역이 있습니다. (해당 내역의 카테고리는 유지되지만 예산 관리에서는 제외됩니다.)`;
    
    if (confirm(msg)) {
        activeBudget.categories.splice(index, 1);
        saveData();
        renderCategoryManagementList();
        renderBudgetUI();
        renderConfirmedTransactions();
        if (typeof updateAllocationChart === 'function') updateAllocationChart();
    }
};

// --- Non-Blocking Banner UI ---
window.showSyncErrorBanner = function(message) {
    let banner = document.getElementById('sync-error-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'sync-error-banner';
        banner.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--danger, #ef4444);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 99999;
            font-size: 0.85rem;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 10px;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
        `;
        banner.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span class="banner-text">Sync Failed — Offline Mode</span>
        `;
        document.body.appendChild(banner);
    }
    
    // Trigger animation
    requestAnimationFrame(() => {
        banner.style.opacity = '1';
        banner.style.transform = 'translateY(0)';
    });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (banner) {
            banner.style.opacity = '0';
            banner.style.transform = 'translateY(-20px)';
            setTimeout(() => banner.remove(), 300);
        }
    }, 5000);
};
bootstrap();

// --- Category Detail Logic ---
window.toggleDetailSort = function(col) {
    if (detailSortCol === col) {
        detailSortOrder = (detailSortOrder === 'desc') ? 'asc' : 'desc';
    } else {
        detailSortCol = col;
        detailSortOrder = 'desc';
    }
    
    if (activeDetailCategory) {
        window.showCategoryDetail(activeDetailCategory);
    }
};

window.showCategoryDetail = function(categoryName) {
    if (!categoryName) return;
    activeDetailCategory = categoryName;
    const activeBudget = getActiveBudget();
    const cat = activeBudget.categories.find(c => c.name === categoryName);
    if (!cat) return;

    // Switch View
    window.switchView('category-detail');

    // Update Sorting UI
    const dateBtn = document.getElementById('detail-sort-date');
    const amtBtn = document.getElementById('detail-sort-amount');
    const dateIcon = document.getElementById('detail-sort-icon-date');
    const amtIcon = document.getElementById('detail-sort-icon-amount');

    if (dateBtn && amtBtn && dateIcon && amtIcon) {
        dateBtn.classList.toggle('active', detailSortCol === 'date');
        amtBtn.classList.toggle('active', detailSortCol === 'amount');
        
        dateIcon.textContent = detailSortCol === 'date' ? (detailSortOrder === 'desc' ? '▼' : '▲') : '↕';
        dateIcon.style.opacity = detailSortCol === 'date' ? '1' : '0.3';
        
        amtIcon.textContent = detailSortCol === 'amount' ? (detailSortOrder === 'desc' ? '▼' : '▲') : '↕';
        amtIcon.style.opacity = detailSortCol === 'amount' ? '1' : '0.3';
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const [year, month] = currentMonthView.split('-').map(Number);
    const currentMonthName = monthNames[month-1];

    const nameEl = document.getElementById('cat-detail-name');
    if (nameEl) nameEl.textContent = categoryName;

    const subtitleEl = document.getElementById('cat-detail-subtitle');
    if (subtitleEl) subtitleEl.textContent = `${currentMonthName} spending details`;

    // Update Summary Card
    const spentBigEl = document.getElementById('cat-detail-spent-big');
    if (spentBigEl) {
        spentBigEl.textContent = `${formatKRW(cat.spent)} / ${formatKRW(cat.limit)}`;
    }

    const pct = cat.limit > 0 ? (cat.spent / cat.limit) * 100 : 0;
    const progressEl = document.getElementById('cat-detail-progress');
    if (progressEl) {
        progressEl.style.width = `${Math.min(pct, 100)}%`;
        progressEl.style.backgroundColor = pct > 100 ? '#EF4444' : cat.colorHex;
    }

    const statusEl = document.getElementById('cat-detail-status-text');
    if (statusEl) statusEl.textContent = `예산 대비 ${Math.round(pct)}%`;

    // Render Filtered & Sorted Transactions
    const listWrap = document.getElementById('cat-detail-tx-list');
    if (listWrap) {
        listWrap.innerHTML = '';
        
        const isExpenseFn = (tx) => {
            const type = String(tx.type || tx.kind || '').toLowerCase();
            if (type.includes('income') || type.includes('수입') || type.includes('in')) return false;
            const rawAmt = tx.amount ?? tx.value ?? tx.price ?? tx.amt ?? 0;
            const amount = typeof rawAmt === 'string' ? parseFloat(rawAmt.replace(/[^0-9.-]/g, '')) : parseFloat(rawAmt);
            return amount < 0 || type.includes('expense') || type.includes('spending') || type.includes('지출') || type === '';
        };

        let filtered = transactionsState.filter(tx => tx.category === categoryName && isExpenseFn(tx));
        
        // Apply Month Filter
        filtered = filtered.filter(tx => {
            const normDate = normalizeDateValue(tx.date, currentMonthView);
            return normDate.startsWith(currentMonthView);
        });

        // Apply Sorting
        filtered.sort((a, b) => {
            if (detailSortCol === 'date') {
                const valA = normalizeDateValue(a.date, currentMonthView);
                const valB = normalizeDateValue(b.date, currentMonthView);
                return detailSortOrder === 'desc' ? valB.localeCompare(valA) : valA.localeCompare(valB);
            } else {
                return detailSortOrder === 'desc' ? (b.amount - a.amount) : (a.amount - b.amount);
            }
        });

        filtered.forEach(tx => {
            const activeBudget = getActiveBudget();
            const cat = activeBudget.categories.find(c => c.name === tx.category);
            const catColor = cat ? cat.colorHex : 'var(--accent-primary)';

            const row = document.createElement('tr');
            row.className = 'li-row';
            row.id = `tx-row-detail-${tx.id}`;
            row.setAttribute('data-tx-id', tx.id);
            row.setAttribute('onclick', `window.toggleTxActions(${tx.id}, event)`);
            
            row.innerHTML = `
                <td class="budget-date-cell">
                    <span class="li-date-short">${formatToMMDD(tx.date)}</span>
                </td>
                <td class="budget-merchant-cell">
                    <div class="li-color-bar" style="background: ${catColor};"></div>
                    <div class="li-content">
                        <div class="li-merchant">${tx.merchant}</div>
                        <div class="li-sub">
                            <span class="li-badge" style="background: ${catColor}15; color: ${catColor}; border: 1px solid ${catColor}30;">${tx.category}</span>
                        </div>
                    </div>
                </td>
                <td class="budget-amount-cell">
                    <span class="li-amount">${formatKRW(tx.amount)}</span>
                </td>
                <td class="budget-actions-cell">
                    <div class="row-actions">
                        <button class="action-btn edit" onclick="event.stopPropagation(); window.showTransactionDetail(${tx.id}); setupEditMode(${tx.id});" title="Edit">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="action-btn delete" onclick="event.stopPropagation(); if(confirm('이 거래 내역을 삭제하시겠습니까?')) window.deleteConfirmedTx(${tx.id});" title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </td>
            `;
            listWrap.appendChild(row);
        });
    }
};
