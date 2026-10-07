import { PrismaClient } from '@prisma/client';

export type StockTransactionType =
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'TRANSFER'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'RETURN'
  | 'RECEIVING'
  | 'ISSUE';

export interface StockChangeParams {
  transactionType: StockTransactionType;
  itemId: string;
  warehouseId: string;
  locationId?: string | null;
  referenceType: string; // PR, PO, GR, GI, HO, DP, ADJUSTMENT
  referenceId: string;
  quantity: number; // positive number of units to add or deduct
  unitCost?: number | null;
  notes?: string;
  userId?: string;
}

export class StockEngine {
  /**
   * Post a stock movement transaction with full double-entry ledger tracking.
   * Can be run inside an existing Prisma transaction or standalone.
   */
  static async recordMovement(
    prismaClient: PrismaClient | any,
    params: StockChangeParams
  ) {
    const {
      transactionType,
      itemId,
      warehouseId,
      locationId,
      referenceType,
      referenceId,
      quantity,
      unitCost,
      notes,
      userId,
    } = params;

    if (quantity <= 0) {
      throw new Error('Quantity must be greater than zero');
    }

    // Determine sign: Is this addition or deduction?
    const isAddition = [
      'STOCK_IN',
      'ADJUSTMENT_IN',
      'RETURN',
      'RECEIVING',
    ].includes(transactionType);

    const signedQty = isAddition ? quantity : -quantity;

    // Fetch or initialize current balance
    const balanceWhere: any = {
      itemId,
      warehouseId,
    };
    if (locationId) {
      balanceWhere.locationId = locationId;
    }

    let currentBalance = await prismaClient.stockBalance.findFirst({
      where: balanceWhere,
    });

    const balanceBefore = currentBalance ? currentBalance.quantity : 0;
    const balanceAfter = balanceBefore + signedQty;

    // Check system setting for negative stock
    if (balanceAfter < 0) {
      const allowNegativeSetting = await prismaClient.systemSetting.findUnique({
        where: { key: 'ALLOW_NEGATIVE_STOCK' },
      });
      const allowNegative = allowNegativeSetting?.value === 'true';

      if (!allowNegative) {
        const item = await prismaClient.item.findUnique({ where: { id: itemId } });
        throw new Error(
          `Stok tidak mencukupi untuk barang "${item?.itemName || itemId}". Stok saat ini: ${balanceBefore}, dibutuhkan: ${quantity}. Transaksi dibatalkan.`
        );
      }
    }

    // Upsert the balance record
    if (currentBalance) {
      await prismaClient.stockBalance.update({
        where: { id: currentBalance.id },
        data: { quantity: balanceAfter },
      });
    } else {
      currentBalance = await prismaClient.stockBalance.create({
        data: {
          itemId,
          warehouseId,
          locationId: locationId || null,
          quantity: balanceAfter,
        },
      });
    }

    // Generate unique transaction reference
    const txNumber = `TX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Create the immutable stock ledger entry
    const transaction = await prismaClient.stockTransaction.create({
      data: {
        transactionNumber: txNumber,
        transactionType,
        itemId,
        warehouseId,
        locationId: locationId || currentBalance?.locationId || null,
        referenceType,
        referenceId,
        quantity: signedQty,
        balanceBefore,
        balanceAfter,
        unitCost: unitCost || null,
        notes,
        createdBy: userId || null,
      },
    });

    return {
      transaction,
      balanceBefore,
      balanceAfter,
    };
  }

  /**
   * Get stock balance status for an item across all warehouses
   */
  static async getItemStockStatus(
    prismaClient: PrismaClient | any,
    itemId: string
  ) {
    const item = await prismaClient.item.findUnique({
      where: { id: itemId },
      include: {
        unit: true,
        category: true,
      },
    });

    if (!item) throw new Error('Barang tidak ditemukan');

    const balances = await prismaClient.stockBalance.findMany({
      where: { itemId },
      include: {
        warehouse: true,
        location: true,
      },
    });

    const totalQuantity = balances.reduce((sum: number, b: any) => sum + b.quantity, 0);

    let status = 'NORMAL';
    if (totalQuantity <= item.criticalStock) {
      status = 'CRITICAL';
    } else if (totalQuantity <= item.minimumStock) {
      status = 'LOW_STOCK';
    }

    return {
      item,
      totalQuantity,
      status,
      balances,
    };
  }
}
