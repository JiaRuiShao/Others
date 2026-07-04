/**
 * 图片 → JPG 转换工具
 *
 * 使用页面内的 <canvas type="2d"> 节点完成绘制：
 * 1. wx.getImageInfo 读取原图尺寸
 * 2. 画布铺白底（JPG 不支持透明，透明区域统一填白）
 * 3. 绘制原图后通过 wx.canvasToTempFilePath 导出 fileType: 'jpg'
 *
 * 注意：动图（GIF 表情）只能导出第一帧，这是 Canvas 的固有限制。
 */

// 导出图片的最长边，超过则等比缩小，避免画布过大导致内存问题
const MAX_EDGE = 1280

/**
 * 获取页面中的 canvas 2d 节点
 * @param {Object} pageInstance 页面实例（this）
 * @param {String} selector 例如 '#convertCanvas'
 * @returns {Promise<Canvas>}
 */
function getCanvasNode(pageInstance, selector) {
  return new Promise((resolve, reject) => {
    wx.createSelectorQuery()
      .in(pageInstance)
      .select(selector)
      .fields({ node: true })
      .exec((res) => {
        if (res && res[0] && res[0].node) {
          resolve(res[0].node)
        } else {
          reject(new Error('未找到画布节点 ' + selector))
        }
      })
  })
}

function getImageInfo(src) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({ src, success: resolve, fail: reject })
  })
}

/**
 * 把一张图片转成 JPG
 * @param {Object} pageInstance 页面实例
 * @param {String} canvasSelector canvas 选择器
 * @param {String} srcPath 原图临时路径
 * @param {Number} quality JPG 质量 0~1
 * @returns {Promise<{jpgPath, width, height}>}
 */
async function toJpg(pageInstance, canvasSelector, srcPath, quality = 0.92) {
  const info = await getImageInfo(srcPath)

  // 等比压缩到 MAX_EDGE 以内
  let { width, height } = info
  const longEdge = Math.max(width, height)
  if (longEdge > MAX_EDGE) {
    const ratio = MAX_EDGE / longEdge
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  const canvas = await getCanvasNode(pageInstance, canvasSelector)
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  await new Promise((resolve, reject) => {
    const img = canvas.createImage()
    img.onload = () => {
      // JPG 无透明通道，先铺白底
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      resolve()
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = srcPath
  })

  const jpgPath = await new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas,
      fileType: 'jpg',
      quality,
      success: (res) => resolve(res.tempFilePath),
      fail: reject
    })
  })

  return { jpgPath, width, height }
}

/**
 * 保存 JPG 到系统相册（自动处理授权）
 * @param {String} filePath
 * @returns {Promise<void>}
 */
function saveToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: resolve,
      fail: (err) => {
        // 用户此前拒绝过授权，引导去设置页打开
        if (err.errMsg && err.errMsg.indexOf('auth deny') > -1) {
          wx.showModal({
            title: '需要相册权限',
            content: '保存图片需要您授权访问相册，请在设置中打开「添加到相册」权限。',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting()
              }
              reject(err)
            }
          })
        } else {
          reject(err)
        }
      }
    })
  })
}

module.exports = {
  toJpg,
  saveToAlbum
}
