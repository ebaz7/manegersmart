const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', 
    { query: sql }, 
    { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }, timeout: 30000 }
  );
  return res.data.data;
}

async function main() {
  try {
    // 1. Doc 11190 details
    console.log("--- Doc 11190 header ---");
    const docHeader = await query("SELECT * FROM STR_TBL_010 WHERE Field_001 = '502496'");
    console.log(docHeader);

    // 2. Warehouses in Sayan (STR_TBL_001 or similar)
    console.log("--- Warehouses ---");
    const warehouses = await query("SELECT Field_001, Field_002, Field_003 FROM STR_TBL_001");
    console.log(warehouses);

  } catch(e) {
    console.error("Error:", e.message, e.response?.data);
  }
}

main();
