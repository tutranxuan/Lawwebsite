const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
    notification_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'user_id' }
    },
    type: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    ref_type: { type: DataTypes.STRING(20), allowNull: true },
    ref_id: { type: DataTypes.INTEGER, allowNull: true },
    topic_id: { type: DataTypes.INTEGER, allowNull: true },
    actor_user_id: { type: DataTypes.INTEGER, allowNull: true },
    actor_username: { type: DataTypes.STRING(255), allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: false },
    read: { type: DataTypes.BOOLEAN, defaultValue: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'notifications',
    timestamps: false
});

module.exports = Notification;
