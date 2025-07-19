const { Sequelize } = require('sequelize');

// Khởi tạo đối tượng Sequelize với thông tin kết nối cụ thể
const sequelize = new Sequelize('WebPL', 'postgres', 'kai2604', {
    host: 'localhost',
    dialect: 'postgres',
    logging: false
});

// Xuất đối tượng sequelize để sử dụng ở những nơi khác trong ứng dụng
module.exports = sequelize;