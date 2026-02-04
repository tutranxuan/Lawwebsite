const { Notification, User } = require('../models');

async function createNotification(user_id, type, ref_type, ref_id, topic_id, actor_user_id, actor_username, message) {
    if (!user_id || !message) return;
    try {
        await Notification.create({
            user_id,
            type,
            ref_type: ref_type || null,
            ref_id: ref_id || null,
            topic_id: topic_id != null ? topic_id : null,
            actor_user_id: actor_user_id || null,
            actor_username: actor_username || null,
            message
        });
    } catch (e) {
        console.error('createNotification error:', e.message);
    }
}

exports.createNotification = createNotification;

exports.list = async (req, res) => {
    try {
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const offset = Math.max(0, parseInt(req.query.offset) || 0);
        const { count, rows } = await Notification.findAndCountAll({
            where: { user_id: req.user.user_id },
            order: [['created_at', 'DESC']],
            limit,
            offset
        });
        res.json({ notifications: rows, total: count });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.count({
            where: { user_id: req.user.user_id, read: false }
        });
        res.json({ count });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

exports.markRead = async (req, res) => {
    try {
        const id = req.params.id;
        const notif = await Notification.findByPk(id);
        if (!notif || notif.user_id !== req.user.user_id) return res.status(404).json({ message: 'Không tìm thấy' });
        notif.read = true;
        await notif.save();
        res.json({ message: 'Đã đánh dấu đã đọc' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

exports.markAllRead = async (req, res) => {
    try {
        await Notification.update({ read: true }, { where: { user_id: req.user.user_id } });
        res.json({ message: 'Đã đánh dấu tất cả đã đọc' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};
