const {
  listApply,
  reviewApply,
  cancelApply,
  selectGroup
} = require('../../api/group')
const { isLoggedIn, requireLogin } = require('../../utils/auth')
const {
  APPLY_STATUS,
  APPLY_STATUS_OPTIONS,
  canReview,
  findMyMember
} = require('../../utils/group-map')
const { formatDate } = require('../../utils/format')

function currentUserId() {
  const user = (getApp().globalData && getApp().globalData.userInfo) || {}
  return user.id || user.userId || ''
}

Page({
  data: {
    applyStatus: null,
    statusOptions: APPLY_STATUS_OPTIONS.map((o) => ({
      ...o,
      key: o.id == null ? 'all' : String(o.id)
    })),
    statusKey: 'all',
    list: [],
    canReview: false,
    guestMode: false
  },

  onShow() {
    this.bootstrap()
  },

  async bootstrap() {
    if (!isLoggedIn()) {
      this.setData({ list: [], guestMode: true, canReview: false })
      return
    }
    try {
      const group = await selectGroup().catch(() => null)
      const mine = findMyMember(group, currentUserId())
      this.setData({
        guestMode: false,
        canReview: !!(mine && canReview(mine.roleType))
      })
    } catch (e) {
      this.setData({ canReview: false })
    }
    this.loadList()
  },

  async loadList() {
    if (!isLoggedIn()) return
    wx.showNavigationBarLoading()
    try {
      const raw = await listApply(this.data.applyStatus)
      this.setData({
        list: (raw || []).map((a) => ({
          ...a,
          timeText: a.createTime ? formatDate(a.createTime, 'MM-DD HH:mm') : '',
          isMine: String(a.userId) === String(currentUserId())
        }))
      })
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    } finally {
      wx.hideNavigationBarLoading()
    }
  },

  onStatusChange(e) {
    const key = e.currentTarget.dataset.key
    const opt = this.data.statusOptions.find((o) => o.key === key)
    this.setData({
      statusKey: key || 'all',
      applyStatus: opt ? opt.id : null
    })
    this.loadList()
  },

  async onApprove(e) {
    if (!requireLogin()) return
    const id = e.currentTarget.dataset.id
    try {
      await reviewApply({
        applyId: id,
        reviewStatus: APPLY_STATUS.APPROVED
      })
      wx.showToast({ title: '已通过', icon: 'success' })
      this.loadList()
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  },

  onReject(e) {
    if (!requireLogin()) return
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '拒绝申请',
      editable: true,
      placeholderText: '拒绝原因（选填）',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await reviewApply({
            applyId: id,
            reviewStatus: APPLY_STATUS.REJECTED,
            reviewRemark: (res.content || '').trim()
          })
          wx.showToast({ title: '已拒绝', icon: 'success' })
          this.loadList()
        } catch (err) {
          wx.showToast({ title: err.message || '操作失败', icon: 'none' })
        }
      }
    })
  },

  onCancel(e) {
    if (!requireLogin()) return
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '取消申请',
      content: '确定取消这条入群申请？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await cancelApply(id)
          wx.showToast({ title: '已取消', icon: 'success' })
          this.loadList()
        } catch (err) {
          wx.showToast({ title: err.message || '取消失败', icon: 'none' })
        }
      }
    })
  }
})
