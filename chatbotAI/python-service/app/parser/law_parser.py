"""
Phân tích cấu trúc văn bản luật Việt Nam thành cây:
Văn bản -> Chương (tuỳ chọn) -> Mục (tuỳ chọn) -> Điều -> Khoản -> Điểm
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field


@dataclass
class LawNode:
    id: str
    level: str
    number: str
    title: str
    content: str
    children: list["LawNode"] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "level": self.level,
            "number": self.number,
            "title": self.title,
            "content": self.content,
            "children": [c.to_dict() for c in self.children],
        }


PATTERNS = {
    "chuong": re.compile(
        r"^\s*Chương\s+([IVXLCDM\d]+)\s*[\.:\-]?\s*(.*)$",
        re.IGNORECASE | re.MULTILINE,
    ),
    "muc": re.compile(
        r"^\s*Mục\s+(\d+)\s*[\.:\-]?\s*(.*)$",
        re.IGNORECASE | re.MULTILINE,
    ),
    "dieu": re.compile(
        r"(?:^|\s)Điều\s+(\d+[a-zA-Z]?)\s*\.\s*",
        re.IGNORECASE,
    ),
    "khoan": re.compile(
        r"(?:^|\s)(\d{1,2})\.\s+",
        re.MULTILINE,
    ),
    "diem": re.compile(
        r"(?:^|\s)([a-zđ])\)\s+",
        re.IGNORECASE | re.MULTILINE,
    ),
}


def make_id(prefix: str, doc_id: str, *parts: str) -> str:
    slug = "_".join(p for p in parts if p)
    return f"{doc_id}_{prefix}_{slug}"[:120]


def _split_by_pattern(text: str, pattern: re.Pattern) -> list[tuple[str, str, str]]:
    """Tách text theo regex, trả về (number, title, body)."""
    matches = list(pattern.finditer(text))
    if not matches:
        return []
    segments: list[tuple[str, str, str]] = []
    for i, match in enumerate(matches):
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        number = match.group(1).strip()
        body = text[start:end].strip()
        if match.lastindex and match.lastindex >= 2:
            title = (match.group(2) or "").strip()
        else:
            # Lấy dòng đầu / câu đầu làm tiêu đề Điều
            first_line = body.split("\n", 1)[0].strip()
            title = first_line[:200] if first_line else ""
        segments.append((number, title, body))
    return segments


def _parse_khoan_diem(parent_id: str, article_body: str) -> list[LawNode]:
    khoan_segments = _split_by_pattern(article_body, PATTERNS["khoan"])
    if not khoan_segments:
        return []

    nodes: list[LawNode] = []
    for number, title, body in khoan_segments:
        khoan_id = make_id("khoan", parent_id, number)
        content = body or title
        diem_segments = _split_by_pattern(content, PATTERNS["diem"])

        children = []
        if diem_segments:
            for d_num, d_title, d_body in diem_segments:
                diem_id = make_id("diem", khoan_id, d_num)
                children.append(
                    LawNode(
                        id=diem_id,
                        level="diem",
                        number=d_num,
                        title=(d_title or d_body)[:200],
                        content=d_body or d_title,
                    )
                )

        nodes.append(
            LawNode(
                id=khoan_id,
                level="khoan",
                number=number,
                title=(title or content)[:200],
                content=content,
                children=children,
            )
        )
    return nodes


def _trim_garbage_prefix(text: str) -> str:
    """Bỏ rác binary đầu file .doc (OLE) trước khi parse."""
    markers = (
        r"BỘ\s",
        r"CỘNG\s+HÒA",
        r"LUẬT\s",
        r"NGHỊ\s+ĐỊNH",
        r"THÔNG\s+TƯ",
        r"QUYẾT\s+ĐỊNH",
        r"Chương\s+",
        r"Điều\s+\d",
    )
    pattern = re.compile("|".join(markers), re.IGNORECASE)
    m = pattern.search(text)
    if m and m.start() > 0:
        return text[m.start() :]
    return text


def _parse_dieu_list(parent_id: str, doc_id: str, text: str) -> list[LawNode]:
    dieu_nodes: list[LawNode] = []
    dieu_segments = _split_by_pattern(text, PATTERNS["dieu"])
    for dieu_num, dieu_title, dieu_body in dieu_segments:
        dieu_id = make_id("dieu", doc_id, dieu_num)
        khoan_nodes = _parse_khoan_diem(dieu_id, dieu_body or dieu_title)
        content = dieu_body if dieu_body and not khoan_nodes else dieu_title
        dieu_nodes.append(
            LawNode(
                id=dieu_id,
                level="dieu",
                number=dieu_num,
                title=dieu_title[:300],
                content=content,
                children=khoan_nodes,
            )
        )
    return dieu_nodes


def _parse_muc_or_dieu(parent_id: str, doc_id: str, text: str) -> list[LawNode]:
    """Trong một Chương: nếu có 'Mục N' thì lồng Điều dưới Mục, ngược lại trả
    thẳng danh sách Điều."""
    muc_match = PATTERNS["muc"].search(text)
    if not muc_match:
        return _parse_dieu_list(parent_id, doc_id, text)

    nodes: list[LawNode] = []
    # Điều nằm trước "Mục 1" (nếu có) gắn trực tiếp vào Chương.
    preamble = text[: muc_match.start()]
    if preamble.strip():
        nodes.extend(_parse_dieu_list(parent_id, doc_id, preamble))

    for m_num, m_title, m_body in _split_by_pattern(text, PATTERNS["muc"]):
        muc_id = make_id("muc", parent_id, m_num)
        dieu_nodes = _parse_dieu_list(muc_id, doc_id, m_body or m_title)
        nodes.append(
            LawNode(
                id=muc_id,
                level="muc",
                number=m_num,
                title=m_title[:300],
                content=m_title,
                children=dieu_nodes,
            )
        )
    return nodes


def parse_law_text(text: str, doc_id: str, doc_title: str) -> LawNode:
    """Chuyển plain text thành cây: VanBan → Chuong → Mục → Dieu → Khoan → Diem."""
    text = _trim_garbage_prefix(text)
    root = LawNode(
        id=doc_id,
        level="van_ban",
        number="",
        title=doc_title,
        content=text[:500],
    )

    chuong_segments = _split_by_pattern(text, PATTERNS["chuong"])
    if chuong_segments:
        for ch_num, ch_title, ch_body in chuong_segments:
            ch_id = make_id("chuong", doc_id, ch_num)
            child_nodes = _parse_muc_or_dieu(ch_id, doc_id, ch_body or ch_title)
            root.children.append(
                LawNode(
                    id=ch_id,
                    level="chuong",
                    number=ch_num,
                    title=ch_title[:300],
                    content=ch_title,
                    children=child_nodes,
                )
            )
        if root.children:
            return root

    # Không có Chương: vẫn hỗ trợ 'Mục' ở cấp cao nhất nếu có.
    nodes = _parse_muc_or_dieu(doc_id, doc_id, text)
    if not nodes:
        root.content = text[:2000]
        return root
    root.children.extend(nodes)
    return root


def flatten_for_index(root: LawNode) -> list[dict]:
    """Làm phẳng cây để nạp Neo4j và vector store."""
    rows: list[dict] = []

    def walk(node: LawNode, parent_id: str | None, doc_id: str, path: list[str]):
        current_path = path + [f"{node.level}:{node.number or node.title[:30]}"]
        text_parts = [node.title, node.content]
        for child in node.children:
            text_parts.append(child.content)
        full_text = "\n".join(p for p in text_parts if p).strip()

        rows.append(
            {
                "id": node.id,
                "level": node.level,
                "number": node.number,
                "title": node.title,
                "content": node.content,
                "full_text": full_text,
                "parent_id": parent_id,
                "doc_id": doc_id,
                "path": " > ".join(current_path),
            }
        )
        for child in node.children:
            walk(child, node.id, doc_id, current_path)

    walk(root, None, root.id, [])
    return rows


def new_doc_id() -> str:
    return f"vb_{uuid.uuid4().hex[:12]}"
