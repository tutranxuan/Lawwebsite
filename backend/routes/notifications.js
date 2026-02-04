const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, notificationController.list);
router.get('/unread-count', authMiddleware, notificationController.getUnreadCount);
router.put('/mark-all-read', authMiddleware, notificationController.markAllRead);
router.put('/:id/read', authMiddleware, notificationController.markRead);

module.exports = router;
