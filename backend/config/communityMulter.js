const multer = require('multer');
const path = require('path');
const fs = require('fs');

const communityDir = path.join(__dirname, '..', 'uploads', 'community');
if (!fs.existsSync(communityDir)) {
    fs.mkdirSync(communityDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, communityDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname) || (file.mimetype && file.mimetype.startsWith('video/') ? '.mp4' : '.jpg');
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'topic-' + unique + ext);
    }
});

const IMAGE_MAX = 5 * 1024 * 1024;
const VIDEO_MAX = 50 * 1024 * 1024;

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        if (file.mimetype.startsWith('image/') && file.size > IMAGE_MAX) {
            return cb(new Error('Mỗi ảnh tối đa 5MB.'), false);
        }
        if (file.mimetype.startsWith('video/') && file.size > VIDEO_MAX) {
            return cb(new Error('Video tối đa 50MB.'), false);
        }
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận ảnh (jpg, png, gif, webp) hoặc video (mp4, webm).'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: VIDEO_MAX }
}).fields([
    { name: 'images', maxCount: 5 },
    { name: 'video', maxCount: 1 }
]);

module.exports = { communityUpload: upload, communityDir };