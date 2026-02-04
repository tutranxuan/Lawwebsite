const express = require('express');
const router = express.Router();
const discussionController = require('../controllers/discussionController');
const authMiddleware = require('../middleware/auth');
const { communityUpload } = require('../config/communityMulter');

router.get('/', authMiddleware.optionalAuth, discussionController.getAllTopics);
router.post('/', authMiddleware, communityUpload, discussionController.createTopic);
router.get('/:id', authMiddleware.optionalAuth, discussionController.getTopicDetail);
router.post('/:id/like', authMiddleware, discussionController.toggleTopicLike);
router.delete('/:id', authMiddleware, discussionController.deleteTopic);
router.put('/:id/close', authMiddleware, discussionController.closeTopic);
router.put('/:id/open', authMiddleware, discussionController.openTopic);

module.exports = router; 