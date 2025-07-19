const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TrafficSignCategory = sequelize.define('TrafficSignCategory', {
    category_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    category_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'trafficsigncategories',
    timestamps: false
});

module.exports = TrafficSignCategory; 