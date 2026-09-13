const fs = require('fs');

async function main() {
    const db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    const settings = db.settings || {};
    const serverSayanBaseUrl = settings.sayanApiUrl || 'http://80.210.31.176:5000/api/external/v1';
    const serverSayanApiKey = settings.sayanApiKey || 's_gate_live_vgr182bwtpoa';

    const finalUrl = `${serverSayanBaseUrl.replace(/\/$/, '')}/grid`;

    async function executeQuery(sql) {
        const response = await fetch(`${serverSayanBaseUrl.replace(/\/$/, '')}/query`, {
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
        console.log("Checking if accounting entries exist for the 15 repaired BUR documents...");
        
        // Let's get the BUR headers for the 15 documents from Fiscal Year 4
        const burDocs = await executeQuery(`
            SELECT Field_001 as SayanHeaderId, Field_005 as ArchiveCode, Field_006 as DocNo, Field_025 as TotalAmount
            FROM BUR_TBL_008
            WHERE Field_004 = '4' AND Field_009 = '11' AND Field_005 IN (
                '1904', '1905', '1906', '1907', '1908', '1909', '1910', '1911', '1912', '1913', '1914', '1915', '1916', '1917', '1918'
            )
        `);

        console.log(`Found ${burDocs.length} BUR documents. Checking corresponding ACT_TBL_009 entries...`);

        for (const doc of burDocs) {
            const actRows = await executeQuery(`
                SELECT Field_004 as SanadNo, COUNT(*) as RowCount 
                FROM ACT_TBL_009 
                WHERE Field_003 = '4' AND Field_008 = '${doc.ArchiveCode}'
                GROUP BY Field_004
            `);
            if (actRows.length > 0) {
                console.log(`🟢 ArchiveCode ${doc.ArchiveCode} (DocNo ${doc.DocNo}) HAS accounting entry: SanadNo ${actRows[0].SanadNo} (${actRows[0].RowCount} rows)`);
            } else {
                console.log(`❌ ArchiveCode ${doc.ArchiveCode} (DocNo ${doc.DocNo}) has NO accounting entry!`);
            }
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
