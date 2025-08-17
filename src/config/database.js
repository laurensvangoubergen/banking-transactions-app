const mysql = require('mysql2/promise');

class Database {
    constructor() {
        this.pool = null;
        this.validateConfig();
        
        this.config = {
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            acquireTimeout: 60000,
            timeout: 60000,
            charset: 'utf8mb4',
            timezone: '+00:00', // Store dates in UTC
            dateStrings: false
        };
    }

    validateConfig() {
        const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}\nPlease check your .env file.`);
        }
    }

    async initialize() {
        try {
            console.log(`🔌 Connecting to database at ${this.config.host}:${this.config.port}...`);
            
            this.pool = mysql.createPool(this.config);
            
            // Test the connection
            const connection = await this.pool.getConnection();
            console.log('✅ Database connected successfully');
            connection.release();
            
            return this.pool;
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            throw error;
        }
    }

    getPool() {
        if (!this.pool) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.pool;
    }

    async query(sql, params = []) {
        try {
            const [results] = await this.pool.execute(sql, params);
            return results;
        } catch (error) {
            console.error('Database query error:', error.message);
            throw error;
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            console.log('🔌 Database connection closed');
        }
    }
}

// Singleton instance
const database = new Database();
module.exports = database;