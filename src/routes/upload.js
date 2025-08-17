const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const csvParser = require('../services/csvParser');
const database = require('../config/database');

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Accept CSV files only
    if (file.mimetype === 'text/csv' || 
        file.mimetype === 'application/csv' ||
        file.originalname.toLowerCase().endsWith('.csv')) {
        cb(null, true);
    } else {
        cb(new Error('Only CSV files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
    }
});

// POST /api/upload - Upload and process CSV file
router.post('/', upload.single('csvFile'), async (req, res) => {
    let filePath = null;
    
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        filePath = req.file.path;
        const originalName = req.file.originalname;
        
        console.log(`📄 Processing uploaded file: ${originalName}`);
        
        // Calculate file hash to prevent duplicates
        const fileBuffer = await fs.readFile(filePath);
        const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
        
        // Check if file was already processed
        const existingLog = await database.query(
            'SELECT * FROM import_logs WHERE file_hash = ?',
            [fileHash]
        );
        
        if (existingLog.length > 0) {
            await fs.unlink(filePath); // Clean up uploaded file
            return res.status(409).json({ 
                error: 'File already processed',
                importDate: existingLog[0].imported_at
            });
        }
        
        // Create import log entry
        const logResult = await database.query(
            'INSERT INTO import_logs (filename, file_hash, import_status) VALUES (?, ?, ?)',
            [originalName, fileHash, 'processing']
        );
        const logId = logResult.insertId;
        
        // Parse CSV file
        const fileContent = fileBuffer.toString('utf-8');
        const parseResult = await csvParser.parseBelgianBankCSV(fileContent);
        
        if (!parseResult.success) {
            await database.query(
                'UPDATE import_logs SET import_status = ?, error_message = ? WHERE id = ?',
                ['failed', parseResult.error, logId]
            );
            await fs.unlink(filePath);
            return res.status(400).json({ error: parseResult.error });
        }
        
        const transactions = parseResult.transactions;
        let importedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const errors = [];
        
        // Process each transaction
        for (let i = 0; i < transactions.length; i++) {
            try {
                const transaction = transactions[i];
                
                const insertQuery = `
                    INSERT INTO transactions (
                        account_number, statement_number, transaction_number,
                        booking_date, value_date, counterpart_account, counterpart_name,
                        counterpart_address, counterpart_postal_code, counterpart_city,
                        transaction_type, amount, currency, bic, country_code,
                        description, reference_number, file_hash
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                await database.query(insertQuery, [
                    transaction.accountNumber,
                    transaction.statementNumber,
                    transaction.transactionNumber,
                    transaction.bookingDate,
                    transaction.valueDate,
                    transaction.counterpartAccount,
                    transaction.counterpartName,
                    transaction.counterpartAddress,
                    transaction.counterpartPostalCode,
                    transaction.counterpartCity,
                    transaction.transactionType,
                    transaction.amount,
                    transaction.currency,
                    transaction.bic,
                    transaction.countryCode,
                    transaction.description,
                    transaction.referenceNumber,
                    fileHash
                ]);
                
                importedCount++;
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY') {
                    skippedCount++;
                } else {
                    errorCount++;
                    errors.push({
                        row: i + 1,
                        error: error.message
                    });
                    console.error(`Error importing transaction ${i + 1}:`, error.message);
                }
            }
        }
        
        // Update import log
        await database.query(
            `UPDATE import_logs SET 
                total_records = ?, imported_records = ?, skipped_records = ?, 
                error_records = ?, import_status = ?, completed_at = NOW(),
                error_message = ?
            WHERE id = ?`,
            [
                transactions.length, 
                importedCount, 
                skippedCount, 
                errorCount,
                errorCount === 0 ? 'completed' : 'completed',
                errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null, // Store first 10 errors
                logId
            ]
        );
        
        // Clean up uploaded file
        await fs.unlink(filePath);
        
        console.log(`✅ Import completed: ${importedCount} imported, ${skippedCount} skipped, ${errorCount} errors`);
        
        res.json({
            success: true,
            summary: {
                totalRecords: transactions.length,
                imported: importedCount,
                skipped: skippedCount,
                errors: errorCount
            },
            errors: errors.slice(0, 5) // Return first 5 errors only
        });
        
    } catch (error) {
        console.error('Upload processing error:', error);
        
        // Clean up uploaded file on error
        if (filePath) {
            try {
                await fs.unlink(filePath);
            } catch (cleanupError) {
                console.error('Error cleaning up file:', cleanupError);
            }
        }
        
        res.status(500).json({ 
            error: 'Failed to process file',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/upload/history - Get import history
router.get('/history', async (req, res) => {
    try {
        const query = `
            SELECT 
                id, filename, total_records, imported_records, 
                skipped_records, error_records, import_status,
                imported_at, completed_at
            FROM import_logs 
            ORDER BY imported_at DESC 
            LIMIT 50
        `;
        
        const history = await database.query(query);
        res.json(history);
    } catch (error) {
        console.error('Error fetching import history:', error);
        res.status(500).json({ error: 'Failed to fetch import history' });
    }
});

module.exports = router;