const sequelize = require('../config/database');
const TrafficSign = require('./TrafficSign');
const TrafficSignCategory = require('./TrafficSignCategory');
const User = require('./User');
const DiscussionTopic = require('./DiscussionTopic');
const Comment = require('./Comment');

// Định nghĩa các mối quan hệ
TrafficSign.belongsTo(TrafficSignCategory, {
    foreignKey: 'category_id',
    as: 'TrafficSignCategory'
});

TrafficSignCategory.hasMany(TrafficSign, {
    foreignKey: 'category_id',
    as: 'TrafficSigns'
});

// Quan hệ cộng đồng
User.hasMany(DiscussionTopic, { foreignKey: 'user_id' });
DiscussionTopic.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Comment, { foreignKey: 'user_id' });
Comment.belongsTo(User, { foreignKey: 'user_id' });

DiscussionTopic.hasMany(Comment, { foreignKey: 'topic_id' });
Comment.belongsTo(DiscussionTopic, { foreignKey: 'topic_id' });

const db = {
    sequelize,
    TrafficSign,
    TrafficSignCategory,
    User,
    DiscussionTopic,
    Comment
};

module.exports = db; 