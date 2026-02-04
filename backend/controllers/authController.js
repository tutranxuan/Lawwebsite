const User = require('../models/User');
const LawyerProfile = require('../models/LawyerProfile');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const { sendAdminNotification } = require('../config/emailconfig');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';

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
        if (user.status === 'Rejected') {
            return res.status(403).json({ message: 'Hồ sơ luật sư đã bị từ chối.' });
        }
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(400).json({ message: 'Sai tên đăng nhập hoặc mật khẩu' });
        }
        // Tạo token
        const token = jwt.sign({ user_id: user.user_id, username: user.username, role: user.role, full_name: user.full_name || null }, JWT_SECRET, { expiresIn: '7d' });
        // Cập nhật last_login
        user.last_login = new Date();
        await user.save();
        const userPayload = { user_id: user.user_id, username: user.username, role: user.role, email: user.email, full_name: user.full_name, status: user.status };
        if (user.role === 'Lawyer' && user.status === 'Active') {
            const LawyerProfile = require('../models/LawyerProfile');
            const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
            const profile = await LawyerProfile.findOne({ where: { user_id: user.user_id } });
            if (profile && profile.portrait_path) {
                userPayload.portrait_path = profile.portrait_path.startsWith('http') ? profile.portrait_path : BASE_URL + profile.portrait_path;
            }
        }
        res.json({ token, user: userPayload });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

exports.registerLawyer = async (req, res) => {
    try {
        const body = req.body || {};
        const username = (body.username || '').trim();
        const email = (body.email || '').trim();
        const password = body.password || '';
        const full_name = (body.full_name_legal || body.full_name || '').trim();
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Thiếu tên đăng nhập, email hoặc mật khẩu' });
        }
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' });
        const existingEmail = await User.findOne({ where: { email } });
        if (existingEmail) return res.status(400).json({ message: 'Email đã tồn tại' });

        const password_hash = await bcrypt.hash(password, 10);
        const user = await User.create({
            username,
            email,
            password_hash,
            full_name,
            role: 'Lawyer',
            status: 'Inactive'
        });

        const toPath = (f) => {
            if (!f || !f[0] || !f[0].filename) return null;
            return '/' + path.join('uploads', 'lawyers', f[0].filename).replace(/\\/g, '/');
        };
        const files = req.files || {};
        const yearsVal = body.years_experience ? parseInt(body.years_experience, 10) : null;
        const profileData = {
            user_id: user.user_id,
            full_name_legal: full_name || null,
            portrait_path: toPath(files.portrait),
            id_number: body.id_number || null,
            id_issue_date: body.id_issue_date || null,
            id_issue_place: body.id_issue_place || null,
            id_front_path: toPath(files.id_front),
            id_back_path: toPath(files.id_back),
            lawyer_card_number: body.lawyer_card_number || null,
            bar_association: body.bar_association || null,
            lawyer_card_photo_path: toPath(files.lawyer_card_photo),
            organization_name: body.organization_name || null,
            specialization: body.specialization || null,
            years_experience: (yearsVal !== undefined && !isNaN(yearsVal)) ? yearsVal : null,
            bio: body.bio || null,
            other_qualifications: body.other_qualifications || null,
            phone: body.phone || null,
            office_address: body.office_address || null
        };
        
        await LawyerProfile.create(profileData);
        const admin = await User.findOne({
            where: { role: 'Admin' }, 
            attributes: ['email']    
        });

        if (admin && admin.email) {
            // Gửi thông báo đến email tìm được
            await sendAdminNotification(admin.email);
        }
        res.status(201).json({
            message: 'Đăng ký hồ sơ luật sư thành công. Tài khoản sẽ được kích hoạt sau khi Admin duyệt.',
            user_id: user.user_id
        });
    } catch (error) {
        console.error('registerLawyer error:', error);
        res.status(500).json({
            message: 'Lỗi server',
            error: error.message || String(error)
        });
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