const express = require("express");
const { getDb } = require("../database/db");

const router = express.Router();

// GET ALL RENTALS  ->  GET /api/rentals
router.get("/", async (req, res) => {
    try {
        const db = getDb();
        const rentals = await db.all("SELECT * FROM rentals ORDER BY id");

        res.status(200).json({ success: true, count: rentals.length, data: rentals });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to fetch rentals" });
    }
});

// JOIN ENDPOINT  ->  GET /api/rentals/details
// Rentals with the trekker name and the tent name
// (keep this route ABOVE /:id, otherwise "details" is read as an id)
router.get("/details", async (req, res) => {
    try {
        const db = getDb();

        const rentals = await db.all(`
            SELECT
                rentals.id AS rental_id,
                trekkers.id AS trekker_id,
                trekkers.name AS trekker_name,
                trekkers.email AS trekker_email,
                tents.id AS tent_id,
                tents.name AS tent_name,
                tents.size AS tent_size,
                rentals.rental_date,
                rentals.return_date,
                rentals.status AS rental_status
            FROM rentals
            INNER JOIN trekkers ON rentals.trekker_id = trekkers.id
            INNER JOIN tents ON rentals.tent_id = tents.id
            ORDER BY rentals.id
        `);

        res.status(200).json({ success: true, count: rentals.length, data: rentals });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to fetch rental details" });
    }
});

// GET ONE RENTAL  ->  GET /api/rentals/:id
router.get("/:id", async (req, res) => {
    try {
        const db = getDb();
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "Invalid rental ID" });
        }

        const rental = await db.get("SELECT * FROM rentals WHERE id = ?", [id]);

        if (!rental) {
            return res.status(404).json({ success: false, message: "Rental not found" });
        }

        res.status(200).json({ success: true, data: rental });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to fetch rental" });
    }
});

// DELETE RENTAL  ->  DELETE /api/rentals/:id
router.delete("/:id", async (req, res) => {
    try {
        const db = getDb();
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "Invalid rental ID" });
        }

        const rental = await db.get("SELECT * FROM rentals WHERE id = ?", [id]);

        if (!rental) {
            return res.status(404).json({ success: false, message: "Rental not found" });
        }

        // If the rental was still active, free the tent again
        if (rental.status === "active") {
            const tent = await db.get("SELECT condition FROM tents WHERE id = ?", [rental.tent_id]);
            const tentStatus = tent && tent.condition === "damaged" ? "maintenance" : "available";

            await db.run("UPDATE tents SET status = ? WHERE id = ?", [tentStatus, rental.tent_id]);
        }

        await db.run("DELETE FROM rentals WHERE id = ?", [id]);

        res.status(200).json({ success: true, message: "Rental deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to delete rental" });
    }
});

module.exports = router;
