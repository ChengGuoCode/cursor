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
  findMyMember,
  resolveMyRoleType
} = require('../../utils/group-map')
const { formatDate } = require('../../utils/format')

function currentUserId() {
  const user = (getApp().globalData && getApp().globalData.userInfo) || {}
  return user.id || user.userId || ''
}

Page({
  data: {
    /** 仅群详情入口会带上；群组页入口为空 */
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
    // 只有路由显式带 groupId 才按群过滤，避免群组页误带上全局当前群
    const raw = query && query.groupId
    const groupId = raw != null && raw !== '' ? raw : null
    this.setData({ groupId })
    this._roleInited = false
  },

  onShow() {
    this.bootstrap()
  },

  async bootstrap() {
    if (!isLoggedIn()) {
      this.setData({ list: [], guestMode: true, canReview: false })
      return
    }

    const groupId = this.data.groupId

    // 权限只在首次进入时用 select 判定；之后 review 用返回 GroupDTO 写缓存，不再 select
    if (!this._roleInited) {
      let canReviewFlag = false
      try {
        if (groupId != null && groupId !== '') {
          const group = await selectGroup(groupId).catch(() => null)
          const role = resolveMyRoleType(group, currentUserId())
          canReviewFlag = canReview(role)
          if (!canReviewFlag) {
            const mine = findMyMember(group, currentUserId())
            canReviewFlag = !!(mine && canReview(mine.roleType))
          }
        } else {
          canReviewFlag = true
        }
        this.setData({ guestMode: false, canReview: canReviewFlag })
        this._roleInited = true
      } catch (e) {
        this.setData({ canReview: false })
      }
    } else {
      this.setData({ guestMode: false })
    }

    this.loadList()
  },

  async loadList() {
    if (!isLoggedIn()) return
    wx.showNavigationBarLoading()
    try {
      const params = { applyStatus: this.data.applyStatus }
      if (this.data.groupId != null && this.data.groupId !== '') {
        params.groupId = this.data.groupId
      }
      const raw = await listApply(params)
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

  /** review 返回 GroupDTO，写入缓存供详情页回填，不再 select */
  cacheReviewedGroup(updated) {
    if (updated && updated.groupId != null) {
      getApp().globalData.groupDetailCache = updated
    }
  },

  async onApprove(e) {
    if (!requireLogin()) return
    const id = e.currentTarget.dataset.id
    try {
      const updated = await reviewApply({
        applyId: id,
        reviewStatus: APPLY_STATUS.APPROVED
      })
      this.cacheReviewedGroup(updated)
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
          const updated = await reviewApply({
            applyId: id,
            reviewStatus: APPLY_STATUS.REJECTED,
            reviewRemark: (res.content || '').trim()
          })
          this.cacheReviewedGroup(updated)
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
