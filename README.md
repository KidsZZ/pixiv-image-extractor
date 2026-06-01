# Pixiv 图片提取 v1.2

从 Pixiv 作品页面提取高清图片，支持预览、勾选、批量下载、打包下载。

## 功能

- 🖼️ 自动识别作品页面所有图片
- ✅ 网格预览 + 勾选想要保存的图片
- 📥 逐张下载选中的高清原图
- 📦 打包下载为 ZIP（多图作品一键保存）
- 📝 自定义下载文件名模板（支持占位符）
- 🎨 浅色主题 UI

## 安装

1. 下载本项目到本地
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择 `pixiv-image-extractor` 文件夹

## 使用

1. 打开 [Pixiv](https://www.pixiv.net/) 任意作品详情页（如 `pixiv.net/artworks/116299462`）
2. 点击浏览器工具栏中的扩展图标
3. 图片会自动提取并显示预览网格
4. 点击图片勾选/取消，或使用「全选」按钮
5. 可选：在输入框中设置文件名模板
6. 点击「下载选中」逐张保存，或「打包下载」保存为 ZIP

## 文件名模板

在下载前可自定义文件名格式，支持以下占位符：

| 占位符 | 含义 | 示例 |
|--------|------|------|
| `{id}` | 作品 ID | 116299462 |
| `{author}` | 作者名 | 鸦居 |
| `{title}` | 作品标题 | 星妲 |
| `{index}` | 页码 | 1 |

默认模板：`pixiv_{id}_{author}_{title}_p{index}`

示例：`{author}-{title}-p{index}` → `鸦居-星妲-p1.jpg`

## 文件说明

```
pixiv-image-extractor/
├── manifest.json      # 扩展配置（Manifest V3）
├── content.js         # 内容脚本，调用 Pixiv API 提取图片
├── popup.js           # 弹出窗口逻辑（预览 + 下载）
├── popup.html         # 弹出窗口 UI（浅色主题）
├── rules.json         # declarativeNetRequest 规则（自动加 Referer 头）
├── lib/
│   └── jszip.min.js   # JSZip 库（打包下载用）
├── icon*.png          # 扩展图标
├── .gitignore         # Git 忽略配置
└── README.md          # 本文档
```

## 技术实现

- **提取策略**：调用 Pixiv 内部 API `/ajax/illust/{id}/pages` 获取所有图片 URL
- **Referer 处理**：通过 `declarativeNetRequest` 规则自动为 i.pximg.net 请求添加 Referer 头
- **预览**：使用 regular 尺寸图片（master1200，约 1200px 宽）
- **下载**：使用 original 原图 URL，通过 blob + `<a download>` 保存
- **打包下载**：使用 JSZip 库将多张图片打包为 ZIP

## 适配范围

- Chrome 88+（Manifest V3 支持）
- Pixiv 作品详情页 `https://www.pixiv.net/artworks/*`

## 已知限制

- 需要 Pixiv 登录状态才能调用 API
- 下载保存到 Chrome 默认下载目录
- Ugoira（动图）暂不支持，会作为普通图片处理
