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
        console.log("Searching for the link between ACT_TBL_008 and BUR_TBL_008...");
        // Let's search BUR_TBL_008 for any fields containing '5062' or '203195' or '1919'
        const burLink = await executeQuery("SELECT * FROM BUR_TBL_008 WHERE Field_001 = '186447' OR Field_005 = '1919'");
        console.log("BUR Record:", burLink);

        // Let's search ACT_TBL_009 for any fields containing '186447' or '1919'
        console.log("Let's query all columns of ACT_TBL_009 for doc 5062 to see if there is any field with 186447 or 1919:");
        const actRows = await executeQuery("SELECT * FROM ACT_TBL_009 WHERE Field_003 = '4' AND Field_004 = '5062'");
        console.log("ACT Rows for 5062:", actRows);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
