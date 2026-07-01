// Chatbot tư vấn luật giao thông
class LawChatbot {
    constructor() {
        this.messages = [];
        this.isOpen = false;
        this.init();
    }

    init() {
        this.createChatbotHTML();
        this.bindEvents();
        this.addWelcomeMessage();
    }

    createChatbotHTML() {
        const chatbotHTML = `
            <div class="chatbot-container">
                <button class="chatbot-button" id="chatbot-toggle">💬</button>
                <div class="chatbot-window" id="chatbot-window">
                    <div class="chatbot-header">
                        <h3>🤖 Tư vấn Luật Giao thông</h3>
                        <button id="chatbot-fullscreen">⛶</button> <button class="chatbot-close" id="chatbot-close">×</button>
                    </div>
                    <div class="chatbot-messages" id="chatbot-messages"></div>
                    <div class="chatbot-quick-actions" id="chatbot-quick-actions">
                        <button class="chatbot-quick-btn" data-question="Mức phạt nồng độ cồn">Mức phạt nồng độ cồn</button>
                        <button class="chatbot-quick-btn" data-question="Biển báo giao thông">Biển báo giao thông</button>
                        <button class="chatbot-quick-btn" data-question="Xử phạt vi phạm">Xử phạt vi phạm</button>
                        <button class="chatbot-quick-btn" data-question="Thủ tục đăng ký xe">Thủ tục đăng ký xe</button>
                    </div>
                    <div class="chatbot-input-container">
                        <textarea class="chatbot-input" id="chatbot-input" placeholder="Nhập câu hỏi của bạn..."></textarea>
                        <button class="chatbot-send" id="chatbot-send">➤</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', chatbotHTML);
    }

    bindEvents() {
        const toggleBtn = document.getElementById('chatbot-toggle');
        const closeBtn = document.getElementById('chatbot-close');
        const sendBtn = document.getElementById('chatbot-send');
        const input = document.getElementById('chatbot-input');
        const quickBtns = document.querySelectorAll('.chatbot-quick-btn');
        const fsBtn = document.getElementById('chatbot-fullscreen');

        toggleBtn.addEventListener('click', () => this.toggleChatbot());
        closeBtn.addEventListener('click', () => this.toggleChatbot());
        sendBtn.addEventListener('click', () => this.sendMessage());
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        quickBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.getAttribute('data-question');
                this.handleUserMessage(question);
            });
        });

        fsBtn.addEventListener('click', () => this.toggleFullscreen());
    }

    toggleFullscreen() {
        const window = document.getElementById('chatbot-window');
        window.classList.toggle('fullscreen');
    }

    toggleChatbot() {
        this.isOpen = !this.isOpen;
        const window = document.getElementById('chatbot-window');
        const button = document.getElementById('chatbot-toggle');
        
        if (this.isOpen) {
            window.classList.add('active');
            button.classList.add('active');
            document.getElementById('chatbot-input').focus();
        } else {
            window.classList.remove('active');
            button.classList.remove('active');
        }
    }

    addWelcomeMessage() {
        const welcomeMsg = "Xin chào! Tôi là chatbot tư vấn luật giao thông. Tôi có thể giúp bạn:\n\n" +
            "• Tra cứu mức phạt nồng độ cồn\n" +
            "• Tìm hiểu về biển báo giao thông\n" +
            "• Xử phạt vi phạm giao thông\n" +
            "• Thủ tục đăng ký, đổi bằng lái xe\n" +
            "• Và nhiều câu hỏi khác về luật giao thông\n\n" +
            "Hãy đặt câu hỏi hoặc chọn một chủ đề bên dưới!";
        this.addMessage(welcomeMsg, 'bot');
    }

    sendMessage() {
        const input = document.getElementById('chatbot-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        input.value = '';
        this.handleUserMessage(message);
    }

    async handleUserMessage(message) {
        this.addMessage(message, 'user');
        this.showTyping();
        
        try {
            const response = await fetch('http://localhost:4000/api/chatbot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question: message })
            });
            
            const data = await response.json();
            this.hideTyping();
            let answer = data.answer || 'Xin lỗi, không nhận được phản hồi.';
            if (data.sources && data.sources.length > 0) {
                const refs = data.sources
                    .slice(0, 3)
                    .map(s => {
                        const label = [s.level, s.number].filter(Boolean).join(' ');
                        return label ? `• ${label}: ${(s.title || '').slice(0, 80)}` : null;
                    })
                    .filter(Boolean)
                    .join('\n');
                if (refs) answer += '\n\n📚 Tham chiếu:\n' + refs;
            }
            this.addMessage(answer, 'bot');
        } catch (error) {
            this.hideTyping();
            // Fallback to local processing if API fails
            const answer = this.processQuestionLocally(message);
            this.addMessage(answer, 'bot');
        }
    }

    addMessage(text, type) {
        const messagesContainer = document.getElementById('chatbot-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chatbot-message ${type}`;
        messageDiv.textContent = text;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showTyping() {
        const messagesContainer = document.getElementById('chatbot-messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chatbot-typing';
        typingDiv.id = 'chatbot-typing';
        typingDiv.innerHTML = '<span></span><span></span><span></span>';
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTyping() {
        const typingDiv = document.getElementById('chatbot-typing');
        if (typingDiv) typingDiv.remove();
    }

    // Fallback local processing (rule-based)
    processQuestionLocally(question) {
        const q = question.toLowerCase();
        
        // Nồng độ cồn
        if (q.includes('nồng độ cồn') || q.includes('uống rượu') || q.includes('uống bia')) {
            return "Mức phạt nồng độ cồn khi lái xe:\n\n" +
                "• Chưa vượt quá 50mg/100ml máu (0,25mg/lít khí thở):\n" +
                "  - Xe ô tô: 6-8 triệu đồng\n" +
                "  - Xe máy: 2-3 triệu đồng\n" +
                "  - Trừ 04 điểm GPLX\n\n" +
                "• Vượt 50-80mg/100ml máu (0,25-0,4mg/lít khí thở):\n" +
                "  - Xe ô tô: 18-20 triệu đồng\n" +
                "  - Xe máy: 6-8 triệu đồng\n" +
                "  - Trừ 10 điểm GPLX\n\n" +
                "• Vượt quá 80mg/100ml máu (0,4mg/lít khí thở):\n" +
                "  - Xe ô tô: 30-40 triệu đồng\n" +
                "  - Xe máy: 8-10 triệu đồng\n" +
                "  - Tước GPLX 22-24 tháng\n\n" +
                "Bạn có thể sử dụng công cụ 'Tính nồng độ cồn' trên website để ước tính nồng độ cồn trong máu.";
        }
        
        // Biển báo
        if (q.includes('biển báo') || q.includes('biển hiệu')) {
            return "Bạn có thể tra cứu biển báo giao thông tại mục 'Tra cứu biển báo' trên website.\n\n" +
                "Các loại biển báo chính:\n" +
                "• Biển báo cấm\n" +
                "• Biển báo hiệu lệnh\n" +
                "• Biển báo cảnh báo\n" +
                "• Biển báo chỉ dẫn\n" +
                "• Biển phụ\n\n" +
                "Mỗi biển báo có mã hiệu và ý nghĩa riêng. Hãy tra cứu để biết chi tiết!";
        }
        
        // Xử phạt
        if (q.includes('xử phạt') || q.includes('phạt') || q.includes('vi phạm')) {
            return "Mức xử phạt vi phạm giao thông phụ thuộc vào loại vi phạm:\n\n" +
                "• Vi phạm tốc độ\n" +
                "• Vi phạm nồng độ cồn\n" +
                "• Không đội mũ bảo hiểm\n" +
                "• Vượt đèn đỏ\n" +
                "• Đi ngược chiều\n" +
                "• Và nhiều vi phạm khác\n\n" +
                "Bạn có thể tra cứu chi tiết tại mục 'Tra cứu xử phạt' hoặc tìm kiếm văn bản pháp luật liên quan.";
        }
        
        // Thủ tục
        if (q.includes('thủ tục') || q.includes('đăng ký') || q.includes('đổi bằng')) {
            return "Thủ tục đăng ký và đổi bằng lái xe:\n\n" +
                "1. Đăng ký bằng lái xe:\n" +
                "   - Nộp hồ sơ tại Sở Giao thông Vận tải\n" +
                "   - Thi sát hạch\n" +
                "   - Nhận bằng lái xe\n\n" +
                "2. Đổi bằng lái xe:\n" +
                "   - Khi hết hạn hoặc mất\n" +
                "   - Nộp hồ sơ và lệ phí\n" +
                "   - Nhận bằng mới\n\n" +
                "Chi tiết biểu mẫu và hướng dẫn có tại mục 'Biểu mẫu & hướng dẫn' trên website.";
        }
        
        // Mặc định
        return "Cảm ơn bạn đã đặt câu hỏi! Tôi đang học hỏi thêm để trả lời chính xác hơn.\n\n" +
            "Bạn có thể:\n" +
            "• Tra cứu văn bản pháp luật tại mục 'Tra cứu VBPL'\n" +
            "• Tham gia cộng đồng để hỏi đáp với người dùng khác\n" +
            "• Sử dụng các công cụ hỗ trợ trên website\n\n" +
            "Hoặc hãy đặt câu hỏi cụ thể hơn về luật giao thông!";
    }
}

// Khởi tạo chatbot khi trang load
document.addEventListener('DOMContentLoaded', () => {
    window.lawChatbot = new LawChatbot();
});

