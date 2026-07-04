// app.js
App({
  globalData: {
    // 已转换的图片列表，供各页面共享
    // { id, srcPath, jpgPath, width, height, size }
    exportedList: []
  },

  onLaunch() {
    const info = wx.getSystemInfoSync()
    // 记录运行平台：ios / android / windows / mac / devtools
    // PC 端（windows / mac）保存图片的交互与手机端略有不同
    this.globalData.platform = info.platform
  }
})
