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
        return data; // Return full response data including possible errors
    }

    try {
        console.log("Testing inserting a single ACT_TBL_008 document to see if Sayan returns an error...");
        const sql = `
            INSERT INTO ACT_TBL_008 (Field_004, Field_005, Field_006, Field_007, Field_008, Field_009, Field_010, Field_011, Field_012, Field_013, Field_014, Field_015, Field_017)
            VALUES ('4', '5064', '5064', '', '2026-09-13 15:07:01', 0, 0, '', 1, '03f3f11a-86d7-4479-b881-c041ac3a7324', 880000000, 880000000, GETDATE())
        `;
        const res = await executeQuery(sql);
        console.log("Response:", JSON.stringify(res, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
