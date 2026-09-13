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
        console.log("Running EXACT Customer Statement SQL from app for امید ظروفی (111926 / 1926):");
        const codeToUse = '111926';
        const shortTafsiliCode = '1926';
        const code31 = '311926';
        const gregFrom = '2026-09-01';
        const gregTo = '2026-09-30';

        const tafsiliFilter = `(
            t9.Field_015 LIKE '%:${codeToUse}%' OR 
            t9.Field_014 LIKE '%:${codeToUse}%' OR
            t9.Field_015 LIKE '%:${codeToUse}' OR 
            t9.Field_014 LIKE '%:${codeToUse}' OR
            t9.Field_015 LIKE '%:${shortTafsiliCode}%' OR 
            t9.Field_014 LIKE '%:${shortTafsiliCode}%' OR
            t9.Field_015 LIKE '%:${shortTafsiliCode}' OR 
            t9.Field_014 LIKE '%:${shortTafsiliCode}' OR
            t9.Field_015 LIKE '%:${code31}%' OR 
            t9.Field_014 LIKE '%:${code31}%' OR
            t9.Field_015 LIKE '%:${code31}' OR 
            t9.Field_014 LIKE '%:${code31}'
        )`;

        const sql = `
            SELECT 
                t9.Field_004 as SanadNo,
                t9.Field_009 as Bed,
                t9.Field_010 as Bes,
                t9.Field_011 as Description,
                t8.Field_008 as Date,
                t9.Field_005 as MoeinGroup,
                t9.Field_006 as MoeinParent,
                t9.Field_007 as MoeinCode
            FROM ACT_TBL_009 t9
            LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
            WHERE ${tafsiliFilter} 
              AND (t9.Field_015 LIKE '11%' OR t9.Field_015 LIKE '%-11%' OR t9.Field_015 LIKE '31%' OR t9.Field_015 LIKE '%-31%')
              AND t9.Field_015 NOT LIKE '%-12%'
              AND t9.Field_015 NOT LIKE '%-13%'
              AND t9.Field_007 NOT IN ('102', '103', '107', '109', '114', '116', '117')
              AND t9.Field_005 <> '9'
              AND t8.Field_008 >= '${gregFrom}T00:00:00.000Z'
              AND t8.Field_008 <= '${gregTo}T23:59:59.000Z'
            ORDER BY t8.Field_008 ASC, CAST(t9.Field_001 AS INT) ASC
        `;

        const data = await executeQuery(sql);
        console.log(`Returned ${data.length} transactions:`);
        console.log(data);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
