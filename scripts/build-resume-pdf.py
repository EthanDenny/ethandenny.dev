#!/usr/bin/env python3
"""Build the downloadable resume PDF from src/data/resume.json."""

from __future__ import annotations

import json
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "src" / "data" / "resume.json"
OUTPUT_PATH = ROOT / "public" / "ethan-denny-resume.pdf"

INK = colors.HexColor("#142018")
MUTED = colors.HexColor("#405047")
ACCENT = colors.HexColor("#1748D1")
PAPER = colors.white


def ascii_text(value: str) -> str:
    replacements = {
        "—": "-",
        "–": "-",
        "·": "|",
        "’": "'",
        "“": '"',
        "”": '"',
    }
    for source, target in replacements.items():
        value = value.replace(source, target)
    return escape(value)


def link(label: str, url: str) -> str:
    return f'<link href="{escape(url)}" color="{ACCENT.hexval()}">{ascii_text(label)}</link>'


def bullet(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(ascii_text(text), style, bulletText="-")


def make_styles() -> dict[str, ParagraphStyle]:
    sample = getSampleStyleSheet()
    base = ParagraphStyle(
        "Base",
        parent=sample["BodyText"],
        fontName="Helvetica",
        fontSize=8.65,
        leading=10.85,
        textColor=INK,
        spaceAfter=0,
    )
    return {
        "base": base,
        "name": ParagraphStyle(
            "Name",
            parent=base,
            fontName="Helvetica-Bold",
            fontSize=30,
            leading=30,
            tracking=-0.5,
        ),
        "headline": ParagraphStyle(
            "Headline",
            parent=base,
            fontName="Helvetica-Bold",
            fontSize=8.35,
            leading=10.2,
            textTransform="uppercase",
            textColor=MUTED,
            spaceBefore=4,
        ),
        "contact": ParagraphStyle(
            "Contact",
            parent=base,
            fontSize=7.7,
            leading=9.65,
            alignment=TA_RIGHT,
        ),
        "summary": ParagraphStyle(
            "Summary",
            parent=base,
            fontName="Helvetica-Bold",
            fontSize=9.15,
            leading=11.55,
        ),
        "section": ParagraphStyle(
            "Section",
            parent=base,
            fontName="Helvetica-Bold",
            fontSize=7.6,
            leading=9.3,
            textTransform="uppercase",
            tracking=0.7,
        ),
        "entry": ParagraphStyle(
            "Entry",
            parent=base,
            fontName="Helvetica-Bold",
            fontSize=9.35,
            leading=11,
        ),
        "meta": ParagraphStyle(
            "Meta",
            parent=base,
            fontSize=7.7,
            leading=9.4,
            textColor=MUTED,
        ),
        "date": ParagraphStyle(
            "Date",
            parent=base,
            fontName="Helvetica-Bold",
            fontSize=7.55,
            leading=9.4,
            alignment=TA_RIGHT,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base,
            leftIndent=8,
            firstLineIndent=-6,
            bulletIndent=0,
            spaceBefore=1.65,
        ),
        "compact": ParagraphStyle(
            "Compact",
            parent=base,
            fontSize=8.35,
            leading=10.35,
        ),
    }


def section_row(title: str, content, styles, top_padding: float = 5.5) -> Table:
    title_cell = Paragraph(ascii_text(title.upper()), styles["section"])
    table = Table([[title_cell, content]], colWidths=[0.95 * inch, 6.55 * inch])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEABOVE", (0, 0), (0, 0), 1.2, INK),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 10),
                ("RIGHTPADDING", (1, 0), (1, 0), 0),
                ("TOPPADDING", (0, 0), (-1, -1), top_padding),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return table


def entry_block(entry: dict, styles) -> list:
    title = Paragraph(
        f'{link(entry["company"], entry["companyUrl"])}'
        f' <font color="{MUTED.hexval()}">/ {ascii_text(entry["role"])}</font>',
        styles["entry"],
    )
    dates = Paragraph(ascii_text(entry["dates"]), styles["date"])
    header = Table([[title, dates]], colWidths=[5.25 * inch, 1.3 * inch])
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    flowables = [
        header,
        Paragraph(ascii_text(entry["location"]), styles["meta"]),
        *[bullet(item, styles["bullet"]) for item in entry["bullets"]],
    ]
    return flowables


def build() -> None:
    data = json.loads(DATA_PATH.read_text())
    styles = make_styles()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    document = BaseDocTemplate(
        str(OUTPUT_PATH),
        pagesize=letter,
        leftMargin=0.5 * inch,
        rightMargin=0.5 * inch,
        topMargin=0.42 * inch,
        bottomMargin=0.4 * inch,
        title=f'{data["name"]} - Resume',
        author=data["name"],
        subject="Software engineering resume",
    )
    frame = Frame(
        document.leftMargin,
        document.bottomMargin,
        document.width,
        document.height,
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    document.addPageTemplates(PageTemplate(id="resume", frames=[frame]))

    contact_lines = [
        ascii_text(data["location"]),
        link(data["email"], f'mailto:{data["email"]}'),
        link(data["website"], f'https://{data["website"]}'),
        f'{link("GitHub", f"https://{data["github"]}")} | '
        f'{link("LinkedIn", f"https://www.{data["linkedin"]}")}',
    ]
    header = Table(
        [
            [
                [
                    Paragraph(ascii_text(data["name"]), styles["name"]),
                    Paragraph(ascii_text(data["headline"]), styles["headline"]),
                ],
                Paragraph("<br/>".join(contact_lines), styles["contact"]),
            ]
        ],
        colWidths=[4.65 * inch, 2.85 * inch],
    )
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                ("LINEBELOW", (0, 0), (-1, -1), 2, INK),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )

    skills = [
        Paragraph(
            f'<b>{ascii_text(skill["label"])}:</b> {ascii_text(skill["items"])}',
            styles["compact"],
        )
        for skill in data["skills"]
    ]

    experience = []
    for index, entry in enumerate(data["experience"]):
        if index:
            experience.append(Spacer(1, 6.5))
        experience.extend(entry_block(entry, styles))

    education = data["education"]
    education_header = Table(
        [
            [
                Paragraph(link(education["school"], education["schoolUrl"]), styles["entry"]),
                Paragraph(ascii_text(education["dates"]), styles["date"]),
            ]
        ],
        colWidths=[5.25 * inch, 1.3 * inch],
    )
    education_header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    education_block = [
        education_header,
        Paragraph(ascii_text(education["degree"]), styles["meta"]),
        *[bullet(item, styles["bullet"]) for item in education["details"]],
    ]

    project_blocks = []
    for project in data["projects"]:
        project_blocks.append(
            Paragraph(
                f'<b>{link(project["name"], project["url"])} -</b> '
                f'{ascii_text(project["description"])}',
                styles["compact"],
            )
        )
        project_blocks.append(Spacer(1, 2.5))

    recognition = Paragraph(
        ascii_text(" | ".join(data["recognition"])), styles["compact"]
    )

    story = [
        header,
        Spacer(1, 7),
        Paragraph(ascii_text(data["summary"]), styles["summary"]),
        section_row("Skills", skills, styles),
        section_row("Experience", experience, styles, top_padding=6.5),
        section_row("Education", education_block, styles),
        section_row("Projects & Leadership", project_blocks, styles),
        section_row("Recognition", recognition, styles),
    ]
    document.build(story)


if __name__ == "__main__":
    build()
