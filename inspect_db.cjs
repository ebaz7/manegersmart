const fs = require('fs');
const path = require('path');

try {
    const dbPath = path.join(__dirname, 'database.json');
    if (fs.existsSync(dbPath)) {
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        console.log("=== DB KEYS ===");
        console.log(Object.keys(db));
        if (db.settings) {
            console.log("settings keys:", Object.keys(db.settings));
            if (db.settings.companies) {
                console.log("settings.companies count:", db.settings.companies.length);
                console.log("settings.companies names:", db.settings.companies.map(c => c.name));
            }
            if (db.settings.secretariatCompanySettings) {
                console.log("settings.secretariatCompanySettings:", db.settings.secretariatCompanySettings);
            }
        }
        console.log("secretariatLetters count:", db.secretariatLetters ? db.secretariatLetters.length : 0);
        if (db.secretariatLetters && db.secretariatLetters.length > 0) {
            console.log("Sample letter keys:", Object.keys(db.secretariatLetters[0]));
            console.log("Sample letter subject & number:", db.secretariatLetters[0].subject, db.secretariatLetters[0].letterNumber);
        }
    } else {
        console.log("database.json not found in root");
    }
} catch (e) {
    console.error("Error inspecting DB keys:", e);
}
