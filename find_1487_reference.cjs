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
        console.log("=== Finding what Field_013 = 1487 represents ===");
        // The column Field_013 of PAY_TBL_013 (which contains 1487, 1235, 92, etc.) must refer to another table.
        // Let's search in PAY_TBL_001, PAY_TBL_003, PAY_TBL_004, PAY_TBL_005, etc. for ID '1487'.
        for (let tNum = 1; tNum <= 15; tNum++) {
            const tableName = `PAY_TBL_${String(tNum).padStart(3, '0')}`;
            try {
                const rows = await executeQuery(`
                    SELECT * FROM ${tableName} 
                    WHERE Field_001 = '1487' OR Field_002 = '1487'
                `);
                if (rows.length > 0) {
                    console.log(`Found in table ${tableName}:`, JSON.stringify(rows, null, 2));
                }
            } catch (err) {}
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
