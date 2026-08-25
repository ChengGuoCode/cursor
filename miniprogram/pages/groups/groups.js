const { getGroups, selectGroup } = require('../../api/group')
const { isLoggedIn, requireLogin } = require('../../utils/auth')
const { toastError } = require('../../utils/request')
const {
  findMyMember,
  roleTypeLabel,
  GROUP_STATUS
} = require('../../utils/group-map')

function currentUserId() {
  const user = (getApp().globalData && getApp().globalData.userInfo) || {}
  return user.id || user.userId || ''
}

Page({
  data: {
    groups: [],
    guestMode: false,
    currentGroupId: null
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    this.loadGroups()
  },

  async loadGroups() {
    if (!isLoggedIn()) {
      this.setData({ groups: [], guestMode: true, currentGroupId: null })
      return
    }

    wx.showNavigationBarLoading()
    try {
      const [{ list }, current] = await Promise.all([
        getGroups(),
        selectGroup().catch(() => null)
      ])
      const uid = currentUserId()
      const currentGroupId = current && current.groupId != null ? current.groupId : null
      if (currentGroupId != null) {
        getApp().globalData.currentGroupId = currentGroupId
      }

      this.setData({
        guestMode: false,
        currentGroupId,
        groups: (list || [])
          .filter((g) => Number(g.status) !== GROUP_STATUS.DISSOLVED)
          .map((g) => {
            const mine = findMyMember(g, uid)
            return {
              ...g,
              roleLabel: mine ? roleTypeLabel(mine.roleType) : '',
              isCurrent: currentGroupId != null && String(g.groupId) === String(currentGroupId)
            }
          })
      })
    } catch (err) {
      if (err && err.code === 401) {
        this.setData({ groups: [], guestMode: true })
      } else {
        toastError(err, '加载失败')
      }
    } finally {
      wx.hideNavigationBarLoading()
    }
  },

  openCreate() {
    if (!requireLogin('新建群组前请先登录')) return
    wx.navigateTo({ url: '/pages/group-create/group-create' })
  },

  openApply() {
    if (!requireLogin('申请加入前请先登录')) return
    wx.navigateTo({ url: '/pages/group-join/group-join' })
  },

  goDetail(e) {
    const groupId = e.currentTarget.dataset.id
    if (groupId == null) return
    getApp().globalData.currentGroupId = groupId
    wx.navigateTo({
      url: `/pages/group-detail/group-detail?groupId=${groupId}`
    })
  },

  goApplyList() {
    if (!requireLogin('查看申请前请先登录')) return
    wx.navigateTo({ url: '/pages/group-apply/group-apply' })
  }
})
