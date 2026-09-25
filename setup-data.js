/**
 * Database Seed and Initialization Script for Firestore
 * Automatically populates default catalog items and demo users for Tampa and Zephyrhills clinics.
 */

const SEED_CATALOG = [
  // Tampa Stock
  {
    itemName: 'Tirzepatide 1 mL',
    category: 'Tirzepatide',
    vialSizeML: 1,
    unitsPerVial: 100,
    closedCount: 12,
    openCount: 1,
    openUnitsRemaining: 100,
    location: 'Tampa',
    minThreshold: 5,
    defaultVendor: 'Empower Pharmacy',
    vendorSku: 'EMP-TRZ-1ML',
    barcode: '70020001001'
  },
  {
    itemName: 'Tirzepatide 2 mL',
    category: 'Tirzepatide',
    vialSizeML: 2,
    unitsPerVial: 200,
    closedCount: 18,
    openCount: 1,
    openUnitsRemaining: 165,
    location: 'Tampa',
    minThreshold: 5,
    defaultVendor: 'Empower Pharmacy',
    vendorSku: 'EMP-TRZ-2ML',
    barcode: '70020002001'
  },
  {
    itemName: 'Tirzepatide 3 mL',
    category: 'Tirzepatide',
    vialSizeML: 3,
    unitsPerVial: 300,
    closedCount: 10,
    openCount: 0,
    openUnitsRemaining: 0,
    location: 'Tampa',
    minThreshold: 4,
    defaultVendor: 'Empower Pharmacy',
    vendorSku: 'EMP-TRZ-3ML',
    barcode: '70020003001'
  },
  {
    itemName: 'Tirzepatide 4 mL',
    category: 'Tirzepatide',
    vialSizeML: 4,
    unitsPerVial: 400,
    closedCount: 8,
    openCount: 0,
    openUnitsRemaining: 0,
    location: 'Tampa',
    minThreshold: 3,
    defaultVendor: 'Empower Pharmacy',
    vendorSku: 'EMP-TRZ-4ML',
    barcode: '70020004001'
  },
  {
    itemName: 'Tirzepatide 5+ mL',
    category: 'Tirzepatide',
    vialSizeML: 5,
    unitsPerVial: 500,
    closedCount: 6,
    openCount: 0,
    openUnitsRemaining: 0,
    location: 'Tampa',
    minThreshold: 2,
    defaultVendor: 'Empower Pharmacy',
    vendorSku: 'EMP-TRZ-5ML',
    barcode: '70020005001'
  },
  {
    itemName: 'Semaglutide 5 mL',
    category: 'Semaglutide',
    vialSizeML: 5,
    unitsPerVial: 500,
    closedCount: 22,
    openCount: 2,
    openUnitsRemaining: 740,
    location: 'Tampa',
    minThreshold: 8,
    defaultVendor: 'Empower Pharmacy',
    vendorSku: 'EMP-SEMA-5ML',
    barcode: '70010005001'
  },
  {
    itemName: 'Influenza Quadrivalent (Flu Shot)',
    category: 'Vaccines',
    vialSizeML: 0.5,
    unitsPerVial: 1,
    closedCount: 45,
    openCount: 0,
    openUnitsRemaining: 0,
    location: 'Tampa',
    minThreshold: 10,
    defaultVendor: 'McKesson',
    vendorSku: 'MCK-FLU-QUAD',
    barcode: '49281042310'
  },
  {
    itemName: 'Toradol (Ketorolac 30 mg/mL)',
    category: 'Vaccines',
    vialSizeML: 1,
    unitsPerVial: 1,
    closedCount: 25,
    openCount: 0,
    openUnitsRemaining: 0,
    location: 'Tampa',
    minThreshold: 5,
    defaultVendor: 'McKesson',
    vendorSku: 'MCK-TORADOL-30',
    barcode: '00409379501'
  },
  {
    itemName: 'Nitrile Exam Gloves (Medium)',
    category: 'Supplies',
    vialSizeML: 0,
    unitsPerVial: 100,
    closedCount: 15,
    openCount: 2,
    openUnitsRemaining: 0,
    location: 'Tampa',
    minThreshold: 5,
    defaultVendor: 'McKesson',
    vendorSku: 'MCK-GLOVE-M',
    barcode: '10884521002'
  },

  // Zephyrhills Stock
  {
    itemName: 'Tirzepatide 1 mL',
    category: 'Tirzepatide',
    vialSizeML: 1,
    unitsPerVial: 100,
    closedCount: 8,
    openCount: 1,
    openUnitsRemaining: 80,
    location: 'Zephyrhills',
    minThreshold: 3,
    defaultVendor: 'Empower Pharmacy',
    vendorSku: 'EMP-TRZ-1ML',
    barcode: '70020001001'
  },
  {
    itemName: 'Tirzepatide 2 mL',
    category: 'Tirzepatide',
    vialSizeML: 2,
    unitsPerVial: 200,
    closedCount: 10,
    openCount: 0,
    openUnitsRemaining: 0,
    location: 'Zephyrhills',
    minThreshold: 4,
    defaultVendor: 'Empower Pharmacy',
    vendorSku: 'EMP-TRZ-2ML',
    barcode: '70020002001'
  },
  {
    itemName: 'Tirzepatide 3 mL',
    category: 'Tirzepatide',
    vialSizeML: 3,
    unitsPerVial: 300,
    closedCount: 6,
    openCount: 0,
    openUnitsRemaining: 0,
    location: 'Zephyrhills',
    minThreshold: 2,
    defaultVendor: 'Empower Pharmacy',
    vendorSku: 'EMP-TRZ-3ML',
    barcode: '70020003001'
  },
  {
    itemName: 'Tirzepatide 4 mL',
    category: 'Tirzepatide',
    vialSizeML: 4,
    unitsPerVial: 400,
    closedCount: 5,
    openCount: 0,
    openUnitsRemaining: 0,
    location: 'Zephyrhills',
    minThreshold: 2,
    defaultVendor: 'Empower Pharmacy',
    vendorSku: 'EMP-TRZ-4ML',
    barcode: '70020004001'
  },
  {
    itemName: 'Tirzepatide 5+ mL',
    category: 'Tirzepatide',
    vialSizeML: 5,
    unitsPerVial: 500,
    closedCount: 4,
    openCount: 0,
    openUnitsRemaining: 0,
    location: 'Zephyrhills',
    minThreshold: 2,
    defaultVendor: 'Empower Pharmacy',
    vendorSku: 'EMP-TRZ-5ML',
    barcode: '70020005001'
  },
  {
    itemName: 'Semaglutide 5 mL',
    category: 'Semaglutide',
    vialSizeML: 5,
    unitsPerVial: 500,
    closedCount: 14,
    openCount: 1,
    openUnitsRemaining: 410,
    location: 'Zephyrhills',
    minThreshold: 5,
    defaultVendor: 'Empower Pharmacy',
    vendorSku: 'EMP-SEMA-5ML',
    barcode: '70010005001'
  },
  {
    itemName: 'Influenza Quadrivalent (Flu Shot)',
    category: 'Vaccines',
    vialSizeML: 0.5,
    unitsPerVial: 1,
    closedCount: 20,
    openCount: 0,
    openUnitsRemaining: 0,
    location: 'Zephyrhills',
    minThreshold: 5,
    defaultVendor: 'McKesson',
    vendorSku: 'MCK-FLU-QUAD',
    barcode: '49281042310'
  }
];

const SEED_USERS = [
  {
    id: 'user_admin',
    username: 'admin',
    passwordHash: 'admin123',
    fullName: 'Dr. Smith (Medical Director)',
    role: 'Administrator',
    location: 'All',
    status: 'ACTIVE'
  },
  {
    id: 'user_inv_mgr',
    username: 'manager',
    passwordHash: 'manager123',
    fullName: 'David Clark (Inventory Lead)',
    role: 'Inventory Manager',
    location: 'All',
    status: 'ACTIVE'
  },
  {
    id: 'user_tampa_staff',
    username: 'tampa_nurse',
    passwordHash: 'nurse123',
    fullName: 'Sarah Jenkins, RN',
    role: 'Nurse',
    location: 'Tampa',
    status: 'ACTIVE'
  },
  {
    id: 'user_zephyr_staff',
    username: 'zephyr_ma',
    passwordHash: 'ma123',
    fullName: 'Michael Torres, MA',
    role: 'Medical Assistant',
    location: 'Zephyrhills',
    status: 'ACTIVE'
  }
];

async function seedFirestoreDatabase() {
  if (!db) {
    throw new Error("Firestore is not initialized. Please configure firebase-config.js first.");
  }

  const batch = db.batch();
  const timestamp = new Date().toISOString();

  // 1. Seed Users
  for (const user of SEED_USERS) {
    const userRef = db.collection('users').doc(user.id);
    batch.set(userRef, { ...user, createdAt: timestamp }, { merge: true });
  }

  // 2. Seed Inventory items
  for (const item of SEED_CATALOG) {
    const docId = `inv_${item.location.toLowerCase()}_${item.itemName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    const invRef = db.collection('inventory').doc(docId);
    batch.set(invRef, {
      ...item,
      id: docId,
      lastUpdated: timestamp
    }, { merge: true });
  }

  // 3. Seed active opened vials
  const activeOpenVials = [
    {
      id: 'vial_tampa_tirz_2ml_01',
      inventoryId: 'inv_tampa_tirzepatide_2_ml',
      itemName: 'Tirzepatide 2 mL',
      location: 'Tampa',
      vialSizeML: 2,
      totalUnits: 200,
      unitsRemaining: 165,
      dateOpened: new Date(Date.now() - 3600000 * 5).toISOString(),
      openedBy: 'Sarah Jenkins, RN',
      status: 'ACTIVE',
      notes: 'Active exam room 1'
    },
    {
      id: 'vial_tampa_sema_5ml_01',
      inventoryId: 'inv_tampa_semaglutide_5_ml',
      itemName: 'Semaglutide 5 mL',
      location: 'Tampa',
      vialSizeML: 5,
      totalUnits: 500,
      unitsRemaining: 380,
      dateOpened: new Date(Date.now() - 3600000 * 24).toISOString(),
      openedBy: 'Sarah Jenkins, RN',
      status: 'ACTIVE',
      notes: 'Active cart A'
    },
    {
      id: 'vial_tampa_sema_5ml_02',
      inventoryId: 'inv_tampa_semaglutide_5_ml',
      itemName: 'Semaglutide 5 mL',
      location: 'Tampa',
      vialSizeML: 5,
      totalUnits: 500,
      unitsRemaining: 360,
      dateOpened: new Date(Date.now() - 3600000 * 12).toISOString(),
      openedBy: 'Sarah Jenkins, RN',
      status: 'ACTIVE',
      notes: 'Active exam room 3'
    },
    {
      id: 'vial_zephyr_sema_5ml_01',
      inventoryId: 'inv_zephyrhills_semaglutide_5_ml',
      itemName: 'Semaglutide 5 mL',
      location: 'Zephyrhills',
      vialSizeML: 5,
      totalUnits: 500,
      unitsRemaining: 410,
      dateOpened: new Date(Date.now() - 3600000 * 8).toISOString(),
      openedBy: 'Michael Torres, MA',
      status: 'ACTIVE',
      notes: 'Active clinic cart'
    }
  ];

  for (const vial of activeOpenVials) {
    const vialRef = db.collection('openedVials').doc(vial.id);
    batch.set(vialRef, vial, { merge: true });
  }

  // 4. Initial Transfer sample
  const transferRef = db.collection('stockTransfers').doc('trf_demo_01');
  batch.set(transferRef, {
    id: 'trf_demo_01',
    transferId: 'TRF-1001',
    timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
    inventoryId: 'inv_tampa_semaglutide_5_ml',
    itemName: 'Semaglutide 5 mL',
    sourceLocation: 'Tampa',
    destinationLocation: 'Zephyrhills',
    quantity: 5,
    transferredBy: 'David Clark (Inventory Lead)',
    status: 'COMPLETED',
    notes: 'Initial clinic stock allocation'
  }, { merge: true });

  await batch.commit();
  console.log('✅ Firestore database seeded successfully with clinic catalog & demo accounts.');
  return true;
}
