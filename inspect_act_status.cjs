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
        console.log("Let's query recent documents from ACT_TBL_008 and look at their columns:");
        const docs = await executeQuery("SELECT TOP 5 * FROM ACT_TBL_008 WHERE Field_004 = '4' ORDER BY Field_001 DESC");
        for (const doc of docs) {
            console.log(`DocNo: ${doc.Field_005}, Field_009: ${doc.Field_009}, Field_010: ${doc.Field_010}, Field_012: ${doc.Field_012}`);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
