const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const trafficSignController = require('../controllers/trafficSignController');
const upload = require('../config/multerConfig');

// Cấu hình multer cho upload ảnh
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/signs/') // Thư mục lưu ảnh biển báo
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, 'sign-' + uniqueSuffix + path.extname(file.originalname))
    }
});

const uploadMulter = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Chỉ cho phép upload ảnh
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Chỉ cho phép file ảnh!'), false);
        }
        cb(null, true);
    }
});

// Lấy tất cả biển báo (có thể kèm tìm kiếm và lọc)
router.get('/', trafficSignController.getAllTrafficSigns);

// Tìm kiếm biển báo
router.get('/search', trafficSignController.searchTrafficSigns);

// Lấy tất cả các loại biển báo
router.get('/categories/all', trafficSignController.getAllCategories);

// Lấy chi tiết một biển báo
router.get('/:id', trafficSignController.getTrafficSignById);

// Thêm biển báo mới
router.post('/', uploadMulter.single('image'), trafficSignController.addTrafficSign);

// Cập nhật biển báo
router.put('/:id', uploadMulter.single('image'), trafficSignController.updateTrafficSign);

// Xóa biển báo
router.delete('/:id', trafficSignController.deleteTrafficSign);

module.exports = router; 