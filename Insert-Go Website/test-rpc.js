const fs = require("fs");
const env = fs.readFileSync(".env.local", "utf8").split("\n").reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) acc[match[1]] = match[2].replace(/^"|"$/g, '').trim();
  return acc;
}, {});

const key = env.SUPABASE_SERVICE_ROLE_KEY;
const url = env.SUPABASE_URL;

async function test() {
  const res = await fetch(`${url}/rest/v1/rpc/consent_current`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "count=none",
    },
    body: JSON.stringify({ p_user_id: "test" }),
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Body:", text);
}
test();
