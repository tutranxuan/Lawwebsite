const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CommentLike = sequelize.define('CommentLike', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    comment_id: { type: DataTypes.INTEGER, allowNull: false }
}, {
    tableName: 'commentlikes',
    timestamps: false,
    indexes: [{ unique: true, fields: ['user_id', 'comment_id'] }]
});
module.exports = CommentLike;
