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
        console.log("Group query for 1918:");
        const res = await executeQuery(`
            SELECT Field_008 as ArchiveCode, Field_004 as SanadNo, COUNT(*) as RowCount
            FROM ACT_TBL_009
            WHERE Field_003 = '4' AND Field_008 = '1918'
            GROUP BY Field_008, Field_004
        `);
        console.log(res);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
