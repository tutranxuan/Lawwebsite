const { DiscussionTopic, User, Comment, LawyerProfile, TopicLike, CommentLike } = require('../models');
const { createNotification } = require('./notificationController');
const path = require('path');
const fs = require('fs');
const { sendUserNotification } = require('../config/emailconfig');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';

const USER_PUBLIC_ATTRS = ['user_id', 'username', 'full_name', 'role', 'status'];
const LAWYER_PROFILE_PUBLIC_ATTRS = ['full_name_legal', 'portrait_path', 'specialization', 'years_experience', 'bio', 'organization_name', 'bar_association', 'phone', 'office_address'];

function addBaseUrl(p) {
    if (!p) return null;
    return p.startsWith('http') ? p : BASE_URL + p;
}

function sanitizeUserForPublic(user) {
    if (!user) return user;
    const u = { ...user };
    if (u.role === 'Lawyer' && u.status !== 'Active' && u.LawyerProfile) {
        u.LawyerProfile = null;
    }
    if (u.LawyerProfile && u.LawyerProfile.portrait_path) {
        u.LawyerProfile = { ...u.LawyerProfile, portrait_path: addBaseUrl(u.LawyerProfile.portrait_path) };
    }
    return u;
}

function normalizeTopic(topic) {
    const t = topic.toJSON ? topic.toJSON() : topic;
    if (t.image_paths) {
        try {
            t.image_paths = JSON.parse(t.image_paths);
            t.image_paths = t.image_paths.map(p => p.startsWith('http') ? p : BASE_URL + p);
        } catch (e) {
            t.image_paths = [];
        }
    } else {
        t.image_paths = [];
    }
    if (t.video_path && !t.video_path.startsWith('http')) t.video_path = BASE_URL + t.video_path;
    if (t.User) t.User = sanitizeUserForPublic(t.User);
    if (t.Comments) {
        t.Comments = t.Comments.map(c => {
            if (c.User) c.User = sanitizeUserForPublic(c.User);
            return c;
        });
    }
    return t;
}

// Lấy danh sách chủ đề (có phân trang, lọc status, mine)
exports.getAllTopics = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 15));
        const status = req.query.status || 'all'; // Open | Closed | all
        const mine = req.query.mine === '1' && req.user ? req.user.user_id : null;

        const where = {};
        if (status !== 'all') where.status = status;
        if (mine) where.user_id = mine;

        const { count, rows: topics } = await DiscussionTopic.findAndCountAll({
            where,
            include: [{
                model: User,
                attributes: USER_PUBLIC_ATTRS,
                include: [{ model: LawyerProfile, required: false, attributes: LAWYER_PROFILE_PUBLIC_ATTRS }]
            }],
            order: [['created_at', 'DESC']],
            limit,
            offset: (page - 1) * limit
        });

        const totalPages = Math.ceil(count / limit) || 1;
        let result = topics.map(normalizeTopic);
        if (req.user && result.length) {
            const topicIds = result.map(t => t.topic_id);
            const likes = await TopicLike.findAll({ where: { user_id: req.user.user_id, topic_id: topicIds } });
            const likedSet = new Set(likes.map(l => l.topic_id));
            result = result.map(t => ({ ...t, liked: likedSet.has(t.topic_id) }));
        }
        res.json({
            topics: result,
            total: count,
            totalPages,
            page,
            limit
        });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Tạo chủ đề mới (có thể kèm ảnh, video)
exports.createTopic = async (req, res) => {
    try {
        const title = (req.body && req.body.title) ? req.body.title.trim() : '';
        const content = (req.body && req.body.content) ? req.body.content.trim() : '';
        const user_id = req.user.user_id;
        if (!title || !content) return res.status(400).json({ message: 'Thiếu tiêu đề hoặc nội dung' });

        let image_paths = [];
        let video_path = null;

        if (req.files) {
            if (req.files.images && Array.isArray(req.files.images)) {
                image_paths = req.files.images.map(f => '/' + path.join('uploads', 'community', f.filename).replace(/\\/g, '/'));
            }
            if (req.files.video && req.files.video[0]) {
                video_path = '/' + path.join('uploads', 'community', req.files.video[0].filename).replace(/\\/g, '/');
            }
        }

        const topic = await DiscussionTopic.create({
            title,
            content,
            user_id,
            image_paths: image_paths.length ? JSON.stringify(image_paths) : null,
            video_path
        });
        res.status(201).json(normalizeTopic(topic));
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Lấy chi tiết chủ đề + bình luận
exports.getTopicDetail = async (req, res) => {
    try {
        const topic = await DiscussionTopic.findByPk(req.params.id, {
            include: [
                {
                    model: User,
                    attributes: USER_PUBLIC_ATTRS,
                    include: [{ model: LawyerProfile, required: false, attributes: LAWYER_PROFILE_PUBLIC_ATTRS }]
                },
                {
                    model: Comment,
                    include: [{
                        model: User,
                        attributes: USER_PUBLIC_ATTRS,
                        include: [{ model: LawyerProfile, required: false, attributes: LAWYER_PROFILE_PUBLIC_ATTRS }]
                    }]
                }
            ]
        });
        if (!topic) return res.status(404).json({ message: 'Không tìm thấy chủ đề' });
        let data = normalizeTopic(topic);
        if (req.user) {
            const [topicLike, commentLikes] = await Promise.all([
                TopicLike.findOne({ where: { user_id: req.user.user_id, topic_id: topic.topic_id } }),
                CommentLike.findAll({ where: { user_id: req.user.user_id, comment_id: (data.Comments || []).map(c => c.comment_id) } })
            ]);
            data.liked = !!topicLike;
            const commentLikedSet = new Set(commentLikes.map(l => l.comment_id));
            if (data.Comments) data.Comments = data.Comments.map(c => ({ ...c, liked: commentLikedSet.has(c.comment_id) }));
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Xóa chủ đề (và xóa file ảnh/video trên đĩa)
exports.deleteTopic = async (req, res) => {
    try {
        const topic = await DiscussionTopic.findByPk(req.params.id);
        if (!topic) return res.status(404).json({ message: 'Không tìm thấy chủ đề' });
        const author = await User.findByPk(topic.user_id);
        const title = topic.title;
        if (req.user.role !== 'Admin' && req.user.user_id !== topic.user_id) {
            return res.status(403).json({ message: 'Bạn không có quyền xóa chủ đề này' });
        }
        const uploadsRoot = path.join(__dirname, '..', 'uploads');
        if (topic.image_paths) {
            try {
                const paths = JSON.parse(topic.image_paths);
                paths.forEach(p => {
                    const full = path.join(__dirname, '..', p.replace(/^\//, ''));
                    if (fs.existsSync(full)) fs.unlinkSync(full);
                });
            } catch (e) { /* ignore */ }
        }
        if (topic.video_path) {
            const full = path.join(__dirname, '..', topic.video_path.replace(/^\//, ''));
            if (fs.existsSync(full)) fs.unlinkSync(full);
        }
        const authorId = topic.user_id;
        await Comment.destroy({ where: { topic_id: topic.topic_id } });
        await topic.destroy();
        if (authorId && req.user.role === 'Admin' && authorId !== req.user.user_id) {
            await createNotification(authorId, 'topic_deleted', 'topic', topic.topic_id, topic.topic_id, req.user.user_id, req.user.username, 'Bài viết của bạn đã bị xóa bởi quản trị viên.');
            await sendUserNotification(author.email, 'delete_post', title);
        }
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
        const author = await User.findByPk(topic.user_id);
        if (topic.user_id && topic.user_id !== req.user.user_id) {
            await createNotification(topic.user_id, 'topic_hidden', 'topic', topic.topic_id, topic.topic_id, req.user.user_id, req.user.username, 'Bài viết của bạn đã bị ẩn bởi quản trị viên.');
            await sendUserNotification(author.email, 'hide_post', topic.title);
        }
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
        const author = await User.findByPk(topic.user_id);
        if (topic.user_id && topic.user_id !== req.user.user_id) {
            await sendUserNotification(author.email, 'restore_post', topic.title);
        }
        res.json({ message: 'Đã khôi phục chủ đề' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Bật/tắt thích chủ đề (toggle)
exports.toggleTopicLike = async (req, res) => {
    try {
        const topic_id = parseInt(req.params.id, 10);
        const user_id = req.user.user_id;
        const topic = await DiscussionTopic.findByPk(topic_id);
        if (!topic) return res.status(404).json({ message: 'Không tìm thấy chủ đề' });
        const existing = await TopicLike.findOne({ where: { user_id, topic_id } });
        let liked = false;
        if (existing) {
            await existing.destroy();
        } else {
            await TopicLike.create({ user_id, topic_id });
            liked = true;
            if (topic.user_id !== user_id) {
                const c = await TopicLike.count({ where: { topic_id } });
                let msg = req.user.full_name + ' đã thích chủ đề của bạn';
                if (c > 1) msg = req.user.full_name + ' và ' + (c - 1) + ' người khác đã thích chủ đề của bạn';
                await createNotification(topic.user_id, 'topic_like', 'topic', topic_id, topic_id, user_id, req.user.full_name, msg);
            }
        }
        const count = await TopicLike.count({ where: { topic_id } });
        await topic.update({ likes_count: count });
        res.json({ liked, count });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
}; 