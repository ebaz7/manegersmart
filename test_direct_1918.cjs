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
        console.log("Direct query for 1918 in ACT_TBL_009:");
        const res = await executeQuery("SELECT * FROM ACT_TBL_009 WHERE Field_003 = '4' AND Field_008 = '1918'");
        console.log("Result length:", res.length);
        if (res.length > 0) {
            console.log("First row:", res[0]);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
