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

    // List of tables to search
    const tables = [];
    for (let i = 1; i <= 20; i++) {
        const num = String(i).padStart(3, '0');
        tables.push(`ACT_TBL_${num}`);
        tables.push(`BUR_TBL_${num}`);
    }

    try {
        console.log("Searching for 5098 (Works) and 5070 (Doesn't work) in tables...");

        for (const tbl of tables) {
            try {
                // Let's first check if table exists by doing a quick SELECT
                const columnsRes = await executeQuery(`SELECT TOP 1 * FROM ${tbl}`);
                if (columnsRes.length === 0) {
                    // Let's check if we can query schema
                }
                
                // Search for any column containing '5098' or '5070'
                // We can query sys.columns
                const cols = await executeQuery(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('${tbl}')`);
                if (cols.length === 0) continue;

                // Build a query: SELECT count(*) WHERE col1 = '5098' OR col2 = '5098' ...
                const conditions5098 = cols.map(c => `CAST(${c.name} AS NVARCHAR(MAX)) = '5098'`).join(' OR ');
                const conditions5070 = cols.map(c => `CAST(${c.name} AS NVARCHAR(MAX)) = '5070'`).join(' OR ');

                const count5098Res = await executeQuery(`SELECT COUNT(*) as cnt FROM ${tbl} WHERE ${conditions5098}`);
                const count5070Res = await executeQuery(`SELECT COUNT(*) as cnt FROM ${tbl} WHERE ${conditions5070}`);

                const cnt5098 = count5098Res[0] ? count5098Res[0].cnt : 0;
                const cnt5070 = count5070Res[0] ? count5070Res[0].cnt : 0;

                if (cnt5098 > 0 || cnt5070 > 0) {
                    console.log(`Table: ${tbl} -> 5098 count: ${cnt5098}, 5070 count: ${cnt5070}`);
                    // Fetch some details
                    const details5098 = await executeQuery(`SELECT TOP 2 * FROM ${tbl} WHERE ${conditions5098}`);
                    console.log(`  5098 rows:`, JSON.stringify(details5098, null, 2));
                    const details5070 = await executeQuery(`SELECT TOP 2 * FROM ${tbl} WHERE ${conditions5070}`);
                    console.log(`  5070 rows:`, JSON.stringify(details5070, null, 2));
                }
            } catch (err) {
                // Ignore missing tables or query errors
            }
        }
    } catch (e) {
        console.error("Error during search:", e);
    }
}

main();
