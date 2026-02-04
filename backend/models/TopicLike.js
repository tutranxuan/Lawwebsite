const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TopicLike = sequelize.define('TopicLike', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    topic_id: { type: DataTypes.INTEGER, allowNull: false }
}, {
    tableName: 'topiclikes',
    timestamps: false,
    indexes: [{ unique: true, fields: ['user_id', 'topic_id'] }]
});
module.exports = TopicLike;
