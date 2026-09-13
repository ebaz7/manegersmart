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
        console.log("Searching sys.objects for interesting names...");
        // Search views, procedures, functions
        const objects = await executeQuery("SELECT name, type_desc FROM sys.objects WHERE (name LIKE '%ACT%' OR name LIKE '%BUR%' OR name LIKE '%Tarikh%' OR name LIKE '%Sanad%' OR name LIKE '%Tafsili%') AND type IN ('V', 'P', 'FN', 'TF', 'U') ORDER BY name");
        console.log("Found matching objects:", objects.slice(0, 100));
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
