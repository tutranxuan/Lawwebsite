Hệ thống Web Hỗ trợ Tư vấn Luật Giao thông Đường bộ
1. Giới thiệu tổng quan
Hệ thống là một nền tảng pháp lý thông minh được xây dựng nhằm hỗ trợ người dân tra cứu và giải đáp các tình huống pháp luật giao thông đường bộ Việt Nam. Thay vì tìm kiếm thủ công trong hàng trăm văn bản pháp luật, hệ thống sử dụng Trí tuệ nhân tạo (AI) kết hợp với Đồ thị tri thức (Knowledge Graph) để hiểu sâu ngữ nghĩa và đưa ra câu trả lời chính xác, tin cậy.

Các tính năng nổi bật:

Chatbot Pháp luật AI: Tư vấn dựa trên dữ liệu văn bản pháp luật cập nhật, có dẫn chiếu điều khoản cụ thể.

Tra cứu văn bản: Hệ thống hóa biển báo, quy định nồng độ cồn và các mức xử phạt.

Quản trị nội dung: Quy trình xác thực chuyên gia và số hóa văn bản pháp luật tự động (PDF to Graph).

2. Hướng dẫn cài đặt môi trường (Cần thực hiện 1 lần)
Trước khi khởi chạy, bạn cần cài đặt các công cụ sau trên máy tính:

Bước 1: Cài đặt công cụ nền tảng
Python (3.10+): Tải tại python.org.

Lưu ý quan trọng: Trong quá trình cài đặt, nhớ tích vào ô "Add Python to PATH".

Node.js (LTS): Tải tại nodejs.org.

Java (JRE/JDK 17+): Cần thiết để chạy Neo4j (Tải tại Adoptium).

Neo4j Community Edition: Tải tại neo4j.com.

Bước 2: Thiết lập Chatbot AI
Mở PowerShell, di chuyển đến thư mục chatbot và cài đặt các thư viện cần thiết:

PowerShell
cd c:\Users\PC\Documents\DA\lawwebsite\chatbotAI
.\start-ai.ps1 -Setup -Ingest
Lệnh này sẽ tự động cài đặt các package Python và nạp dữ liệu từ các tệp PDF vào cơ sở dữ liệu.

3. Quy trình khởi chạy hệ thống (Hàng ngày)
Hệ thống bao gồm 4 thành phần cần được khởi chạy theo đúng thứ tự để đảm bảo các kết nối không bị lỗi:

Cửa sổ 1: Khởi động Cơ sở dữ liệu (Neo4j)
Neo4j lưu trữ cấu trúc quan hệ giữa các điều luật để AI hiểu được ngữ cảnh.

PowerShell
cd C:\Users\PC\Downloads\neo4j-community-2026.05.0-windows\neo4j-community-2026.05.0\bin
.\neo4j console
Đợi dòng chữ "Started" xuất hiện.

Cửa sổ 2: Khởi động Chatbot AI Server
Server này xử lý các truy vấn AI và kiến trúc RAG.

PowerShell
cd c:\Users\PC\Documents\DA\lawwebsite\chatbotAI
.\start-ai.ps1
Cửa sổ 3: Khởi động Backend
Backend xử lý nghiệp vụ người dùng, tài khoản và kết nối với PostgreSQL.

PowerShell
cd c:\Users\PC\Documents\DA\lawwebsite\backend
npm start
Cửa sổ 4: Giao diện người dùng
Mở thư mục frontend và mở tệp index.html bằng trình duyệt (Chrome/Edge).
Nếu bạn dùng VS Code, hãy cài tiện ích Live Server và nhấn "Go Live" để có trải nghiệm tốt nhất.

4. Kiến trúc kỹ thuật và luồng dữ liệu
Hệ thống sử dụng kiến trúc Hybrid-SOA, tách biệt rõ ràng giữa logic nghiệp vụ (Node.js) và bộ não AI (FastAPI).

Để đảm bảo độ chính xác cho các câu trả lời về luật, hệ thống sử dụng quy trình Graph-RAG (Truy xuất tăng cường thế hệ dựa trên đồ thị), giúp giảm thiểu tình trạng "ảo tưởng" (hallucination) của AI.

5. Xử lý sự cố thường gặp
Lỗi không kết nối được Database: Kiểm tra xem Neo4j đã chạy chưa (kiểm tra tại http://localhost:7474).

Lỗi thiếu Python package: Nếu AI Server báo lỗi module, hãy chạy pip install -r requirements.txt trong thư mục chatbotAI.

Cổng bị chiếm: Nếu lệnh npm start báo lỗi, hãy tắt các ứng dụng đang sử dụng cổng 3000 hoặc 8000.

Dự án Đồ án Tốt nghiệp 2026.