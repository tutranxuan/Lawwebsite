const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

// Lấy danh sách user (admin)
router.get('/', authMiddleware, userController.getAllUsers);
// Admin cập nhật status user
router.put('/:id/status', authMiddleware, userController.updateUserStatus);
// User tự sửa thông tin cá nhân
router.put('/me', authMiddleware, userController.updateProfile);

module.exports = router; 