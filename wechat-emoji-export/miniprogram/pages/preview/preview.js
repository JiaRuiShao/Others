// pages/preview/preview.js
const app = getApp()
const convert = require('../../utils/convert')

Page({
  data: {
    item: null,
    isPC: false
  },

  onLoad(options) {
    const platform = app.globalData.platform || ''
    const item = app.globalData.exportedList.find((x) => x.id === options.id)
    if (!item) {
      wx.showToast({ title: '图片不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
      return
    }
    this.setData({
      item,
      isPC: platform === 'windows' || platform === 'mac'
    })
  },

  /** 全屏预览，长按可直接保存/转发 */
  fullscreen() {
    wx.previewImage({
      urls: [this.data.item.jpgPath]
    })
  },

  /** 保存到相册（手机）/ 本地（PC 端微信会弹出保存对话框） */
  async save() {
    try {
      await convert.saveToAlbum(this.data.item.jpgPath)
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (e) {
      // 授权弹窗已在 saveToAlbum 内处理，其他错误提示一下
      if (!(e.errMsg && e.errMsg.indexOf('auth deny') > -1)) {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    }
  },

  /** 从列表中删除本张 */
  remove() {
    const { item } = this.data
    app.globalData.exportedList = app.globalData.exportedList.filter(
      (x) => x.id !== item.id
    )
    wx.navigateBack()
  },

  onShareAppMessage() {
    return {
      title: '表情包转JPG - 一键把微信表情导出为图片',
      path: '/pages/index/index'
    }
  }
})
