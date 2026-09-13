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
        console.log("Checking recent ACT_TBL_008 documents in Fiscal Year 4:");
        const res = await executeQuery("SELECT TOP 20 Field_005 as DocNo, Field_008 as DocDate, Field_012 as Status, Field_017 as SystemDate FROM ACT_TBL_008 WHERE Field_004 = '4' ORDER BY Field_001 DESC");
        console.log(res);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
