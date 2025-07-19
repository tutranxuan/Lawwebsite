const { DiscussionTopic, User, Comment } = require('../models');

// Lấy danh sách chủ đề
exports.getAllTopics = async (req, res) => {
    try {
        const topics = await DiscussionTopic.findAll({
            include: [{ model: User, attributes: ['user_id', 'username', 'full_name'] }],
            order: [['created_at', 'DESC']]
        });
        res.json(topics);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Tạo chủ đề mới
exports.createTopic = async (req, res) => {
    try {
        const { title, content } = req.body;
        const user_id = req.user.user_id; // Lấy từ middleware xác thực
        if (!title || !content) return res.status(400).json({ message: 'Thiếu tiêu đề hoặc nội dung' });
        const topic = await DiscussionTopic.create({ title, content, user_id });
        res.status(201).json(topic);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Lấy chi tiết chủ đề + bình luận
exports.getTopicDetail = async (req, res) => {
    try {
        const topic = await DiscussionTopic.findByPk(req.params.id, {
            include: [
                { model: User, attributes: ['user_id', 'username', 'full_name'] },
                { model: Comment, include: [{ model: User, attributes: ['user_id', 'username', 'full_name'] }] }
            ]
        });
        if (!topic) return res.status(404).json({ message: 'Không tìm thấy chủ đề' });
        res.json(topic);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Xóa chủ đề
exports.deleteTopic = async (req, res) => {
    try {
        const topic = await DiscussionTopic.findByPk(req.params.id);
        if (!topic) return res.status(404).json({ message: 'Không tìm thấy chủ đề' });
        // Kiểm tra quyền xóa: chỉ chủ topic hoặc admin
        if (req.user.role !== 'Admin' && req.user.user_id !== topic.user_id) {
            return res.status(403).json({ message: 'Bạn không có quyền xóa chủ đề này' });
        }
        // Xóa tất cả bình luận liên quan trước
        await Comment.destroy({ where: { topic_id: topic.topic_id } });
        await topic.destroy();
        res.json({ message: 'Đã xóa chủ đề' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Ẩn chủ đề (đổi status sang Closed)
exports.closeTopic = async (req, res) => {
    try {
        const topic = await DiscussionTopic.findByPk(req.params.id);
        if (!topic) return res.status(404).json({ message: 'Không tìm thấy chủ đề' });
        // Chỉ admin mới được ẩn chủ đề
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Bạn không có quyền ẩn chủ đề này' });
        }
        topic.status = 'Closed';
        await topic.save();
        res.json({ message: 'Đã ẩn chủ đề' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Khôi phục chủ đề (đổi status sang Open)
exports.openTopic = async (req, res) => {
    try {
        const topic = await DiscussionTopic.findByPk(req.params.id);
        if (!topic) return res.status(404).json({ message: 'Không tìm thấy chủ đề' });
        // Chỉ admin mới được khôi phục chủ đề
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Bạn không có quyền khôi phục chủ đề này' });
        }
        topic.status = 'Open';
        await topic.save();
        res.json({ message: 'Đã khôi phục chủ đề' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
}; 