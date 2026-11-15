const express = require("express");
const { getDb } = require("../database/db");

const router = express.Router();

// GET ALL TENTS  ->  GET /api/tents
router.get("/", async (req, res) => {
    try {
        const db = getDb();
        const tents = await db.all("SELECT * FROM tents ORDER BY id");

        res.status(200).json({ success: true, count: tents.length, data: tents });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to fetch tents" });
    }
});

// GET ONE TENT  ->  GET /api/tents/:id
router.get("/:id", async (req, res) => {
    try {
        const db = getDb();
        const tent = await db.get("SELECT * FROM tents WHERE id = ?", [req.params.id]);

        if (!tent) {
            return res.status(404).json({ success: false, message: "Tent not found" });
        }

        res.status(200).json({ success: true, data: tent });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to fetch tent" });
    }
});

// ADD TENT  ->  POST /api/tents
router.post("/", async (req, res) => {
    try {
        const db = getDb();
        const body = req.body || {};
        const { name, size } = body;
        const condition = body.condition ?? "good";

        // A damaged tent goes to maintenance, so it cannot be rented
        const status = condition === "damaged" ? "maintenance" : "available";

        const result = await db.run(
            "INSERT INTO tents (name, size, condition, status) VALUES (?, ?, ?, ?)",
            [name, size, condition, status]
        );

        res.status(201).json({
            success: true,
            message: "Tent created successfully",
            data: { id: result.lastID, name, size, condition, status }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to create tent" });
    }
});

// UPDATE TENT  ->  PUT /api/tents/:id
router.put("/:id", async (req, res) => {
    try {
        const db = getDb();
        const old = await db.get("SELECT * FROM tents WHERE id = ?", [req.params.id]);

        if (!old) {
            return res.status(404).json({ success: false, message: "Tent not found" });
        }

        const body = req.body || {};
        const name = body.name ?? old.name;
        const size = body.size ?? old.size;
        const condition = body.condition ?? old.condition;

        // Keep "rented" while rented, otherwise follow the condition
        let status;
        if (old.status === "rented") {
            status = "rented";
        } else if (condition === "damaged") {
            status = "maintenance";
        } else {
            status = "available";
        }

        await db.run(
            "UPDATE tents SET name = ?, size = ?, condition = ?, status = ? WHERE id = ?",
            [name, size, condition, status, old.id]
        );

        res.status(200).json({ success: true, message: "Tent updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to update tent" });
    }
});

// DELETE TENT  ->  DELETE /api/tents/:id
router.delete("/:id", async (req, res) => {
    try {
        const db = getDb();
        const tent = await db.get("SELECT * FROM tents WHERE id = ?", [req.params.id]);

        if (!tent) {
            return res.status(404).json({ success: false, message: "Tent not found" });
        }

        if (tent.status === "rented") {
            return res.status(409).json({ success: false, message: "Cannot delete a rented tent" });
        }

        const history = await db.get("SELECT id FROM rentals WHERE tent_id = ?", [tent.id]);

        if (history) {
            return res.status(409).json({
                success: false,
                message: "Cannot delete a tent with rental history"
            });
        }

        await db.run("DELETE FROM tents WHERE id = ?", [tent.id]);

        res.status(200).json({ success: true, message: "Tent deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to delete tent" });
    }
});

module.exports = router;
