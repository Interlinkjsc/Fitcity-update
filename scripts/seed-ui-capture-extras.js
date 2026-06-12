/**
 * Seed 1 lead + 1 CMS page for UI screenshot capture (admin detail/edit).
 * Usage: node scripts/seed-ui-capture-extras.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../src/modules/crm/models/leadModel.js');
const SiteContent = require('../src/modules/crm/models/siteContentModel.js');
const Branch = require('../src/modules/crm/models/branchModel.js');
const User = require('../src/modules/users/models/userModel.js');
const { hash } = require('../src/utils/encryption');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  let branch = await Branch.findOne({ status: 'Open' }).sort({ createdAt: -1 });
  if (!branch) {
    branch = await Branch.findOne().sort({ createdAt: -1 });
  }
  if (!branch) {
    branch = await Branch.create({
      name: 'UI Capture Branch',
      address: '123 Nguyễn Huệ, Q1, TP.HCM',
      phone: '02838229999',
      status: 'Open',
    });
    console.log('Created branch:', branch._id.toString());
  }

  const leadPhone = '0901234567';
  let lead = await Lead.findOne({ phoneHash: hash(leadPhone) });
  if (!lead) {
    lead = await Lead.create({
      name: 'Nguyễn Thị UI Capture',
      phone: leadPhone,
      email: 'ui-capture-lead@fitcity.com',
      branch: branch._id,
      interestedPackage: 'Gym',
      source: 'Contact',
      status: 'Contacted',
      notes: 'Lead seed cho screenshot admin detail.',
    });
    console.log('Created lead:', lead._id.toString());
  } else {
    console.log('Lead exists:', lead._id.toString());
  }

  const slug = 'ui-capture-blog-post';
  let cms = await SiteContent.findOne({ slug });
  if (!cms) {
    const admin = await User.findOne({ role: { $in: ['SA', 'Admin'] } }).select('_id');
    cms = await SiteContent.create({
      type: 'post',
      title: 'Bài viết demo UI Capture',
      slug,
      excerpt: 'Mô tả ngắn cho screenshot CMS edit.',
      body: '<p>Nội dung demo FitCity FMS — chụp màn hình admin CMS edit.</p>',
      seoTitle: 'UI Capture Blog | FitCity',
      seoDescription: 'Trang demo cho tài liệu screenshot.',
      published: true,
      publishedAt: new Date(),
      author: admin?._id,
    });
    console.log('Created CMS:', cms._id.toString());
  } else {
    console.log('CMS exists:', cms._id.toString());
  }

  console.log('\nRoutes for capture:');
  console.log(`  /admin/leads/detail/${lead._id}`);
  console.log(`  /admin/cms/edit/${cms._id}`);

  await mongoose.connection.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
