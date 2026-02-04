const { User, LawyerProfile } = require('../models');
const path = require('path');
const { sendLawyerApprovalNotification, sendLawyerRejectionNotification } = require('../config/emailconfig');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';

function addBaseUrl(p) {
    if (!p) return null;
    return p.startsWith('http') ? p : BASE_URL + p;
}

function normalizeProfile(profile) {
    if (!profile) return null;
    const p = profile.toJSON ? profile.toJSON() : profile;
    ['portrait_path', 'id_front_path', 'id_back_path', 'lawyer_card_photo_path'].forEach(f => {
        if (p[f]) p[f] = addBaseUrl(p[f]);
    });
    return p;
}

// Danh sách luật sư chờ duyệt (Admin)
exports.getPending = async (req, res) => {
    try {
        if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Chỉ Admin mới được xem' });
        const users = await User.findAll({
            where: { role: 'Lawyer', status: 'Inactive' },
            include: [{ model: LawyerProfile, required: false }],
            order: [['registration_date', 'DESC']]
        });
        const list = users.map(u => {
            const uu = u.toJSON();
            if (uu.LawyerProfile) uu.LawyerProfile = normalizeProfile(uu.LawyerProfile);
            return uu;
        });
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Chi tiết 1 luật sư (Admin)
exports.getById = async (req, res) => {
    try {
        if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Chỉ Admin mới được xem' });
        const user = await User.findByPk(req.params.id, {
            include: [{ model: LawyerProfile, required: false }]
        });
        if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });
        if (user.role !== 'Lawyer') return res.status(404).json({ message: 'Không phải tài khoản luật sư' });
        const uu = user.toJSON();
        if (uu.LawyerProfile) uu.LawyerProfile = normalizeProfile(uu.LawyerProfile);
        res.json(uu);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Duyệt luật sư -> kích hoạt tài khoản (Admin)
exports.approve = async (req, res) => {
    try {
        if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Chỉ Admin mới được duyệt' });
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });
        if (user.role !== 'Lawyer') return res.status(400).json({ message: 'Không phải tài khoản luật sư' });
        user.status = 'Active';
        await user.save();
        // Gửi email thông báo kích hoạt
        if (user.email) {
            await sendLawyerApprovalNotification(user.email, user.full_name || user.username);
        }
        res.json({ message: 'Đã duyệt và kích hoạt tài khoản luật sư.', user: { user_id: user.user_id, status: user.status } });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Từ chối luật sư (Admin)
exports.reject = async (req, res) => {
    try {
        if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Chỉ Admin mới được từ chối' });
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });
        if (user.role !== 'Lawyer') return res.status(400).json({ message: 'Không phải tài khoản luật sư' });
        user.status = 'Rejected';
        await user.save();
        if (user.email) {
            await sendLawyerRejectionNotification(user.email, user.full_name || user.username);
        }
        res.json({ message: 'Đã từ chối hồ sơ luật sư.', user: { user_id: user.user_id, status: user.status } });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Công khai: xem thông tin user/luật sư (cho modal hồ sơ khi click vào nick)
const PUBLIC_PROFILE_ATTRS = ['full_name_legal', 'portrait_path', 'specialization', 'years_experience', 'bio', 'organization_name', 'bar_association', 'phone', 'office_address'];
exports.getPublic = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.userId, {
            attributes: ['user_id', 'username', 'full_name', 'role', 'status'],
            include: [{ model: LawyerProfile, required: false, attributes: PUBLIC_PROFILE_ATTRS }]
        });
        if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        const uu = user.toJSON();
        if (uu.role === 'Lawyer' && uu.status !== 'Active') {
            uu.LawyerProfile = null;
        }
        if (uu.LawyerProfile && uu.LawyerProfile.portrait_path) {
            uu.LawyerProfile.portrait_path = addBaseUrl(uu.LawyerProfile.portrait_path);
        }
        res.json(uu);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Luật sư xem hồ sơ của mình (để chỉnh sửa)
exports.getMe = async (req, res) => {
    try {
        if (req.user.role !== 'Lawyer') return res.status(403).json({ message: 'Chỉ tài khoản luật sư mới được truy cập' });
        const user = await User.findByPk(req.user.user_id, {
            attributes: ['user_id', 'username', 'email', 'full_name', 'role'],
            include: [{ model: LawyerProfile, required: false }]
        });
        if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });
        const uu = user.toJSON();
        if (uu.LawyerProfile) uu.LawyerProfile = normalizeProfile(uu.LawyerProfile);
        res.json(uu);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Luật sư cập nhật hồ sơ của mình (các trường được phép, có thể đổi ảnh chân dung)
exports.updateMe = async (req, res) => {
    try {
        if (req.user.role !== 'Lawyer') return res.status(403).json({ message: 'Chỉ tài khoản luật sư mới được cập nhật' });
        const profile = await LawyerProfile.findOne({ where: { user_id: req.user.user_id } });
        if (!profile) return res.status(404).json({ message: 'Chưa có hồ sơ luật sư' });
        const body = req.body || {};
        const files = req.files || {};
        const toPath = (f) => {
            if (!f || !f[0] || !f[0].filename) return undefined;
            return '/' + path.join('uploads', 'lawyers', f[0].filename).replace(/\\/g, '/');
        };
        const updates = {};
        const allowed = ['full_name_legal', 'id_number', 'id_issue_date', 'id_issue_place', 'lawyer_card_number', 'bar_association', 'organization_name', 'specialization', 'years_experience', 'bio', 'other_qualifications', 'phone', 'office_address'];
        allowed.forEach(f => {
            if (body[f] !== undefined) updates[f] = body[f] === '' ? null : body[f];
        });
        if (body.years_experience !== undefined) {
            const v = parseInt(body.years_experience, 10);
            updates.years_experience = isNaN(v) ? null : v;
        }
        if (files.portrait && files.portrait[0]) updates.portrait_path = toPath(files.portrait);
        updates.updated_at = new Date();
        await profile.update(updates);
        const updated = await LawyerProfile.findByPk(profile.profile_id);
        res.json({ message: 'Đã cập nhật hồ sơ', LawyerProfile: normalizeProfile(updated) });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};
