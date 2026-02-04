const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'hotroluatgiaothongduongbo@gmail.com',
        pass: 'auowhqqtnvznmphj' // mật khẩu ứng dụng
    }
});

const sendAdminNotification = (adminEmail) => {
    const mailOptions = {
        from: 'Hệ thống Hỗ trợ Luật Giao thông Đường Bộ',
        to: adminEmail,
        subject: '🔔 Thông báo: Có hồ sơ luật sư mới cần duyệt',
    html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #1a237e; color: #ffffff; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Hệ thống Hỗ trợ Luật Giao thông Đường Bộ </h1>
            </div>
            
            <div style="padding: 30px; line-height: 1.6; color: #333333;">
                <h2 style="color: #1a237e; margin-top: 0;">🔔 Thông báo duyệt hồ sơ</h2>
                <p>Xin chào <strong>Quản trị viên</strong>,</p>
                <p>Hệ thống vừa nhận được một <b>Hồ sơ đăng ký Luật sư mới</b> đang chờ được phê duyệt.</p>
                
                <div style="background-color: #f8f9fa; border-left: 4px solid #1a237e; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Trạng thái:</strong> Đang chờ duyệt (Pending)</p>
                </div>

                <p>Vui lòng đăng nhập vào trang quản trị để xem chi tiết thông tin và tệp đính kèm của luật sư.</p>
                
                <div style="text-align: center; margin-top: 30px;">
                    <a href="" 
                    style="background-color: #1a237e; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                    Đi tới trang duyệt hồ sơ
                    </a>
                </div>
            </div>
            
            <div style="background-color: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #777777;">
                <p style="margin: 0;">© 2026 Law Support Website System. All rights reserved.</p>
                <p style="margin: 5px 0 0 0;">Đây là email tự động, vui lòng không trả lời thư này.</p>
            </div>
        </div>
    `
    };

    return transporter.sendMail(mailOptions);
};

const sendUserNotification = (userEmail, actionType, contentTitle) => {
    let actionName = "";
    let color = "#d32f2f"; 

    switch (actionType) {
        case 'delete_post': actionName = "Xóa bài viết"; break;
        case 'hide_post': actionName = "Ẩn bài viết"; color = "#f57c00"; break; 
        case 'delete_comment': actionName = "Xóa bình luận"; break;
        case 'restore_post': 
            actionName = "Khôi phục bài viết"; 
            color = "#2e7d32"; 
            break;
        default: actionName = "Cập nhật nội dung";
    }

    const mailOptions = {
        from: 'Hỗ trợ Luật Giao thông Đường Bộ',
        to: userEmail,
        subject: `🔔 Thông báo: ${actionName}`,
        html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
            <div style="background-color: ${color}; color: white; padding: 15px; text-align: center;">
                <h2 style="margin: 0;">Thông báo từ Quản trị viên</h2>
            </div>
            
            <div style="padding: 25px; color: #333;">
                <p>Xin chào,</p>
                <p>Chúng tôi thông báo rằng nội dung sau của bạn đã được <strong>${actionName.toLowerCase()}</strong>:</p>
                
                <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 15px 0; font-style: italic; border-left: 4px solid ${color};">
                    "${contentTitle}"
                </div>

                <p>${actionType === 'restore_post' 
                    ? 'Bài viết của bạn hiện đã hiển thị công khai trở lại trên hệ thống.' 
                    : 'Hành động này nhằm đảm bảo môi trường cộng đồng tuân thủ đúng quy định.'}</p>
                
                <p>Trân trọng,<br>Ban quản trị hệ thống.</p>
            </div>
            
            <div style="background-color: #fafafa; padding: 10px; text-align: center; font-size: 11px; color: #999;">
                © 2026 Law Support Website System
            </div>
        </div>
        `
    };

    return transporter.sendMail(mailOptions);
};

const sendLawyerFeedbackNotification = (userEmail, topicTitle) => {
    const mailOptions = {
        from: 'Hỗ trợ Luật Giao thông Đường Bộ',
        to: userEmail,
        subject: '🎓 CÓ LUẬT SƯ VỪA PHẢN HỒI BÀI VIẾT CỦA BẠN',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #004d40; color: white; padding: 15px; text-align: center;">
                <h2 style="margin: 0;">Tư vấn Chuyên môn</h2>
            </div>
            <div style="padding: 25px; color: #333;">
                <p>Xin chào,</p>
                <p>Một <b>Luật sư</b> vừa để lại bình luận hướng dẫn trong bài viết:</p>
                <div style="background: #e0f2f1; padding: 10px; border-radius: 5px; font-weight: bold; color: #00695c;">
                    "${topicTitle}"
                </div>
                <p>Vui lòng đăng nhập vào hệ thống để xem nội dung tư vấn chi tiết.</p>
                <div style="text-align: center; margin-top: 25px;">
                    <a href="" style="background: #004d40; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Xem phản hồi ngay</a>
                </div>
            </div>
            <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 11px; color: #888;">
                © 2026 Hệ thống Hỗ trợ Luật Giao thông
            </div>
        </div>
        `
    };
    return transporter.sendMail(mailOptions);
};

const sendLawyerApprovalNotification = (lawyerEmail, fullName) => {
    const mailOptions = {
        from: 'Hỗ trợ Luật Giao thông Đường Bộ',
        to: lawyerEmail,
        subject: '🎊 Chúc mừng: Hồ sơ Luật sư của bạn đã được phê duyệt',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #2e7d32; color: white; padding: 20px; text-align: center;">
                <h2 style="margin: 0;">Tài khoản đã kích hoạt!</h2>
            </div>
            <div style="padding: 25px; color: #333;">
                <p>Xin chào Luật sư <strong>${fullName}</strong>,</p>
                <p>Chúc mừng bạn! Hồ sơ đăng ký tài khoản luật sư của bạn trên hệ thống <b>Hỗ trợ Luật Giao thông Đường Bộ</b> đã được quản trị viên phê duyệt thành công.</p>
                <p>Bây giờ bạn có thể đăng nhập để bắt đầu tư vấn và hỗ trợ cộng đồng.</p>
                <div style="text-align: center; margin-top: 25px;">
                    <a href="" style="background: #2e7d32; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Đăng nhập ngay</a>
                </div>
            </div>
            <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 11px; color: #888;">
                © 2026 Hệ thống Hỗ trợ Luật Giao thông
            </div>
        </div>
        `
    };
    return transporter.sendMail(mailOptions);
};

// Thông báo từ chối hồ sơ
const sendLawyerRejectionNotification = (lawyerEmail, fullName) => {
    const mailOptions = {
        from: 'Hỗ trợ Luật Giao thông Đường Bộ',
        to: lawyerEmail,
        subject: '📢 Thông báo: Kết quả duyệt hồ sơ Luật sư',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #d32f2f; color: white; padding: 20px; text-align: center;">
                <h2 style="margin: 0;">Thông báo từ chối hồ sơ</h2>
            </div>
            <div style="padding: 25px; color: #333;">
                <p>Xin chào <strong>${fullName}</strong>,</p>
                <p>Cảm ơn bạn đã quan tâm và gửi hồ sơ đăng ký đăng ký tài khoản luật sư tại hệ thống của chúng tôi.</p>
                <p>Rất tiếc, sau khi xem xét, quản trị viên đã <b>từ chối</b> yêu cầu kích hoạt tài khoản luật sư của bạn do hồ sơ chưa phù hợp với yêu cầu hệ thống.</p>
                <p>Trân trọng.</p>
            </div>
            <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 11px; color: #888;">
                © 2026 Hệ thống Hỗ trợ Luật Giao thông
            </div>
        </div>
        `
    };
    return transporter.sendMail(mailOptions);
};
module.exports = { sendAdminNotification, sendUserNotification, sendLawyerFeedbackNotification, sendLawyerApprovalNotification, sendLawyerRejectionNotification};