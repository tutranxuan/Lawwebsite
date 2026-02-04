const { Comment, DiscussionTopic, CommentLike, User } = require('../models');
const { createNotification } = require('./notificationController');
const { sendUserNotification, sendLawyerFeedbackNotification } = require('../config/emailconfig');

// Thêm bình luận vào chủ đề (có thể là reply)
exports.addComment = async (req, res) => {
    try {
        const { content, parent_comment_id } = req.body;
        const user_id = req.user.user_id;
        const user_role = req.user.role;
        const topic_id = req.params.topicId;
        const actor = req.user.full_name || 'Ai đó';
        if (!content) return res.status(400).json({ message: 'Thiếu nội dung bình luận' });
        const comment = await Comment.create({ content, user_id, topic_id, parent_comment_id: parent_comment_id || null });
        let recipientId = null;
        let message = '';
        let topicTitle = ''
        if (parent_comment_id) {
            const parent = await Comment.findByPk(parent_comment_id);
            if (parent && parent.user_id !== user_id) {
                recipientId = parent.user_id;
                message = `${actor} đã trả lời bình luận của bạn`;
            }
        } else {
            const topic = await DiscussionTopic.findByPk(topic_id);
            if (topic && topic.user_id !== user_id) {
                recipientId = topic.user_id;
                message = `${actor} đã bình luận chủ đề của bạn`;
            }
        }
        const notifType = parent_comment_id ? 'comment_reply' : 'topic_comment';
        if (recipientId && message) await createNotification(recipientId, notifType, 'comment', comment.comment_id, topic_id, user_id, actor, message);
        if (user_role === 'Lawyer') {
                const recipient = await User.findByPk(recipientId);
                if (recipient && recipient.email) {
                    // Nếu không lấy được topicTitle (trường hợp reply), có thể để mặc định
                    const finalTitle = topicTitle || "Bình luận của bạn";
                    await sendLawyerFeedbackNotification(recipient.email, finalTitle);
                }
            }
        res.status(201).json(comment);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Xóa bình luận (và các reply con)
exports.deleteComment = async (req, res) => {
    try {
        const comment = await Comment.findByPk(req.params.commentId);
        if (!comment) return res.status(404).json({ message: 'Không tìm thấy bình luận' });
        const author = await User.findByPk(comment.user_id);
        const content = comment.content.substring(0, 20) + "...";
        // Chỉ cho phép xóa bình luận của mình hoặc admin
        if (req.user.role !== 'Admin' && req.user.user_id !== comment.user_id) {
            return res.status(403).json({ message: 'Bạn không có quyền xóa bình luận này' });
        }
        const authorId = comment.user_id;
        const commentId = comment.comment_id;
        const isAdminDelete = req.user.role === 'Admin' && authorId !== req.user.user_id;
        const topicId = comment.topic_id;
        await Comment.destroy({ where: { parent_comment_id: comment.comment_id } });
        await comment.destroy();
        if (authorId && isAdminDelete) {
            await createNotification(authorId, 'comment_deleted', 'comment', commentId, topicId, req.user.user_id, req.user.username, 'Bình luận của bạn đã bị xóa bởi quản trị viên.');
            await sendUserNotification(author.email, 'delete_comment', content);
        }
        res.json({ message: 'Đã xóa bình luận' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// Bật/tắt thích bình luận (toggle)
exports.toggleCommentLike = async (req, res) => {
  
    try {
        const comment_id = parseInt(req.params.commentId, 10);
        const user_id = req.user.user_id;
        const comment = await Comment.findByPk(comment_id);
        if (!comment) return res.status(404).json({ message: 'Không tìm thấy bình luận' });
        const existing = await CommentLike.findOne({ where: { user_id, comment_id } });
        let liked = false;
        if (existing) {
            await existing.destroy();
        } else {
            await CommentLike.create({ user_id, comment_id });
            liked = true;
            if (comment.user_id !== user_id) {
                const c = await CommentLike.count({ where: { comment_id } });
                const topicId = comment.topic_id;
                let msg = req.user.full_name + ' đã thích bình luận của bạn';
                if (c > 1) msg = req.user.full_name + ' và ' + (c - 1) + ' người khác đã thích bình luận của bạn';
                await createNotification(comment.user_id, 'comment_like', 'comment', comment_id, topicId, user_id, req.user.full_name, msg);
            }
        }
        const count = await CommentLike.count({ where: { comment_id } });

        await Comment.update({ likes_count: count }, { where: { comment_id: comment_id } });
        res.json({ liked, count });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
}; 