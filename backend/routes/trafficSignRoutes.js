const express = require('express');
const router = express.Router();
const trafficSignController = require('../controllers/trafficSignController');
const upload = require('../config/multerConfig');

// Lấy tất cả biển báo (có thể kèm tìm kiếm và lọc)
router.get('/', trafficSignController.getAllTrafficSigns);

// Lấy chi tiết một biển báo
router.get('/:id', trafficSignController.getTrafficSignById);

// Thêm biển báo mới
router.post('/', upload.single('image'), trafficSignController.addTrafficSign);

// Cập nhật biển báo
router.put('/:id', upload.single('image'), trafficSignController.updateTrafficSign);

// Xóa biển báo
router.delete('/:id', trafficSignController.deleteTrafficSign);

// Lấy tất cả các loại biển báo
router.get('/categories/all', trafficSignController.getAllCategories);

module.exports = router; 