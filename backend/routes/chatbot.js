const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbotController');

// Xử lý câu hỏi từ chatbot
router.post('/', chatbotController.processQuestion);

module.exports = router;

