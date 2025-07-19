const TrafficSign = require('../models/TrafficSign');
const TrafficSignCategory = require('../models/TrafficSignCategory');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

const DOMAIN = process.env.DOMAIN || 'http://localhost:4000';

// Hàm xử lý để thêm domain vào đường dẫn ảnh
const addDomainToImagePath = (data) => {
    if (data.image_path && !data.image_path.startsWith('http')) {
        // Loại bỏ mọi dấu / dư thừa ở đầu image_path
        let cleanPath = data.image_path.replace(/^\/+/, '');
        data.image_path = `${DOMAIN}/${cleanPath}`;
    }
    return data;
};

// Get all traffic signs
exports.getAllTrafficSigns = async (req, res) => {
    try {
        const signs = await TrafficSign.findAll({
            include: [{
                model: TrafficSignCategory,
                as: 'TrafficSignCategory',
                attributes: ['category_name']
            }],
            order: [['sign_id', 'ASC']]
        });
        const signsWithFullImagePath = signs.map(sign => addDomainToImagePath(sign.toJSON()));
        res.json(signsWithFullImagePath);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

// Search traffic signs
exports.searchTrafficSigns = async (req, res) => {
    const { query, category_id } = req.query;
    let whereClause = {};
    if (query) {
         whereClause[require('sequelize').Op.or] = [
            { name: { [require('sequelize').Op.like]: `%${query}%` } },
            { sign_code: { [require('sequelize').Op.like]: `%${query}%` } },
            { description: { [require('sequelize').Op.like]: `%${query}%` } }
        ];
    }
    if (category_id) {
        whereClause.category_id = category_id;
    }

    try {
        const signs = await TrafficSign.findAll({
            where: whereClause,
            include: [{ model: TrafficSignCategory, as: 'TrafficSignCategory', attributes: ['category_name'] }]
        });
        const signsWithFullImagePath = signs.map(sign => addDomainToImagePath(sign.toJSON()));
        res.json(signsWithFullImagePath);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

// Get traffic sign by ID
exports.getTrafficSignById = async (req, res) => {
    try {
        const sign = await TrafficSign.findByPk(req.params.id, {
            include: [{
                model: TrafficSignCategory,
                as: 'TrafficSignCategory',
                attributes: ['category_name']
            }]
        });
        if (!sign) {
            return res.status(404).json({ message: 'Không tìm thấy biển báo' });
        }
        const signWithFullImagePath = addDomainToImagePath(sign.toJSON());
        res.json(signWithFullImagePath);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

// Get all categories
exports.getAllCategories = async (req, res) => {
    try {
        const categories = await TrafficSignCategory.findAll();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

// Create new traffic sign
exports.addTrafficSign = async (req, res) => {
    const { name, sign_code, description, category_id } = req.body;
    if (!req.file) {
        return res.status(400).json({ message: 'Vui lòng tải lên ảnh' });
    }
    const image_path = path.join('uploads', 'signs', req.file.filename).replace(/\\/g, '/');

    try {
        const newSign = await TrafficSign.create({ name, sign_code, description, category_id, image_path });
        const signWithFullImagePath = addDomainToImagePath(newSign.toJSON());
        res.status(201).json(signWithFullImagePath);
    } catch (error) {
        fs.unlinkSync(path.join(__dirname, '..', '..', image_path));
        res.status(500).json({ message: 'Có lỗi xảy ra khi thêm biển báo', error: error.message });
    }
};

// Update traffic sign
exports.updateTrafficSign = async (req, res) => {
    const { id } = req.params;
    const { name, sign_code, description, category_id } = req.body;
    try {
        const sign = await TrafficSign.findByPk(id);
        if (!sign) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(404).json({ message: 'Không tìm thấy biển báo' });
        }
        let oldImagePath = sign.image_path;
        let newImagePath = oldImagePath;
        if (req.file) {
            newImagePath = path.join('uploads', 'signs', req.file.filename).replace(/\\/g, '/');
        }
        await sign.update({
            name,
            sign_code,
            description,
            category_id,
            image_path: newImagePath
        });
        if (req.file && oldImagePath && oldImagePath !== newImagePath) {
            const fullOldPath = path.join(__dirname, '..', '..', oldImagePath);
            if (fs.existsSync(fullOldPath)) {
                fs.unlinkSync(fullOldPath);
            }
        }
        const updatedSignWithFullImagePath = addDomainToImagePath(sign.toJSON());
        res.json(updatedSignWithFullImagePath);
    } catch (error) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ message: 'Có lỗi xảy ra khi cập nhật', error: error.message });
    }
};

// Delete traffic sign
exports.deleteTrafficSign = async (req, res) => {
    try {
        const sign = await TrafficSign.findByPk(req.params.id);
        if (!sign) {
            return res.status(404).json({ message: 'Không tìm thấy biển báo' });
        }
        const imagePath = sign.image_path;
        await sign.destroy();
        if (imagePath) {
            const fullPath = path.join(__dirname, '..', '..', imagePath);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        }
        res.status(200).json({ message: 'Xóa biển báo thành công' });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
}; 