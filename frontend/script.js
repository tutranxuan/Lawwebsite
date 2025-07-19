async function fetchDocumentTypes() {
    const response = await fetch('http://localhost:4000/api/document-types');
    const types = await response.json();
    const typeFilter = document.getElementById('typeFilter');
    types.forEach(type => {
        const option = document.createElement('option');
        option.value = type.type_id;
        option.textContent = type.type_name;
        typeFilter.appendChild(option);
    });
}

let allDocuments = [];

async function fetchDocuments() {
    const response = await fetch('http://localhost:4000/api/legal-documents');
    const documents = await response.json();
    allDocuments = documents;
    displayDocuments(documents);
}

async function searchDocuments() {
    const query = document.getElementById('search').value;
    const typeId = document.getElementById('typeFilter').value;
    let url = `http://localhost:4000/api/legal-documents/search?query=${encodeURIComponent(query)}`;
    if (typeId) url += `&type_id=${typeId}`;
    const response = await fetch(url);
    const documents = await response.json();
    displayDocuments(documents);
}

function filterByType() {
    const typeId = document.getElementById('typeFilter').value;
    let filtered = allDocuments;
    if (typeId) {
        filtered = allDocuments.filter(doc => String(doc.type_id) === String(typeId));
    }
    displayDocuments(filtered);
}

function displayDocuments(documents) {
    const documentsDiv = document.getElementById('documents');
    if (!documents.length) {
        documentsDiv.innerHTML = '<p>Không có văn bản nào.</p>';
        return;
    }
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    let html = `<div style="text-align:right;margin-bottom:12px;">
        ${user && user.role === 'Admin' ? '<button id="btn-add-vbpl" style="background:#28a745;color:#fff;padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-weight:500;">+ Thêm VBPL</button>' : ''}
    </div>`;
    html += `<table class=\"documents-table\"><thead><tr>
        <th>Tiêu đề</th>
        <th>Số hiệu</th>
        <th>Ngày ban hành</th>
        <th>Cơ quan ban hành</th>
        <th>Loại</th>
        <th>Xem chi tiết</th>
        <th>Tải về</th>
        ${user && user.role === 'Admin' ? '<th>Thao tác</th>' : ''}
    </tr></thead><tbody>`;
    documents.forEach(doc => {
        const typeName = doc.type_name || (doc.type && doc.type.type_name) || (doc.DocumentType && doc.DocumentType.type_name) || '';
        
        // Debug log
        console.log('Document:', doc.title);
        console.log('File path:', doc.file_path);
        
        // Use the file_path directly from database
        let filePath = doc.file_path;
        
        html += `<tr>
            <td>${doc.title}</td>
            <td>${doc.document_number || ''}</td>
            <td>${doc.issuance_date ? new Date(doc.issuance_date).toLocaleDateString() : ''}</td>
            <td>${doc.issuing_authority || ''}</td>
            <td>${typeName}</td>
            <td><button onclick=\"goToDetail(${doc.doc_id})\">Xem chi tiết</button></td>
            <td>${filePath ? `<a href="${filePath}\" target=\"_blank\" rel=\"noopener noreferrer\">Tải về</a>` : ''}</td>
            ${user && user.role === 'Admin' ? `<td>
                <button class='btn-edit-vbpl' data-doc-id='${doc.doc_id}' style='background:#ffc107;color:#333;padding:4px 10px;border:none;border-radius:4px;cursor:pointer;'>Sửa</button>
                <button class='btn-delete-vbpl' data-doc-id='${doc.doc_id}' style='background:#dc3545;color:#fff;padding:4px 10px;border:none;border-radius:4px;cursor:pointer;margin-left:4px;'>Xóa</button>
            </td>` : ''}
        </tr>`;
    });
    html += '</tbody></table>';
    documentsDiv.innerHTML = html;
    // Gán sự kiện cho các nút Thêm, Sửa, Xóa nếu là admin
    if (user && user.role === 'Admin') {
        const btnAdd = document.getElementById('btn-add-vbpl');
        if (btnAdd) btnAdd.onclick = showAddVBPLModal;
        documentsDiv.querySelectorAll('.btn-edit-vbpl').forEach(btn => {
            btn.onclick = function() {
                const docId = btn.getAttribute('data-doc-id');
                showEditVBPLModal(docId);
            };
        });
        documentsDiv.querySelectorAll('.btn-delete-vbpl').forEach(btn => {
            btn.onclick = async function() {
                const docId = btn.getAttribute('data-doc-id');
                if (!confirm('Bạn có chắc chắn muốn xóa văn bản này không?')) return;
                await deleteVBPL(docId);
            };
        });
    }
}

async function viewDocument(id) {
    const response = await fetch(`http://localhost:4000/api/legal-documents/${id}`);
    const document = await response.json();
    showDocumentDetails(document);
}

function showDocumentDetails(document) {
    const detailsDiv = document.getElementById('document-details');
    detailsDiv.style.display = 'block';
    detailsDiv.innerHTML = `
        <h2>${document.title}</h2>
        <p><b>Số hiệu:</b> ${document.document_number || ''}</p>
        <p><b>Ngày ban hành:</b> ${document.issuance_date ? new Date(document.issuance_date).toLocaleDateString() : ''}</p>
        <p><b>Ngày hiệu lực:</b> ${document.effective_date ? new Date(document.effective_date).toLocaleDateString() : ''}</p>
        <p><b>Cơ quan ban hành:</b> ${document.issuing_authority || ''}</p>
        <p><b>Loại văn bản:</b> ${document.type_name || ''}</p>
        <p><b>Tóm tắt:</b> ${document.summary || ''}</p>
        <div class="document-content"><b>Nội dung:</b><br>${document.content || ''}</div>
        ${document.file_path ? `<a href="${document.file_path}" download target="_blank">Tải về văn bản</a><br>` : ''}
        <button onclick="hideDocumentDetails()">Đóng</button>
    `;
}

function hideDocumentDetails() {
    const detailsDiv = document.getElementById('document-details');
    detailsDiv.style.display = 'none';
}

function goToDetail(id) {
    window.location.href = `detail.html?id=${id}`;
}

// SPA menu logic
// function showPage(page) {
//     const pages = ['home', 'vbpl', 'tools', 'forms', 'community'];
//     pages.forEach(p => {
//         document.getElementById('page-' + p).style.display = (p === page) ? 'block' : 'none';
//         document.getElementById('menu-' + p).classList.remove('active');
//     });
//     document.getElementById('menu-' + page).classList.add('active');
//     if (page === 'vbpl') {
//         renderVBPL();
//     }
// }

// Render lại giao diện tra cứu vào #vbpl-content
function renderVBPL() {
    document.getElementById('vbpl-content').innerHTML = `
        <h2>Tra cứu Văn bản Pháp luật</h2>
        <div class="search-container">
            <div class="search-box">
                <input type="text" id="search" placeholder="Nhập từ khóa tìm kiếm...">
                <button onclick="searchDocuments()">Tìm kiếm</button>
            </div>
            <div class="filter-container">
                <div class="filter-group">
                    <label>Loại văn bản</label>
                    <select id="typeFilter" onchange="filterByType()">
                        <option value="">Tất cả loại văn bản</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Cơ quan ban hành</label>
                    <select id="authorityFilter" onchange="filterDocuments()">
                        <option value="">Tất cả cơ quan</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Năm ban hành</label>
                    <select id="yearFilter" onchange="filterDocuments()">
                        <option value="">Tất cả năm</option>
                    </select>
                </div>
            </div>
        </div>
        <div id="documents"></div>
        <div id="document-details" style="display: none;"></div>
    `;
    fetchDocumentTypes();
    fetchDocuments();
    fetchAuthorities();
    setupYearFilter();
}

async function fetchAuthorities() {
    const response = await fetch('http://localhost:4000/api/legal-documents/authorities');
    const authorities = await response.json();
    const authorityFilter = document.getElementById('authorityFilter');
    authorities.forEach(auth => {
        const option = document.createElement('option');
        option.value = auth;
        option.textContent = auth;
        authorityFilter.appendChild(option);
    });
}

function setupYearFilter() {
    const yearFilter = document.getElementById('yearFilter');
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= 2000; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    }
}

function filterDocuments() {
    const typeId = document.getElementById('typeFilter').value;
    const authority = document.getElementById('authorityFilter').value;
    const year = document.getElementById('yearFilter').value;
    
    let filtered = allDocuments;
    
    if (typeId) {
        filtered = filtered.filter(doc => String(doc.type_id) === String(typeId));
    }
    
    if (authority) {
        filtered = filtered.filter(doc => doc.issuing_authority === authority);
    }
    
    if (year) {
        filtered = filtered.filter(doc => {
            const docYear = new Date(doc.issuance_date).getFullYear();
            return docYear === parseInt(year);
        });
    }
    
    displayDocuments(filtered);
}

async function displayTrafficSigns(signs) {
    const container = document.getElementById('signs-result');
    if (!signs || signs.length === 0) {
        container.innerHTML = '<p class="no-results">Không tìm thấy biển báo nào.</p>';
        return;
    }

    let html = '';
    signs.forEach(sign => {
        html += `
            <div class="sign-card">
                <div class="sign-image-container">
                    <img src="${sign.image_path}" alt="${sign.name}" class="sign-image">
                </div>
                <div class="sign-info">
                    <h3>${sign.name}</h3>
                    <div class="sign-code">Mã hiệu: ${sign.sign_code}</div>
                    <div class="sign-category">Loại: ${sign.TrafficSignCategory?.category_name || 'Chưa phân loại'}</div>
                    <div class="sign-description">${sign.description || ''}</div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// --- Modal sửa biển báo ---
let currentEditSign = null;

async function openEditModal(signId) {
    // Lấy thông tin biển báo từ API
    try {
        const response = await fetch(`http://localhost:4000/api/traffic-signs/${signId}`);
        if (!response.ok) throw new Error('Không tìm thấy biển báo');
        const sign = await response.json();
        currentEditSign = sign;
        // Điền dữ liệu vào form
        document.getElementById('edit-sign-id').value = sign.sign_id;
        document.getElementById('edit-sign-name').value = sign.name || '';
        document.getElementById('edit-sign-code').value = sign.sign_code || '';
        document.getElementById('edit-sign-description').value = sign.description || '';
        // Load loại biển báo
        await loadEditCategories(sign.category_id);
        // Hiển thị ảnh hiện tại
        document.getElementById('edit-sign-current-image').innerHTML = sign.image_path ? `<img src="${sign.image_path}" alt="Ảnh hiện tại" style="max-width:100px;">` : '';
        // Hiện modal
        document.getElementById('edit-sign-modal').style.display = 'block';
    } catch (error) {
        alert('Không thể tải thông tin biển báo.');
    }
}

async function loadEditCategories(selectedId) {
    const select = document.getElementById('edit-sign-category');
    select.innerHTML = '';
    try {
        const response = await fetch('http://localhost:4000/api/traffic-signs/categories/all');
        const categories = await response.json();
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.category_id;
            option.textContent = cat.category_name;
            if (cat.category_id == selectedId) option.selected = true;
            select.appendChild(option);
        });
    } catch (e) {
        select.innerHTML = '<option value="">Không tải được loại</option>';
    }
}

const closeEditModalBtn = document.getElementById('close-edit-modal');
if (closeEditModalBtn) closeEditModalBtn.onclick = function() {
    const editModal = document.getElementById('edit-sign-modal');
    if (editModal) editModal.style.display = 'none';
};

const editSignForm = document.getElementById('edit-sign-form');
if (editSignForm) {
    editSignForm.onsubmit = async function(e) {
        e.preventDefault();
        const id = document.getElementById('edit-sign-id').value;
        const name = document.getElementById('edit-sign-name').value;
        const sign_code = document.getElementById('edit-sign-code').value;
        const description = document.getElementById('edit-sign-description').value;
        const category_id = document.getElementById('edit-sign-category').value;
        const imageFile = document.getElementById('edit-sign-image').files[0];
        const formData = new FormData();
        formData.append('name', name);
        formData.append('sign_code', sign_code);
        formData.append('description', description);
        formData.append('category_id', category_id);
        if (imageFile) formData.append('image', imageFile);
        try {
            const response = await fetch(`http://localhost:4000/api/traffic-signs/${id}`, {
                method: 'PUT',
                body: formData
            });
            if (!response.ok) throw new Error('Lỗi khi cập nhật biển báo');
            const editModal = document.getElementById('edit-sign-modal');
            if (editModal) editModal.style.display = 'none';
            await loadAllSigns();
            alert('Cập nhật thành công!');
        } catch (error) {
            alert('Có lỗi khi cập nhật biển báo.');
        }
    }
}

// --- Render lại nút Sửa/Xóa ---
function displaySigns(signs) {
    const resultDiv = document.getElementById('signs-result');
    if (!signs.length) {
        resultDiv.innerHTML = '<p class="no-results">Không tìm thấy biển báo phù hợp.</p>';
        return;
    }
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    let html = '';
    signs.forEach(sign => {
        html += `
            <div class="sign-card">
                <div class="sign-image-container">
                    <img src="${sign.image_path || ''}" alt="${sign.name || ''}" class="sign-image">
                </div>
                <div class="sign-info">
                    <h3>${sign.name || ''}</h3>
                    <div class="sign-code">Mã hiệu: ${sign.sign_code || ''}</div>
                    <div class="sign-category">Loại: ${sign.TrafficSignCategory?.category_name || 'Chưa phân loại'}</div>
                    <div class="sign-description">${sign.description || ''}</div>
                    <div class="sign-actions">
                        ${user && user.role === 'Admin' ? `
                        <button onclick="openEditModal(${sign.sign_id})" class="sign-action-btn edit" title="Sửa biển báo">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteSign(${sign.sign_id})" class="sign-action-btn delete" title="Xóa biển báo">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    resultDiv.innerHTML = html;
}

async function deleteSign(signId) {
    if (!confirm('Bạn có chắc chắn muốn xóa biển báo này không?')) return;
    try {
        const response = await fetch(`http://localhost:4000/api/traffic-signs/${signId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Lỗi khi xóa biển báo');
        await loadAllSigns();
        alert('Xóa biển báo thành công!');
    } catch (error) {
        alert('Có lỗi xảy ra khi xóa biển báo.');
    }
}

window.openEditModal = openEditModal;
window.deleteSign = deleteSign;

// Khi load trang, mặc định hiển thị Trang chủ
window.onload = function() {
    fetchCategories();
    loadAllSigns();
    showUserInfo();
}

async function loadAllSigns() {
    try {
        const response = await fetch('http://localhost:4000/api/traffic-signs');
        const signs = await response.json();
        displaySigns(signs);
    } catch (error) {
        const resultDiv = document.getElementById('signs-result');
        if (resultDiv) resultDiv.innerHTML = '<p class="error-message">Có lỗi xảy ra khi tải danh sách biển báo.</p>';
    }
}

async function searchSigns() {
    const keyword = document.getElementById('signs-keyword').value.trim();
    const categoryId = document.getElementById('category-filter').value;
    let url = 'http://localhost:4000/api/traffic-signs/search?';
    if (keyword) url += `query=${encodeURIComponent(keyword)}`;
    if (categoryId) url += `${keyword ? '&' : ''}category_id=${categoryId}`;
    try {
        const response = await fetch(url);
        const signs = await response.json();
        displaySigns(signs);
    } catch (error) {
        document.getElementById('signs-result').innerHTML = '<p class="error-message">Có lỗi xảy ra khi tìm kiếm biển báo.</p>';
    }
}

window.searchSigns = searchSigns;

async function fetchCategories() {
    try {
        const response = await fetch('http://localhost:4000/api/traffic-signs/categories/all');
        const categories = await response.json();
        const categoryFilter = document.getElementById('category-filter');
        if (!categoryFilter) return;
        categoryFilter.innerHTML = '<option value="">Tất cả loại biển báo</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.category_id;
            option.textContent = category.category_name;
            categoryFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
    }
}

// ====== CỘNG ĐỒNG ======
// Lưu lại tất cả topics để lọc
let allCommunityTopics = [];

window.addEventListener('DOMContentLoaded', function() {
    // Lấy user 1 lần duy nhất
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    // Nếu vào community.html mà chưa đăng nhập thì show login
    if (window.location.pathname.endsWith('community.html') && !user) {
        if (typeof showLoginModal === 'function') showLoginModal();
        else window.location.href = 'index.html';
        return;
    }
    // Lấy các nút cộng đồng
    const btnCreate = document.getElementById('btn-create-topic');
    const btnHidden = document.getElementById('btn-hidden-topics');
    const btnAllAdmin = document.getElementById('btn-all-topics-admin');
    const btnFav = document.getElementById('btn-fav-topics');
    const btnMy = document.getElementById('btn-my-topics');
    const btnAll = document.getElementById('btn-all-topics');
    const profileIcon = document.getElementById('profile-icon');
    const profilePopup = document.getElementById('profile-popup');

    // Ẩn/hiện và gán sự kiện cho các nút cộng đồng
    if (window.location.pathname.endsWith('community.html')) {
        if (user && user.role === 'Admin') {
            if (btnCreate) btnCreate.style.display = 'none';
            if (btnFav) btnFav.style.display = 'none';
            if (btnMy) btnMy.style.display = 'none';
            if (btnAll) btnAll.style.display = 'none';
            if (btnHidden) {
                btnHidden.style.display = '';
                btnHidden.onclick = function() {
                    window.currentTopicFilter = 'hidden';
                    loadCommunityTopics('hidden');
                    if (btnAllAdmin) btnAllAdmin.style.display = '';
                };
            }
            if (btnAllAdmin) {
                btnAllAdmin.style.display = 'none';
                btnAllAdmin.onclick = function() {
                    window.currentTopicFilter = 'all';
                    loadCommunityTopics('all');
                    btnAllAdmin.style.display = 'none';
                };
            }
        } else {
            if (btnCreate) {
                btnCreate.style.display = '';
                if (user && user.status === 'Banned') {
                    btnCreate.onclick = function() {
                        alert('Tài khoản của bạn đã bị cấm đăng bài!');
                    };
                } else {
                    btnCreate.onclick = showCreateTopicModal;
                }
            }
            if (btnFav) btnFav.style.display = '';
            if (btnMy) btnMy.style.display = '';
            if (btnHidden) btnHidden.style.display = 'none';
            if (btnAllAdmin) btnAllAdmin.style.display = 'none';
            if (btnAll) btnAll.style.display = 'none';
            if (btnFav) btnFav.onclick = function() {
                window.currentTopicFilter = 'fav';
                loadCommunityTopics('fav');
                if (btnAll) btnAll.style.display = '';
            };
            if (btnMy) btnMy.onclick = function() {
                window.currentTopicFilter = 'my';
                loadCommunityTopics('my');
                if (btnAll) btnAll.style.display = '';
            };
            if (btnAll) btnAll.onclick = function() {
                window.currentTopicFilter = 'all';
                loadCommunityTopics('all');
                btnAll.style.display = 'none';
            };
        }
        // Gán sự kiện cho nút đóng modal tạo chủ đề mới (luôn luôn gán, không phụ thuộc role)
        const btnCloseCreate = document.getElementById('close-create-topic');
        if (btnCloseCreate) {
            btnCloseCreate.onclick = closeCreateTopicModal;
        }
        // Tự động load danh sách chủ đề khi vào trang cộng đồng
        loadCommunityTopics('all');
    }
    // Gán sự kiện cho profileIcon
    if (profileIcon && profilePopup) {
        profileIcon.onclick = function(e) {
            e.stopPropagation();
            profilePopup.style.display = (profilePopup.style.display === 'block') ? 'none' : 'block';
        };
        window.addEventListener('click', function(e) {
            if (profilePopup && !profilePopup.contains(e.target) && e.target !== profileIcon) {
                profilePopup.style.display = 'none';
            }
        });
    }
    // Tự động load dữ liệu tra cứu VBPL khi vào vbpl.html
    if (window.location.pathname.endsWith('vbpl.html')) {
        fetchDocumentTypes();
        fetchDocuments();
        fetchAuthorities();
        setupYearFilter();
    }
    // Ẩn/hiện nút Thêm biển báo mới trên trang signs.html
    if (window.location.pathname.endsWith('signs.html')) {
        if (!user || user.role !== 'Admin') {
            const btnAddSign = document.getElementById('btn-add-sign');
            if (btnAddSign) {
                btnAddSign.style.display = 'none';
            }
        } else {
            const btnAddSign = document.getElementById('btn-add-sign');
            if (btnAddSign) {
                btnAddSign.style.display = '';
            }
        }
    }
});
// 2. Đảm bảo gọi showUserInfo() khi load ở mọi trang
window.addEventListener('load', showUserInfo);

// Hiển thị danh sách chủ đề (có lọc, phân quyền admin)
async function loadCommunityTopics(filter = 'all') {
    const list = document.getElementById('topic-list');
    if (!list) return;
    list.innerHTML = '<li>Đang tải...</li>';
    try {
        const res = await fetch('http://localhost:4000/api/topics');
        let topics = await res.json();
        allCommunityTopics = topics;
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        // Nếu là admin: luôn hiển thị tất cả bài viết
        if (user && user.role === 'Admin') {
            // Nếu filter là 'hidden', chỉ lấy bài Closed
            if (window.currentTopicFilter === 'hidden') {
                topics = topics.filter(topic => topic.status === 'Closed');
            }
            // Ngược lại, hiển thị tất cả (Open + Closed)
        } else {
            // User thường: chỉ hiển thị bài Open
            topics = topics.filter(topic => topic.status === 'Open');
            // Lọc theo filter như cũ
            if (filter === 'fav') {
                const currentUser = user;
                topics = topics.filter(topic => {
                    const likeKey = currentUser ? `topic_like_${topic.topic_id}_${currentUser.user_id}` : `topic_like_${topic.topic_id}_guest`;
                    return localStorage.getItem(likeKey) === '1';
                });
            } else if (filter === 'my') {
                if (user) topics = topics.filter(topic => topic.user_id === user.user_id);
                else topics = [];
            }
        }
        if (!topics.length) {
            list.innerHTML = '<li>Không có chủ đề nào.</li>';
            return;
        }
        list.innerHTML = '';
        topics.forEach(topic => {
            const li = document.createElement('li');
            const author = topic.User?.full_name || topic.User?.username || 'Ẩn danh';
            const avatar = author.charAt(0).toUpperCase();
            const created = new Date(topic.created_at).toLocaleString();
            const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
            const likeKey = currentUser ? `topic_like_${topic.topic_id}_${currentUser.user_id}` : `topic_like_${topic.topic_id}_guest`;
            const liked = localStorage.getItem(likeKey) === '1';
            let likeCount = parseInt(localStorage.getItem(`topic_like_count_${topic.topic_id}`) || topic.likes_count || 0);
            if (liked && likeCount === 0) likeCount = 1;
            let deleteBtn = '';
            if ((user && topic.user_id === user.user_id) || (user && user.role === 'Admin')) {
                deleteBtn = `<button class=\"topic-action-btn btn-delete\" title=\"Xóa bài viết\" data-topic-id=\"${topic.topic_id}\">🗑️</button>`;
            }
            let adminActionBtn = '';
            if (user && user.role === 'Admin') {
                if (topic.status === 'Open') {
                    adminActionBtn = `<button class=\"topic-action-btn btn-hide\" data-topic-id=\"${topic.topic_id}\">Ẩn</button>`;
                } else {
                    adminActionBtn = `<button class=\"topic-action-btn btn-restore\" data-topic-id=\"${topic.topic_id}\">Khôi phục</button>`;
                }
            }
            li.innerHTML = `
                <div class=\"community-topic-card\" data-topic-id=\"${topic.topic_id}\" style=\"position:relative;\">
                    ${adminActionBtn ? `<div class=\"admin-action-btn-wrapper\" style=\"position:absolute;top:12px;right:12px;z-index:2;\">${adminActionBtn}</div>` : ''}
                    <div class=\"topic-card-header\">
                        <div class=\"topic-avatar avatar-muted\">${avatar}</div>
                        <div class=\"topic-meta\">
                            <div class=\"topic-author author-muted\">${author}</div>
                            <div class=\"topic-date\">${created}</div>
                        </div>
                    </div>
                    <div class=\"topic-card-title\">${topic.title}</div>
                    <div class=\"topic-card-content\">${topic.content.length > 120 ? topic.content.slice(0, 120) + '...' : topic.content}</div>
                    <div class=\"topic-actions\">
                        <button class=\"topic-action-btn btn-like${liked ? ' liked' : ''}\" title=\"Thích\" data-topic-id=\"${topic.topic_id}\"> <span class=\"heart-icon\">${liked ? '💗' : '🤍'}</span> <span class=\"like-count\">${likeCount}</span></button>
                        <button class=\"topic-action-btn btn-comment\" title=\"Bình luận\" data-topic-id=\"${topic.topic_id}\"><span class=\"icon\">💬</span> <span class=\"comment-label\">Bình luận</span></button>
                        ${deleteBtn}
                    </div>
                    <div class=\"topic-detail-inline\" id=\"topic-detail-inline-${topic.topic_id}\" style=\"display:none\"></div>
                </div>
            `;
            list.appendChild(li);
        });
        // Gán sự kiện cho các nút Ẩn/Khôi phục (admin)
        list.querySelectorAll('.btn-hide').forEach(btn => {
            btn.onclick = async function() {
                const topicId = btn.getAttribute('data-topic-id');
                const token = localStorage.getItem('token');
                await fetch(`http://localhost:4000/api/topics/${topicId}/close`, { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token } });
                loadCommunityTopics(window.currentTopicFilter || 'all');
            }
        });
        list.querySelectorAll('.btn-restore').forEach(btn => {
            btn.onclick = async function() {
                const topicId = btn.getAttribute('data-topic-id');
                const token = localStorage.getItem('token');
                await fetch(`http://localhost:4000/api/topics/${topicId}/open`, { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token } });
                loadCommunityTopics(window.currentTopicFilter || 'all');
            }
        });
        // Like chủ đề: mỗi user có like riêng, cập nhật số lượt thích thực tế
        list.querySelectorAll('.btn-like').forEach(btn => {
            btn.onclick = function() {
                const topicId = btn.getAttribute('data-topic-id');
                const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
                const likeKey = currentUser ? `topic_like_${topicId}_${currentUser.user_id}` : `topic_like_${topicId}_guest`;
                let likeCountSpan = btn.querySelector('.like-count');
                let likeCount = parseInt(likeCountSpan.textContent) || 0;
                const liked = localStorage.getItem(likeKey) === '1';
                if (liked) {
                    localStorage.setItem(likeKey, '0');
                    btn.classList.remove('liked');
                    btn.querySelector('.heart-icon').textContent = '🤍';
                    likeCount = Math.max(0, likeCount - 1);
                } else {
                    localStorage.setItem(likeKey, '1');
                    btn.classList.add('liked');
                    btn.querySelector('.heart-icon').textContent = '💗';
                    likeCount = likeCount + 1;
                }
                likeCountSpan.textContent = likeCount;
                localStorage.setItem(`topic_like_count_${topicId}`, likeCount);
            };
        });
        list.querySelectorAll('.btn-comment').forEach(btn => {
            btn.onclick = async function() {
                const topicId = btn.getAttribute('data-topic-id');
                const detailDiv = document.getElementById('topic-detail-inline-' + topicId);
                // Toggle mở/đóng
                if (detailDiv.style.display === 'block') {
                    detailDiv.style.display = 'none';
                } else {
                    // Ẩn mọi topic-detail-inline khác
                    document.querySelectorAll('.topic-detail-inline').forEach(div => div.style.display = 'none');
                    detailDiv.style.display = 'block';
                    await showTopicDetailInline(topicId, detailDiv);
                }
            };
        });
        list.querySelectorAll('.btn-delete').forEach(btn => {
            btn.onclick = async function() {
                const topicId = btn.getAttribute('data-topic-id');
                if (!confirm('Bạn có chắc chắn muốn xóa bài viết này?')) return;
                try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`http://localhost:4000/api/topics/${topicId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const data = await res.json();
                    if (!res.ok) return alert(data.message || 'Lỗi xóa bài viết');
                    loadCommunityTopics(window.currentTopicFilter || 'all');
                } catch (err) {
                    alert('Lỗi kết nối server');
                }
            }
        });
    } catch (e) {
        list.innerHTML = '<li>Lỗi tải chủ đề.</li>';
    }
}
window.loadCommunityTopics = loadCommunityTopics;
window.currentTopicFilter = 'all';

// Hàm dựng cây bình luận đa cấp
function buildCommentTree(comments) {
    const map = {};
    const roots = [];
    comments.forEach(c => {
        c.children = [];
        map[c.comment_id] = c;
    });
    comments.forEach(c => {
        if (c.parent_comment_id) {
            if (map[c.parent_comment_id]) map[c.parent_comment_id].children.push(c);
        } else {
            roots.push(c);
        }
    });
    return roots;
}

// Hàm render cây bình luận đa cấp (không giới hạn cấp lồng)
function renderCommentTree(comments, topicId, user, level = 0, parentVisible = true) {
    let html = '';
    comments.forEach(c => {
        const author = c.User?.full_name || c.User?.username || 'Ẩn danh';
        const avatar = author.charAt(0).toUpperCase();
        const created = new Date(c.created_at).toLocaleString();
        const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
        const likeKey = currentUser ? `comment_like_${c.comment_id}_${currentUser.user_id}` : `comment_like_${c.comment_id}_guest`;
        const liked = localStorage.getItem(likeKey) === '1';
        let likeCount = parseInt(localStorage.getItem(`comment_like_count_${c.comment_id}`) || c.likes_count || 0);
        if (liked && likeCount === 0) likeCount = 1;
        let deleteBtn = '';
        if (user && (c.user_id === user.user_id || user.role === 'Admin')) {
            deleteBtn = `<button class="reply-action-btn btn-delete" title="Xóa bình luận" data-comment-id="${c.comment_id}">🗑️</button>`;
        }
        html += `<li class='reply-item${level>0?' reply-child':''}' style='margin-left:${level*28}px;'>
            <div class='reply-avatar'>${avatar}</div>
            <div class='reply-body'>
                <div class='reply-author'>${author}</div>
                <div class='reply-meta'>${created}</div>
                <div class='reply-content'>${c.content}</div>
                <div class='reply-actions'>
                    <button class="reply-action-btn btn-like${liked ? ' liked' : ''}" data-comment-id="${c.comment_id}"><span class="heart-icon">${liked ? '💗' : '🤍'}</span> <span class='like-count'>${likeCount}</span></button>
                    ${level === 0 ? `<button class="reply-action-btn btn-reply" data-comment-id="${c.comment_id}">Trả lời</button>` : ''}
                    ${deleteBtn}
                </div>
                <div class='reply-form-inline' id='reply-form-inline-${c.comment_id}' style='display:none'></div>
            </div>
        </li>`;
        if (c.children && c.children.length) {
            html += `<ul class='reply-children' id='reply-children-${c.comment_id}' style='display:none'></ul>`;
        }
    });
    return html;
}

// Hàm gán lại sự kiện cho các nút tym và xóa trong vùng reply-children
function bindReplyChildEvents(container) {
    container.querySelectorAll('.btn-like').forEach(btn => {
        btn.onclick = async function() {
            const commentId = btn.getAttribute('data-comment-id');
            const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
            const likeKey = currentUser ? `comment_like_${commentId}_${currentUser.user_id}` : `comment_like_${commentId}_guest`;
            let likeCountSpan = btn.querySelector('.like-count');
            let likeCount = parseInt(likeCountSpan.textContent) || 0;
            const liked = localStorage.getItem(likeKey) === '1';
            if (liked) {
                localStorage.setItem(likeKey, '0');
                btn.classList.remove('liked');
                btn.querySelector('.heart-icon').textContent = '🤍';
                likeCount = Math.max(0, likeCount - 1);
            } else {
                localStorage.setItem(likeKey, '1');
                btn.classList.add('liked');
                btn.querySelector('.heart-icon').textContent = '💗';
                likeCount = likeCount + 1;
            }
            likeCountSpan.textContent = likeCount;
            localStorage.setItem(`comment_like_count_${commentId}`, likeCount);
        }
    });
    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = async function() {
            const commentId = btn.getAttribute('data-comment-id');
            if (!confirm('Bạn có chắc chắn muốn xóa bình luận này?')) return;
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`http://localhost:4000/api/comments/${commentId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                if (!res.ok) return alert(data.message || 'Lỗi xóa bình luận');
                // Reload lại toàn bộ chủ đề
                const topicId = window.currentTopicId;
                const container = document.getElementById('topic-detail-inline-' + topicId) || document.getElementById('topic-detail');
                if (topicId && container) showTopicDetailInline(topicId, container);
            } catch (err) {
                alert('Lỗi kết nối server');
            }
        }
    });
}

// Hiển thị chi tiết chủ đề và bình luận đa cấp (inline)
async function showTopicDetailInline(topicId, container) {
    container.innerHTML = 'Đang tải...';
    try {
        const res = await fetch(`http://localhost:4000/api/topics/${topicId}`);
        const topic = await res.json();
        if (!topic) {
            container.innerHTML = 'Không tìm thấy chủ đề.';
            return;
        }
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        // Xây cây bình luận
        const commentTree = buildCommentTree(topic.Comments || []);
        let html = `<div class='community-thread topic-detail-inline'>`;
        html += `<div class='replies-title'>Bình luận</div>`;
        html += `<ul class='reply-list'>`;
        html += renderCommentTree(commentTree, topicId, user);
        html += `</ul>`;
        // Form bình luận gốc
        html += `<form id="comment-form-inline-${topicId}" class="comment-form">
            <textarea id="comment-content-inline-${topicId}" placeholder="Nhập bình luận..." required></textarea>
            <button type="submit">Gửi bình luận</button>
        </form>`;
        html += `</div>`;
        container.innerHTML = html;
        // Gán sự kiện submit bình luận gốc
        const commentForm = document.getElementById(`comment-form-inline-${topicId}`);
        if (commentForm) {
            commentForm.onsubmit = async function(e) {
                e.preventDefault();
                const content = document.getElementById(`comment-content-inline-${topicId}`).value.trim();
                const token = localStorage.getItem('token');
                if (!token) return alert('Bạn cần đăng nhập để bình luận!');
                try {
                    const res = await fetch(`http://localhost:4000/api/comments/${topicId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({ content })
                    });
                    const data = await res.json();
                    if (!res.ok) return alert(data.message || 'Lỗi gửi bình luận');
                    showTopicDetailInline(topicId, container); // reload lại chi tiết
                } catch (err) {
                    alert('Lỗi kết nối server');
                }
            }
        }
        // Gán sự kiện reply, like, xóa cho từng bình luận
        container.querySelectorAll('.btn-reply').forEach(btn => {
            btn.onclick = function() {
                const commentId = btn.getAttribute('data-comment-id');
                const formDiv = document.getElementById('reply-form-inline-' + commentId);
                const childrenUl = document.getElementById('reply-children-' + commentId);
                if (formDiv.style.display === 'block') {
                    formDiv.style.display = 'none';
                    formDiv.innerHTML = '';
                    if (childrenUl) childrenUl.style.display = 'none';
                } else {
                    // Ẩn các reply form khác
                    container.querySelectorAll('.reply-form-inline').forEach(div => { div.style.display = 'none'; div.innerHTML = ''; });
                    container.querySelectorAll('.reply-children').forEach(ul => ul.style.display = 'none');
                    formDiv.style.display = 'block';
                    formDiv.innerHTML = `<form class='comment-form' id='reply-form-${commentId}'>
                        <textarea id='reply-content-${commentId}' placeholder='Nhập trả lời...' required></textarea>
                        <button type='submit'>Gửi trả lời</button>
                    </form>`;
                    if (childrenUl) {
                        // Luôn render lại bình luận con khi mở
                        const comment = (topic.Comments || []).find(x => x.comment_id == commentId);
                        if (comment && comment.children) {
                            childrenUl.innerHTML = renderCommentTree(comment.children, topicId, user, (parseInt(formDiv.parentElement.parentElement.style.marginLeft)||0)/28+1, true);
                        }
                        bindReplyChildEvents(childrenUl);
                        childrenUl.style.display = 'block';
                    }
                    const replyForm = document.getElementById('reply-form-' + commentId);
                    if (replyForm) {
                        replyForm.onsubmit = async function(e) {
                            e.preventDefault();
                            const content = document.getElementById('reply-content-' + commentId).value.trim();
                            const token = localStorage.getItem('token');
                            if (!token) return alert('Bạn cần đăng nhập để trả lời!');
                            try {
                                const res = await fetch(`http://localhost:4000/api/comments/${topicId}`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': 'Bearer ' + token
                                    },
                                    body: JSON.stringify({ content, parent_comment_id: commentId })
                                });
                                const data = await res.json();
                                if (!res.ok) return alert(data.message || 'Lỗi gửi trả lời');
                                showTopicDetailInline(topicId, container);
                            } catch (err) {
                                alert('Lỗi kết nối server');
                            }
                        }
                    }
                }
            }
        });
        container.querySelectorAll('.btn-like').forEach(btn => {
            btn.onclick = async function() {
                const commentId = btn.getAttribute('data-comment-id');
                const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
                const likeKey = currentUser ? `comment_like_${commentId}_${currentUser.user_id}` : `comment_like_${commentId}_guest`;
                let likeCountSpan = btn.querySelector('.like-count');
                let likeCount = parseInt(likeCountSpan.textContent) || 0;
                const liked = localStorage.getItem(likeKey) === '1';
                if (liked) {
                    localStorage.setItem(likeKey, '0');
                    btn.classList.remove('liked');
                    btn.querySelector('.heart-icon').textContent = '🤍';
                    likeCount = Math.max(0, likeCount - 1);
                } else {
                    localStorage.setItem(likeKey, '1');
                    btn.classList.add('liked');
                    btn.querySelector('.heart-icon').textContent = '💗';
                    likeCount = likeCount + 1;
                }
                likeCountSpan.textContent = likeCount;
                localStorage.setItem(`comment_like_count_${commentId}`, likeCount);
            }
        });
        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.onclick = async function() {
                const commentId = btn.getAttribute('data-comment-id');
                if (!confirm('Bạn có chắc chắn muốn xóa bình luận này?')) return;
                try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`http://localhost:4000/api/comments/${commentId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const data = await res.json();
                    if (!res.ok) return alert(data.message || 'Lỗi xóa bình luận');
                    showTopicDetailInline(topicId, container);
                } catch (err) {
                    alert('Lỗi kết nối server');
                }
            }
        });
    } catch (e) {
        container.innerHTML = 'Lỗi tải chi tiết chủ đề.';
    }
}

// Hiển thị modal tạo chủ đề
function showCreateTopicModal() {
    document.getElementById('create-topic-modal').style.display = 'block';
}
function closeCreateTopicModal() {
    document.getElementById('create-topic-modal').style.display = 'none';
}
window.showCreateTopicModal = showCreateTopicModal;

// ====== HỖ TRỢ FILL SELECT LOẠI VĂN BẢN, CƠ QUAN BAN HÀNH CHO MODAL ======
async function fillAddEditSelects() {
    // Loại văn bản
    const typeSelects = [document.getElementById('add-type'), document.getElementById('edit-type')];
    const typeRes = await fetch('http://localhost:4000/api/document-types');
    const types = await typeRes.json();
    typeSelects.forEach(select => {
        if (!select) return;
        select.innerHTML = '<option value="">Chọn loại</option>';
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type.type_id;
            option.textContent = type.type_name;
            select.appendChild(option);
        });
    });
    // Cơ quan ban hành
    const authoritySelects = [document.getElementById('add-authority'), document.getElementById('edit-authority')];
    const authRes = await fetch('http://localhost:4000/api/legal-documents/authorities');
    const authorities = await authRes.json();
    authoritySelects.forEach(select => {
        if (!select) return;
        select.innerHTML = '<option value="">Chọn cơ quan</option>';
        authorities.forEach(auth => {
            const option = document.createElement('option');
            option.value = auth;
            option.textContent = auth;
            select.appendChild(option);
        });
    });
}

// === TỰ ĐỘNG GHI CONTENT SAU KHI UPLOAD FILE PDF Ở MODAL THÊM MỚI ===
const addFileInput = document.getElementById('add-file');
if (addFileInput) {
    addFileInput.addEventListener('change', async function() {
        // Lưu doc_id tạm vào biến toàn cục sau khi thêm mới thành công
        window._lastAddedDocId = null;
    });
}

if (typeof showAddVBPLModal !== 'function') {
    window.showAddVBPLModal = function() {
        fillAddEditSelects();
        document.getElementById('add-vbpl-modal').style.display = 'block';
    };
}
if (typeof showEditVBPLModal !== 'function') {
    window.showEditVBPLModal = async function(id) {
        await fillAddEditSelects();
        try {
            const res = await fetch(`http://localhost:4000/api/legal-documents/${id}`);
            if (!res.ok) throw new Error('Không lấy được thông tin văn bản!');
            const doc = await res.json();
            document.getElementById('edit-doc-id').value = doc.doc_id;
            document.getElementById('edit-title').value = doc.title || '';
            document.getElementById('edit-number').value = doc.document_number || '';
            document.getElementById('edit-issuance').value = doc.issuance_date ? doc.issuance_date.slice(0,10) : '';
            document.getElementById('edit-effective').value = doc.effective_date ? doc.effective_date.slice(0,10) : '';
            document.getElementById('edit-authority').value = doc.issuing_authority || '';
            document.getElementById('edit-type').value = doc.type_id || '';
            document.getElementById('edit-summary').value = doc.summary || '';
            // Lưu lại giá trị cũ
            window.currentEditVBPL = {
                file_path: doc.file_path || '',
                file_path_local: doc.file_path_local || '',
                content: doc.content || ''
            };
            // Hiển thị link tải về nếu có
            if (doc.file_path_local) {
                document.getElementById('edit-download-link').value = '';
                document.getElementById('edit-file').setAttribute('data-existing', doc.file_path_local);
            } else if (doc.file_path) {
                document.getElementById('edit-download-link').value = doc.file_path;
                document.getElementById('edit-file').removeAttribute('data-existing');
            } else {
                document.getElementById('edit-download-link').value = '';
                document.getElementById('edit-file').removeAttribute('data-existing');
            }
            document.getElementById('edit-vbpl-modal').style.display = 'block';
        } catch (e) {
            alert('Không lấy được thông tin văn bản!');
        }
    };
}
if (typeof deleteVBPL !== 'function') {
    window.deleteVBPL = async function(id) {
        if (!confirm('Bạn có chắc chắn muốn xóa văn bản này không?')) return;
        try {
            const res = await fetch(`http://localhost:4000/api/legal-documents/${id}`, { method: 'DELETE' });
                    const data = await res.json();
            if (!res.ok) return alert(data.message || 'Lỗi xóa văn bản');
            fetchDocuments();
            alert('Đã xóa thành công!');
        } catch (e) {
                    alert('Lỗi kết nối server');
                }
    };
}
// Đóng modal thêm/sửa
const closeAddVBPLModal = document.getElementById('close-add-vbpl-modal');
if (closeAddVBPLModal) closeAddVBPLModal.onclick = function() {
    document.getElementById('add-vbpl-modal').style.display = 'none';
};
const closeEditVBPLModal = document.getElementById('close-edit-vbpl-modal');
if (closeEditVBPLModal) closeEditVBPLModal.onclick = function() {
    document.getElementById('edit-vbpl-modal').style.display = 'none';
};

// === TỰ ĐỘNG GHI CONTENT SAU KHI UPLOAD FILE PDF Ở MODAL SỬA ===
const editFileInput = document.getElementById('edit-file');
if (editFileInput) {
    editFileInput.addEventListener('change', async function() {
        if (editFileInput.files && editFileInput.files[0]) {
            // 1. Upload file lên server
            const formData = new FormData();
            formData.append('file', editFileInput.files[0]);
            const res = await fetch('http://localhost:4000/api/upload/file', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.file_path_local) {
                // 2. Trích xuất nội dung PDF
                const content = await extractPdfText(editFileInput.files[0]);
                // 3. Gửi request cập nhật content cho văn bản
                const doc_id = document.getElementById('edit-doc-id').value;
                await fetch(`http://localhost:4000/api/legal-documents/${doc_id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ file_path_local: data.file_path_local, content })
                });
                alert('Đã cập nhật nội dung file PDF!');
            }
        }
    });
}

// ====== HỒ SƠ CÁ NHÂN & QUẢN LÝ USER ======
const profileIcon = document.getElementById('profile-icon');
const profilePopup = document.getElementById('profile-popup');
const btnEditProfile = document.getElementById('btn-edit-profile');
const btnLogout = document.getElementById('btn-logout');
const btnManageUsers = document.getElementById('btn-manage-users');
const editProfileModal = document.getElementById('edit-profile-modal');
const closeEditProfileModal = document.getElementById('close-edit-profile-modal');
const editProfileForm = document.getElementById('edit-profile-form');
const manageUsersModal = document.getElementById('manage-users-modal');
const closeManageUsersModal = document.getElementById('close-manage-users-modal');
const usersTableBody = document.querySelector('#users-table tbody');

// Hiển thị tên user sau khi đăng nhập
function showUserInfo() {
    const user = localStorage.getItem('user');
    const btn = document.getElementById('btn-login-header');
    const profileIcon = document.getElementById('profile-icon');
    const profileUsername = document.getElementById('profile-username');
    if (user && btn && profileIcon && profileUsername) {
        const u = JSON.parse(user);
        btn.style.display = 'none';
        profileIcon.style.display = 'flex';
        profileUsername.style.display = 'block';
        profileUsername.textContent = u.full_name || u.username;
        profileUsername.style.position = 'fixed';
        profileUsername.style.top = '62px';
        profileUsername.style.right = '32px';
        profileUsername.style.width = '100px';
        profileUsername.style.textAlign = 'center';
        profileUsername.style.zIndex = '10001';
    profileIcon.onclick = function(e) {
        e.stopPropagation();
        profilePopup.style.display = (profilePopup.style.display === 'block') ? 'none' : 'block';
            if (u.role === 'Admin') btnManageUsers.style.display = '';
            else btnManageUsers.style.display = 'none';
        };
    } else if (btn && profileIcon && profileUsername) {
        btn.style.display = '';
        profileIcon.style.display = 'none';
        profileUsername.style.display = 'none';
    }
}

// Hiển thị modal đăng nhập và đăng ký
function showLoginModal() {
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    if (loginModal) loginModal.style.display = 'block';
    if (registerModal) registerModal.style.display = 'none';
}
function showRegisterModal() {
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    if (registerModal) registerModal.style.display = 'block';
    if (loginModal) loginModal.style.display = 'none';
}
const btnLoginHeader = document.getElementById('btn-login-header');
if (btnLoginHeader) btnLoginHeader.onclick = showLoginModal;
const showRegisterBtn = document.getElementById('show-register');
if (showRegisterBtn) showRegisterBtn.onclick = function(e) { e.preventDefault(); showRegisterModal(); };
const showLoginBtn = document.getElementById('show-login');
if (showLoginBtn) showLoginBtn.onclick = function(e) { e.preventDefault(); showLoginModal(); };
const closeLoginModalBtn = document.getElementById('close-login-modal');
if (closeLoginModalBtn) closeLoginModalBtn.onclick = function() {
    const loginModal = document.getElementById('login-modal');
    if (loginModal) loginModal.style.display = 'none';
};
const closeRegisterModalBtn = document.getElementById('close-register-modal');
if (closeRegisterModalBtn) closeRegisterModalBtn.onclick = function() {
    const registerModal = document.getElementById('register-modal');
    if (registerModal) registerModal.style.display = 'none';
};

// Sửa thông tin cá nhân
if (btnEditProfile) btnEditProfile.onclick = function() {
    profilePopup.style.display = 'none';
    // Fill form
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user) {
        document.getElementById('edit-fullname').value = user.full_name || '';
        document.getElementById('edit-email').value = user.email || '';
        document.getElementById('edit-password').value = '';
    }
    editProfileModal.style.display = 'block';
};
if (closeEditProfileModal) closeEditProfileModal.onclick = function() {
    editProfileModal.style.display = 'none';
};
if (editProfileForm) editProfileForm.onsubmit = async function(e) {
    e.preventDefault();
    const full_name = document.getElementById('edit-fullname').value.trim();
    const email = document.getElementById('edit-email').value.trim();
    const password = document.getElementById('edit-password').value;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch('http://localhost:4000/api/users/me', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ full_name, email, password: password || undefined })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.message || 'Lỗi cập nhật thông tin');
        alert('Cập nhật thành công!');
        localStorage.setItem('user', JSON.stringify(data.user));
        editProfileModal.style.display = 'none';
        showUserInfo();
    } catch (err) {
        alert('Lỗi kết nối server');
    }
};
// Đăng xuất
if (btnLogout) btnLogout.onclick = function() {
    if (confirm('Đăng xuất?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        showUserInfo();
        location.reload();
    }
};
// Quản lý user (admin)
if (btnManageUsers) btnManageUsers.onclick = async function() {
    profilePopup.style.display = 'none';
    manageUsersModal.style.display = 'block';
    await loadUsersTable();
};
if (closeManageUsersModal) closeManageUsersModal.onclick = function() {
    manageUsersModal.style.display = 'none';
};
async function loadUsersTable() {
    usersTableBody.innerHTML = '<tr><td colspan="7">Đang tải...</td></tr>';
    const token = localStorage.getItem('token');
    try {
        const res = await fetch('http://localhost:4000/api/users', { headers: { 'Authorization': 'Bearer ' + token } });
        const users = await res.json();
        usersTableBody.innerHTML = '';
        users.forEach(u => {
            let actionBtns = '';
            if (u.role !== 'Admin') {
                if (u.status === 'Active') {
                    actionBtns += `<button onclick="updateUserStatus(${u.user_id},'Inactive')">Hủy kích hoạt</button>`;
                    actionBtns += `<button onclick="updateUserStatus(${u.user_id},'Banned')">Cấm đăng bài</button>`;
                } else if (u.status === 'Inactive') {
                    actionBtns += `<button onclick="updateUserStatus(${u.user_id},'Active')">Kích hoạt</button>`;
                } else if (u.status === 'Banned') {
                    actionBtns += `<button onclick="updateUserStatus(${u.user_id},'Active')">Bỏ cấm</button>`;
                }
            }
            usersTableBody.innerHTML += `<tr>
                <td>${u.user_id}</td>
                <td>${u.username}</td>
                <td>${u.email}</td>
                <td>${u.full_name || ''}</td>
                <td>${u.role}</td>
                <td>${u.status}</td>
                <td>${actionBtns}</td>
            </tr>`;
        });
    } catch (err) {
        usersTableBody.innerHTML = '<tr><td colspan="7">Lỗi tải danh sách user</td></tr>';
    }
}
window.updateUserStatus = async function(userId, status) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`http://localhost:4000/api/users/${userId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.message || 'Lỗi cập nhật trạng thái');
        await loadUsersTable();
    } catch (err) {
        alert('Lỗi kết nối server');
    }
};

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.onsubmit = async function(e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        try {
            const res = await fetch('http://localhost:4000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) return alert(data.message || 'Đăng nhập thất bại');
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            document.getElementById('login-modal').style.display = 'none';
            setTimeout(showUserInfo, 0);
        } catch (err) {
            alert('Lỗi kết nối server');
        }
    };
}

// Hàm đọc text từ file PDF (dùng pdfjs-dist)
async function extractPdfText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const pdfjsLib = window['pdfjs-dist/build/pdf'];
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                const typedarray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
                let text = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map(item => item.str).join(' ') + '\n';
                }
                resolve(text);
            } catch (err) {
                resolve('');
            }
        };
        reader.onerror = function() { resolve(''); };
        reader.readAsArrayBuffer(file);
    });
}

// ====== XỬ LÝ SUBMIT FORM THÊM MỚI VBPL ======
const addVBPLForm = document.getElementById('add-vbpl-form');
if (addVBPLForm) addVBPLForm.onsubmit = async function(e) {
    e.preventDefault();
    const title = document.getElementById('add-title').value.trim();
    const document_number = document.getElementById('add-number').value.trim();
    const issuance_date = document.getElementById('add-issuance').value;
    const effective_date = document.getElementById('add-effective').value;
    const issuing_authority = document.getElementById('add-authority').value;
    const type_id = document.getElementById('add-type').value;
    const summary = document.getElementById('add-summary').value.trim();
    const fileInput = document.getElementById('add-file');
    const downloadLink = document.getElementById('add-download-link').value.trim();
    let file_path = '';
    let file_path_local = '';
    let content = '';
    let body = { title, document_number, issuance_date, effective_date, issuing_authority, type_id, summary };
    // Nếu có file PDF thì upload trước, lấy text content
    if (fileInput && fileInput.files && fileInput.files[0]) {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        const res = await fetch('http://localhost:4000/api/upload/file', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.file_path_local) file_path_local = data.file_path_local;
        content = await extractPdfText(fileInput.files[0]);
        body.file_path_local = file_path_local;
        body.content = content;
    }
    if (downloadLink) {
        file_path = downloadLink;
        body.file_path = file_path;
    }
    try {
        const res = await fetch('http://localhost:4000/api/legal-documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) return alert(data.message || 'Lỗi thêm mới');
        // Lưu doc_id vừa tạo vào biến toàn cục
        window._lastAddedDocId = data.doc_id || (data.data && data.data.doc_id);
        document.getElementById('add-vbpl-modal').style.display = 'none';
        addVBPLForm.reset();
        fetchDocuments();
        alert('Thêm mới thành công!');
        // Sau khi thêm mới, nếu có file PDF thì tự động PATCH lại content
        if (fileInput && fileInput.files && fileInput.files[0] && window._lastAddedDocId) {
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            const uploadRes = await fetch('http://localhost:4000/api/upload/file', { method: 'POST', body: formData });
            const uploadData = await uploadRes.json();
            if (uploadData.file_path_local) {
                const content = await extractPdfText(fileInput.files[0]);
                await fetch(`http://localhost:4000/api/legal-documents/${window._lastAddedDocId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ file_path_local: uploadData.file_path_local, content })
                });
            }
        }
    } catch (e) {
        alert('Lỗi kết nối server');
    }
};

// Gán sự kiện cho nút tìm kiếm và các select lọc VBPL
const searchBtn = document.getElementById('searchBtn');
if (searchBtn) searchBtn.onclick = searchDocuments;

const typeFilter = document.getElementById('typeFilter');
if (typeFilter) typeFilter.onchange = filterByType;

const authorityFilter = document.getElementById('authorityFilter');
if (authorityFilter) authorityFilter.onchange = filterDocuments;

const yearFilter = document.getElementById('yearFilter');
if (yearFilter) yearFilter.onchange = filterDocuments;

// ====== HIỂN THỊ BẢNG XỬ PHẠT NỒNG ĐỘ CỒN ======
function renderAlcoholPenaltyTable() {
    const table = `
    <div style="background:#f3eded;padding:8px 12px;font-weight:bold;border-radius:6px 6px 0 0;">Mức phạt tiền khi vi phạm nồng độ cồn</div>
    <table class="penalty-table" style="width:100%;border-collapse:collapse;background:#fff;">
        <thead>
            <tr style="background:#f3eded;">
                <th style="padding:8px 6px;">Mức vi phạm</th>
                <th style="padding:8px 6px;">Xe ô tô</th>
                <th style="padding:8px 6px;">Xe máy</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="padding:6px 6px;">Chưa vượt quá 50 miligam/100 mililit máu hoặc chưa vượt quá 0,25 miligam/1 lít khí thở</td>
                <td style="color:#b94a48;font-weight:bold;text-align:center;">6.000.000đ - 8.000.000đ</td>
                <td style="color:#b94a48;font-weight:bold;text-align:center;">2.000.000đ - 3.000.000đ</td>
            </tr>
            <tr>
                <td style="padding:6px 6px;">Vượt quá 50 miligam đến 80 miligam/100 mililit máu hoặc vượt quá 0,25 miligam đến 0,4 miligam/1 lít khí thở</td>
                <td style="color:#b94a48;font-weight:bold;text-align:center;">18.000.000đ - 20.000.000đ</td>
                <td style="color:#b94a48;font-weight:bold;text-align:center;">6.000.000đ - 8.000.000đ</td>
            </tr>
            <tr>
                <td style="padding:6px 6px;">Vượt quá 80 miligam/100 mililit máu hoặc vượt quá 0,4 miligam/1 lít khí thở</td>
                <td style="color:#b94a48;font-weight:bold;text-align:center;">30.000.000đ - 40.000.000đ</td>
                <td style="color:#b94a48;font-weight:bold;text-align:center;">8.000.000đ - 10.000.000đ</td>
            </tr>
        </tbody>
    </table>
    <div style="background:#f3eded;padding:8px 12px;font-weight:bold;border-radius:6px 6px 0 0;margin-top:24px;">Hình phạt bổ sung khi vi phạm nồng độ cồn</div>
    <table class="penalty-table" style="width:100%;border-collapse:collapse;background:#fff;">
        <thead>
            <tr style="background:#f3eded;">
                <th style="padding:8px 6px;">Mức vi phạm</th>
                <th style="padding:8px 6px;">Hình phạt bổ sung</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="padding:6px 6px;">Chưa vượt quá 50 miligam/100 mililit máu hoặc chưa vượt quá 0,25 miligam/1 lít khí thở</td>
                <td style="color:#b94a48;font-weight:bold;text-align:center;">Trừ 04 điểm GPLX</td>
            </tr>
            <tr>
                <td style="padding:6px 6px;">Vượt quá 50 miligam đến 80 miligam/100 mililit máu hoặc vượt quá 0,25 miligam đến 0,4 miligam/1 lít khí thở</td>
                <td style="color:#b94a48;font-weight:bold;text-align:center;">Trừ 10 điểm GPLX</td>
            </tr>
            <tr>
                <td style="padding:6px 6px;">Vượt quá 80 miligam/100 mililit máu hoặc vượt quá 0,4 miligam/1 lít khí thở</td>
                <td style="color:#b94a48;font-weight:bold;text-align:center;">Tước quyền sử dụng GPLX từ 22 đến 24 tháng</td>
            </tr>
        </tbody>
    </table>
    `;
    const penaltyDiv = document.getElementById('alcohol-penalty-table');
    if (penaltyDiv) penaltyDiv.innerHTML = table;
}

// ====== XỬ LÝ FORM TÍNH NỒNG ĐỘ CỒN VÀ TRA CỨU MỨC PHẠT ======
const alcoholForm = document.getElementById('alcohol-form');
if (alcoholForm) alcoholForm.onsubmit = function(e) {
    e.preventDefault();
    const weight = parseFloat(document.getElementById('weight').value);
    const gender = document.getElementById('gender').value;
    const drink = document.getElementById('drink').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const time = parseFloat(document.getElementById('time').value);
    let percent = 0.05;
    if (drink === 'wine') percent = 0.12;
    if (drink === 'vodka') percent = 0.40;
    const A = (amount * percent * 0.79) / 10;
    const R = gender === 'male' ? 0.7 : 0.6;
    let BAC = 1056 * A / (weight * R);
    BAC = Math.max(0, BAC - 15 * time);
    const BrAC = BAC / 210;
    const T = BAC / 15;
    // Tra cứu mức phạt
    let fineCar = '', fineBike = '', extraPenalty = '';
    if (BrAC <= 0.25) {
        fineCar = '6.000.000đ - 8.000.000đ';
        fineBike = '2.000.000đ - 3.000.000đ';
        extraPenalty = 'Trừ 04 điểm GPLX';
    } else if (BrAC <= 0.4) {
        fineCar = '18.000.000đ - 20.000.000đ';
        fineBike = '6.000.000đ - 8.000.000đ';
        extraPenalty = 'Trừ 10 điểm GPLX';
    } else {
        fineCar = '30.000.000đ - 40.000.000đ';
        fineBike = '8.000.000đ - 10.000.000đ';
        extraPenalty = 'Tước quyền sử dụng GPLX từ 22 đến 24 tháng';
    }
    let result = `<b style='font-size:1.1em;'>KẾT QUẢ ĐO NỒNG ĐỘ CỒN</b><br>`;
    result += `<table style='width:100%;max-width:480px;margin:12px 0;border-collapse:collapse;'>`;
    result += `<tr><td style='padding:6px 8px;'>Nồng độ cồn trong máu</td><td style='color:#b94a48;font-weight:bold;padding:6px 8px;text-align:right;'>${BAC.toFixed(1)} mg/100ml máu</td></tr>`;
    result += `<tr><td style='padding:6px 8px;'>Nồng độ cồn trong khí thở</td><td style='color:#b94a48;font-weight:bold;padding:6px 8px;text-align:right;'>${BrAC.toFixed(3)} mg/lít khí thở</td></tr>`;
    result += `<tr><td style='padding:6px 8px;'>Thời gian hết cồn</td><td style='color:#b94a48;font-weight:bold;padding:6px 8px;text-align:right;'>${T.toFixed(1)} giờ</td></tr>`;
    result += `<tr><td style='padding:6px 8px;'>Phạt tiền đối với ô tô</td><td style='color:#b94a48;font-weight:bold;padding:6px 8px;text-align:right;'>${fineCar}</td></tr>`;
    result += `<tr><td style='padding:6px 8px;'>Phạt tiền đối với xe máy</td><td style='color:#b94a48;font-weight:bold;padding:6px 8px;text-align:right;'>${fineBike}</td></tr>`;
    result += `<tr><td style='padding:6px 8px;'>Hình phạt bổ sung</td><td style='color:#b94a48;font-weight:bold;padding:6px 8px;text-align:right;'>${extraPenalty}</td></tr>`;
    result += `</table>`;
    document.getElementById('alcohol-result').innerHTML = result;
};

// ====== GỌI HIỂN THỊ BẢNG XỬ PHẠT KHI VÀO alcohol.html ======
if (window.location.pathname.endsWith('alcohol.html')) {
    renderAlcoholPenaltyTable();
}

const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.onsubmit = async function(e) {
        e.preventDefault();
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const full_name = document.getElementById('register-fullname').value.trim();
        const password = document.getElementById('register-password').value;
        const password2 = document.getElementById('register-password2').value;

        if (password !== password2) {
            alert('Mật khẩu nhập lại không khớp!');
            return;
        }

        try {
            const res = await fetch('http://localhost:4000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, full_name })
            });
            const data = await res.json();
            if (!res.ok) return alert(data.message || 'Đăng ký thất bại');
            alert('Đăng ký thành công! Bạn có thể đăng nhập.');
            document.getElementById('register-modal').style.display = 'none';
            showLoginModal();
        } catch (err) {
            alert('Lỗi kết nối server');
        }
    };
}

const createTopicForm = document.getElementById('create-topic-form');
if (createTopicForm) {
    createTopicForm.onsubmit = async function(e) {
        e.preventDefault();
        const title = document.getElementById('topic-title').value.trim();
        const content = document.getElementById('topic-content').value.trim();
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Bạn cần đăng nhập để tạo chủ đề!');
            return;
        }
        try {
            const res = await fetch('http://localhost:4000/api/topics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ title, content })
            });
            const data = await res.json();
            if (!res.ok) return alert(data.message || 'Tạo chủ đề thất bại');
            alert('Tạo chủ đề thành công!');
            document.getElementById('create-topic-modal').style.display = 'none';
            loadCommunityTopics(); // reload lại danh sách chủ đề
        } catch (err) {
            alert('Lỗi kết nối server');
        }
    };
}