const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const TrafficSignCategory = require('./TrafficSignCategory');

const TrafficSign = sequelize.define('TrafficSign', {
    sign_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    sign_code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    image_path: {
        type: DataTypes.STRING,
        allowNull: true
    },
    category_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'traffic_sign_categories',
            key: 'category_id'
        }
    }
}, {
    tableName: 'trafficsigns',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = TrafficSign; 