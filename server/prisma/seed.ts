import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Database Seeding ---');

  // 1. Roles
  const roles = [
    { name: 'ADMIN', description: 'Full access to master data, users, and audit trail' },
    { name: 'REQUESTER', description: 'Can submit PR and confirm handover' },
    { name: 'WAREHOUSE', description: 'Stock checking, receiving, goods issue, and stock ledger' },
    { name: 'PURCHASING', description: 'Sourcing, quotation comparison, and purchase orders' },
    { name: 'APPROVER', description: 'Review and approve/reject procurement documents' },
    { name: 'MANAGEMENT', description: 'Read-only management dashboard and reports' },
  ];

  const roleMap: Record<string, string> = {};
  for (const r of roles) {
    const created = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    });
    roleMap[r.name] = created.id;
  }

  // 2. Departments
  const departments = [
    { departmentCode: 'MNT', departmentName: 'Maintenance', managerName: 'Hendra Saputra' },
    { departmentCode: 'PRD', departmentName: 'Production', managerName: 'Agus Santoso' },
    { departmentCode: 'WHS', departmentName: 'Warehouse', managerName: 'Joko Widodo' },
    { departmentCode: 'PUR', departmentName: 'Purchasing', managerName: 'Ratna Sari' },
    { departmentCode: 'FIN', departmentName: 'Finance', managerName: 'Linda Hartono' },
    { departmentCode: 'GA',  departmentName: 'General Affair', managerName: 'Bambang Soediro' },
    { departmentCode: 'ENG', departmentName: 'Engineering', managerName: 'David Pratama' },
  ];

  const deptMap: Record<string, string> = {};
  for (const d of departments) {
    const created = await prisma.department.upsert({
      where: { departmentCode: d.departmentCode },
      update: { departmentName: d.departmentName, managerName: d.managerName },
      create: d,
    });
    deptMap[d.departmentCode] = created.id;
  }

  // 3. Users
  const hashedPasswordAdmin = await bcrypt.hash('admin123', 10);
  const hashedPasswordUser = await bcrypt.hash('user123', 10);

  const users = [
    {
      employeeNumber: 'EMP-001',
      name: 'System Administrator',
      email: 'admin@golden.local',
      password: hashedPasswordAdmin,
      phone: '0811000001',
      departmentId: deptMap['GA'],
      position: 'IT & System Admin',
      roleId: roleMap['ADMIN'],
    },
    {
      employeeNumber: 'EMP-002',
      name: 'Budi Maintenance',
      email: 'budi.maintenance@golden.local',
      password: hashedPasswordUser,
      phone: '0811000002',
      departmentId: deptMap['MNT'],
      position: 'Maintenance Technician',
      roleId: roleMap['REQUESTER'],
    },
    {
      employeeNumber: 'EMP-003',
      name: 'Joko Gudang',
      email: 'gudang@golden.local',
      password: hashedPasswordUser,
      phone: '0811000003',
      departmentId: deptMap['WHS'],
      position: 'Warehouse Head',
      roleId: roleMap['WAREHOUSE'],
    },
    {
      employeeNumber: 'EMP-004',
      name: 'Siti Purchasing',
      email: 'purchasing@golden.local',
      password: hashedPasswordUser,
      phone: '0811000004',
      departmentId: deptMap['PUR'],
      position: 'Senior Purchasing Officer',
      roleId: roleMap['PURCHASING'],
    },
    {
      employeeNumber: 'EMP-005',
      name: 'Hendra Manager (Approver)',
      email: 'approver@golden.local',
      password: hashedPasswordUser,
      phone: '0811000005',
      departmentId: deptMap['MNT'],
      position: 'Maintenance & Operations Manager',
      roleId: roleMap['APPROVER'],
    },
    {
      employeeNumber: 'EMP-006',
      name: 'Bambang Director',
      email: 'director@golden.local',
      password: hashedPasswordUser,
      phone: '0811000006',
      departmentId: deptMap['FIN'],
      position: 'Executive Director',
      roleId: roleMap['APPROVER'],
    },
    {
      employeeNumber: 'EMP-007',
      name: 'Dewi Management',
      email: 'management@golden.local',
      password: hashedPasswordUser,
      phone: '0811000007',
      departmentId: deptMap['GA'],
      position: 'Corporate Management Analyst',
      roleId: roleMap['MANAGEMENT'],
    },
  ];

  const userMap: Record<string, string> = {};
  for (const u of users) {
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        departmentId: u.departmentId,
        roleId: u.roleId,
        position: u.position,
        password: u.password,
      },
      create: u,
    });
    userMap[u.email] = created.id;
  }

  // 4. Warehouses & Locations
  const wh1 = await prisma.warehouse.upsert({
    where: { warehouseCode: 'WH-01' },
    update: { warehouseName: 'Gudang Utama' },
    create: {
      warehouseCode: 'WH-01',
      warehouseName: 'Gudang Utama',
      address: 'Kawasan Industri Blok A',
    },
  });

  const wh2 = await prisma.warehouse.upsert({
    where: { warehouseCode: 'WH-02' },
    update: { warehouseName: 'Gudang Maintenance' },
    create: {
      warehouseCode: 'WH-02',
      warehouseName: 'Gudang Maintenance',
      address: 'Workshop Gedung C',
    },
  });

  const loc1 = await prisma.warehouseLocation.create({
    data: {
      warehouseId: wh1.id,
      locationName: 'Rak Sparepart A',
      rack: 'Rack A',
      bin: 'Bin A-01',
    },
  });

  const loc2 = await prisma.warehouseLocation.create({
    data: {
      warehouseId: wh1.id,
      locationName: 'Rak Consumable B',
      rack: 'Rack B',
      bin: 'Bin B-01',
    },
  });

  const locMnt = await prisma.warehouseLocation.create({
    data: {
      warehouseId: wh2.id,
      locationName: 'Rak Maintenance M-1',
      rack: 'Rack M',
      bin: 'Bin M-01',
    },
  });

  // 5. Units
  const units = [
    { code: 'PCS', name: 'Pieces' },
    { code: 'BOX', name: 'Box' },
    { code: 'ROLL', name: 'Roll' },
    { code: 'DRUM', name: 'Drum' },
    { code: 'LTR', name: 'Liter' },
    { code: 'SET', name: 'Set' },
    { code: 'KG', name: 'Kilogram' },
  ];

  const unitMap: Record<string, string> = {};
  for (const un of units) {
    const created = await prisma.unit.upsert({
      where: { code: un.code },
      update: { name: un.name },
      create: un,
    });
    unitMap[un.code] = created.id;
  }

  // 6. Item Categories & Subcategories
  const categories = [
    { code: 'SPAREPART', name: 'Sparepart', desc: 'Suku cadang mesin & peralatan' },
    { code: 'SUPPORTING', name: 'Material Penunjang', desc: 'Material pendukung operasional' },
    { code: 'RAW_MATERIAL', name: 'Bahan Baku Produksi', desc: 'Bahan baku utama produksi' },
    { code: 'CONSUMABLE', name: 'Consumable', desc: 'Barang habis pakai' },
    { code: 'TOOLS', name: 'Tools', desc: 'Peralatan mekanik & elektrik' },
    { code: 'CHEMICAL', name: 'Chemical', desc: 'Bahan kimia & pelumas industri' },
    { code: 'PACKAGING', name: 'Packaging', desc: 'Kemasan & pembungkus' },
    { code: 'OFFICE', name: 'Office Supplies', desc: 'Perlengkapan alat tulis kantor' },
  ];

  const catMap: Record<string, string> = {};
  for (const c of categories) {
    const created = await prisma.itemCategory.upsert({
      where: { code: c.code },
      update: { name: c.name, description: c.desc },
      create: { code: c.code, name: c.name, description: c.desc },
    });
    catMap[c.code] = created.id;
  }

  // Subcategory
  const subcatKowi = await prisma.itemSubcategory.create({
    data: {
      categoryId: catMap['SPAREPART'],
      name: 'Production Supporting Material',
      description: 'Material kritis pendukung peleburan & cetakan',
    },
  });

  // 7. Master Barang (Items)
  // Per requirement: Kowi must be Sparepart / Production Supporting Material, Critical = YES
  const items = [
    {
      itemCode: 'MAT-00101',
      itemName: 'Kowi',
      categoryId: catMap['SPAREPART'],
      subcategoryId: subcatKowi.id,
      unitId: unitMap['PCS'],
      specification: 'Cawan peleburan tahan panas Silicon Carbide Grade A #50',
      brand: 'Morgan Salamander',
      minimumStock: 5,
      maximumStock: 25,
      reorderPoint: 8,
      criticalStock: 3,
      isCritical: true, // Critical = YES per prompt!
      defaultWarehouseId: wh1.id,
    },
    {
      itemCode: 'MAT-00102',
      itemName: 'Bearing 6204ZZ',
      categoryId: catMap['SPAREPART'],
      unitId: unitMap['PCS'],
      specification: 'Deep groove ball bearing 20x47x14 mm double metal shield',
      brand: 'SKF',
      minimumStock: 10,
      maximumStock: 50,
      reorderPoint: 15,
      criticalStock: 5,
      isCritical: true,
      defaultWarehouseId: wh2.id,
    },
    {
      itemCode: 'MAT-00103',
      itemName: 'Amplas P80',
      categoryId: catMap['CONSUMABLE'],
      unitId: unitMap['ROLL'],
      specification: 'Amplas Roll Lebar 4 inch Grit 80 Waterproof',
      brand: 'Norton',
      minimumStock: 5,
      maximumStock: 30,
      reorderPoint: 10,
      criticalStock: 2,
      isCritical: false,
      defaultWarehouseId: wh1.id,
    },
    {
      itemCode: 'MAT-00104',
      itemName: 'Amplas P120',
      categoryId: catMap['CONSUMABLE'],
      unitId: unitMap['ROLL'],
      specification: 'Amplas Roll Lebar 4 inch Grit 120 Waterproof',
      brand: 'Norton',
      minimumStock: 5,
      maximumStock: 30,
      reorderPoint: 10,
      criticalStock: 2,
      isCritical: false,
      defaultWarehouseId: wh1.id,
    },
    {
      itemCode: 'MAT-00105',
      itemName: 'Amplas P240',
      categoryId: catMap['CONSUMABLE'],
      unitId: unitMap['ROLL'],
      specification: 'Amplas Roll Lebar 4 inch Grit 240 Finishing',
      brand: 'Norton',
      minimumStock: 5,
      maximumStock: 30,
      reorderPoint: 10,
      criticalStock: 2,
      isCritical: false,
      defaultWarehouseId: wh1.id,
    },
    {
      itemCode: 'MAT-00106',
      itemName: 'Oil Seal TC 25-47-10',
      categoryId: catMap['SPAREPART'],
      unitId: unitMap['PCS'],
      specification: 'NBR Rotary Shaft Rubber Seal',
      brand: 'NOK',
      minimumStock: 10,
      maximumStock: 40,
      reorderPoint: 15,
      criticalStock: 4,
      isCritical: false,
      defaultWarehouseId: wh2.id,
    },
    {
      itemCode: 'MAT-00107',
      itemName: 'Oli Hydraulic VG 68',
      categoryId: catMap['CHEMICAL'],
      unitId: unitMap['DRUM'],
      specification: 'ISO VG 68 Industrial Hydraulic Fluid 209 Liter',
      brand: 'Pertamina Turalik 68',
      minimumStock: 2,
      maximumStock: 10,
      reorderPoint: 4,
      criticalStock: 1,
      isCritical: true,
      defaultWarehouseId: wh1.id,
    },
    {
      itemCode: 'MAT-00108',
      itemName: 'Baut M10 x 50 Hex Galvanized',
      categoryId: catMap['SPAREPART'],
      unitId: unitMap['BOX'],
      specification: 'Baut Hexagonal Grade 8.8 + Mur Box isi 100 pcs',
      brand: 'Local Standard',
      minimumStock: 5,
      maximumStock: 20,
      reorderPoint: 8,
      criticalStock: 2,
      isCritical: false,
      defaultWarehouseId: wh2.id,
    },
    {
      itemCode: 'MAT-00109',
      itemName: 'Sarung Tangan Safety Nitrile',
      categoryId: catMap['CONSUMABLE'],
      unitId: unitMap['BOX'],
      specification: 'Nitrile coated safety gloves heavy duty box 12 pasang',
      brand: 'Ansell',
      minimumStock: 15,
      maximumStock: 60,
      reorderPoint: 20,
      criticalStock: 5,
      isCritical: false,
      defaultWarehouseId: wh1.id,
    },
    {
      itemCode: 'MAT-00110',
      itemName: 'Masker Respirator N95',
      categoryId: catMap['CONSUMABLE'],
      unitId: unitMap['BOX'],
      specification: 'Particulate respirator N95 filter box isi 20 pcs',
      brand: '3M 8210',
      minimumStock: 10,
      maximumStock: 50,
      reorderPoint: 15,
      criticalStock: 4,
      isCritical: false,
      defaultWarehouseId: wh1.id,
    },
    {
      itemCode: 'MAT-00111',
      itemName: 'Chemical Cleaner Degreaser',
      categoryId: catMap['CHEMICAL'],
      unitId: unitMap['DRUM'],
      specification: 'Industrial Heavy Duty Solvent Cleaner 20 Liter',
      brand: 'Chem-Tech',
      minimumStock: 3,
      maximumStock: 15,
      reorderPoint: 5,
      criticalStock: 1,
      isCritical: true,
      defaultWarehouseId: wh1.id,
    },
  ];

  const itemMap: Record<string, any> = {};
  for (const it of items) {
    const created = await prisma.item.upsert({
      where: { itemCode: it.itemCode },
      update: it,
      create: it,
    });
    itemMap[it.itemName] = created;
  }

  // 8. Suppliers
  const suppliers = [
    {
      supplierCode: 'SUP-001',
      supplierName: 'PT Mitra Perkasa Teknik (Vendor A)',
      address: 'Jl. Raya Industri No. 45, Cikarang',
      contactPerson: 'Anton Prasetyo',
      phone: '08123456789',
      email: 'sales@mitraperkasa.co.id',
      taxNumber: '01.234.567.8-012.000',
      paymentTerms: 'NET 30',
      leadTimeDays: 3,
    },
    {
      supplierCode: 'SUP-002',
      supplierName: 'CV Jaya Abadi Supplies (Vendor B)',
      address: 'Kawasan Niaga Kalimalang B-12, Bekasi',
      contactPerson: 'Linda Kusuma',
      phone: '08129876543',
      email: 'order@jayaabadi.com',
      taxNumber: '02.345.678.9-023.000',
      paymentTerms: 'NET 14',
      leadTimeDays: 7,
    },
    {
      supplierCode: 'SUP-003',
      supplierName: 'PT Global Sinar Mandiri (Vendor C)',
      address: 'Jl. Daan Mogot Km 11, Jakarta Barat',
      contactPerson: 'Rudi Hartono',
      phone: '08111223344',
      email: 'info@globalsinar.co.id',
      taxNumber: '03.456.789.0-034.000',
      paymentTerms: 'COD / Cash',
      leadTimeDays: 2,
    },
  ];

  const supplierMap: Record<string, string> = {};
  for (const s of suppliers) {
    const created = await prisma.supplier.upsert({
      where: { supplierCode: s.supplierCode },
      update: s,
      create: s,
    });
    supplierMap[s.supplierName] = created.id;
  }

  // 9. Configurable Approval Flows
  const flow1 = await prisma.approvalFlow.create({
    data: {
      name: 'Standard Procurement (< Rp 5 Juta)',
      minAmount: 0,
      maxAmount: 5000000,
      description: 'Persetujuan oleh Manager terkait',
      steps: {
        create: [
          { stepOrder: 1, roleId: roleMap['APPROVER'], requiredPosition: 'Manager' },
        ],
      },
    },
  });

  const flow2 = await prisma.approvalFlow.create({
    data: {
      name: 'Medium Procurement (Rp 5 Juta - Rp 50 Juta)',
      minAmount: 5000000,
      maxAmount: 50000000,
      description: 'Persetujuan berjenjang: Manager dan General Manager',
      steps: {
        create: [
          { stepOrder: 1, roleId: roleMap['APPROVER'], requiredPosition: 'Manager' },
          { stepOrder: 2, roleId: roleMap['APPROVER'], requiredPosition: 'General Manager' },
        ],
      },
    },
  });

  const flow3 = await prisma.approvalFlow.create({
    data: {
      name: 'High Value Procurement (> Rp 50 Juta)',
      minAmount: 50000000,
      maxAmount: null,
      description: 'Persetujuan berjenjang: Manager, GM, dan Direktur',
      steps: {
        create: [
          { stepOrder: 1, roleId: roleMap['APPROVER'], requiredPosition: 'Manager' },
          { stepOrder: 2, roleId: roleMap['APPROVER'], requiredPosition: 'General Manager' },
          { stepOrder: 3, roleId: roleMap['APPROVER'], requiredPosition: 'Director' },
        ],
      },
    },
  });

  // 10. Initial Stock Balances & Stock Ledger Transactions for in-stock items
  // Note: Bearing 6204ZZ starts with 0 stock to satisfy Section 42 Demo Workflow!
  const stockSeedItems = [
    { item: itemMap['Kowi'], qty: 12, loc: loc1.id, wh: wh1.id, cost: 850000 },
    { item: itemMap['Amplas P80'], qty: 25, loc: loc2.id, wh: wh1.id, cost: 75000 },
    { item: itemMap['Amplas P120'], qty: 18, loc: loc2.id, wh: wh1.id, cost: 75000 },
    { item: itemMap['Amplas P240'], qty: 20, loc: loc2.id, wh: wh1.id, cost: 78000 },
    { item: itemMap['Oil Seal TC 25-47-10'], qty: 15, loc: locMnt.id, wh: wh2.id, cost: 35000 },
    { item: itemMap['Oli Hydraulic VG 68'], qty: 4, loc: loc1.id, wh: wh1.id, cost: 4200000 },
    { item: itemMap['Baut M10 x 50 Hex Galvanized'], qty: 12, loc: locMnt.id, wh: wh2.id, cost: 120000 },
    { item: itemMap['Sarung Tangan Safety Nitrile'], qty: 30, loc: loc2.id, wh: wh1.id, cost: 85000 },
    { item: itemMap['Masker Respirator N95'], qty: 22, loc: loc2.id, wh: wh1.id, cost: 150000 },
  ];

  for (const s of stockSeedItems) {
    await prisma.stockBalance.upsert({
      where: {
        itemId_warehouseId_locationId: {
          itemId: s.item.id,
          warehouseId: s.wh,
          locationId: s.loc,
        },
      },
      update: { quantity: s.qty },
      create: {
        itemId: s.item.id,
        warehouseId: s.wh,
        locationId: s.loc,
        quantity: s.qty,
      },
    });

    await prisma.stockTransaction.create({
      data: {
        transactionNumber: `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        transactionType: 'STOCK_IN',
        itemId: s.item.id,
        warehouseId: s.wh,
        locationId: s.loc,
        referenceType: 'INITIAL_STOCK',
        referenceId: 'INIT-202610',
        quantity: s.qty,
        balanceBefore: 0,
        balanceAfter: s.qty,
        unitCost: s.cost,
        notes: 'Initial opening stock balance',
        createdBy: userMap['admin@golden.local'],
      },
    });
  }

  // 11. DEMO COMPLETE WORKFLOW AS EXPLICITLY REQUIRED IN SECTION 42:
  // PR-202610-0001
  // Requester: Maintenance (Budi)
  // Item: Bearing 6204ZZ
  // Quantity: 10
  // Stock: 0
  // Purchasing: Vendor A
  // Price: Rp 250.000
  // PO: Rp 2.500.000
  // Approval: Approved
  // Receiving: 10
  // Destination: User
  // Handover: Completed
  console.log('Seeding Master Demo Workflow (Section 42)...');

  const demoPR = await prisma.purchaseRequest.create({
    data: {
      prNumber: 'PR-202610-0001',
      requesterId: userMap['budi.maintenance@golden.local'],
      departmentId: deptMap['MNT'],
      priority: 'URGENT',
      purpose: 'Penggantian bearing motor gearbox line konveyor utama yang aus',
      notes: 'Harap diproses segera agar tidak downtime produksi',
      status: 'COMPLETED',
      items: {
        create: [
          {
            itemId: itemMap['Bearing 6204ZZ'].id,
            specification: 'Deep groove ball bearing 20x47x14 mm double metal shield',
            requestedQty: 10,
            unitId: unitMap['PCS'],
            estimatedPrice: 250000,
            availableStock: 0, // Stock checking = 0
            allocatedQty: 0,
            purchaseQty: 10,  // Purchase quantity = 10
            status: 'COMPLETED',
            notes: 'Stok gudang 0, harus dilakukan pembelian eksternal',
          },
        ],
      },
    },
    include: { items: true },
  });

  const prItemId = demoPR.items[0].id;
  const vendorAId = supplierMap['PT Mitra Perkasa Teknik (Vendor A)'];

  // Quotation comparison data
  const quotationA = await prisma.supplierQuotation.create({
    data: {
      quotationNumber: 'QUOT-VEND-A-001',
      prId: demoPR.id,
      supplierId: vendorAId,
      leadTimeDays: 3,
      paymentTerms: 'NET 30',
      totalAmount: 2500000,
      isSelected: true,
      selectionReason: 'Harga terbaik dan ketersediaan barang ready stock',
      notes: 'Garansi resmi SKF 6 bulan',
      items: {
        create: [
          {
            prItemId: prItemId,
            itemId: itemMap['Bearing 6204ZZ'].id,
            unitPrice: 250000,
            discount: 0,
            taxPercent: 0,
            subtotal: 2500000,
            leadTimeDays: 3,
          },
        ],
      },
    },
  });

  const quotationB = await prisma.supplierQuotation.create({
    data: {
      quotationNumber: 'QUOT-VEND-B-001',
      prId: demoPR.id,
      supplierId: supplierMap['CV Jaya Abadi Supplies (Vendor B)'],
      leadTimeDays: 7,
      paymentTerms: 'NET 14',
      totalAmount: 2700000,
      isSelected: false,
      selectionReason: 'Harga lebih tinggi dan lead time 7 hari',
      items: {
        create: [
          {
            prItemId: prItemId,
            itemId: itemMap['Bearing 6204ZZ'].id,
            unitPrice: 270000,
            discount: 0,
            taxPercent: 0,
            subtotal: 2700000,
            leadTimeDays: 7,
          },
        ],
      },
    },
  });

  // Purchase Order PO-202610-0001
  const demoPO = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-202610-0001',
      prId: demoPR.id,
      supplierId: vendorAId,
      poDate: new Date(),
      deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      paymentTerms: 'NET 30',
      shippingTerms: 'Franco Gudang Pabrik',
      currency: 'IDR',
      subtotal: 2500000,
      discount: 0,
      taxAmount: 0,
      totalAmount: 2500000,
      notes: 'Pengiriman langsung ke Gudang Utama ditujukan untuk maintenance konveyor',
      status: 'FULLY_RECEIVED',
      purchaseType: 'VENDOR',
      createdBy: userMap['purchasing@golden.local'],
      approvedBy: userMap['approver@golden.local'],
      approvedAt: new Date(),
      items: {
        create: [
          {
            prItemId: prItemId,
            itemId: itemMap['Bearing 6204ZZ'].id,
            specification: 'Deep groove ball bearing 20x47x14 mm double metal shield',
            quantity: 10,
            unitId: unitMap['PCS'],
            unitPrice: 250000,
            discount: 0,
            taxPercent: 0,
            subtotal: 2500000,
            receivedQty: 10,
            remainingQty: 0,
          },
        ],
      },
    },
    include: { items: true },
  });

  // Approval instance and log
  const appInst = await prisma.approvalInstance.create({
    data: {
      documentType: 'PO',
      documentId: demoPO.id,
      documentNumber: demoPO.poNumber,
      currentStep: 1,
      totalSteps: 1,
      status: 'APPROVED',
      logs: {
        create: [
          {
            stepOrder: 1,
            approverId: userMap['approver@golden.local'],
            action: 'APPROVE',
            comments: 'Disetujui. Urgent untuk kelancaran jalur produksi.',
          },
        ],
      },
    },
  });

  // Goods Receipt GR-202610-0001
  const demoGR = await prisma.goodsReceipt.create({
    data: {
      grNumber: 'GR-202610-0001',
      poId: demoPO.id,
      supplierId: vendorAId,
      arrivalDate: new Date(),
      receivedBy: 'Joko Gudang',
      deliveryNoteNumber: 'DN-MITRA-8891',
      invoiceNumber: 'INV-MITRA-2026-104',
      destination: 'USER_REQUEST', // Direct Handover to User
      qcStatus: 'PASSED',
      status: 'POSTED',
      notes: 'Kondisi barang 100% baik, segel utuh, spesifikasi sesuai PO',
      items: {
        create: [
          {
            poItemId: demoPO.items[0].id,
            itemId: itemMap['Bearing 6204ZZ'].id,
            warehouseId: wh1.id,
            locationId: loc1.id,
            orderQty: 10,
            receivedQty: 10,
            goodQty: 10,
            damagedQty: 0,
            rejectedQty: 0,
            remainingQty: 0,
            notes: 'Lolos inspeksi QC penerimaan',
          },
        ],
      },
    },
  });

  // Handover Document HO-202610-0001
  const demoHO = await prisma.handoverDocument.create({
    data: {
      hoNumber: 'HO-202610-0001',
      requesterId: userMap['budi.maintenance@golden.local'],
      departmentId: deptMap['MNT'],
      prId: demoPR.id,
      grId: demoGR.id,
      handoverDate: new Date(),
      receiverName: 'Budi Maintenance',
      receiverSignatureNote: 'Diterima lengkap dan langsung dipasang pada konveyor line 1',
      status: 'COMPLETED',
      notes: 'Serah terima barang selesai.',
      items: {
        create: [
          {
            itemId: itemMap['Bearing 6204ZZ'].id,
            quantity: 10,
            unitId: unitMap['PCS'],
            notes: 'Barang terpasang dengan baik',
          },
        ],
      },
    },
  });

  // Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        userId: userMap['budi.maintenance@golden.local'],
        userName: 'Budi Maintenance',
        action: 'CREATE_PR',
        module: 'PR',
        documentNumber: 'PR-202610-0001',
        newValue: 'Submitted PR with 1 item (10 pcs Bearing)',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      {
        userId: userMap['gudang@golden.local'],
        userName: 'Joko Gudang',
        action: 'WAREHOUSE_CHECK',
        module: 'WAREHOUSE',
        documentNumber: 'PR-202610-0001',
        newValue: 'Stock available: 0, purchase qty: 10',
        ipAddress: '127.0.0.1',
      },
      {
        userId: userMap['purchasing@golden.local'],
        userName: 'Siti Purchasing',
        action: 'CREATE_PO',
        module: 'PO',
        documentNumber: 'PO-202610-0001',
        newValue: 'PO Created with Vendor A Rp 2.500.000',
        ipAddress: '127.0.0.1',
      },
      {
        userId: userMap['approver@golden.local'],
        userName: 'Hendra Manager',
        action: 'APPROVE_PO',
        module: 'APPROVAL',
        documentNumber: 'PO-202610-0001',
        newValue: 'Approved step 1/1',
        ipAddress: '127.0.0.1',
      },
      {
        userId: userMap['gudang@golden.local'],
        userName: 'Joko Gudang',
        action: 'RECEIVE_GOODS',
        module: 'RECEIVING',
        documentNumber: 'GR-202610-0001',
        newValue: 'Received 10 pcs, QC Passed 10 pcs, Dest: USER_REQUEST',
        ipAddress: '127.0.0.1',
      },
      {
        userId: userMap['budi.maintenance@golden.local'],
        userName: 'Budi Maintenance',
        action: 'HANDOVER_CONFIRMED',
        module: 'HANDOVER',
        documentNumber: 'HO-202610-0001',
        newValue: 'User confirmed receipt of 10 pcs Bearing',
        ipAddress: '127.0.0.1',
      },
    ],
  });

  // Document Sequences
  await prisma.documentSequence.createMany({
    data: [
      { prefix: 'PR', yearMonth: '202610', lastSequence: 1 },
      { prefix: 'PO', yearMonth: '202610', lastSequence: 1 },
      { prefix: 'GR', yearMonth: '202610', lastSequence: 1 },
      { prefix: 'GI', yearMonth: '202610', lastSequence: 0 },
      { prefix: 'HO', yearMonth: '202610', lastSequence: 1 },
      { prefix: 'DP', yearMonth: '202610', lastSequence: 0 },
    ],
  });

  // System Settings
  await prisma.systemSetting.createMany({
    data: [
      { key: 'COMPANY_NAME', value: 'GOLDEN INDUSTRIAL MANUFACTURING' },
      { key: 'ALLOW_NEGATIVE_STOCK', value: 'false' },
      { key: 'REQUIRE_QC_INSPECTION', value: 'true' },
      { key: 'CURRENCY_CODE', value: 'IDR' },
    ],
  });

  // Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: userMap['budi.maintenance@golden.local'],
        title: 'Serah Terima Selesai',
        message: 'Barang Bearing 6204ZZ untuk PR-202610-0001 telah selesai diserahterimakan.',
        link: '/handovers',
        isRead: false,
      },
      {
        userId: userMap['purchasing@golden.local'],
        title: 'PO Selesai Diterima',
        message: 'PO-202610-0001 (Vendor A) telah diterima lengkap oleh gudang.',
        link: '/goods-receipts',
        isRead: true,
      },
    ],
  });

  console.log('--- Database Seeding Completed Successfully! ---');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
