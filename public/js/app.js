// Banking Transactions Manager - Frontend Application

class BankingApp {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 50;
        this.currentFilters = {};
        this.transactions = [];
        this.accounts = [];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadInitialData();
    }
    
    setupEventListeners() {
        // File upload
        const fileInput = document.getElementById('csvFileInput');
        const uploadBtn = document.getElementById('uploadBtn');
        const uploadArea = document.getElementById('uploadArea');
        
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        
        // Drag and drop
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadArea.addEventListener('drop', this.handleFileDrop.bind(this));
        
        // Filters
        document.getElementById('applyFilters').addEventListener('click', this.applyFilters.bind(this));
        document.getElementById('clearFilters').addEventListener('click', this.clearFilters.bind(this));
        
        // Pagination
        document.getElementById('prevPage').addEventListener('click', () => this.changePage(this.currentPage - 1));
        document.getElementById('nextPage').addEventListener('click', () => this.changePage(this.currentPage + 1));
        
        // Search on Enter
        document.getElementById('searchText').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.applyFilters();
            }
        });
    }
    
    async loadInitialData() {
        try {
            await Promise.all([
                this.loadTransactions(),
                this.loadStatistics(),
                this.loadAccounts()
            ]);
        } catch (error) {
            this.showToast('Error loading data', error.message, 'error');
        }
    }
    
    // File Upload Handlers
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.uploadFile(file);
        }
    }
    
    handleDragOver(event) {
        event.preventDefault();
        event.currentTarget.classList.add('dragover');
    }
    
    handleDragLeave(event) {
        event.currentTarget.classList.remove('dragover');
    }
    
    handleFileDrop(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('dragover');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
                this.uploadFile(file);
            } else {
                this.showToast('Invalid file type', 'Please select a CSV file', 'error');
            }
        }
    }
    
    async uploadFile(file) {
        const progressContainer = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const resultsContainer = document.getElementById('uploadResults');
        
        // Show progress
        progressContainer.style.display = 'block';
        resultsContainer.style.display = 'none';
        progressFill.style.width = '0%';
        progressText.textContent = 'Preparing upload...';
        
        try {
            const formData = new FormData();
            formData.append('csvFile', file);
            
            // Simulate progress
            progressFill.style.width = '30%';
            progressText.textContent = 'Uploading file...';
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            progressFill.style.width = '70%';
            progressText.textContent = 'Processing transactions...';
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }
            
            // Complete progress
            progressFill.style.width = '100%';
            progressText.textContent = 'Upload complete!';
            
            // Show results
            setTimeout(() => {
                this.showUploadResults(result);
                this.loadInitialData(); // Refresh data
            }, 500);
            
            this.showToast('Upload successful', 
                `Imported ${result.summary.imported} transactions`, 'success');
            
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast('Upload failed', error.message, 'error');
            progressContainer.style.display = 'none';
        }
    }
    
    showUploadResults(result) {
        const resultsContainer = document.getElementById('uploadResults');
        const resultsSummary = document.getElementById('resultsSummary');
        const resultsErrors = document.getElementById('resultsErrors');
        
        // Show summary
        resultsSummary.innerHTML = `
            <div class="results-summary">
                <div class="result-stat">
                    <div class="number">${result.summary.totalRecords}</div>
                    <div class="label">Total Records</div>
                </div>
                <div class="result-stat">
                    <div class="number" style="color: var(--success-color)">${result.summary.imported}</div>
                    <div class="label">Imported</div>
                </div>
                <div class="result-stat">
                    <div class="number" style="color: var(--warning-color)">${result.summary.skipped}</div>
                    <div class="label">Skipped</div>
                </div>
                <div class="result-stat">
                    <div class="number" style="color: var(--danger-color)">${result.summary.errors}</div>
                    <div class="label">Errors</div>
                </div>
            </div>
        `;
        
        // Show errors if any
        if (result.errors && result.errors.length > 0) {
            resultsErrors.innerHTML = `
                <div style="margin-top: 1rem;">
                    <h4 style="color: var(--danger-color); margin-bottom: 0.5rem;">
                        <i class="fas fa-exclamation-triangle"></i> Import Errors
                    </h4>
                    <ul style="color: var(--text-secondary); font-size: 0.875rem;">
                        ${result.errors.map(error => `<li>Row ${error.row}: ${error.error}</li>`).join('')}
                    </ul>
                </div>
            `;
        } else {
            resultsErrors.innerHTML = '';
        }
        
        resultsContainer.style.display = 'block';
    }
    
    // Data Loading
    async loadTransactions() {
        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.itemsPerPage,
                ...this.currentFilters
            });
            
            const response = await fetch(`/api/transactions?${params}`);
            if (!response.ok) throw new Error('Failed to load transactions');
            
            const data = await response.json();
            this.transactions = data.transactions;
            
            this.renderTransactions(data.transactions);
            this.updatePagination(data.pagination);
            
        } catch (error) {
            console.error('Error loading transactions:', error);
            this.showToast('Error', 'Failed to load transactions', 'error');
        }
    }
    
    async loadStatistics() {
        try {
            const params = new URLSearchParams(this.currentFilters);
            const response = await fetch(`/api/transactions/stats?${params}`);
            if (!response.ok) throw new Error('Failed to load statistics');
            
            const stats = await response.json();
            this.renderStatistics(stats);
            
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }
    
    async loadAccounts() {
        try {
            const response = await fetch('/api/transactions/accounts');
            if (!response.ok) throw new Error('Failed to load accounts');
            
            const accounts = await response.json();
            this.accounts = accounts;
            this.renderAccountFilter(accounts);
            
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    }
    
    // Rendering Methods
    renderTransactions(transactions) {
        const tbody = document.getElementById('transactionsBody');
        const countElement = document.getElementById('transactionCount');
        
        if (transactions.length === 0) {
            tbody.innerHTML = `
                <tr class="no-data">
                    <td colspan="6">
                        <div class="no-data-content">
                            <i class="fas fa-inbox"></i>
                            <p>No transactions found</p>
                        </div>
                    </td>
                </tr>
            `;
            countElement.textContent = '0 transactions';
            return;
        }
        
        tbody.innerHTML = transactions.map(transaction => `
            <tr>
                <td>${this.formatDate(transaction.booking_date)}</td>
                <td>
                    <div style="font-weight: 500;">${transaction.counterpart_name || 'N/A'}</div>
                    ${transaction.counterpart_account ? 
                        `<div style="font-size: 0.75rem; color: var(--text-muted);">${transaction.counterpart_account}</div>` : 
                        ''
                    }
                </td>
                <td>
                    <div style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;" 
                         title="${transaction.description || ''}">${this.truncateText(transaction.description || 'N/A', 50)}</div>
                </td>
                <td>
                    <span class="amount ${transaction.amount >= 0 ? 'positive' : 'negative'}">
                        ${this.formatAmount(transaction.amount, transaction.currency)}
                    </span>
                </td>
                <td>
                    ${transaction.transaction_type ? 
                        `<span class="transaction-type">${this.truncateText(transaction.transaction_type, 15)}</span>` : 
                        'N/A'
                    }
                </td>
                <td>
                    <button class="btn btn-outline" onclick="app.deleteTransaction(${transaction.id})" 
                            style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" 
                            title="Delete transaction">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        countElement.textContent = `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`;
    }
    
    renderStatistics(stats) {
        document.getElementById('totalIncome').textContent = this.formatAmount(stats.total_income || 0);
        document.getElementById('totalExpenses').textContent = this.formatAmount(stats.total_expenses || 0);
        document.getElementById('netBalance').textContent = this.formatAmount((stats.total_income || 0) - (stats.total_expenses || 0));
        document.getElementById('totalTransactions').textContent = stats.total_transactions || 0;
    }
    
    renderAccountFilter(accounts) {
        const select = document.getElementById('accountFilter');
        select.innerHTML = '<option value="">All Accounts</option>' +
            accounts.map(account => 
                `<option value="${account.account_number}">${account.account_number} (${account.transaction_count} transactions)</option>`
            ).join('');
    }
    
    updatePagination(pagination) {
        const paginationContainer = document.getElementById('pagination');
        const paginationInfo = document.getElementById('paginationInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        if (pagination.totalPages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }
        
        paginationContainer.style.display = 'flex';
        paginationInfo.textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
        
        prevBtn.disabled = pagination.page <= 1;
        nextBtn.disabled = pagination.page >= pagination.totalPages;
    }
    
    // Filter and Search
    applyFilters() {
        this.currentFilters = {
            account: document.getElementById('accountFilter').value,
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            search: document.getElementById('searchText').value
        };
        
        // Remove empty filters
        Object.keys(this.currentFilters).forEach(key => {
            if (!this.currentFilters[key]) {
                delete this.currentFilters[key];
            }
        });
        
        this.currentPage = 1;
        this.loadTransactions();
        this.loadStatistics();
    }
    
    clearFilters() {
        document.getElementById('accountFilter').value = '';
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        document.getElementById('searchText').value = '';
        
        this.currentFilters = {};
        this.currentPage = 1;
        this.loadTransactions();
        this.loadStatistics();
    }
    
    // Pagination
    changePage(page) {
        this.currentPage = page;
        this.loadTransactions();
    }
    
    // Transaction Actions
    async deleteTransaction(id) {
        if (!confirm('Are you sure you want to delete this transaction?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/transactions/${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete transaction');
            }
            
            this.showToast('Success', 'Transaction deleted successfully', 'success');
            this.loadInitialData(); // Refresh data
            
        } catch (error) {
            console.error('Delete error:', error);
            this.showToast('Error', 'Failed to delete transaction', 'error');
        }
    }
    
    // Utility Methods
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return dateString;
        }
    }
    
    formatAmount(amount, currency = 'EUR') {
        if (amount === null || amount === undefined) return 'N/A';
        
        const formatter = new Intl.NumberFormat('nl-BE', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        return formatter.format(amount);
    }
    
    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    // Toast Notifications
    showToast(title, message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const iconMap = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        toast.innerHTML = `
            <i class="${iconMap[type]}"></i>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add event listener for close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.removeToast(toast);
        });
        
        container.appendChild(toast);
        
        // Show toast with animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Auto-remove after 5 seconds
        setTimeout(() => this.removeToast(toast), 5000);
    }
    
    removeToast(toast) {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

// Initialize the application
const app = new BankingApp();