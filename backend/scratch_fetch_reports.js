async function testFetch() {
  try {
    const res = await fetch('http://localhost:4001/api/storage/endo_reports');
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Returned reports array:", data);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

testFetch();
