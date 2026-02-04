const User = require('../models/User');

// Lấy danh sách user (chỉ admin)
exports.getAllUsers = async (req, res) => {
    try {
        if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Chỉ admin mới được xem danh sách user' });
        const users = await User.findAll({
            attributes: ['user_id', 'username', 'email', 'full_name', 'role', 'status', 'registration_date', 'last_login']
        });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Admin cập nhật status user
exports.updateUserStatus = async (req, res) => {
    try {
        if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Chỉ admin mới được cập nhật status user' });
        const { id } = req.params;
        const { status } = req.body;
        if (!['Active', 'Inactive', 'Banned', 'Rejected'].includes(status)) return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });
        user.status = status;
        await user.save();
        res.json({ message: 'Cập nhật trạng thái thành công', user });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// User tự sửa thông tin cá nhân
exports.updateProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.user_id);
        if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });
        const { full_name, email, password } = req.body;
        if (full_name) user.full_name = full_name;
        if (email) user.email = email;
        if (password) {
            const bcrypt = require('bcrypt');
            user.password_hash = await bcrypt.hash(password, 10);
        }
        await user.save();
        res.json({ message: 'Cập nhật thông tin thành công', user: { user_id: user.user_id, username: user.username, email: user.email, full_name: user.full_name, role: user.role, status: user.status } });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
}; 