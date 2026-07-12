# 图片生成提示词

把下面内容作为基础提示词，并替换方括号中的变量。

```text
Use case: ads-marketing
Asset type: premium PPT template marketplace thumbnail, landscape 16:9
Primary request: Create an elegant, high-end commercial template showcase image based on the supplied PPT slide screenshots. It must communicate a complete presentation template, not a screenshot collage.
Input images: The cover or strongest visual slide is the hero board. The remaining images are supporting interior-slide previews and must stay recognizable.
Composition/framing: Use a restrained studio backdrop derived from the source template palette. Place the hero slide as one large crisp presentation board. Arrange 3–4 supporting slide boards with realistic perspective, depth, soft shadows, and layered spacing. Keep every slide board fully inside the frame and preserve its 16:9 proportion.
Text (verbatim): "[模板名称]" and a smaller subtitle "[主题名称]". Render both Chinese strings exactly. No other large copy.
Style/medium: polished professional business design, premium template-store cover, clean, contemporary, understated.
Color palette: derive colors from the supplied slides; do not replace the template identity with an unrelated palette.
Constraints: preserve the source slides' recognizable layout; show multiple page types; maintain strong hierarchy and generous negative space.
Avoid: flat grid collage, oversized title, clutter, excessive badges, fake logos, watermarks, gibberish text, distorted slide proportions, cropped slide boards, unrelated people or objects.
```

## 生成后检查

1. 放大核对模板名称和主题名称；出现错字必须重生成。
2. 检查主页面是否仍能识别为原 PPT 页面。
3. 检查至少三种版式是否可见。
4. 检查所有页面比例、透视和边缘是否自然。
5. 若结果仍像拼图，只调整构图与空间层次，不改变源模板身份。
