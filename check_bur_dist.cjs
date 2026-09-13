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
        console.log("Checking distribution of Field_003 in BUR_TBL_009 for the recent archive codes:");
        const dist = await executeQuery(`
            SELECT TOP 20 h.Field_005 as ArchiveCode, h.Field_001 as HeaderId, r.Field_003 as Field003InRow
            FROM BUR_TBL_008 h
            INNER JOIN BUR_TBL_009 r ON h.Field_005 = r.Field_004
            WHERE h.Field_004 = '4' AND h.Field_009 = '11'
            ORDER BY h.Field_001 DESC
        `);
        console.log("Distribution of Field_003 in Row:", dist);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
