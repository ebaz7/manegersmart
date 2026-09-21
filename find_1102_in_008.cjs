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
        console.log("=== Querying PAY_TBL_008 for Employee 1102 in Month 33 & 34 ===");
        // Wait, in PAY_TBL_008, what is the period or month?
        // Let's find rows with Field_007 (Employee Code) = '1102'
        const rows = await executeQuery(`
            SELECT * FROM PAY_TBL_008 
            WHERE Field_007 = '1102'
        `);
        console.log(`Found ${rows.length} rows.`);
        for (const r of rows) {
            console.log(`ID: ${r.Field_001} | Employee: ${r.Field_007} | Contract Type: ${r.Field_008} | Template: ${r.Field_013} | Period: ${r.Field_004}`);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
