const express = require("express");
const { getDb } = require("../database/db");
const { getId } = require("../helpers");

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
        const id = getId(req.params.id);

        if (!id) {
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

// CREATE RENTAL  ->  POST /api/rentals
// TWIST: a trekker can hold at most 3 active rentals
router.post("/", async (req, res) => {
    try {
        const db = getDb();
        const body = req.body || {};

        const trekkerId = getId(body.trekker_id);
        const tentId = getId(body.tent_id);

        if (!trekkerId || !tentId) {
            return res.status(400).json({
                success: false,
                message: "Valid trekker_id and tent_id are required"
            });
        }

        // 1. Does the trekker exist?
        const trekker = await db.get("SELECT id FROM trekkers WHERE id = ?", [trekkerId]);

        if (!trekker) {
            return res.status(404).json({ success: false, message: "Trekker not found" });
        }

        // 2. Three-at-a-time rule: count the active rentals
        const active = await db.get(
            "SELECT COUNT(*) AS total FROM rentals WHERE trekker_id = ? AND status = 'active'",
            [trekkerId]
        );

        if (active.total >= 3) {
            return res.status(409).json({ success: false, message: "Limit of 3 reached" });
        }

        // 3. Does the tent exist and can it be rented?
        const tent = await db.get("SELECT * FROM tents WHERE id = ?", [tentId]);

        if (!tent) {
            return res.status(404).json({ success: false, message: "Tent not found" });
        }

        if (tent.condition !== "good") {
            return res.status(409).json({ success: false, message: "Damaged tent cannot be rented" });
        }

        if (tent.status !== "available") {
            return res.status(409).json({
                success: false,
                message: "Tent is not available for rental"
            });
        }

        // 4. Create the rental and mark the tent as rented
        const result = await db.run(
            "INSERT INTO rentals (trekker_id, tent_id, status) VALUES (?, ?, 'active')",
            [trekkerId, tentId]
        );

        await db.run("UPDATE tents SET status = 'rented' WHERE id = ?", [tentId]);

        res.status(201).json({
            success: true,
            message: "Rental created successfully",
            data: {
                id: result.lastID,
                trekker_id: trekkerId,
                tent_id: tentId,
                status: "active"
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to create rental" });
    }
});

// RETURN RENTAL  ->  PUT /api/rentals/:id/return
// Returning a tent frees one of the 3 places
router.put("/:id/return", async (req, res) => {
    try {
        const db = getDb();
        const id = getId(req.params.id);

        if (!id) {
            return res.status(400).json({ success: false, message: "Invalid rental ID" });
        }

        const rental = await db.get("SELECT * FROM rentals WHERE id = ?", [id]);

        if (!rental) {
            return res.status(404).json({ success: false, message: "Rental not found" });
        }

        if (rental.status === "returned") {
            return res.status(409).json({
                success: false,
                message: "This rental has already been returned"
            });
        }

        const tent = await db.get("SELECT condition FROM tents WHERE id = ?", [rental.tent_id]);

        // A tent that came back damaged goes to maintenance
        const tentStatus = tent && tent.condition === "damaged" ? "maintenance" : "available";

        await db.run(
            "UPDATE rentals SET status = 'returned', return_date = CURRENT_TIMESTAMP WHERE id = ?",
            [id]
        );

        await db.run("UPDATE tents SET status = ? WHERE id = ?", [tentStatus, rental.tent_id]);

        res.status(200).json({
            success: true,
            message: "Rental returned successfully",
            data: { rental_id: id, status: "returned", tent_status: tentStatus }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to return rental" });
    }
});

// DELETE RENTAL  ->  DELETE /api/rentals/:id
router.delete("/:id", async (req, res) => {
    try {
        const db = getDb();
        const id = getId(req.params.id);

        if (!id) {
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
