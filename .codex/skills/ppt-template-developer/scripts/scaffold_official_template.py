#!/usr/bin/env python3
"""为 molinppt 项目创建官方 PPT 模板主题目录。"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
OFFICIAL_ROOT = ROOT / "templates" / "official"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="创建官方 PPT 模板主题脚手架")
    parser.add_argument("--category", required=True, help="分类 slug，例如 marketing")
    parser.add_argument("--category-name", required=True, help="分类中文名，例如 市场营销")
    parser.add_argument("--category-sort-order", type=int, default=100, help="分类排序")
    parser.add_argument("--template", required=True, help="模板 slug，例如 growth-marketing-plan")
    parser.add_argument("--template-name", required=True, help="模板中文名，例如 增长营销方案")
    parser.add_argument("--theme", required=True, help="主题 slug，例如 aarrr")
    parser.add_argument("--theme-name", required=True, help="主题中文名，例如 AARRR")
    parser.add_argument("--layout", required=True, help="visual.layout，例如 growth-marketing")
    parser.add_argument("--variant", required=True, help="visual.variant，例如 aarrr")
    parser.add_argument("--primary", default="111827", help="主色十六进制")
    parser.add_argument("--accent", default="22C55E", help="强调色十六进制")
    parser.add_argument("--background", default="F8FAFC", help="背景色十六进制")
    parser.add_argument("--surface", default="FFFFFF", help="页面底色十六进制")
    parser.add_argument("--title", default="0F172A", help="标题色十六进制")
    parser.add_argument("--body", default="334155", help="正文色十六进制")
    parser.add_argument("--force", action="store_true", help="允许覆盖已存在的基础文件")
    return parser.parse_args()


def ensure_slug(value: str, field: str) -> None:
    allowed = set("abcdefghijklmnopqrstuvwxyz0123456789-")
    if not value or value[0] == "-" or value[-1] == "-" or any(ch not in allowed for ch in value):
        raise SystemExit(f"{field} 必须使用小写字母、数字和连字符: {value}")


def write_json(path: Path, data: dict, force: bool) -> None:
    if path.exists() and not force:
        raise SystemExit(f"文件已存在，使用 --force 覆盖: {path}")
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, content: str, force: bool) -> None:
    if path.exists() and not force:
        raise SystemExit(f"文件已存在，使用 --force 覆盖: {path}")
    path.write_text(content, encoding="utf-8")


def main() -> None:
    args = parse_args()
    for field in ["category", "template", "theme", "layout", "variant"]:
        ensure_slug(getattr(args, field), field)

    slug = f"{args.category}-{args.template}-{args.theme}"
    theme_dir = OFFICIAL_ROOT / args.category / args.template / args.theme
    assets_dir = theme_dir / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    visual = {
        "primary": args.primary,
        "accent": args.accent,
        "background": args.background,
        "surface": args.surface,
        "title": args.title,
        "body": args.body,
        "layout": args.layout,
        "variant": args.variant,
    }
    manifest = {
        "slug": slug,
        "name": f"{args.template_name} - {args.theme_name}",
        "description": f"适合{args.theme_name}场景的商业化 PPT 模板。",
        "category_slug": args.category,
        "category_name": args.category_name,
        "category_sort_order": args.category_sort_order,
        "status": "active",
        "tags": [args.category, args.template, args.theme],
        "template_file": "template.json",
        "renderer_file": "renderer.js",
    }
    template = {
        "baseTemplateId": args.template,
        "themeId": args.theme,
        "style": args.layout,
        "themes": [{"id": args.theme, "name": args.theme_name, "visual": visual}],
        "visual": visual,
        "layoutSchema": {
            "defaultCoverLayout": f"{args.layout}-cover",
            "defaultContentLayout": f"{args.layout}-content",
            "allowedLayouts": [
                f"{args.layout}-cover",
                f"{args.layout}-content",
                f"{args.layout}-analysis",
                f"{args.layout}-summary",
            ],
        },
    }
    renderer = f'''/**
 * 官方代码模板渲染入口。
 * 当前渲染仍由 ppt-service.js 和 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {json.dumps({
        "templateId": args.template,
        "templateName": args.template_name,
        "themeId": args.theme,
        "themeName": args.theme_name,
        "style": args.layout,
        "visual": visual,
    }, ensure_ascii=False, indent=2)};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {{object}}
 */
export function getTemplateVisual() {{
  return templateRenderer.visual;
}}
'''

    write_json(theme_dir / "manifest.json", manifest, args.force)
    write_json(theme_dir / "template.json", template, args.force)
    write_text(theme_dir / "renderer.js", renderer, args.force)
    print(theme_dir)


if __name__ == "__main__":
    main()
