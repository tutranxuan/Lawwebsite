const multer = require('multer');
const path = require('path');
const fs = require('fs');

const lawyerDir = path.join(__dirname, '..', 'uploads', 'lawyers');
if (!fs.existsSync(lawyerDir)) {
    fs.mkdirSync(lawyerDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, lawyerDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname) || '.jpg';
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'lawyer-' + (file.fieldname || 'file') + '-' + unique + ext);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file ảnh.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
}).fields([
    { name: 'portrait', maxCount: 1 },
    { name: 'id_front', maxCount: 1 },
    { name: 'id_back', maxCount: 1 },
    { name: 'lawyer_card_photo', maxCount: 1 }
]);

module.exports = { lawyerUpload: upload, lawyerDir };
