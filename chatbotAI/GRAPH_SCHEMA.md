# Graph Schema – 2 Pipeline ETL

## Pipeline 1: STANDARD_LAW (Regex)

```
VanBan ──CO_CHUONG──► Chuong ──CO_DIEU──► Dieu ──CO_KHOAN──► Khoan ──CO_DIEM──► Diem
```

- Luật, Nghị định, Thông tư thông thường
- Regex: `Điều \d+`, `1.`, `a)`

## Pipeline 2: TECHNICAL_REGULATION (QCVN / Phụ lục)

```
VanBan ──CO_PHAN──► Phan ──CO_TIEU_MUC──► TieuMuc ──CO_YEU_CAU──► YeuCau
```

- QCVN, bảng biểu số `1.`, `1.1.`, `2.1.5.`, `2.1.5.1.`

## Pipeline 3: PENALTY_DECREE (NĐ 168)

- Pipeline 1 + node `ViPham`, `PhuongTien`, `HinhPhat`
- `ViPham ──QUY_DINH_TAI──► Khoan`
- `ViPham ──AP_DUNG_CHO──► PhuongTien`
- `ViPham ──CO_HINH_PHAT──► HinhPhat`

## FAISS – metadata thống nhất (cả 2 hướng)

```json
{
  "source_file": "158_2024_ND-CP.doc",
  "doc_id": "158_2024_nd_cp",
  "document_number": "158/2024/NĐ-CP",
  "reference_path": "Chương II > Điều 15 > Khoản 1",
  "text_content": "...",
  "node_type": "khoan",
  "pipeline": "STANDARD_LAW"
}
```

Node lá được embed: `Khoan`, `Diem`, `YeuCau`.

## Quan hệ văn bản

- `(VanBan)-[:HUONG_DAN]->(VanBan)` — NĐ/TT hướng dẫn Luật
- `(VanBan)-[:CAN_CU]->(VanBan)`
- `(Khoan)-[:THAM_CHIEU]->(Dieu)`

## Cypher

```cypher
MATCH (v:VanBan)-[:CO_DIEU]->(d:Dieu)-[:CO_KHOAN]->(k:Khoan)
RETURN v.document_number, d.number, k.number LIMIT 25
```

```cypher
MATCH (v:VanBan)-[:CO_PHAN]->(p:Phan)-[:CO_TIEU_MUC*0..2]->(y:YeuCau)
RETURN v.title, y.reference_path, y.text LIMIT 20
```

```cypher
MATCH (vp:ViPham)-[:AP_DUNG_CHO]->(pt:PhuongTien)
RETURN vp.description, pt.type, vp.fine_min, vp.fine_max LIMIT 15
```
