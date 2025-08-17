const Papa = require('papaparse');

class CSVParser {
    /**
     * Parse Belgian bank CSV file (Belfius format)
     * @param {string} csvContent - Raw CSV file content
     * @returns {Object} Parse result with transactions or error
     */
    async parseBelgianBankCSV(csvContent) {
        try {
            // Belgian CSV files use semicolon as delimiter and comma as decimal separator
            const parseConfig = {
                delimiter: ';',
                header: true,
                skipEmptyLines: true,
                encoding: 'UTF-8'
            };
            
            const parsed = Papa.parse(csvContent, parseConfig);
            
            if (parsed.errors && parsed.errors.length > 0) {
                console.error('CSV parsing errors:', parsed.errors);
                return {
                    success: false,
                    error: `CSV parsing failed: ${parsed.errors[0].message}`
                };
            }
            
            const rows = parsed.data;
            const transactions = [];
            
            // Find the header row (starts with "Rekening")
            let dataStartIndex = 0;
            for (let i = 0; i < rows.length; i++) {
                const firstCell = Object.values(rows[i])[0];
                if (firstCell && firstCell.toString().startsWith('BE')) {
                    dataStartIndex = i;
                    break;
                }
            }
            
            if (dataStartIndex === 0) {
                return {
                    success: false,
                    error: 'Could not find transaction data in CSV file'
                };
            }
            
            // Process data rows
            for (let i = dataStartIndex; i < rows.length; i++) {
                const row = rows[i];
                
                // Skip empty rows
                if (!row || !Object.values(row).some(val => val && val.toString().trim())) {
                    continue;
                }
                
                try {
                    const transaction = this.parseTransactionRow(row);
                    if (transaction) {
                        transactions.push(transaction);
                    }
                } catch (error) {
                    console.error(`Error parsing row ${i + 1}:`, error.message);
                    // Continue with other rows instead of failing completely
                }
            }
            
            if (transactions.length === 0) {
                return {
                    success: false,
                    error: 'No valid transactions found in CSV file'
                };
            }
            
            console.log(`📊 Parsed ${transactions.length} transactions from CSV`);
            
            return {
                success: true,
                transactions: transactions
            };
            
        } catch (error) {
            console.error('CSV parsing error:', error);
            return {
                success: false,
                error: `Failed to parse CSV: ${error.message}`
            };
        }
    }
    
    /**
     * Parse a single transaction row
     * @param {Object} row - CSV row object
     * @returns {Object|null} Parsed transaction or null if invalid
     */
    parseTransactionRow(row) {
        // Get values by expected column order (based on your CSV structure)
        const values = Object.values(row);
        
        const accountNumber = values[0]?.toString().trim();
        const bookingDateStr = values[1]?.toString().trim();
        const statementNumber = values[2]?.toString().trim();
        const transactionNumber = values[3]?.toString().trim();
        const counterpartAccount = values[4]?.toString().trim();
        const counterpartName = values[5]?.toString().trim();
        const counterpartAddress = values[6]?.toString().trim();
        const counterpartPostalCode = values[7]?.toString().trim();
        const transactionType = values[8]?.toString().trim();
        const valueDateStr = values[9]?.toString().trim();
        const amountStr = values[10]?.toString().trim();
        const currency = values[11]?.toString().trim() || 'EUR';
        const bic = values[12]?.toString().trim();
        const countryCode = values[13]?.toString().trim();
        const description = values[14]?.toString().trim();
        
        // Skip rows without essential data
        if (!accountNumber || !bookingDateStr || !amountStr) {
            return null;
        }
        
        // Parse dates (DD/MM/YYYY format)
        const bookingDate = this.parseDate(bookingDateStr);
        const valueDate = this.parseDate(valueDateStr);
        
        if (!bookingDate) {
            throw new Error(`Invalid booking date: ${bookingDateStr}`);
        }
        
        // Parse amount (Belgian format: comma as decimal separator)
        const amount = this.parseAmount(amountStr);
        
        if (amount === null) {
            throw new Error(`Invalid amount: ${amountStr}`);
        }
        
        // Extract postal code and city from counterpart address
        const { postalCode, city } = this.parsePostalCodeCity(counterpartPostalCode);
        
        // Generate reference number from description if not provided
        const referenceNumber = this.extractReference(description) || transactionNumber;
        
        return {
            accountNumber: accountNumber,
            statementNumber: statementNumber || null,
            transactionNumber: transactionNumber || null,
            bookingDate: bookingDate,
            valueDate: valueDate,
            counterpartAccount: counterpartAccount || null,
            counterpartName: counterpartName || null,
            counterpartAddress: counterpartAddress || null,
            counterpartPostalCode: postalCode,
            counterpartCity: city,
            transactionType: transactionType || null,
            amount: amount,
            currency: currency,
            bic: bic || null,
            countryCode: countryCode || null,
            description: description || null,
            referenceNumber: referenceNumber
        };
    }
    
    /**
     * Parse date in DD/MM/YYYY format
     * @param {string} dateStr - Date string
     * @returns {string|null} Date in YYYY-MM-DD format or null if invalid
     */
    parseDate(dateStr) {
        if (!dateStr || dateStr.trim() === '') return null;
        
        const parts = dateStr.split('/');
        if (parts.length !== 3) return null;
        
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        
        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
        if (day < 1 || day > 31 || month < 1 || month > 12) return null;
        
        // Convert to YYYY-MM-DD format
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
    
    /**
     * Parse amount in Belgian format (comma as decimal separator)
     * @param {string} amountStr - Amount string
     * @returns {number|null} Parsed amount or null if invalid
     */
    parseAmount(amountStr) {
        if (!amountStr || amountStr.trim() === '') return null;
        
        // Remove any currency symbols and whitespace
        let cleaned = amountStr.replace(/[^\d,.-]/g, '');
        
        // Handle Belgian format: comma as decimal separator
        // Replace comma with dot for parsing
        cleaned = cleaned.replace(',', '.');
        
        const amount = parseFloat(cleaned);
        return isNaN(amount) ? null : amount;
    }
    
    /**
     * Extract postal code and city from combined string
     * @param {string} postalCodeCity - Combined postal code and city
     * @returns {Object} Object with postalCode and city
     */
    parsePostalCodeCity(postalCodeCity) {
        if (!postalCodeCity || postalCodeCity.trim() === '') {
            return { postalCode: null, city: null };
        }
        
        // Pattern: "2600  BERCHEM" or "1000  BRUSSEL"
        const match = postalCodeCity.match(/^(\d+)\s+(.+)$/);
        if (match) {
            return {
                postalCode: match[1].trim(),
                city: match[2].trim()
            };
        }
        
        // If no match, treat entire string as city
        return {
            postalCode: null,
            city: postalCodeCity.trim()
        };
    }
    
    /**
     * Extract reference number from description
     * @param {string} description - Transaction description
     * @returns {string|null} Reference number or null if not found
     */
    extractReference(description) {
        if (!description) return null;
        
        // Look for "REF. :" pattern
        const refMatch = description.match(/REF\.\s*:\s*([^\s]+)/);
        if (refMatch) {
            return refMatch[1];
        }
        
        // Look for other reference patterns
        const payconiqMatch = description.match(/Payconiq\s+([a-f0-9]+)/);
        if (payconiqMatch) {
            return payconiqMatch[1];
        }
        
        return null;
    }
}

module.exports = new CSVParser();