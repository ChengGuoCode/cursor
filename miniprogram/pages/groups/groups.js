const { getGroups, selectGroup } = require('../../api/group')
const { isLoggedIn, requireLogin } = require('../../utils/auth')
const { toastError } = require('../../utils/request')
const {
  findMyMember,
  roleTypeLabel,
  GROUP_STATUS,
  normalizeGroup
} = require('../../utils/group-map')
const { applyScopePreference } = require('../../utils/scope-store')

function currentUserId() {
  const user = (getApp().globalData && getApp().globalData.userInfo) || {}
  return user.id || user.userId || ''
}

/**
 * list 可能不带成员；select 会返回当前群完整 groupMembers。
 * 把 select 的成员集合合并进对应列表项，人数用集合长度。
 */
function mergeCurrentGroupMembers(groups, current) {
  if (!current || current.groupId == null) return groups || []
  const list = groups || []
  const cur = normalizeGroup(current) || current
  const members = cur.groupMembers || []
  const idx = list.findIndex((g) => String(g.groupId) === String(cur.groupId))

  if (idx < 0) {
    return [cur, ...list]
  }

  if (!members.length && (list[idx].groupMembers || []).length) {
    return list
  }

  const next = list.slice()
  next[idx] = {
    ...list[idx],
    ...cur,
    groupMembers: members,
    memberCount: members.length,
    inviteCode: cur.inviteCode || list[idx].inviteCode
  }
  return next
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
      let groups = (list || []).filter((g) => Number(g.status) !== GROUP_STATUS.DISSOLVED)
      groups = mergeCurrentGroupMembers(groups, current)

      if (current && current.groupId != null) {
        getApp().globalData.currentGroupId = current.groupId
      }
      const scope = applyScopePreference(groups)

      this.setData({
        guestMode: false,
        currentGroupId: scope.currentGroupId,
        groups: groups.map((g) => {
          const mine = findMyMember(g, uid)
          const memberCount = Array.isArray(g.groupMembers) ? g.groupMembers.length : 0
          return {
            ...g,
            memberCount,
            roleLabel: mine ? roleTypeLabel(mine.roleType) : '',
            isCurrent:
              scope.currentGroupId != null &&
              String(g.groupId) === String(scope.currentGroupId)
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
