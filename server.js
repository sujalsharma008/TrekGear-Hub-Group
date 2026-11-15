const express = require("express");
const { initializeDatabase } = require("./database/db");

const trekkersRoutes = require("./routes/trekkers");
const tentsRoutes = require("./routes/tents");
const rentalsRoutes = require("./routes/rentals");
const app = express();
const PORT = 5000;

// Read JSON request bodies
app.use(express.json());

// Routes
app.use("/api/trekkers", trekkersRoutes);
app.use("/api/tents", tentsRoutes);
app.use("/api/rentals", rentalsRoutes);

// Unknown route
app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});

// Error handler (for example, broken JSON in the request body)
app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ success: false, message: "Invalid JSON in request body" });
    }

    console.error(err);
    res.status(500).json({ success: false, message: "Something went wrong" });
});

// Open the database first, then start the server
async function startServer() {
    try {
        await initializeDatabase();

        app.listen(PORT, () => {
            console.log(`TrekGear Hub running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Server startup failed:", error);
        process.exit(1);
    }
}

startServer();