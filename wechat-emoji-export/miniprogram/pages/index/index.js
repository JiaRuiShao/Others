// pages/index/index.js
const app = getApp()
const convert = require('../../utils/convert')

Page({
  data: {
    list: [],        // { id, srcPath, jpgPath, width, height }
    converting: false,
    isPC: false
  },

  onLoad() {
    const platform = app.globalData.platform || ''
    this.setData({
      isPC: platform === 'windows' || platform === 'mac',
      list: app.globalData.exportedList
    })
  },

  onShow() {
    // 从预览页删除后回来刷新列表
    this.setData({ list: app.globalData.exportedList })
  },

  /**
   * 从聊天记录中选择表情/图片
   * 使用方法：先把想导出的表情发到任意聊天（比如"文件传输助手"），
   * 再从这里选择该聊天里的表情图片。
   */
  chooseFromChat() {
    wx.chooseMessageFile({
      count: 9,
      type: 'image',
      success: (res) => {
        const paths = res.tempFiles.map((f) => f.path)
        this.convertAll(paths)
      }
    })
  },

  /** 从相册选择（适用于已保存到相册的表情截图等） */
  chooseFromAlbum() {
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        const paths = res.tempFiles.map((f) => f.tempFilePath)
        this.convertAll(paths)
      }
    })
  },

  /** 批量转换为 JPG */
  async convertAll(paths) {
    if (!paths.length) return
    this.setData({ converting: true })
    wx.showLoading({ title: '转换中…', mask: true })

    let ok = 0
    let fail = 0
    for (const srcPath of paths) {
      try {
        const { jpgPath, width, height } = await convert.toJpg(
          this, '#convertCanvas', srcPath
        )
        app.globalData.exportedList.push({
          id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
          srcPath,
          jpgPath,
          width,
          height
        })
        ok++
      } catch (e) {
        console.error('转换失败', e)
        fail++
      }
    }

    wx.hideLoading()
    this.setData({
      list: app.globalData.exportedList,
      converting: false
    })
    wx.showToast({
      title: fail ? `成功${ok}张，失败${fail}张` : `已转换${ok}张`,
      icon: fail ? 'none' : 'success'
    })
  },

  /** 点击缩略图进入预览页 */
  openPreview(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/preview/preview?id=${id}` })
  },

  /** 保存全部到相册 */
  async saveAll() {
    const { list } = this.data
    if (!list.length) return
    wx.showLoading({ title: '保存中…', mask: true })
    let ok = 0
    for (const item of list) {
      try {
        await convert.saveToAlbum(item.jpgPath)
        ok++
      } catch (e) {
        // 授权被拒时 saveToAlbum 内部已弹窗引导，这里直接中断
        break
      }
    }
    wx.hideLoading()
    if (ok > 0) {
      wx.showToast({ title: `已保存${ok}张`, icon: 'success' })
    }
  },

  /** 清空列表 */
  clearAll() {
    wx.showModal({
      title: '清空列表',
      content: '确定要清空已转换的图片吗？（不影响已保存到相册的图片）',
      success: (res) => {
        if (res.confirm) {
          app.globalData.exportedList = []
          this.setData({ list: [] })
        }
      }
    })
  },

  onShareAppMessage() {
    return {
      title: '表情包转JPG - 一键把微信表情导出为图片',
      path: '/pages/index/index'
    }
  }
})
