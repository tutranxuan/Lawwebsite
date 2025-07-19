const LegalDocument = require('../models/LegalDocument');
const DocumentType = require('../models/DocumentType');
const { Op } = require('sequelize');

// Lấy danh sách tất cả văn bản
exports.getAllDocuments = async (req, res) => {
    try {
        const documents = await LegalDocument.findAll({
            include: [{
                model: DocumentType,
                attributes: ['type_name']
            }],
            order: [['issuance_date', 'DESC']]
        });
        res.json(documents);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Tìm kiếm văn bản
exports.searchDocuments = async (req, res) => {
    try {
        const { query, type_id } = req.query;
        let whereClause = {};

        if (query) {
            whereClause = {
                [Op.or]: [
                    { title: { [Op.like]: `%${query}%` } },
                    { document_number: { [Op.like]: `%${query}%` } },
                    { content: { [Op.like]: `%${query}%` } },
                    { summary: { [Op.like]: `%${query}%` } }
                ]
            };
        }

        if (type_id) {
            whereClause.type_id = type_id;
        }

        const documents = await LegalDocument.findAll({
            where: whereClause,
            include: [{
                model: DocumentType,
                attributes: ['type_name']
            }],
            order: [['issuance_date', 'DESC']]
        });

        res.json(documents);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Lấy chi tiết một văn bản
exports.getDocumentById = async (req, res) => {
    try {
        const document = await LegalDocument.findByPk(req.params.id, {
            include: [{
                model: DocumentType,
                attributes: ['type_name']
            }]
        });
        if (!document) {
            return res.status(404).json({ message: 'Không tìm thấy văn bản' });
        }
        res.json(document);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Lấy danh sách cơ quan ban hành
exports.getAuthorities = async (req, res) => {
    try {
        const documents = await LegalDocument.findAll({
            attributes: ['issuing_authority'],
            where: {
                issuing_authority: {
                    [Op.not]: null
                }
            },
            group: ['issuing_authority']
        });
        const authorities = documents.map(doc => doc.issuing_authority);
        res.json(authorities);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Lấy danh sách văn bản theo năm
exports.getDocumentsByYear = async (req, res) => {
    try {
        const { year } = req.params;
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31);

        const documents = await LegalDocument.findAll({
            where: {
                issuance_date: {
                    [Op.between]: [startDate, endDate]
                }
            },
            include: [{
                model: DocumentType,
                attributes: ['type_name']
            }],
            order: [['issuance_date', 'DESC']]
        });

        res.json(documents);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Thêm mới văn bản pháp luật
exports.createDocument = async (req, res) => {
    try {
        const { title, document_number, issuance_date, effective_date, issuing_authority, summary, content, type_id, file_path, file_path_local } = req.body;
        const newDoc = await LegalDocument.create({
            title,
            document_number,
            issuance_date,
            effective_date,
            issuing_authority,
            summary,
            content,
            type_id,
            file_path,
            file_path_local
        });
        res.status(201).json(newDoc);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Sửa văn bản pháp luật
exports.updateDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, document_number, issuance_date, effective_date, issuing_authority, summary, content, type_id, file_path, file_path_local } = req.body;
        const doc = await LegalDocument.findByPk(id);
        if (!doc) return res.status(404).json({ message: 'Không tìm thấy văn bản' });
        await doc.update({
            title,
            document_number,
            issuance_date,
            effective_date,
            issuing_authority,
            summary,
            content,
            type_id,
            file_path,
            file_path_local
        });
        res.json(doc);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Xóa văn bản pháp luật
exports.deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await LegalDocument.findByPk(id);
        if (!doc) return res.status(404).json({ message: 'Không tìm thấy văn bản' });
        await doc.destroy();
        res.json({ message: 'Đã xóa văn bản thành công' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}; 