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
        console.log("Fetching definition of Transfer_ActVoucher:");
        const defTransfer = await executeQuery("SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID('Transfer_ActVoucher')");
        if (defTransfer.length > 0) {
            console.log(defTransfer[0].definition);
        } else {
            console.log("Not found.");
        }

        console.log("\nFetching definition of SetGroupedRecordsAll:");
        const defSetGrouped = await executeQuery("SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID('SetGroupedRecordsAll')");
        if (defSetGrouped.length > 0) {
            console.log(defSetGrouped[0].definition);
        } else {
            console.log("Not found.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
