const express = require("express");
const { getDb } = require("../database/db");
const { getId, isValidEmail } = require("../helpers");

const router = express.Router();

// GET ALL TREKKERS  ->  GET /api/trekkers
router.get("/", async (req, res) => {
    try {
        const db = getDb();
        const trekkers = await db.all("SELECT * FROM trekkers ORDER BY id");

        res.status(200).json({
            success: true,
            count: trekkers.length,
            data: trekkers
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to fetch trekkers" });
    }
});

// GET ONE TREKKER  ->  GET /api/trekkers/:id
router.get("/:id", async (req, res) => {
    try {
        const db = getDb();
        const id = getId(req.params.id);

        if (!id) {
            return res.status(400).json({ success: false, message: "Invalid trekker ID" });
        }

        const trekker = await db.get("SELECT * FROM trekkers WHERE id = ?", [id]);

        if (!trekker) {
            return res.status(404).json({ success: false, message: "Trekker not found" });
        }

        res.status(200).json({ success: true, data: trekker });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to fetch trekker" });
    }
});

// ADD TREKKER  ->  POST /api/trekkers
router.post("/", async (req, res) => {
    try {
        const db = getDb();
        const { name, email, phone } = req.body || {};

        if (
            typeof name !== "string" || !name.trim() ||
            typeof email !== "string" || !email.trim()
        ) {
            return res.status(400).json({ success: false, message: "Name and email are required" });
        }

        if (!isValidEmail(email.trim())) {
            return res.status(400).json({ success: false, message: "Invalid email address" });
        }

        const existing = await db.get(
            "SELECT id FROM trekkers WHERE LOWER(email) = LOWER(?)",
            [email.trim()]
        );

        if (existing) {
            return res.status(409).json({ success: false, message: "Email already registered" });
        }

        const result = await db.run(
            "INSERT INTO trekkers (name, email, phone) VALUES (?, ?, ?)",
            [name.trim(), email.trim(), phone || null]
        );

        res.status(201).json({
            success: true,
            message: "Trekker created successfully",
            data: {
                id: result.lastID,
                name: name.trim(),
                email: email.trim(),
                phone: phone || null
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to create trekker" });
    }
});

// UPDATE TREKKER  ->  PUT /api/trekkers/:id
router.put("/:id", async (req, res) => {
    try {
        const db = getDb();
        const id = getId(req.params.id);

        if (!id) {
            return res.status(400).json({ success: false, message: "Invalid trekker ID" });
        }

        const old = await db.get("SELECT * FROM trekkers WHERE id = ?", [id]);

        if (!old) {
            return res.status(404).json({ success: false, message: "Trekker not found" });
        }

        const body = req.body || {};
        const name = body.name ?? old.name;
        const email = body.email ?? old.email;
        const phone = body.phone ?? old.phone;

        if (
            typeof name !== "string" || !name.trim() ||
            typeof email !== "string" || !email.trim()
        ) {
            return res.status(400).json({ success: false, message: "Name and email are required" });
        }

        if (!isValidEmail(email.trim())) {
            return res.status(400).json({ success: false, message: "Invalid email address" });
        }

        const duplicate = await db.get(
            "SELECT id FROM trekkers WHERE LOWER(email) = LOWER(?) AND id != ?",
            [email.trim(), id]
        );

        if (duplicate) {
            return res.status(409).json({ success: false, message: "Email already registered" });
        }

        await db.run(
            "UPDATE trekkers SET name = ?, email = ?, phone = ? WHERE id = ?",
            [name.trim(), email.trim(), phone || null, id]
        );

        res.status(200).json({ success: true, message: "Trekker updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to update trekker" });
    }
});

// DELETE TREKKER  ->  DELETE /api/trekkers/:id
router.delete("/:id", async (req, res) => {
    try {
        const db = getDb();
        const id = getId(req.params.id);

        if (!id) {
            return res.status(400).json({ success: false, message: "Invalid trekker ID" });
        }

        const trekker = await db.get("SELECT id FROM trekkers WHERE id = ?", [id]);

        if (!trekker) {
            return res.status(404).json({ success: false, message: "Trekker not found" });
        }

        const history = await db.get("SELECT id FROM rentals WHERE trekker_id = ?", [id]);

        if (history) {
            return res.status(409).json({
                success: false,
                message: "Cannot delete trekker with rental history"
            });
        }

        await db.run("DELETE FROM trekkers WHERE id = ?", [id]);

        res.status(200).json({ success: true, message: "Trekker deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to delete trekker" });
    }
});

module.exports = router;
