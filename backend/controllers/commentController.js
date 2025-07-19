const { Comment } = require('../models');

// Thêm bình luận vào chủ đề (có thể là reply)
exports.addComment = async (req, res) => {
    try {
        const { content, parent_comment_id } = req.body;
        const user_id = req.user.user_id;
        const topic_id = req.params.topicId;
        if (!content) return res.status(400).json({ message: 'Thiếu nội dung bình luận' });
        const comment = await Comment.create({ content, user_id, topic_id, parent_comment_id: parent_comment_id || null });
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
        // Chỉ cho phép xóa bình luận của mình hoặc admin
        if (req.user.role !== 'Admin' && req.user.user_id !== comment.user_id) {
            return res.status(403).json({ message: 'Bạn không có quyền xóa bình luận này' });
        }
        // Xóa các reply con trước
        await Comment.destroy({ where: { parent_comment_id: comment.comment_id } });
        await comment.destroy();
        res.json({ message: 'Đã xóa bình luận' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
}; 