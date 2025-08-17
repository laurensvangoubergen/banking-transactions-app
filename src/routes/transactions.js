const express = require('express');
const database = require('../config/database');

const router = express.Router();

// GET /api/transactions - Get all transactions with pagination
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        
        const accountNumber = req.query.account;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        
        let whereClause = 'WHERE 1=1';
        const params = [];
        
        if (accountNumber) {
            whereClause += ' AND account_number = ?';
            params.push(accountNumber);
        }
        
        if (startDate) {
            whereClause += ' AND booking_date >= ?';
            params.push(startDate);
        }
        
        if (endDate) {
            whereClause += ' AND booking_date <= ?';
            params.push(endDate);
        }
        
        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM transactions ${whereClause}`;
        const countResult = await database.query(countQuery, params);
        const total = countResult[0].total;
        
        // Get transactions
        const query = `
            SELECT * FROM transactions 
            ${whereClause} 
            ORDER BY booking_date DESC, id DESC 
            LIMIT ? OFFSET ?
        `;
        params.push(limit, offset);
        
        const transactions = await database.query(query, params);
        
        res.json({
            transactions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// GET /api/transactions/stats - Get transaction statistics
router.get('/stats', async (req, res) => {
    try {
        const accountNumber = req.query.account;
        
        let whereClause = 'WHERE 1=1';
        const params = [];
        
        if (accountNumber) {
            whereClause += ' AND account_number = ?';
            params.push(accountNumber);
        }
        
        const statsQuery = `
            SELECT 
                COUNT(*) as total_transactions,
                COUNT(DISTINCT account_number) as accounts_count,
                SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income,
                SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_expenses,
                MIN(booking_date) as earliest_transaction,
                MAX(booking_date) as latest_transaction,
                AVG(CASE WHEN amount < 0 THEN ABS(amount) ELSE NULL END) as avg_expense,
                AVG(CASE WHEN amount > 0 THEN amount ELSE NULL END) as avg_income
            FROM transactions ${whereClause}
        `;
        
        const stats = await database.query(statsQuery, params);
        
        res.json(stats[0]);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// GET /api/transactions/accounts - Get list of accounts
router.get('/accounts', async (req, res) => {
    try {
        const query = `
            SELECT 
                account_number,
                COUNT(*) as transaction_count,
                MIN(booking_date) as first_transaction,
                MAX(booking_date) as last_transaction,
                SUM(amount) as balance
            FROM transactions 
            GROUP BY account_number
            ORDER BY last_transaction DESC
        `;
        
        const accounts = await database.query(query);
        res.json(accounts);
    } catch (error) {
        console.error('Error fetching accounts:', error);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
});

// GET /api/transactions/:id - Get single transaction
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = 'SELECT * FROM transactions WHERE id = ?';
        const transactions = await database.query(query, [id]);
        
        if (transactions.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        res.json(transactions[0]);
    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({ error: 'Failed to fetch transaction' });
    }
});

// DELETE /api/transactions/:id - Delete single transaction
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = 'DELETE FROM transactions WHERE id = ?';
        const result = await database.query(query, [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

module.exports = router;