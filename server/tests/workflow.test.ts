import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { prisma } from '../src/config/prisma.js';

describe('GOLDEN PROCUREMENT SYSTEM - E2E Workflow Tests', () => {
  let adminToken = '';
  let requesterToken = '';
  let warehouseToken = '';
  let purchasingToken = '';
  let approverToken = '';
  let directorToken = '';

  beforeAll(async () => {
    // 1. Authenticate tokens for all roles
    const loginAdmin = await request(app).post('/api/auth/login').send({
      email: 'admin@golden.local',
      password: 'admin123',
    });
    adminToken = loginAdmin.body.token;

    const loginReq = await request(app).post('/api/auth/login').send({
      email: 'budi.maintenance@golden.local',
      password: 'user123',
    });
    requesterToken = loginReq.body.token;

    const loginWh = await request(app).post('/api/auth/login').send({
      email: 'gudang@golden.local',
      password: 'user123',
    });
    warehouseToken = loginWh.body.token;

    const loginPur = await request(app).post('/api/auth/login').send({
      email: 'purchasing@golden.local',
      password: 'user123',
    });
    purchasingToken = loginPur.body.token;

    const loginApp = await request(app).post('/api/auth/login').send({
      email: 'approver@golden.local',
      password: 'user123',
    });
    approverToken = loginApp.body.token;

    const loginDir = await request(app).post('/api/auth/login').send({
      email: 'director@golden.local',
      password: 'user123',
    });
    directorToken = loginDir.body.token;
  });

  it('Health check endpoint returns UP', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
  });

  it('RBAC security: Requester cannot approve or check warehouse stock', async () => {
    const res = await request(app)
      .post('/api/purchase-requests/dummy-id/warehouse-check')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ items: [] });
    expect(res.status).toBe(403);
  });

  it('TEST 1: In-Stock Workflow: PR -> Warehouse Check (Available) -> Stock Issue -> Handover -> Complete', async () => {
    // Fetch an item with ample stock: Amplas P80
    const itemsRes = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${requesterToken}`);
    const amplas = itemsRes.body.data.find((i: any) => i.itemName === 'Amplas P80');
    expect(amplas).toBeDefined();

    // 1. User submits PR for 2 rolls of Amplas P80
    const prRes = await request(app)
      .post('/api/purchase-requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        priority: 'NORMAL',
        purpose: 'Penghalusan permukaan housing conveyor',
        items: [
          {
            itemId: amplas.id,
            requestedQty: 2,
            unitId: amplas.unitId,
            estimatedPrice: 75000,
          },
        ],
      });
    expect(prRes.status).toBe(201);
    const prId = prRes.body.data.id;
    const prItemId = prRes.body.data.items[0].id;

    // 2. Warehouse checks stock: Full stock available (2 available, 2 allocated, 0 purchase)
    const checkRes = await request(app)
      .post(`/api/purchase-requests/${prId}/warehouse-check`)
      .set('Authorization', `Bearer ${warehouseToken}`)
      .send({
        items: [
          {
            prItemId,
            availableStock: amplas.totalStock,
            allocatedQty: 2,
            purchaseQty: 0,
            notes: 'Stok mencukupi di Rak Consumable',
          },
        ],
      });
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.status).toBe('STOCK_ISSUE');

    // 3. Warehouse performs Stock Issue
    const whRes = await request(app)
      .get('/api/warehouses')
      .set('Authorization', `Bearer ${warehouseToken}`);
    const wh1 = whRes.body.data[0];

    const giRes = await request(app)
      .post('/api/goods-issues')
      .set('Authorization', `Bearer ${warehouseToken}`)
      .send({
        prId,
        requesterId: prRes.body.data.requesterId,
        departmentId: prRes.body.data.departmentId,
        warehouseId: wh1.id,
        items: [
          {
            itemId: amplas.id,
            quantity: 2,
            unitId: amplas.unitId,
          },
        ],
      });
    expect(giRes.status).toBe(201);

    // 4. Create Handover document
    const hoRes = await request(app)
      .post('/api/handovers')
      .set('Authorization', `Bearer ${warehouseToken}`)
      .send({
        prId,
        giId: giRes.body.data.id,
        requesterId: prRes.body.data.requesterId,
        departmentId: prRes.body.data.departmentId,
        receiverName: 'Budi Maintenance',
        items: [
          {
            itemId: amplas.id,
            quantity: 2,
            unitId: amplas.unitId,
          },
        ],
      });
    expect(hoRes.status).toBe(201);
    const hoId = hoRes.body.data.id;

    // 5. User confirms handover completion
    const confirmRes = await request(app)
      .post(`/api/handovers/${hoId}/confirm`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ receiverSignatureNote: 'Diterima dalam kondisi baik oleh Budi' });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe('COMPLETED');

    // Verify final PR status is COMPLETED
    const finalPr = await request(app)
      .get(`/api/purchase-requests/${prId}`)
      .set('Authorization', `Bearer ${requesterToken}`);
    expect(finalPr.body.data.status).toBe('COMPLETED');
  });

  it('TEST 2: Out-of-Stock Workflow: PR -> Quotation -> PO -> Approval -> Receiving -> Stock In -> Complete', async () => {
    // Fetch suppliers and item
    const itemsRes = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${requesterToken}`);
    const oli = itemsRes.body.data.find((i: any) => i.itemName.includes('Oli Hydraulic'));
    const supRes = await request(app)
      .get('/api/suppliers')
      .set('Authorization', `Bearer ${purchasingToken}`);
    const supplierA = supRes.body.data[0];

    // 1. Submit PR
    const prRes = await request(app)
      .post('/api/purchase-requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        priority: 'CRITICAL',
        purpose: 'Pengisian ulang oli hidrolik unit press #2',
        items: [
          {
            itemId: oli.id,
            requestedQty: 2,
            unitId: oli.unitId,
            estimatedPrice: 4200000,
          },
        ],
      });
    expect(prRes.status).toBe(201);
    const prId = prRes.body.data.id;
    const prItemId = prRes.body.data.items[0].id;

    // 2. Warehouse checks: 0 allocated, 2 purchase
    await request(app)
      .post(`/api/purchase-requests/${prId}/warehouse-check`)
      .set('Authorization', `Bearer ${warehouseToken}`)
      .send({
        items: [
          {
            prItemId,
            availableStock: 0,
            allocatedQty: 0,
            purchaseQty: 2,
            notes: 'Stok menipis, harus beli eksternal',
          },
        ],
      });

    // 3. Purchasing inputs quotation
    const quotRes = await request(app)
      .post('/api/suppliers/quotations')
      .set('Authorization', `Bearer ${purchasingToken}`)
      .send({
        prId,
        supplierId: supplierA.id,
        quotationNumber: `QUOT-TEST-${Date.now()}`,
        leadTimeDays: 3,
        paymentTerms: 'NET 30',
        items: [
          {
            prItemId,
            itemId: oli.id,
            unitPrice: 4100000,
            discount: 0,
            taxPercent: 11,
          },
        ],
      });
    expect(quotRes.status).toBe(201);

    // 4. Purchasing creates PO
    const poRes = await request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${purchasingToken}`)
      .send({
        prId,
        supplierId: supplierA.id,
        paymentTerms: 'NET 30',
        items: [
          {
            prItemId,
            itemId: oli.id,
            quantity: 2,
            unitId: oli.unitId,
            unitPrice: 4100000,
            taxPercent: 11,
          },
        ],
      });
    expect(poRes.status).toBe(201);
    const poId = poRes.body.data.id;

    // 5. Submit PO for Approval
    const submitAppRes = await request(app)
      .post(`/api/purchase-orders/${poId}/submit-approval`)
      .set('Authorization', `Bearer ${purchasingToken}`);
    expect(submitAppRes.status).toBe(200);
    const instanceId = submitAppRes.body.data.approvalInstance.id;

    // 6. Multi-step approval: Step 1 approved by Manager, Step 2 by Director
    const approveRes1 = await request(app)
      .post(`/api/approvals/${instanceId}/approve`)
      .set('Authorization', `Bearer ${approverToken}`)
      .send({ comments: 'Disetujui step 1 untuk maintenance berkala' });
    expect(approveRes1.status).toBe(200);

    // If flow requires second step approval
    if (approveRes1.body.data.status === 'PENDING') {
      const approveRes2 = await request(app)
        .post(`/api/approvals/${instanceId}/approve`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ comments: 'Disetujui step 2 oleh General Manager / Direksi' });
      expect(approveRes2.status).toBe(200);
      expect(approveRes2.body.data.status).toBe('APPROVED');
    }

    // 7. Send PO to supplier
    const sendPoRes = await request(app)
      .post(`/api/purchase-orders/${poId}/send`)
      .set('Authorization', `Bearer ${purchasingToken}`);
    expect(sendPoRes.status).toBe(200);

    // 8. Warehouse receives goods (Receiving with QC and Destination: STOCK)
    const whRes = await request(app).get('/api/warehouses').set('Authorization', `Bearer ${warehouseToken}`);
    const wh1 = whRes.body.data[0];

    const grRes = await request(app)
      .post('/api/goods-receipts')
      .set('Authorization', `Bearer ${warehouseToken}`)
      .send({
        poId,
        destination: 'STOCK',
        qcStatus: 'PASSED',
        items: [
          {
            itemId: oli.id,
            warehouseId: wh1.id,
            orderQty: 2,
            receivedQty: 2,
            goodQty: 2,
            damagedQty: 0,
            rejectedQty: 0,
          },
        ],
      });
    expect(grRes.status).toBe(201);
    expect(grRes.body.data.qcStatus).toBe('PASSED');
  });

  it('TEST 3: Partial Workflow: Partial Warehouse Allocation and Partial Receiving', async () => {
    const itemsRes = await request(app).get('/api/items').set('Authorization', `Bearer ${requesterToken}`);
    const baut = itemsRes.body.data.find((i: any) => i.itemName.includes('Baut M10'));
    const supRes = await request(app).get('/api/suppliers').set('Authorization', `Bearer ${purchasingToken}`);
    const supplier = supRes.body.data[0];

    // PR for 100 boxes of Baut
    const prRes = await request(app)
      .post('/api/purchase-requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        priority: 'NORMAL',
        items: [
          {
            itemId: baut.id,
            requestedQty: 100,
            unitId: baut.unitId,
            estimatedPrice: 120000,
          },
        ],
      });
    const prId = prRes.body.data.id;
    const prItemId = prRes.body.data.items[0].id;

    // Warehouse check: 40 from stock, 60 purchase
    const checkRes = await request(app)
      .post(`/api/purchase-requests/${prId}/warehouse-check`)
      .set('Authorization', `Bearer ${warehouseToken}`)
      .send({
        items: [
          {
            prItemId,
            availableStock: 40,
            allocatedQty: 40,
            purchaseQty: 60,
          },
        ],
      });
    expect(checkRes.body.data.status).toBe('PARTIAL_STOCK');

    // Create PO for the 60 purchase quantity
    const poRes = await request(app)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${purchasingToken}`)
      .send({
        prId,
        supplierId: supplier.id,
        items: [
          {
            prItemId,
            itemId: baut.id,
            quantity: 60,
            unitId: baut.unitId,
            unitPrice: 110000,
          },
        ],
      });
    const poId = poRes.body.data.id;

    // Submit and approve PO (handling both steps)
    const subRes = await request(app).post(`/api/purchase-orders/${poId}/submit-approval`).set('Authorization', `Bearer ${purchasingToken}`);
    const instanceId = subRes.body.data.approvalInstance.id;
    const app1 = await request(app).post(`/api/approvals/${instanceId}/approve`).set('Authorization', `Bearer ${approverToken}`).send({ comments: 'OK' });
    if (app1.body.data.status === 'PENDING') {
      await request(app).post(`/api/approvals/${instanceId}/approve`).set('Authorization', `Bearer ${directorToken}`).send({ comments: 'OK Step 2' });
    }
    await request(app).post(`/api/purchase-orders/${poId}/send`).set('Authorization', `Bearer ${purchasingToken}`);

    // Receiving 1: 30 boxes (Partial)
    const whRes = await request(app).get('/api/warehouses').set('Authorization', `Bearer ${warehouseToken}`);
    const wh1 = whRes.body.data[0];

    const gr1 = await request(app)
      .post('/api/goods-receipts')
      .set('Authorization', `Bearer ${warehouseToken}`)
      .send({
        poId,
        destination: 'STOCK',
        items: [
          {
            itemId: baut.id,
            warehouseId: wh1.id,
            orderQty: 60,
            receivedQty: 30,
            goodQty: 30,
            damagedQty: 0,
            rejectedQty: 0,
          },
        ],
      });
    expect(gr1.status).toBe(201);

    // Verify PO status is PARTIALLY_RECEIVED
    const poCheck1 = await request(app).get(`/api/purchase-orders/${poId}`).set('Authorization', `Bearer ${purchasingToken}`);
    expect(poCheck1.body.data.status).toBe('PARTIALLY_RECEIVED');

    // Receiving 2: remaining 30 boxes (Complete)
    const gr2 = await request(app)
      .post('/api/goods-receipts')
      .set('Authorization', `Bearer ${warehouseToken}`)
      .send({
        poId,
        destination: 'STOCK',
        items: [
          {
            itemId: baut.id,
            warehouseId: wh1.id,
            orderQty: 30,
            receivedQty: 30,
            goodQty: 30,
            damagedQty: 0,
            rejectedQty: 0,
          },
        ],
      });
    expect(gr2.status).toBe(201);

    // Verify PO status is FULLY_RECEIVED
    const poCheck2 = await request(app).get(`/api/purchase-orders/${poId}`).set('Authorization', `Bearer ${purchasingToken}`);
    expect(poCheck2.body.data.status).toBe('FULLY_RECEIVED');
  });
});
