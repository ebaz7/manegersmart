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
        console.log("=== Querying all unique functions in PAY_TBL_002 formulas ===");
        const rows = await executeQuery(`
            SELECT Field_001, Field_004, Field_013 
            FROM PAY_TBL_002 
            WHERE Field_013 LIKE '%[[]%'
        `);
        const regex = /([A-Za-z0-9_]+)\[/g;
        const funcs = new Set();
        for (const r of rows) {
            let match;
            while ((match = regex.exec(r.Field_013)) !== null) {
                if (!match[1].startsWith('CP')) {
                    funcs.add(match[1]);
                }
            }
        }
        console.log("Functions found:", Array.from(funcs));
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
