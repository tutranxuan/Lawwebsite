"""Ontology GraphRAG – nhãn tiếng Việt thống nhất."""

# --- Văn bản luật chuẩn: VanBan → Chuong → Dieu → Khoan → Diem ---
VAN_BAN = "VanBan"
CHUONG = "Chuong"
DIEU = "Dieu"
KHOAN = "Khoan"
DIEM = "Diem"

# --- Quy chuẩn kỹ thuật (QCVN): VanBan → Phan → TieuMuc → YeuCau ---
PHAN = "Phan"
TIEU_MUC = "TieuMuc"
YEU_CAU = "YeuCau"

# --- Xử phạt (NĐ 168) ---
VI_PHAM = "ViPham"
PHUONG_TIEN = "PhuongTien"
HINH_PHAT = "HinhPhat"

STANDARD_LABELS = {VAN_BAN, CHUONG, DIEU, KHOAN, DIEM}
TECHNICAL_LABELS = {VAN_BAN, PHAN, TIEU_MUC, YEU_CAU}
PENALTY_LABELS = {VI_PHAM, PHUONG_TIEN, HINH_PHAT}
ALL_LABELS = STANDARD_LABELS | TECHNICAL_LABELS | PENALTY_LABELS

# --- Quan hệ cấu trúc ---
CO_CHUONG = "CO_CHUONG"
CO_DIEU = "CO_DIEU"
CO_KHOAN = "CO_KHOAN"
CO_DIEM = "CO_DIEM"
CO_PHAN = "CO_PHAN"
CO_TIEU_MUC = "CO_TIEU_MUC"
CO_YEU_CAU = "CO_YEU_CAU"

# --- Tham chiếu xuyên văn bản ---
THAM_CHIEU = "THAM_CHIEU"
HUONG_DAN = "HUONG_DAN"
CAN_CU = "CAN_CU"
THAY_THE = "THAY_THE"

# --- Xử phạt ---
QUY_DINH_TAI = "QUY_DINH_TAI"   # ViPham → Khoan/Diem
AP_DUNG_CHO = "AP_DUNG_CHO"     # ViPham → PhuongTien
CO_HINH_PHAT = "CO_HINH_PHAT"   # ViPham → HinhPhat

STRUCTURAL_RELS = {
    CO_CHUONG, CO_DIEU, CO_KHOAN, CO_DIEM,
    CO_PHAN, CO_TIEU_MUC, CO_YEU_CAU,
}
CROSS_RELS = {THAM_CHIEU, HUONG_DAN, CAN_CU, THAY_THE}
DOMAIN_RELS = {QUY_DINH_TAI, AP_DUNG_CHO, CO_HINH_PHAT}
ALL_RELS = STRUCTURAL_RELS | CROSS_RELS | DOMAIN_RELS

# Alias tương thích seed cũ
GUIDES = HUONG_DAN
BASED_ON = CAN_CU
REFERENCES = THAM_CHIEU
REPLACES = THAY_THE

CONSTRAINTS = [
    f"CREATE CONSTRAINT {lbl.lower()}_id IF NOT EXISTS FOR (n:{lbl}) REQUIRE n.id IS UNIQUE"
    for lbl in ALL_LABELS
]

# Node lá cho FAISS (đơn vị embedding)
VECTOR_LEAF_LABELS = (KHOAN, DIEM, YEU_CAU)

EXPAND_REL_PATTERN = "|".join(sorted(ALL_RELS))

# --- Loại pipeline ---
STANDARD_LAW = "STANDARD_LAW"
TECHNICAL_REGULATION = "TECHNICAL_REGULATION"
PENALTY_DECREE = "PENALTY_DECREE"

PENALTY_FILE_HINTS = ("168_2024", "168/2024")
TECHNICAL_FILE_HINTS = ("qcvn", "quy chuan", "quy chuẩn", "phu luc", "phụ lục")
