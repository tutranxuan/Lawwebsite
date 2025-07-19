const express = require('express');
const router = express.Router();
const discussionController = require('../controllers/discussionController');
const authMiddleware = require('../middleware/auth'); // middleware xác thực JWT

router.get('/', discussionController.getAllTopics);
router.post('/', authMiddleware, discussionController.createTopic);
router.get('/:id', discussionController.getTopicDetail);
router.delete('/:id', authMiddleware, discussionController.deleteTopic);
router.put('/:id/close', authMiddleware, discussionController.closeTopic);
router.put('/:id/open', authMiddleware, discussionController.openTopic);

module.exports = router; 