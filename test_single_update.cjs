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
        console.log("=== Testing Single UPDATE for Factor 77 ===");
        const f77_formula = "LEAVEREMAINED[CALC[[CP155]*[CP35]+SUM[175,1]+[CP175]-(SUM[177,2]+[CP177])],[CP10],1]";
        await executeQuery(`
            UPDATE PAY_TBL_002
            SET Field_013 = N'${f77_formula}', Field_015 = N'${f77_formula}'
            WHERE Field_003 = '11' AND Field_001 = '77'
        `);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
