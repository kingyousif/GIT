import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/endo_management';

async function inspectReports() {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));

    const reports = await mongoose.connection.db.collection('reports').find({}).toArray();
    console.log(`Found ${reports.length} reports:`);
    console.log(JSON.stringify(reports, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
}

inspectReports();
