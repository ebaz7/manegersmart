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
        console.log("Fetching top 10 newest rows in ACT_TBL_008 for Fiscal Year 4:");
        const actHeaders = await executeQuery("SELECT TOP 10 * FROM ACT_TBL_008 WHERE Field_004 = '4' ORDER BY Field_001 DESC");
        console.log("ACT Headers:", actHeaders);

        console.log("Fetching top 5 rows in ACT_TBL_009 linked to those recent documents:");
        if (actHeaders.length > 0) {
            const hIds = actHeaders.map(h => `'${h.Field_005}'`).join(',');
            const actRows = await executeQuery(`SELECT TOP 5 * FROM ACT_TBL_009 WHERE Field_003 = '4' AND Field_004 IN (${hIds})`);
            console.log("ACT Rows:", actRows);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
