

async function testPut() {
  const reports = [
    {
      id: "test-report-id-123",
      sessionId: "session-001",
      doctorName: "Dr. Sara",
      templateUsed: "",
      sections: [
        { title: "Indication", content: "Abdominal pain" },
        { title: "Findings", content: "Normal mucosa" }
      ],
      diagnosis: ["Gastritis"],
      recommendations: ["Follow up in 6 months"],
      followUp: "None",
      biopsy: false,
      biopsyLocation: "",
      biopsySentTo: "",
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  try {
    const res = await fetch('http://localhost:4001/api/storage/endo_reports', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reports)
    });

    console.log("Status:", res.status);
    const body = await res.text();
    console.log("Response Body:", body);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

testPut();
