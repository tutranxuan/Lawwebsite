require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sequelize = require('./config/database');
const legalDocumentRoutes = require('./routes/legalDocuments');
const documentTypeRoutes = require('./routes/documentTypes');
const uploadRoutes = require('./routes/upload');
const trafficSignRoutes = require('./routes/trafficSigns');
const path = require('path');
const multer = require('multer');
const authRoutes = require('./routes/auth');
const discussionRoutes = require('./routes/discussion');
const commentRoutes = require('./routes/comment');
const userRoutes = require('./routes/user');
const chatbotRoutes = require('./routes/chatbot');
const lawyerRoutes = require('./routes/lawyers');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Tạo thư mục uploads nếu chưa tồn tại
const uploadsDir = path.join(__dirname, 'uploads');
const signsDir = path.join(uploadsDir, 'signs');
if (!require('fs').existsSync(uploadsDir)) {
    require('fs').mkdirSync(uploadsDir);
}
if (!require('fs').existsSync(signsDir)) {
    require('fs').mkdirSync(signsDir, { recursive: true });
}

// Cho phép truy cập file tĩnh trong thư mục uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/legal-documents', legalDocumentRoutes);
app.use('/api/document-types', documentTypeRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/traffic-signs', trafficSignRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/topics', discussionRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/lawyers', lawyerRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ 
            message: 'Lỗi upload file: ' + err.message 
        });
    }
    res.status(500).json({ 
        message: err.message || 'Có lỗi xảy ra trong quá trình xử lý!' 
    });
});

// Test database connection
sequelize.authenticate()
    .then(() => {
        console.log('Kết nối cơ sở dữ liệu thành công.');
    })
    .catch(err => {
        console.error('Không thể kết nối cơ sở dữ liệu:', err);
    });

// Sync database
sequelize.sync()
    .then(() => {
        console.log('Database synced');
    })
    .catch((err) => {
        console.error('Error syncing database:', err);
    });

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});