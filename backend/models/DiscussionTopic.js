const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DiscussionTopic = sequelize.define('DiscussionTopic', {
    topic_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'Open'
    },
    image_paths: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    video_path: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    likes_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
}, {
    tableName: 'discussiontopics',
    timestamps: false
});

module.exports = DiscussionTopic; 