const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const authMiddleware = require('../middleware/auth');

router.post('/:topicId', authMiddleware, commentController.addComment);
router.delete('/:commentId', authMiddleware, commentController.deleteComment);

module.exports = router; 