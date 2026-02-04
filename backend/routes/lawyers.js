const express = require('express');
const router = express.Router();
const lawyerController = require('../controllers/lawyerController');
const authMiddleware = require('../middleware/auth');
const { lawyerUpload } = require('../config/lawyerMulter');

router.get('/me', authMiddleware, lawyerController.getMe);
router.put('/me', authMiddleware, lawyerUpload, lawyerController.updateMe);
router.get('/public/:userId', lawyerController.getPublic);
router.get('/pending', authMiddleware, lawyerController.getPending);
router.get('/:id', authMiddleware, lawyerController.getById);
router.put('/:id/approve', authMiddleware, lawyerController.approve);
router.put('/:id/reject', authMiddleware, lawyerController.reject);

module.exports = router;
