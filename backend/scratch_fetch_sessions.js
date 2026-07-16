async function testFetchSessions() {
  try {
    const res = await fetch('http://localhost:4001/api/storage/endo_sessions');
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Returned sessions count:", data.length);
    console.log("Returned sessions list:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

testFetchSessions();
