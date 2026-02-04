const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LawyerProfile = sequelize.define('LawyerProfile', {
    profile_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'user_id' }
    },
    // 1. Thông tin định danh cá nhân
    full_name_legal: { type: DataTypes.STRING(255), allowNull: true },
    portrait_path: { type: DataTypes.STRING(500), allowNull: true },
    id_number: { type: DataTypes.STRING(50), allowNull: true },
    id_issue_date: { type: DataTypes.DATEONLY, allowNull: true },
    id_issue_place: { type: DataTypes.STRING(255), allowNull: true },
    id_front_path: { type: DataTypes.STRING(500), allowNull: true },
    id_back_path: { type: DataTypes.STRING(500), allowNull: true },
    // 2. Thông tin hành nghề
    lawyer_card_number: { type: DataTypes.STRING(100), allowNull: true },
    bar_association: { type: DataTypes.STRING(255), allowNull: true },
    lawyer_card_photo_path: { type: DataTypes.STRING(500), allowNull: true },
    organization_name: { type: DataTypes.STRING(255), allowNull: true },
    // 3. Thông tin chuyên môn
    specialization: { type: DataTypes.STRING(255), allowNull: true },
    years_experience: { type: DataTypes.INTEGER, allowNull: true },
    bio: { type: DataTypes.TEXT, allowNull: true },
    other_qualifications: { type: DataTypes.TEXT, allowNull: true },
    // 4. Liên lạc (email trong User)
    phone: { type: DataTypes.STRING(20), allowNull: true },
    office_address: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: true }
}, {
    tableName: 'lawyerprofiles',
    timestamps: false
});

module.exports = LawyerProfile;
