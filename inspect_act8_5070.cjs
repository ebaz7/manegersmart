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
        console.log("Full columns in ACT_TBL_008 for 5070:");
        const res5070 = await executeQuery("SELECT * FROM ACT_TBL_008 WHERE Field_005 = '5070' AND Field_004 = '4'");
        console.log(JSON.stringify(res5070, null, 2));

        console.log("\nFull columns in ACT_TBL_008 for 5098:");
        const res5098 = await executeQuery("SELECT * FROM ACT_TBL_008 WHERE Field_005 = '5098' AND Field_004 = '4'");
        console.log(JSON.stringify(res5098, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
