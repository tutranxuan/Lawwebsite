const { Op } = require('sequelize');
const fetch = require('node-fetch');
const LegalDocument = require('../models/LegalDocument');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-1.5-flash'; // có thể đổi sang gemini-1.5-pro nếu cần

/**
 * Trích 3-5 văn bản VBPL liên quan để làm context cho prompt.
 */
async function buildContext(question) {
    const documents = await LegalDocument.findAll({
        where: {
            [Op.or]: [
                { title: { [Op.iLike]: `%${question}%` } },
                { summary: { [Op.iLike]: `%${question}%` } },
                { content: { [Op.iLike]: `%${question}%` } },
                { issuing_authority: { [Op.iLike]: `%${question}%` } },
            ],
        },
        limit: 5,
        order: [['issuance_date', 'DESC']],
    });

    if (!documents.length) return 'No legal documents found for this query.';

    return documents
        .map((doc, idx) => {
            const issued = doc.issuance_date
                ? new Date(doc.issuance_date).toLocaleDateString('vi-VN')
                : '';
            return `${idx + 1}. Tiêu đề: ${doc.title || 'N/A'}\n` +
                `   Số hiệu: ${doc.document_number || 'N/A'}\n` +
                `   Ngày ban hành: ${issued}\n` +
                `   Cơ quan: ${doc.issuing_authority || 'N/A'}\n` +
                `   Loại: ${doc.type_id || 'N/A'}\n` +
                `   Tóm tắt: ${doc.summary ? doc.summary.slice(0, 400) : 'N/A'}`;
        })
        .join('\n\n');
}

/**
 * Gọi Gemini với system prompt ràng buộc miền giao thông.
 */
async function callGemini(question, context) {
    if (!GEMINI_API_KEY) {
        throw new Error('Missing GEMINI_API_KEY');
    }

    const systemPrompt = `
Bạn là trợ lý chuyên về luật giao thông đường bộ Việt Nam. 
Chỉ trả lời trong phạm vi: quy định, mức phạt, thủ tục, biển báo, nồng độ cồn, đăng ký/đổi GPLX. 
Nếu câu hỏi ngoài phạm vi, hãy từ chối lịch sự và hướng người dùng về chủ đề giao thông.
Ưu tiên ngắn gọn, chính xác, có số hiệu văn bản khi biết. 
Tránh bịa đặt; nếu không chắc, hãy nói chưa có đủ thông tin.
`;

    const payload = {
        contents: [
            {
                role: 'user',
                parts: [
                    { text: systemPrompt },
                    { text: `Ngữ cảnh VBPL (tối đa 5 kết quả):\n${context}` },
                    { text: `Câu hỏi người dùng: ${question}` },
                ],
            },
        ],
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 700,
        },
    };

    const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }
    );

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Gemini error ${resp.status}: ${text}`);
    }

    const data = await resp.json();
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return answer || 'Xin lỗi, tôi chưa có câu trả lời phù hợp.';
}

// Xử lý câu hỏi từ chatbot (Gemini + RAG đơn giản từ DB)
exports.processQuestion = async (req, res) => {
    try {
        const { question } = req.body;

        if (!question || question.trim() === '') {
            return res.status(400).json({
                answer: 'Xin lỗi, bạn vui lòng nhập câu hỏi cụ thể hơn.',
            });
        }

        // Lấy context từ VBPL
        const context = await buildContext(question.trim());

        // Gọi Gemini
        const answer = await callGemini(question.trim(), context);

        res.json({ answer });
    } catch (error) {
        console.error('Chatbot error:', error.message);
        // Fallback: trả lời ngắn để không gián đoạn trải nghiệm
        res.status(500).json({
            answer:
                'Xin lỗi, hệ thống đang bận hoặc thiếu khóa API Gemini. Vui lòng thử lại sau.',
        });
    }
};

