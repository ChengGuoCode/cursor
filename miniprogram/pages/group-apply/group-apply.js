const {
  listApply,
  reviewApply,
  cancelApply,
  selectGroup
} = require('../../api/group')
const { isLoggedIn, requireLogin } = require('../../utils/auth')
const { toastError } = require('../../utils/request')
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
    groupId: null,
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

  onLoad(query) {
    const groupId =
      (query && query.groupId) ||
      (getApp().globalData && getApp().globalData.currentGroupId) ||
      null
    this.setData({ groupId: groupId || null })
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
      const groupId =
        this.data.groupId ||
        (getApp().globalData && getApp().globalData.currentGroupId)
      const group = groupId != null && groupId !== ''
        ? await selectGroup(groupId).catch(() => null)
        : null
      const mine = findMyMember(group, currentUserId())
      this.setData({
        guestMode: false,
        groupId: groupId || null,
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
      toastError(err, '加载失败')
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
      toastError(err, '操作失败')
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
          toastError(err, '操作失败')
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
          toastError(err, '取消失败')
        }
      }
    })
  }
})
