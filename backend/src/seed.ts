/**
 * Seed script — creates a default admin user in MongoDB.
 * Run with: npx tsx src/seed.ts
 */
import './config.js'; // load env
import bcrypt from 'bcryptjs';
import { connectDB } from './db/connection.js';
import { User, Settings } from './db/models.js';

async function seed() {
  await connectDB();

  // Seed admin user
  const existing = await User.findOne({ username: 'admin' });
  if (!existing) {
    const hash = await bcrypt.hash('admin123', 10);
    await User.create({ username: 'admin', passwordHash: hash, displayName: 'Administrator', role: 'admin', active: true });
    console.log('✅ Admin user created (admin / admin123)');
  } else {
    console.log('Admin user already exists.');
  }

  // Seed default settings
  const settings = await Settings.findOne({ _key: 'global' });
  if (!settings) {
    await Settings.create({
      _key: 'global',
      hospitalName: 'My Hospital',
      departmentName: 'GI Endoscopy Unit',
      address: '',
      phone: '',
      doctors: ['Dr. Ahmed'],
      procedures: [
        { id: 'upper-endoscopy', label: 'Upper Endoscopy (EGD)', icon: '🔬' },
        { id: 'colonoscopy', label: 'Colonoscopy', icon: '🩺' },
        { id: 'ercp', label: 'ERCP', icon: '⚕️' },
      ],
      defaultPreparations: {},
      reportFooter: '',
    });
    console.log('✅ Default settings created');
  }

  console.log('Done.');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
