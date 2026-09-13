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
        console.log("Checking if there are any documents in ACT_TBL_008 with Field_009 <> 0 in Fiscal Year 4:");
        const nonZero009 = await executeQuery("SELECT TOP 5 * FROM ACT_TBL_008 WHERE Field_004 = '4' AND Field_009 <> 0");
        console.log("Non-zero Field_009:", nonZero009);

        console.log("Checking if there are any documents in ACT_TBL_008 with Field_010 = true or <> 0 in Fiscal Year 4:");
        const nonZero010 = await executeQuery("SELECT TOP 5 * FROM ACT_TBL_008 WHERE Field_004 = '4' AND (Field_010 = 1 OR Field_010 = 'true')");
        console.log("Non-zero Field_010:", nonZero010);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
