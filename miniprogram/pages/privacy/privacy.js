Page({
  data: {
    url: ''
  },

  onLoad() {
    let base = ''
    try {
      const app = getApp()
      base = (app && app.globalData && app.globalData.apiBaseUrl) || ''
    } catch (e) {
      base = ''
    }
    if (!base) {
      try {
        const { getEnv } = require('../../utils/request')
        base = (getEnv() && getEnv().apiBaseUrl) || ''
      } catch (e2) {
        base = ''
      }
    }
    const url = `${String(base).replace(/\/$/, '')}/privacy`
    if (!base) {
      wx.showToast({ title: '未配置服务地址', icon: 'none' })
      return
    }
    this.setData({ url })
  }
})
