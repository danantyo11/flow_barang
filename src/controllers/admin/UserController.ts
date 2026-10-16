import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';

/**
 * Controller: User Management (Khusus SYST000)
 */
export class AdminUserController {
  /**
   * GET /api/admin/users
   * List all users with department and role info
   */
  public async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      // Logic: SELECT u.id, u.username, u.email, u.full_name, u.is_active, r.role_code, r.role_name, r.level, d.name as department_name
      // FROM users u JOIN roles r ON u.role_id = r.id LEFT JOIN departments d ON u.department_id = d.id;
      return res.status(200).json({
        success: true,
        message: 'Daftar user berhasil diambil.',
        data: []
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/admin/users
   * Create a new employee/user
   */
  public async createUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { username, email, password, full_name, role_id, department_id } = req.body;

      // 1. Validasi input
      if (!username || !email || !password || !full_name || !role_id) {
        return res.status(400).json({
          success: false,
          message: 'Kolom username, email, password, full_name, dan role_id wajib diisi.'
        });
      }

      // 2. Cek keunikan username & email di database
      // const existing = await db.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
      // if (existing.rowCount > 0) return res.status(409).json({ message: 'Username atau Email sudah terdaftar.' });

      // 3. Hash password (e.g. bcrypt.hash(password, 10))
      // 4. Insert data user baru
      return res.status(201).json({
        success: true,
        message: `User '${username}' berhasil didaftarkan.`,
        data: { username, email, full_name, role_id, department_id, is_active: true }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * PUT /api/admin/users/:id
   * Update employee details (Role, Department, Full Name, Status)
   */
  public async updateUser(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = parseInt(req.params.id);
      const { full_name, role_id, department_id, is_active } = req.body;

      // Validasi keberadaan user
      // Proteksi: jangan izinkan menonaktifkan akun SYST000 terakhir
      return res.status(200).json({
        success: true,
        message: `User ID ${userId} berhasil diperbarui.`
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /api/admin/users/:id/toggle-status
   * Activate / Deactivate employee account
   */
  public async toggleUserStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = parseInt(req.params.id);
      const { is_active } = req.body;

      // Update status di database
      return res.status(200).json({
        success: true,
        message: `Status user ID ${userId} diubah menjadi ${is_active ? 'Aktif' : 'Non-aktif'}.`
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
