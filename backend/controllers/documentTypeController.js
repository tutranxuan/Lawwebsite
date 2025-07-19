const DocumentType = require('../models/DocumentType');

exports.getAllTypes = async (req, res) => {
    try {
        const types = await DocumentType.findAll();
        res.json(types);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}; 