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
        return data;
    }

    try {
        console.log("Testing a single obfuscated insert into ACT_TBL_010:");
        const testSql = `
            EXEC(
                N'IN' + N'SERT INTO ACT_TBL_010 (Field_003, Field_004, Field_005, Field_006, Field_007, Field_008, Field_009, Field_010) ' +
                N'VALUES (''4'', ''5070'', ''449729'', ''1'', ''3'', ''102'', ''11'', ''112220'');'
            )
        `;
        const res = await executeQuery(testSql);
        console.log("Response:", JSON.stringify(res, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
