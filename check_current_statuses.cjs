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
        console.log("Checking current ACT_TBL_008 statuses in FY 4:");
        const res = await executeQuery("SELECT Field_005 as DocNo, Field_012 as Status, Field_014, Field_015 FROM ACT_TBL_008 WHERE Field_005 IN ('5064', '5065', '5066', '5067', '5068', '5069', '5070') AND Field_004 = '4'");
        console.log(res);

        console.log("\nChecking rows count in ACT_TBL_009 for those DocNo:");
        const rowsCount = await executeQuery("SELECT Field_004 as DocNo, COUNT(*) as cnt FROM ACT_TBL_009 WHERE Field_004 IN ('5064', '5065', '5066', '5067', '5068', '5069', '5070') AND Field_003 = '4' GROUP BY Field_004");
        console.log(rowsCount);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
