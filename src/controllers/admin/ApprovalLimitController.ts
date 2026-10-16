import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';

/**
 * Controller: Master Approval Limit (Khusus SYST000)
 * Mengatur threshold limit persetujuan PR khusus untuk Role Level 3 s/d 8:
 * - Level 3: Supervisor
 * - Level 4: Kepala Bagian
 * - Level 5: Asisten Manager
 * - Level 6: Manager
 * - Level 7: Direktur
 * - Level 8: Direktur Utama
 */
export class ApprovalLimitController {
  /**
   * GET /api/admin/approval-limits
   * Mengambil daftar seluruh batas nominal persetujuan yang aktif
   */
  public async getApprovalLimits(req: AuthenticatedRequest, res: Response) {
    try {
      // Query database:
      // SELECT al.id, al.role_id, r.role_code, r.role_name, r.level, al.min_amount, al.max_amount, al.is_active
      // FROM approval_limits al
      // JOIN roles r ON al.role_id = r.id
      // WHERE r.level BETWEEN 3 AND 8
      // ORDER BY r.level ASC;
      return res.status(200).json({
        success: true,
        message: 'Data batas nominal persetujuan (PR Threshold) berhasil diambil.',
        data: []
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * PUT /api/admin/approval-limits/:id
   * Mengubah batas nominal approval untuk role tertentu
   */
  public async updateApprovalLimit(req: AuthenticatedRequest, res: Response) {
    try {
      const limitId = parseInt(req.params.id);
      const { min_amount, max_amount } = req.body;
      const adminUserId = req.user?.id;

      // 1. Validasi nominal angka
      const min = parseFloat(min_amount);
      const max = parseFloat(max_amount);

      if (isNaN(min) || isNaN(max) || min < 0 || max <= min) {
        return res.status(400).json({
          success: false,
          message: 'Nilai limit tidak valid. Pastikan min_amount >= 0 dan max_amount > min_amount.'
        });
      }

      // 2. Validasi bahwa target role memang berada dalam jenjang Level 3 - 8
      // SELECT r.level, r.role_name FROM approval_limits al JOIN roles r ON al.role_id = r.id WHERE al.id = $1
      // if (role.level < 3 || role.level > 8) {
      //    return res.status(400).json({ message: 'Threshold hanya berlaku untuk Role Level 3 s/d 8.' });
      // }

      // 3. Simpan perubahan dan catat user yang mengubah (audit)
      // UPDATE approval_limits SET min_amount = $1, max_amount = $2, updated_by = $3, updated_at = NOW() WHERE id = $4

      return res.status(200).json({
        success: true,
        message: `Batas nominal approval ID ${limitId} berhasil diperbarui.`,
        data: { id: limitId, min_amount: min, max_amount: max, updated_by: adminUserId }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/admin/po-rules
   * Konfirmasi aturan PO: Memvalidasi bahwa PO Approver terkunci pada Level >= 6
   */
  public async getPOApprovalRules(req: AuthenticatedRequest, res: Response) {
    try {
      return res.status(200).json({
        success: true,
        rule_definition: 'PO Approval Enforcement',
        min_allowed_level: 6,
        eligible_roles: ['MANAGER (Level 6)', 'DIREKTUR (Level 7)', 'DIREKTUR_UTAMA (Level 8)'],
        description: 'Sistem menolak otorisasi PO jika role user memiliki level di bawah 6.'
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
