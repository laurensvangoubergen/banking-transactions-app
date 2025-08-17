#!/usr/bin/env node

/**
 * Database Connection Test Utility
 * Run this script to test your database connection before starting the main app
 * 
 * Usage: node test-db-connection.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function testDatabaseConnection() {
    console.log('🧪 Testing database connection...\n');
    
    const config = {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    };
    
    console.log(`📡 Connecting to: ${config.user}@${config.host}:${config.port}/${config.database}`);
    
    let connection;
    
    try {
        // Test connection
        connection = await mysql.createConnection(config);
        console.log('✅ Database connection successful!');
        
        // Test database exists
        const [databases] = await connection.execute(`SHOW DATABASES LIKE '${config.database}'`);
        if (databases.length === 0) {
            console.log(`❌ Database '${config.database}' does not exist!`);
            console.log('💡 Please create the database using the sql/init.sql script');
            return false;
        }
        console.log(`✅ Database '${config.database}' exists`);
        
        // Test tables exist
        const expectedTables = ['transactions', 'import_logs', 'categories', 'transaction_categories'];
        const [tables] = await connection.execute('SHOW TABLES');
        const tableNames = tables.map(t => Object.values(t)[0]);
        
        console.log('\n📋 Checking required tables:');
        let allTablesExist = true;
        
        for (const expectedTable of expectedTables) {
            if (tableNames.includes(expectedTable)) {
                console.log(`✅ Table '${expectedTable}' exists`);
            } else {
                console.log(`❌ Table '${expectedTable}' missing!`);
                allTablesExist = false;
            }
        }
        
        if (!allTablesExist) {
            console.log('\n💡 Please run the sql/init.sql script to create missing tables');
            return false;
        }
        
        // Test sample query
        const [transactionCount] = await connection.execute('SELECT COUNT(*) as count FROM transactions');
        console.log(`\n📊 Current transactions in database: ${transactionCount[0].count}`);
        
        const [categoryCount] = await connection.execute('SELECT COUNT(*) as count FROM categories');
        console.log(`📊 Categories in database: ${categoryCount[0].count}`);
        
        console.log('\n🎉 Database setup is complete and ready!');
        return true;
        
    } catch (error) {
        console.log(`❌ Database connection failed: ${error.message}\n`);
        
        if (error.code === 'ENOTFOUND') {
            console.log('💡 Check that DB_HOST in your .env file is correct');
            console.log('💡 Make sure your NAS is accessible from this machine');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('💡 Check DB_USER and DB_PASSWORD in your .env file');
            console.log('💡 Make sure the user has proper privileges');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('💡 Check that MariaDB is running on your NAS');
            console.log('💡 Verify DB_PORT is correct (usually 3306)');
        } else {
            console.log('💡 Full error details:', error);
        }
        
        return false;
        
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the test
testDatabaseConnection()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });