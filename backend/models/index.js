const sequelize = require('../config/database');
const TrafficSign = require('./TrafficSign');
const TrafficSignCategory = require('./TrafficSignCategory');
const User = require('./User');
const LawyerProfile = require('./LawyerProfile');
const DiscussionTopic = require('./DiscussionTopic');
const Comment = require('./Comment');
const Notification = require('./Notification');
const TopicLike = require('./TopicLike');
const CommentLike = require('./CommentLike');

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

User.hasOne(LawyerProfile, { foreignKey: 'user_id' });
LawyerProfile.belongsTo(User, { foreignKey: 'user_id' });

DiscussionTopic.hasMany(Comment, { foreignKey: 'topic_id' });
Comment.belongsTo(DiscussionTopic, { foreignKey: 'topic_id' });

User.hasMany(Notification, { foreignKey: 'user_id' });
Notification.belongsTo(User, { foreignKey: 'user_id' });

DiscussionTopic.hasMany(TopicLike, { foreignKey: 'topic_id' });
TopicLike.belongsTo(DiscussionTopic, { foreignKey: 'topic_id' });
User.hasMany(TopicLike, { foreignKey: 'user_id' });
TopicLike.belongsTo(User, { foreignKey: 'user_id' });

Comment.hasMany(CommentLike, { foreignKey: 'comment_id' });
CommentLike.belongsTo(Comment, { foreignKey: 'comment_id' });
User.hasMany(CommentLike, { foreignKey: 'user_id' });
CommentLike.belongsTo(User, { foreignKey: 'user_id' });

const db = {
    sequelize,
    TrafficSign,
    TrafficSignCategory,
    User,
    LawyerProfile,
    DiscussionTopic,
    Comment,
    Notification,
    TopicLike,
    CommentLike
};

module.exports = db; 