const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const LegalDocument = require('../models/LegalDocument');

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '../uploads/') });

router.post('/file', upload.single('file'), async (req, res) => {
    try {
        const filePath = req.file.path;
        const docId = req.body.doc_id;
        const ext = path.extname(req.file.originalname).toLowerCase();

        if (ext === '.pdf') {
            // Lưu file PDF vào thư mục uploads
            const newFileName = `doc_${docId}_${Date.now()}.pdf`;
            const newPath = path.join(path.dirname(filePath), newFileName);

            // Xóa file PDF cũ nếu có
            if (docId) {
                const doc = await LegalDocument.findByPk(docId);
                if (doc && doc.file_path && doc.file_path.startsWith('/uploads/')) {
                    const oldPath = path.join(__dirname, '..', doc.file_path);
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                }
            }

            fs.renameSync(filePath, newPath);
            const fileUrl = '/uploads/' + newFileName;

            // Cập nhật file_path_local khi upload file PDF mới
            if (docId) {
                await LegalDocument.update(
                    { file_path_local: fileUrl },
                    { where: { doc_id: docId } }
                );
            }
            res.json({ file_path_local: fileUrl });
        } else {
            fs.unlinkSync(filePath);
            return res.status(400).json({ message: 'Chỉ hỗ trợ file .pdf' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Lỗi upload file', error: err.message });
    }
});

module.exports = router; 