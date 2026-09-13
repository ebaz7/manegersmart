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
        console.log("Checking if document 5062 exists in ACT_TBL_024:");
        const rows24 = await executeQuery("SELECT * FROM ACT_TBL_024 WHERE Field_004 = '5062'");
        console.log("ACT_TBL_024 rows for 5062:", rows24);

        console.log("Checking if document 5064 exists in ACT_TBL_024:");
        const rows24_64 = await executeQuery("SELECT * FROM ACT_TBL_024 WHERE Field_004 = '5064'");
        console.log("ACT_TBL_024 rows for 5064:", rows24_64);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
