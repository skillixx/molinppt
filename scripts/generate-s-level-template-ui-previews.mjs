import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const sourcePath = path.join(rootDir, 'docs', 'template-ui-design-task-plan.md');
const outputDir = path.join(rootDir, 'docs', 'template-ui-design-previews', 's-level');

const categoryStyles = {
  商业汇报: {
    palette: ['#edf4fb', '#0f3b5f', '#2f80ed', '#9db7ce', '#f5a623'],
    motif: 'dashboard',
    texture: 'grid',
  },
  战略咨询: {
    palette: ['#fbfbf8', '#1f2937', '#2f6f73', '#b8c9c6', '#d5a253'],
    motif: 'consulting',
    texture: 'paper',
  },
  财务经营: {
    palette: ['#f5f7fb', '#253858', '#2d6cdf', '#7d8da6', '#e05a47'],
    motif: 'finance',
    texture: 'ledger',
  },
  销售方案: {
    palette: ['#f4f8fb', '#14213d', '#00a6a6', '#f77f00', '#9db4c0'],
    motif: 'solution',
    texture: 'network',
  },
  市场营销: {
    palette: ['#fff7f0', '#281b43', '#ff5a5f', '#ffb000', '#36c2b4'],
    motif: 'marketing',
    texture: 'ribbons',
  },
  数据洞悉: {
    palette: ['#07111f', '#eaf6ff', '#00d1ff', '#53ffa9', '#ffcc4d'],
    motif: 'data',
    texture: 'matrix',
  },
  产品规划: {
    palette: ['#f8fbff', '#1d3557', '#457b9d', '#a8dadc', '#ffb703'],
    motif: 'product',
    texture: 'blueprint',
  },
  融资路演: {
    palette: ['#fbf8f2', '#1b1b2f', '#c59d5f', '#4f6d7a', '#d95763'],
    motif: 'pitch',
    texture: 'capital',
  },
  教育培训: {
    palette: ['#f7fbf8', '#1f3d36', '#2a9d8f', '#e9c46a', '#5c7cfa'],
    motif: 'education',
    texture: 'classroom',
  },
};

const themeAccents = {
  经营看板: ['#2f80ed', '#16a085'],
  问题诊断: ['#e05a47', '#f5a623'],
  行动闭环: ['#1f8f5f', '#2f80ed'],
  行业格局: ['#2f6f73', '#d5a253'],
  趋势判断: ['#00a6a6', '#2f80ed'],
  竞争地图: ['#7c3aed', '#2f6f73'],
  预算编制: ['#2d6cdf', '#6b7a90'],
  执行偏差: ['#e05a47', '#f5a623'],
  预算调整: ['#4f6d7a', '#d5a253'],
  金融行业: ['#0b3d91', '#00a6a6'],
  制造行业: ['#1d3557', '#f77f00'],
  教育行业: ['#2a9d8f', '#457b9d'],
  首发节奏: ['#ff5a5f', '#ffb000'],
  渠道铺排: ['#36c2b4', '#7c3aed'],
  上市发布会: ['#281b43', '#ff5a5f'],
  管理驾驶舱: ['#00d1ff', '#53ffa9'],
  实时监控: ['#00d1ff', '#ffcc4d'],
  指标预警: ['#ff4d4f', '#ffcc4d'],
  用户痛点: ['#457b9d', '#ffb703'],
  需求池: ['#2a9d8f', '#457b9d'],
  优先级评估: ['#7c3aed', '#ffb703'],
  商业模式: ['#c59d5f', '#4f6d7a'],
  市场机会: ['#2f80ed', '#c59d5f'],
  财务预测: ['#c59d5f', '#d95763'],
  管理培训: ['#2a9d8f', '#e9c46a'],
  销售培训: ['#5c7cfa', '#e76f51'],
  新人培训: ['#2a9d8f', '#5c7cfa'],
};

const slideTitles = ['首页封面', '总览页', '内容分析页', '行动结尾页'];

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function sanitizeName(value) {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '');
}

function wrapText(text, maxChars = 13) {
  const chars = [...text];
  const lines = [];
  for (let index = 0; index < chars.length; index += maxChars) {
    lines.push(chars.slice(index, index + maxChars).join(''));
  }
  return lines.slice(0, 3);
}

function parseSLevelTasks(markdown) {
  const section = markdown.match(/## S 级任务([\s\S]*?)## A 级任务/);
  if (!section) {
    throw new Error('未找到 S 级任务区块');
  }

  return section[1]
    .split(/\r?\n/)
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) => {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      return {
        order: Number(cells[0]),
        weight: cells[1],
        category: cells[2],
        template: cells[3],
        theme: cells[4],
        idea: cells[5],
        imageBrief: cells[6],
        prompt: cells[7],
      };
    });
}

function textBlock(lines, x, y, options = {}) {
  const {
    size = 22,
    fill = '#1f2937',
    weight = 600,
    lineHeight = 30,
    anchor = 'start',
    family = 'Microsoft YaHei, Noto Sans CJK SC, Arial',
  } = options;

  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" text-anchor="${anchor}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`,
    )
    .join('');
}

function miniChart(x, y, width, height, accent, secondary, mode) {
  const bars = [0.46, 0.66, 0.36, 0.82, 0.58].map((ratio, index) => {
    const barW = width / 7;
    const barH = height * ratio;
    const bx = x + 18 + index * (barW + 18);
    const by = y + height - barH;
    return `<rect x="${bx}" y="${by}" width="${barW}" height="${barH}" rx="6" fill="${index % 2 ? secondary : accent}" opacity="${index % 2 ? 0.72 : 0.95}"/>`;
  });

  const linePoints = [
    [x + 12, y + height * 0.75],
    [x + width * 0.26, y + height * 0.54],
    [x + width * 0.48, y + height * 0.61],
    [x + width * 0.7, y + height * 0.32],
    [x + width - 12, y + height * 0.22],
  ]
    .map(([px, py]) => `${px},${py}`)
    .join(' ');

  if (mode === 'line') {
    return `
      <polyline points="${linePoints}" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="${linePoints}" fill="none" stroke="${secondary}" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
      ${linePoints
        .split(' ')
        .map((point) => {
          const [cx, cy] = point.split(',');
          return `<circle cx="${cx}" cy="${cy}" r="6" fill="#fff" stroke="${accent}" stroke-width="4"/>`;
        })
        .join('')}
    `;
  }

  return bars.join('');
}

function decoration(x, y, width, height, style, accent, secondary) {
  if (style.texture === 'matrix') {
    return `
      <defs>
        <pattern id="matrix-${x}-${y}" width="42" height="42" patternUnits="userSpaceOnUse">
          <path d="M 42 0 L 0 0 0 42" fill="none" stroke="${accent}" stroke-width="1" opacity="0.22"/>
        </pattern>
      </defs>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#matrix-${x}-${y})"/>
      <circle cx="${x + width - 88}" cy="${y + 80}" r="56" fill="none" stroke="${secondary}" stroke-width="10" opacity="0.55"/>
      <circle cx="${x + width - 88}" cy="${y + 80}" r="34" fill="none" stroke="${accent}" stroke-width="5" opacity="0.85"/>
    `;
  }

  if (style.texture === 'ribbons') {
    return `
      <path d="M${x + width - 260},${y - 10} C${x + width - 170},${y + 70} ${x + width - 120},${y + 140} ${x + width + 20},${y + 174}" fill="none" stroke="${accent}" stroke-width="28" opacity="0.2"/>
      <path d="M${x + width - 210},${y + height + 10} C${x + width - 130},${y + height - 92} ${x + width - 80},${y + height - 130} ${x + width + 30},${y + height - 180}" fill="none" stroke="${secondary}" stroke-width="18" opacity="0.22"/>
    `;
  }

  if (style.texture === 'ledger') {
    return `
      ${Array.from({ length: 7 }, (_, index) => `<line x1="${x + 34}" y1="${y + 60 + index * 42}" x2="${x + width - 34}" y2="${y + 60 + index * 42}" stroke="${secondary}" stroke-width="1" opacity="0.24"/>`).join('')}
      <rect x="${x + width - 142}" y="${y + 38}" width="82" height="82" rx="18" fill="${accent}" opacity="0.14"/>
    `;
  }

  if (style.texture === 'blueprint') {
    return `
      <rect x="${x + width - 170}" y="${y + 34}" width="112" height="112" rx="18" fill="none" stroke="${accent}" stroke-width="4" opacity="0.35"/>
      <line x1="${x + width - 114}" y1="${y + 34}" x2="${x + width - 114}" y2="${y + 146}" stroke="${accent}" stroke-width="2" opacity="0.3"/>
      <line x1="${x + width - 170}" y1="${y + 90}" x2="${x + width - 58}" y2="${y + 90}" stroke="${accent}" stroke-width="2" opacity="0.3"/>
    `;
  }

  return `
    <circle cx="${x + width - 100}" cy="${y + 86}" r="68" fill="${accent}" opacity="0.12"/>
    <rect x="${x + width - 194}" y="${y + height - 112}" width="150" height="58" rx="14" fill="${secondary}" opacity="0.16"/>
    <path d="M${x + width - 250},${y + height - 42} L${x + width - 58},${y + height - 42}" stroke="${accent}" stroke-width="7" stroke-linecap="round" opacity="0.42"/>
  `;
}

function slideSvg(task, slideIndex, x, y, style, accents) {
  const [bg, ink, baseAccent, muted, warn] = style.palette;
  const [accent, secondary] = accents;
  const slideW = 690;
  const slideH = 388;
  const dark = bg === '#07111f';
  const foreground = dark ? '#eaf6ff' : ink;
  const panelFill = dark ? '#0d1d31' : '#ffffff';
  const softFill = dark ? '#122945' : '#f7fafc';
  const slideTitle = slideTitles[slideIndex];
  const headerLines = slideIndex === 0 ? wrapText(`${task.template}`) : wrapText(`${task.theme}${slideTitle}`);
  const subtitle = slideIndex === 0 ? `${task.category} / ${task.theme}` : task.imageBrief;

  const pageDecor = decoration(x, y, slideW, slideH, style, accent || baseAccent, secondary || muted);
  const titleY = y + (slideIndex === 0 ? 98 : 64);

  const titleBlock = textBlock(headerLines, x + 46, titleY, {
    size: slideIndex === 0 ? 34 : 24,
    fill: foreground,
    weight: 800,
    lineHeight: slideIndex === 0 ? 43 : 31,
  });

  const subtitleBlock = textBlock(wrapText(subtitle, 24), x + 48, titleY + headerLines.length * 38 + 16, {
    size: 15,
    fill: dark ? '#a7c6df' : '#64748b',
    weight: 500,
    lineHeight: 22,
  });

  if (slideIndex === 0) {
    return `
      <g>
        <rect x="${x}" y="${y}" width="${slideW}" height="${slideH}" rx="20" fill="${bg}" stroke="${dark ? '#19314d' : '#d8e2eb'}"/>
        ${pageDecor}
        <rect x="${x + 44}" y="${y + 42}" width="96" height="8" rx="4" fill="${accent}" opacity="0.95"/>
        ${titleBlock}
        ${subtitleBlock}
        <rect x="${x + 430}" y="${y + 200}" width="178" height="96" rx="22" fill="${panelFill}" opacity="${dark ? 0.12 : 0.88}" stroke="${dark ? '#1d4b72' : '#e2e8f0'}"/>
        <circle cx="${x + 478}" cy="${y + 248}" r="26" fill="${secondary}" opacity="0.82"/>
        <path d="M${x + 520},${y + 266} L${x + 580},${y + 216}" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>
        <text x="${x + 46}" y="${y + slideH - 42}" font-family="Microsoft YaHei, Noto Sans CJK SC, Arial" font-size="14" font-weight="700" fill="${dark ? '#a7c6df' : '#64748b'}">PPT TEMPLATE UI PREVIEW</text>
      </g>
    `;
  }

  if (slideIndex === 1) {
    return `
      <g>
        <rect x="${x}" y="${y}" width="${slideW}" height="${slideH}" rx="20" fill="${bg}" stroke="${dark ? '#19314d' : '#d8e2eb'}"/>
        ${pageDecor}
        ${titleBlock}
        <rect x="${x + 44}" y="${y + 100}" width="170" height="88" rx="18" fill="${panelFill}" stroke="${dark ? '#21486a' : '#e2e8f0'}" opacity="${dark ? 0.82 : 1}"/>
        <rect x="${x + 236}" y="${y + 100}" width="170" height="88" rx="18" fill="${panelFill}" stroke="${dark ? '#21486a' : '#e2e8f0'}" opacity="${dark ? 0.82 : 1}"/>
        <rect x="${x + 428}" y="${y + 100}" width="170" height="88" rx="18" fill="${panelFill}" stroke="${dark ? '#21486a' : '#e2e8f0'}" opacity="${dark ? 0.82 : 1}"/>
        <text x="${x + 70}" y="${y + 136}" font-family="Microsoft YaHei" font-size="28" font-weight="800" fill="${accent}">86%</text>
        <text x="${x + 262}" y="${y + 136}" font-family="Microsoft YaHei" font-size="28" font-weight="800" fill="${secondary}">12.8</text>
        <text x="${x + 454}" y="${y + 136}" font-family="Microsoft YaHei" font-size="28" font-weight="800" fill="${warn}">+24%</text>
        <text x="${x + 70}" y="${y + 168}" font-family="Microsoft YaHei, Noto Sans CJK SC, Arial" font-size="13" font-weight="700" fill="${dark ? '#b8d7eb' : '#6b7280'}">目标达成</text>
        <text x="${x + 262}" y="${y + 168}" font-family="Microsoft YaHei, Noto Sans CJK SC, Arial" font-size="13" font-weight="700" fill="${dark ? '#b8d7eb' : '#6b7280'}">关键指标</text>
        <text x="${x + 454}" y="${y + 168}" font-family="Microsoft YaHei, Noto Sans CJK SC, Arial" font-size="13" font-weight="700" fill="${dark ? '#b8d7eb' : '#6b7280'}">增长趋势</text>
        <rect x="${x + 46}" y="${y + 220}" width="552" height="112" rx="18" fill="${softFill}" stroke="${dark ? '#21486a' : '#e2e8f0'}"/>
        ${miniChart(x + 70, y + 238, 504, 76, accent, secondary, 'bar')}
      </g>
    `;
  }

  if (slideIndex === 2) {
    return `
      <g>
        <rect x="${x}" y="${y}" width="${slideW}" height="${slideH}" rx="20" fill="${bg}" stroke="${dark ? '#19314d' : '#d8e2eb'}"/>
        ${pageDecor}
        ${titleBlock}
        <rect x="${x + 44}" y="${y + 96}" width="260" height="230" rx="18" fill="${panelFill}" stroke="${dark ? '#21486a' : '#e2e8f0'}" opacity="${dark ? 0.84 : 1}"/>
        <rect x="${x + 334}" y="${y + 96}" width="266" height="72" rx="16" fill="${softFill}" stroke="${dark ? '#21486a' : '#e2e8f0'}"/>
        <rect x="${x + 334}" y="${y + 181}" width="266" height="72" rx="16" fill="${softFill}" stroke="${dark ? '#21486a' : '#e2e8f0'}"/>
        <rect x="${x + 334}" y="${y + 266}" width="266" height="60" rx="16" fill="${softFill}" stroke="${dark ? '#21486a' : '#e2e8f0'}"/>
        ${miniChart(x + 70, y + 150, 206, 112, accent, secondary, 'line')}
        ${textBlock(['关键洞察', '原因拆解', '策略判断'], x + 364, y + 126, { size: 16, fill: foreground, weight: 700, lineHeight: 84 })}
        <circle cx="${x + 558}" cy="${y + 126}" r="12" fill="${accent}"/>
        <circle cx="${x + 558}" cy="${y + 211}" r="12" fill="${secondary}"/>
        <circle cx="${x + 558}" cy="${y + 296}" r="12" fill="${warn}"/>
      </g>
    `;
  }

  return `
    <g>
      <rect x="${x}" y="${y}" width="${slideW}" height="${slideH}" rx="20" fill="${bg}" stroke="${dark ? '#19314d' : '#d8e2eb'}"/>
      ${pageDecor}
      ${titleBlock}
      <path d="M${x + 74},${y + 178} C${x + 184},${y + 112} ${x + 264},${y + 254} ${x + 374},${y + 188} S${x + 528},${y + 176} ${x + 600},${y + 116}" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>
      ${[0, 1, 2, 3].map((index) => {
        const cx = x + 92 + index * 150;
        const cy = y + 178 + (index % 2 ? 44 : -18);
        return `
          <circle cx="${cx}" cy="${cy}" r="20" fill="${panelFill}" stroke="${accent}" stroke-width="5"/>
          <text x="${cx}" y="${cy + 7}" text-anchor="middle" font-family="Microsoft YaHei" font-size="16" font-weight="800" fill="${foreground}">${index + 1}</text>
        `;
      }).join('')}
      <rect x="${x + 72}" y="${y + 264}" width="500" height="52" rx="16" fill="${panelFill}" opacity="${dark ? 0.85 : 1}" stroke="${dark ? '#21486a' : '#e2e8f0'}"/>
      <text x="${x + 96}" y="${y + 297}" font-family="Microsoft YaHei" font-size="17" font-weight="700" fill="${foreground}">行动计划 / 负责人 / 时间节点 / 结果复盘</text>
    </g>
  `;
}

function buildSvg(task) {
  const style = categoryStyles[task.category] || categoryStyles.商业汇报;
  const accents = themeAccents[task.theme] || [style.palette[2], style.palette[4]];
  const title = `${task.category}｜${task.template}｜${task.theme}`;
  const darkHeader = task.category === '数据洞悉';

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1060" viewBox="0 0 1600 1060">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#1f2937" flood-opacity="0.18"/>
      </filter>
    </defs>
    <rect width="1600" height="1060" fill="${darkHeader ? '#06101d' : '#eef2f7'}"/>
    <rect x="54" y="42" width="1492" height="92" rx="26" fill="${darkHeader ? '#0b1c31' : '#ffffff'}" opacity="0.96"/>
    <text x="86" y="86" font-family="Microsoft YaHei, Noto Sans CJK SC, Arial" font-size="30" font-weight="800" fill="${darkHeader ? '#eaf6ff' : '#111827'}">${escapeXml(title)}</text>
    <text x="88" y="118" font-family="Microsoft YaHei, Noto Sans CJK SC, Arial" font-size="16" font-weight="600" fill="${darkHeader ? '#8fb7d9' : '#64748b'}">S 级模板 UI 设计预览 / 4 页结构：封面、总览、分析、行动结尾</text>
    <g filter="url(#shadow)">
      ${slideSvg(task, 0, 70, 174, style, accents)}
      ${slideSvg(task, 1, 840, 174, style, accents)}
      ${slideSvg(task, 2, 70, 604, style, accents)}
      ${slideSvg(task, 3, 840, 604, style, accents)}
    </g>
  </svg>`;
}

function buildIndex(tasks) {
  const cards = tasks
    .map((task) => {
      const filename = `${String(task.order).padStart(2, '0')}-${sanitizeName(task.category)}-${sanitizeName(task.template)}-${sanitizeName(task.theme)}.png`;
      return `
        <article class="card">
          <img src="./${filename}" alt="${escapeXml(task.category)}-${escapeXml(task.template)}-${escapeXml(task.theme)}" />
          <div class="meta">
            <span>S${String(task.order).padStart(2, '0')}</span>
            <strong>${escapeXml(task.category)} / ${escapeXml(task.template)}</strong>
            <em>${escapeXml(task.theme)}</em>
          </div>
        </article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>S 级 PPT 模板 UI 设计预览</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif; background: #f4f6f9; color: #111827; }
    header { padding: 32px 40px 20px; background: #ffffff; border-bottom: 1px solid #e5e7eb; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    p { margin: 0; color: #64748b; }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 22px; padding: 28px 40px 48px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08); }
    img { display: block; width: 100%; height: auto; }
    .meta { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; padding: 14px 16px 16px; align-items: center; }
    .meta span { grid-row: span 2; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; background: #111827; color: #fff; font-weight: 800; }
    .meta strong { font-size: 15px; }
    .meta em { font-style: normal; color: #2563eb; font-weight: 700; }
  </style>
</head>
<body>
  <header>
    <h1>S 级 PPT 模板 UI 设计预览</h1>
    <p>每张图对应一个模板分类、模板名称和主题风格，后续可按该命名继续实现真实 PPT 模板。</p>
  </header>
  <main>
    ${cards}
  </main>
</body>
</html>`;
}

await fs.mkdir(outputDir, { recursive: true });
const markdown = await fs.readFile(sourcePath, 'utf8');
const tasks = parseSLevelTasks(markdown);

for (const task of tasks) {
  const basename = `${String(task.order).padStart(2, '0')}-${sanitizeName(task.category)}-${sanitizeName(task.template)}-${sanitizeName(task.theme)}`;
  const svg = buildSvg(task);
  const svgPath = path.join(outputDir, `${basename}.svg`);

  // 每个任务单独导出 SVG，方便后续按主题风格人工挑选和转为正式 PPT 模板。
  await fs.writeFile(svgPath, svg, 'utf8');
}

await fs.writeFile(path.join(outputDir, 'index.html'), buildIndex(tasks), 'utf8');
await fs.writeFile(
  path.join(outputDir, 'manifest.json'),
  JSON.stringify(
    tasks.map((task) => ({
      order: task.order,
      weight: task.weight,
      category: task.category,
      template: task.template,
      theme: task.theme,
      filename: `${String(task.order).padStart(2, '0')}-${sanitizeName(task.category)}-${sanitizeName(task.template)}-${sanitizeName(task.theme)}.png`,
      sourceSvg: `${String(task.order).padStart(2, '0')}-${sanitizeName(task.category)}-${sanitizeName(task.template)}-${sanitizeName(task.theme)}.svg`,
      prompt: task.prompt,
    })),
    null,
    2,
  ),
  'utf8',
);

console.log(`已生成 ${tasks.length} 张 S 级模板 UI 设计预览图：${outputDir}`);
