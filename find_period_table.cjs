const fs = require('fs');

async function main() {
    const db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    const settings = db.settings || {};
    const serverSayanBaseUrl = settings.sayanApiUrl || 'http://80.210.31.176:5000/api/external/v1';
    const serverSayanApiKey = settings.sayanApiKey || 's_gate_live_vgr182bwtpoa';
    const finalUrl = `${serverSayanBaseUrl.replace(/\/$/, '')}/query`;

    async function executeQuery(sql) {
        const response = await fetch(finalUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serverSayanApiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: sql })
        });
        const data = await response.json();
        return data.data || [];
    }

    try {
        console.log("=== Searching for Row with Field_001 = 1487 ===");
        const tablesRes = await executeQuery(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME LIKE 'PAY_TBL_%'
        `);
        const tables = tablesRes.map(t => t.TABLE_NAME);

        for (const t of tables) {
            try {
                const rows = await executeQuery(`
                    SELECT * FROM ${t} 
                    WHERE Field_001 = 1487
                `);
                if (rows.length > 0) {
                    console.log(`Found in table ${t}:`, JSON.stringify(rows, null, 2));
                }
            } catch (err) {}
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
