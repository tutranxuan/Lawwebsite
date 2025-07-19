const express = require('express');
const router = express.Router();
const legalDocumentController = require('../controllers/legalDocumentController');
const LegalDocument = require('../models/LegalDocument');

// Lấy danh sách tất cả văn bản
router.get('/', legalDocumentController.getAllDocuments);

// Tìm kiếm văn bản
router.get('/search', legalDocumentController.searchDocuments);

// Lấy danh sách cơ quan ban hành
router.get('/authorities', legalDocumentController.getAuthorities);

// Lấy chi tiết một văn bản
router.get('/:id', legalDocumentController.getDocumentById);

// Lấy danh sách văn bản theo năm
router.get('/year/:year', legalDocumentController.getDocumentsByYear);

// Thêm mới văn bản pháp luật
router.post('/', legalDocumentController.createDocument);

// Sửa văn bản pháp luật
router.put('/:id', legalDocumentController.updateDocument);

// Xóa văn bản pháp luật
router.delete('/:id', legalDocumentController.deleteDocument);

module.exports = router;