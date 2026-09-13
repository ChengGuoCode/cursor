const { applyGroup } = require('../../api/group')
const { requireLogin } = require('../../utils/auth')
const { toastError } = require('../../utils/request')

Page({
  data: {
    inviteCode: '',
    applyMsg: '',
    submitting: false
  },

  onLoad() {
    if (!requireLogin('申请加入前请先登录')) {
      setTimeout(() => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/groups/groups' }) }), 400)
    }
  },

  onInviteInput(e) {
    this.setData({ inviteCode: e.detail.value })
  },

  onApplyMsgInput(e) {
    this.setData({ applyMsg: e.detail.value })
  },

  async onSubmit() {
    if (this.data.submitting) return
    if (!requireLogin('申请加入前请先登录')) return

    const inviteCode = (this.data.inviteCode || '').trim()
    if (!inviteCode) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      await applyGroup({
        inviteCode,
        applyMsg: (this.data.applyMsg || '').trim()
      })
      wx.showToast({ title: '已提交申请', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/groups/groups' }) })
      }, 400)
    } catch (err) {
      toastError(err, '申请失败')
    } finally {
      this.setData({ submitting: false })
    }
  }
})
