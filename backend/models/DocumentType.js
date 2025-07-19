const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DocumentType = sequelize.define('DocumentType', {
    type_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    type_name: {
        type: DataTypes.STRING(100),
        allowNull: false
    }
}, {
    tableName: 'documenttypes',
    timestamps: false // Nếu bảng không có các trường createdAt, updatedAt
});

module.exports = DocumentType;