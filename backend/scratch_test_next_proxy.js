import https from 'https';

const agent = new https.Agent({
  rejectUnauthorized: false
});

async function testNextProxy() {
  const reports = [
    {
      id: "next-proxy-test-id",
      sessionId: "session-001",
      doctorName: "Dr. Ahmed",
      templateUsed: "",
      sections: [
        { title: "Indication", content: "Heartburn" }
      ],
      diagnosis: ["Reflux"],
      recommendations: ["PPIs"],
      followUp: "",
      biopsy: false,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  try {
    const res = await fetch('https://172.18.1.68:3000/api/storage/endo_reports', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reports),
      // @ts-ignore
      agent
    });

    console.log("Status:", res.status);
    const body = await res.text();
    console.log("Response:", body);
  } catch (err) {
    console.error("Error:", err);
  }
}

testNextProxy();
