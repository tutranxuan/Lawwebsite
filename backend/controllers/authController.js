const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

exports.register = async (req, res) => {
    try {
        const { username, email, password, full_name } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
        }
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' });
        }
        const existingEmail = await User.findOne({ where: { email } });
        if (existingEmail) {
            return res.status(400).json({ message: 'Email đã tồn tại' });
        }
        const password_hash = await bcrypt.hash(password, 10);
        const user = await User.create({ username, email, password_hash, full_name });
        res.status(201).json({ message: 'Đăng ký thành công' });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Thiếu thông tin đăng nhập' });
        }
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(400).json({ message: 'Sai tên đăng nhập hoặc mật khẩu' });
        }
        if (user.status === 'Inactive') {
            return res.status(403).json({ message: 'Tài khoản của bạn chưa được kích hoạt hoặc đã bị khóa.' });
        }
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(400).json({ message: 'Sai tên đăng nhập hoặc mật khẩu' });
        }
        // Tạo token
        const token = jwt.sign({ user_id: user.user_id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        // Cập nhật last_login
        user.last_login = new Date();
        await user.save();
        res.json({ token, user: { user_id: user.user_id, username: user.username, role: user.role, email: user.email, full_name: user.full_name, status: user.status } });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

exports.getMe = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'Thiếu token' });
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findByPk(decoded.user_id);
        if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });
        res.json({ user_id: user.user_id, username: user.username, role: user.role, email: user.email, full_name: user.full_name, status: user.status });
    } catch (error) {
        res.status(401).json({ message: 'Token không hợp lệ hoặc hết hạn' });
    }
}; 