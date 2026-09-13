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
        console.log("Checking ACT_TBL_010 for working document 4997 (VoucherCode):");
        const rows4997 = await executeQuery("SELECT * FROM ACT_TBL_010 WHERE Field_004 = '4997' AND Field_003 = '4'");
        console.log(rows4997);

        console.log("\nChecking ACT_TBL_010 for not-working document 5070 (VoucherCode):");
        const rows5070 = await executeQuery("SELECT * FROM ACT_TBL_010 WHERE Field_004 = '5070' AND Field_003 = '4'");
        console.log(rows5070);

        console.log("\nChecking ACT_TBL_010 for manual-approved document 5098 (VoucherCode):");
        const rows5098 = await executeQuery("SELECT * FROM ACT_TBL_010 WHERE Field_004 = '5098' AND Field_003 = '4'");
        console.log(rows5098);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
