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
        console.log("Checking for orphaned ACT_TBL_009 rows:");
        const orphans = await executeQuery(`
            SELECT Field_001 as RowId, Field_003 as FiscalYear, Field_004 as DocNo, Field_005 as GroupCode, Field_006 as LedgerCode, Field_007 as SubsidiaryCode, Field_015 as ElaborativeKey
            FROM ACT_TBL_009
            WHERE Field_003 = '4' 
              AND Field_015 != '' 
              AND Field_015 IS NOT NULL
              AND Field_004 IN ('5064','5065','5066','5067','5068','5069','5070')
              AND Field_001 NOT IN (SELECT DISTINCT Field_005 FROM ACT_TBL_010 WHERE Field_003 = '4')
        `);
        console.log(`Found ${orphans.length} orphaned rows:`, orphans);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
