#!/usr/bin/env python3
"""strip_html.py — детермінований HTML-стрип для tm-case-fetcher.

Тіла API (request/response) НЕ проходять через цей скрипт — вони копіюються
дослівно (DESIGN.md крок 1а). Стрип застосовується лише до описових полів
ТМ (`description`, `reproduceSteps`), які приходять як HTML.

Детермінований (без моделі): прибирає теги, розгортає entity, нормалізує
пробіли, зберігає межі блоків/списків як переноси рядків.

Використання:
    echo "<p>Текст</p>" | python3 strip_html.py
    python3 strip_html.py < input.html
    python3 strip_html.py "<p>Inline HTML</p>"
"""
import sys
import re
from html.parser import HTMLParser

# Блокові теги, після яких доречний перенос рядка.
_BLOCK = {
    "p", "div", "br", "li", "tr", "ul", "ol", "table",
    "h1", "h2", "h3", "h4", "h5", "h6", "section", "header", "footer",
}
# Теги, вміст яких викидається цілком.
_DROP_CONTENT = {"script", "style"}


class _Stripper(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self._parts = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in _DROP_CONTENT:
            self._skip_depth += 1
            return
        if tag == "li":
            self._parts.append("\n- ")
        elif tag in _BLOCK:
            self._parts.append("\n")

    def handle_endtag(self, tag):
        if tag in _DROP_CONTENT and self._skip_depth > 0:
            self._skip_depth -= 1
            return
        if tag in _BLOCK:
            self._parts.append("\n")

    def handle_data(self, data):
        if self._skip_depth == 0:
            self._parts.append(data)

    def text(self):
        return "".join(self._parts)


def strip_html(html: str) -> str:
    p = _Stripper()
    p.feed(html)
    p.close()
    text = p.text()
    #   (nbsp) → звичайний пробіл
    text = text.replace(" ", " ")
    # прибрати пробіли по краях рядків
    lines = [ln.strip() for ln in text.splitlines()]
    # схлопнути внутрішні множинні пробіли
    lines = [re.sub(r"[ \t]+", " ", ln) for ln in lines]
    # прибрати порожні рядки (але лишити структуру списків/абзаців — по одному)
    out = []
    prev_blank = False
    for ln in lines:
        if ln == "":
            if not prev_blank and out:
                out.append("")
            prev_blank = True
        else:
            out.append(ln)
            prev_blank = False
    return "\n".join(out).strip()


def main() -> int:
    if len(sys.argv) > 1:
        html = " ".join(sys.argv[1:])
    else:
        html = sys.stdin.read()
    sys.stdout.write(strip_html(html))
    if not html.endswith("\n"):
        sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
