# 表情包转 JPG（微信小程序 + PC 网页版）

把微信表情包导出为 `.jpg` 图片，支持保存到手机相册或下载到电脑本地。

## 项目结构

```
wechat-emoji-export/
├── project.config.json        # 微信开发者工具项目配置
├── miniprogram/               # 微信小程序源码
│   ├── app.js / app.json / app.wxss
│   ├── sitemap.json
│   ├── utils/convert.js       # 核心：图片 → JPG 转换 & 保存相册
│   └── pages/
│       ├── index/             # 首页：选择表情、批量转换、结果网格
│       └── preview/           # 预览页：全屏查看、保存、删除
└── web/
    └── index.html             # PC 网页版：拖拽表情文件批量转 JPG 下载
```

## 工作原理

微信官方**没有开放读取用户表情收藏的接口**，因此采用业内通行的两条路径：

### 手机端（小程序）

1. 用户把想导出的表情发送到任意聊天（推荐「文件传输助手」）；
2. 小程序内点击「从聊天中选择表情」，底层调用 `wx.chooseMessageFile({ type: 'image' })` 从聊天记录中选取表情图片；
3. 通过 `<canvas type="2d">` 绘制：先铺白底（JPG 不支持透明），再绘制原图，超过 1280px 的长边等比缩小；
4. `wx.canvasToTempFilePath({ fileType: 'jpg' })` 导出 JPG 临时文件；
5. `wx.saveImageToPhotosAlbum` 保存到手机相册（含授权拒绝后的设置页引导）。

也支持「从相册选择图片」转换已保存的表情截图。

### PC 端（网页版）

1. 在微信 PC 版聊天中右键表情 →「另存为…」保存原文件（通常是 PNG/GIF）；
2. 打开 `web/index.html`（双击本地打开即可，无需服务器），把文件拖入页面；
3. 浏览器本地 Canvas 转换为 JPG，点击「下载 JPG」或「全部下载」保存到电脑。

所有转换均在本地完成，图片不经过任何服务器。

> 微信 PC 版（Windows/Mac）也能直接运行小程序，`app.js` 中检测到 PC 平台后会展示对应的保存提示。

## 如何运行小程序

1. 下载安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)；
2. 导入本目录（`wechat-emoji-export/`），AppID 可先使用测试号（`touristappid`）；
3. 点击「预览」用手机扫码即可真机体验；
4. 正式发布需要注册小程序账号、替换 `project.config.json` 中的 `appid` 并提交审核。

## 已知限制

| 限制 | 说明 |
| --- | --- |
| 动图（GIF）只导出第一帧 | Canvas 绘制静态帧，这是 JPG 格式与 Canvas 的固有限制；需要动画请保留原 GIF |
| 透明背景变为白色 | JPG 不支持透明通道，转换时统一填充白底 |
| 无法直接读取表情收藏 | 微信未开放该接口，需先把表情发到聊天里再选取 |
| 部分正版表情商店表情 | 受版权保护的表情在聊天中可能无法作为图片选取，属微信平台限制 |

## 发布合规提示

若计划上架微信小程序商店，请注意：表情包内容可能涉及第三方版权，建议在小程序内加入用户协议，声明仅供个人备份使用，避免审核被拒。
