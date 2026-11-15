// Small helper functions used by the route files

// Converts a value to a positive whole number id, or returns null if invalid
function getId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// Basic email format check
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const TENT_SIZES = ["small", "medium", "large"];
const TENT_CONDITIONS = ["good", "damaged"];

module.exports = { getId, isValidEmail, TENT_SIZES, TENT_CONDITIONS };