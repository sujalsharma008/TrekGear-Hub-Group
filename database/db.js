const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");

const DB_PATH = path.join(__dirname, "trekgear.db");

let db;

// Opens the database, creates the 3 tables and adds sample data
async function initializeDatabase() {
    db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    // Turn on foreign key checking
    await db.exec("PRAGMA foreign_keys = ON");

    // Create the three tables
    await db.exec(`
        CREATE TABLE IF NOT EXISTS trekkers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            phone TEXT
        );

        CREATE TABLE IF NOT EXISTS tents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            size TEXT NOT NULL,
            condition TEXT NOT NULL DEFAULT 'good'
                CHECK(condition IN ('good', 'damaged')),
            status TEXT NOT NULL DEFAULT 'available'
                CHECK(status IN ('available', 'rented', 'maintenance'))
        );

        CREATE TABLE IF NOT EXISTS rentals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trekker_id INTEGER NOT NULL,
            tent_id INTEGER NOT NULL,
            rental_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            return_date TEXT,
            status TEXT NOT NULL DEFAULT 'active'
                CHECK(status IN ('active', 'returned')),
            FOREIGN KEY (trekker_id) REFERENCES trekkers(id),
            FOREIGN KEY (tent_id) REFERENCES tents(id)
        );
    `);

    // Sample trekkers (only when the table is empty)
    const trekkerCount = await db.get("SELECT COUNT(*) AS count FROM trekkers");

    if (trekkerCount.count === 0) {
        await db.exec(`
            INSERT INTO trekkers (name, email, phone) VALUES
            ('Asha', 'asha@example.com', '9876543210'),
            ('Rahul', 'rahul@example.com', '9876543211'),
            ('Priya', 'priya@example.com', '9876543212');
        `);
    }

    // Sample tents (only when the table is empty)
    const tentCount = await db.get("SELECT COUNT(*) AS count FROM tents");

    if (tentCount.count === 0) {
        await db.exec(`
            INSERT INTO tents (name, size, condition, status) VALUES
            ('Mountain Pro', 'large', 'good', 'available'),
            ('Forest Camp', 'medium', 'good', 'available'),
            ('Adventure Lite', 'small', 'good', 'available'),
            ('Summit Shelter', 'large', 'good', 'available'),
            ('Trail Master', 'medium', 'good', 'available'),
            ('Old Explorer', 'small', 'damaged', 'maintenance');
        `);
    }

    console.log("Database ready");
    return db;
}

// Returns the open database connection
function getDb() {
    if (!db) {
        throw new Error("Database is not initialized");
    }
    return db;
}

module.exports = { initializeDatabase, getDb };
