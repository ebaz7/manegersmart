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
        console.log("=== Searching for '1487' in all columns of all tables ===");
        const tables = [
            'PAY_TBL_001', 'PAY_TBL_002', 'PAY_TBL_003', 'PAY_TBL_004', 'PAY_TBL_005',
            'PAY_TBL_006', 'PAY_TBL_007', 'PAY_TBL_008', 'PAY_TBL_009', 'PAY_TBL_010',
            'PAY_TBL_011', 'PAY_TBL_012', 'PAY_TBL_013', 'PAY_TBL_014', 'PAY_TBL_015',
            'PAY_TBL_016', 'PAY_TBL_017', 'PAY_TBL_018', 'PAY_TBL_019', 'PAY_TBL_020',
            'PAY_TBL_021', 'PAY_TBL_022', 'PAY_TBL_023', 'PAY_TBL_024', 'PAY_TBL_025',
            'PAY_TBL_026', 'PAY_TBL_027', 'PAY_TBL_028', 'PAY_TBL_029', 'PAY_TBL_030'
        ];

        for (const t of tables) {
            try {
                // Let's query if '1487' exists as Field_001, Field_002, Field_003, Field_004, Field_005...
                // We can construct a query checking columns
                const colsRes = await executeQuery(`
                    SELECT COLUMN_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = '${t}'
                `);
                if (colsRes.length === 0) continue;
                const matchConditions = colsRes.map(c => `CAST(${c.COLUMN_NAME} AS NVARCHAR(MAX)) = N'1487'`).join(' OR ');
                const rows = await executeQuery(`SELECT TOP 5 * FROM ${t} WHERE ${matchConditions}`);
                if (rows.length > 0) {
                    console.log(`Found in table ${t}:`, JSON.stringify(rows, null, 2));
                }
            } catch (err) {
                // Ignore table column errors
            }
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
