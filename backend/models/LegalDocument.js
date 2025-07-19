const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const DocumentType = require('./DocumentType'); // Import DocumentType để thiết lập mối quan hệ

const LegalDocument = sequelize.define('LegalDocument', {
    doc_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING(500),
        allowNull: false
    },
    document_number: {
        type: DataTypes.STRING,
        allowNull: true
    },
    issuance_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    effective_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    issuing_authority: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    summary: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    file_path: {
        type: DataTypes.STRING,
        allowNull: true
    },
    file_path_local: {
        type: DataTypes.STRING,
        allowNull: true
    },
    type_id: {
        type: DataTypes.INTEGER,
        references: {
            model: DocumentType, // Tham chiếu đến bảng DocumentType
            key: 'type_id'
        }
    }
}, {
    tableName: 'legaldocuments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

// Thiết lập mối quan hệ
LegalDocument.belongsTo(DocumentType, { foreignKey: 'type_id' });

module.exports = LegalDocument;