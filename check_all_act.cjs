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
        console.log("Checking all 15 ArchiveCodes in a single SQL query:");
        const codes = ['1904', '1905', '1906', '1907', '1908', '1909', '1910', '1911', '1912', '1913', '1914', '1915', '1916', '1917', '1918'];
        const codesStr = codes.map(c => `'${c}'`).join(',');
        
        const sql = `
            SELECT Field_008 as ArchiveCode, Field_004 as SanadNo, COUNT(*) as RowCount
            FROM ACT_TBL_009
            WHERE Field_003 = '4' AND Field_008 IN (${codesStr})
            GROUP BY Field_008, Field_004
        `;

        const res = await executeQuery(sql);
        console.log("Results from database:");
        console.log(res);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
