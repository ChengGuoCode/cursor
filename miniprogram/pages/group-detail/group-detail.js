const {
  selectGroup,
  updateGroup,
  updateMemberName,
  exitGroup,
  listApply
} = require('../../api/group')
const { getProfile } = require('../../api/user')
const { isLoggedIn, requireLogin } = require('../../utils/auth')
const { toastError } = require('../../utils/request')
const { syncScopeAfterGroupChange } = require('../../utils/scope-store')
const {
  ROLE_TYPE,
  MEMBER_STATUS,
  GROUP_STATUS,
  APPLY_STATUS,
  normalizeGroup,
  findMyMember,
  resolveMyRoleType,
  isOwner: checkIsOwner,
  canReview
} = require('../../utils/group-map')

function readUserId(user) {
  if (!user || typeof user !== 'object') return ''
  if (user.userId != null && user.userId !== '') return user.userId
  if (user.id != null && user.id !== '') return user.id
  if (user.user_id != null && user.user_id !== '') return user.user_id
  return ''
}

function isActiveMember(m) {
  // 后端可能返回 status: null，视为在群正常
  return m.status == null || Number(m.status) === MEMBER_STATUS.NORMAL
}

Page({
  data: {
    groupId: null,
    group: null,
    members: [],
    myRoleType: null,
    isOwner: false,
    canManage: false,
    hasPendingApply: false,
    loading: true,
    empty: false
  },

  onLoad(query) {
    const groupId = query.groupId || ''
    this.setData({ groupId: groupId || null })
    // 本页实例只允许一次 select；改昵称等变更禁止再请求
    this._selectConsumed = false
    this._selectEpoch = 0
    this._pendingApplyFetched = false
    this._refreshPendingOnShow = false
    this._modalOpen = false
    this.loadDetailOnce()
  },

  onShow() {
    // showModal 关闭也会进 onShow：此处绝不请求 select
    if (this._modalOpen) {
      this._modalOpen = false
      return
    }

    const cache = getApp().globalData.groupDetailCache
    if (cache && String(cache.groupId) === String(this.data.groupId)) {
      this.applyGroupView(cache, { merge: true })
      getApp().globalData.groupDetailCache = null
    }

    // 从「入群申请」返回时再刷一次待审红点（listApply，不是 select）
    if (this._refreshPendingOnShow && this.data.canManage) {
      this._refreshPendingOnShow = false
      this.refreshPendingApplyBadge(this.data.groupId)
    }
  },

  onHide() {
    // 标记可能由 showModal 引起，避免误判为需要刷新详情
  },

  /**
   * 用 GroupDTO 填充详情。merge=true 时保留本地已有成员等字段，避免变更接口缺字段把页面掏空。
   */
  applyGroupView(rawGroup, { merge = false } = {}) {
    const prev = this.data.group
    let incoming = rawGroup
    if (merge && prev && rawGroup && typeof rawGroup === 'object') {
      const hasMembers =
        Array.isArray(rawGroup.groupMembers) && rawGroup.groupMembers.length > 0
      incoming = {
        ...prev,
        ...rawGroup,
        groupMembers: hasMembers ? rawGroup.groupMembers : prev.groupMembers
      }
    }

    const group = normalizeGroup(incoming)
    if (!group) {
      // 变更回填失败时不清空已有详情，避免触发用户重新进页再次 select
      if (prev) return { group: prev, manage: this.data.canManage }
      this.setData({
        group: null,
        members: [],
        empty: true,
        loading: false,
        isOwner: false,
        canManage: false
      })
      return null
    }

    const uid = readUserId(getApp().globalData.userInfo)
    const myRoleType = resolveMyRoleType(group, uid)
    const owner = checkIsOwner(myRoleType)
    const manage = canReview(myRoleType)
    const members = (group.groupMembers || [])
      .filter(isActiveMember)
      .sort((a, b) => (a.sortNo || 0) - (b.sortNo || 0) || (a.roleType || 0) - (b.roleType || 0))

    this.setData({
      group,
      groupId: group.groupId != null ? group.groupId : this.data.groupId,
      members,
      myRoleType,
      isOwner: owner,
      canManage: manage,
      empty: false,
      loading: false
    })

    if (!manage) {
      this.setData({ hasPendingApply: false })
    }
    return { group, manage }
  },

  /**
   * 进入详情仅调用一次 select。之后改昵称/update 等不得再走此方法。
   */
  async loadDetailOnce() {
    if (this._selectConsumed) {
      console.warn('[group-detail] select already consumed, skip')
      return
    }
    this._selectConsumed = true
    const epoch = ++this._selectEpoch

    if (!isLoggedIn()) {
      this.setData({
        group: null,
        members: [],
        loading: false,
        empty: true,
        isOwner: false,
        canManage: false,
        hasPendingApply: false
      })
      return
    }

    this.setData({ loading: true })
    wx.showNavigationBarLoading()
    try {
      const groupId = this.data.groupId
      const [profile, group] = await Promise.all([
        getProfile().catch(() => null),
        selectGroup(groupId).catch(() => null)
      ])

      // 改昵称等已用更新结果回填：丢弃过期的 select 响应
      if (epoch !== this._selectEpoch) {
        console.warn('[group-detail] stale select response dropped')
        return
      }

      if (profile) {
        getApp().globalData.userInfo = profile
      }

      const view = this.applyGroupView(group)

      if (view && view.manage && !this._pendingApplyFetched) {
        this._pendingApplyFetched = true
        await this.refreshPendingApplyBadge(view.group.groupId)
      }
    } catch (err) {
      if (epoch !== this._selectEpoch) return
      toastError(err, '加载失败')
      this.setData({
        loading: false,
        empty: true,
        isOwner: false,
        canManage: false,
        hasPendingApply: false
      })
    } finally {
      wx.hideNavigationBarLoading()
    }
  },

  async refreshPendingApplyBadge(groupId) {
    if (groupId == null || groupId === '') {
      this.setData({ hasPendingApply: false })
      return
    }
    try {
      const list = await listApply({
        groupId,
        applyStatus: APPLY_STATUS.PENDING_APPROVAL
      })
      this.setData({ hasPendingApply: (list || []).length > 0 })
    } catch (e) {
      this.setData({ hasPendingApply: false })
    }
  },

  /** update / updateMemberName 成功后用返回体刷新；抬高 epoch 作废在途 select */
  applyMutationResult(updated) {
    this._selectEpoch += 1
    this._selectConsumed = true
    if (!updated || typeof updated !== 'object') return false
    this.applyGroupView(updated, { merge: true })
    return true
  },

  /**
   * 无完整 GroupDTO 时仅本地改自己的昵称（仍不请求 select）
   */
  patchMyMemberName(memberName) {
    this._selectEpoch += 1
    this._selectConsumed = true
    const uid = readUserId(getApp().globalData.userInfo)
    const group = this.data.group
    if (!group) return
    const members = (this.data.members || []).map((m) => {
      if (String(m.userId) === String(uid)) {
        return {
          ...m,
          memberName,
          avatarText: (memberName || '?').slice(0, 1)
        }
      }
      return m
    })
    const groupMembers = (group.groupMembers || []).map((m) => {
      if (String(m.userId) === String(uid)) {
        return { ...m, memberName }
      }
      return m
    })
    this.setData({
      members,
      group: { ...group, groupMembers }
    })
  },

  onEditMyName() {
    if (!requireLogin()) return
    const mine = findMyMember(this.data.group, readUserId(getApp().globalData.userInfo))
    this._modalOpen = true
    wx.showModal({
      title: '修改群昵称',
      editable: true,
      placeholderText: '输入群内昵称',
      content: (mine && mine.memberName) || '',
      success: async (res) => {
        if (!res.confirm) {
          this._modalOpen = false
          return
        }
        const memberName = (res.content || '').trim()
        if (!memberName) {
          this._modalOpen = false
          wx.showToast({ title: '昵称不能为空', icon: 'none' })
          return
        }
        try {
          const groupId =
            this.data.groupId || (this.data.group && this.data.group.groupId)
          // 先作废任何在途 select，再只用 updateMemberName 回填
          this._selectEpoch += 1
          this._selectConsumed = true
          const updated = await updateMemberName(groupId, memberName)
          if (!this.applyMutationResult(updated)) {
            this.patchMyMemberName(memberName)
          }
          wx.showToast({ title: '已更新', icon: 'success' })
        } catch (err) {
          toastError(err, '更新失败')
        } finally {
          this._modalOpen = false
        }
      },
      fail: () => {
        this._modalOpen = false
      }
    })
  },

  copyInvite() {
    const code = this.data.group && this.data.group.inviteCode
    if (!code) {
      wx.showToast({ title: '暂无邀请码', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: String(code),
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'success' })
    })
  },

  /**
   * 组装 update 入参。
   * 刷新邀请码：inviteCode 传空；其它更新：带上旧邀请码。
   */
  buildUpdatePayload(extra = {}, { refreshInvite = false } = {}) {
    const group = this.data.group
    if (!group) return null
    const payload = {
      groupId: group.groupId,
      ...extra
    }
    if (refreshInvite) {
      payload.inviteCode = ''
    } else {
      payload.inviteCode = group.inviteCode || ''
    }
    return payload
  },

  async onRefreshInvite() {
    if (!requireLogin() || !this.data.isOwner) return
    const group = this.data.group
    if (!group) return
    wx.showModal({
      title: '刷新邀请码',
      content: '刷新后旧邀请码将失效，确认继续？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const updated = await updateGroup(
            this.buildUpdatePayload(
              { groupName: group.groupName },
              { refreshInvite: true }
            )
          )
          this.applyMutationResult(updated)
          wx.showToast({ title: '已刷新', icon: 'success' })
        } catch (err) {
          toastError(err, '刷新失败')
        }
      }
    })
  },

  onSetBudget() {
    if (!requireLogin('设置预算前请先登录') || !this.data.canManage) return
    const group = this.data.group
    if (!group || group.groupId == null) {
      wx.showToast({ title: '缺少群组信息', icon: 'none' })
      return
    }
    const name = encodeURIComponent(group.groupName || '')
    wx.navigateTo({
      url: `/pages/budget/budget?scopeType=2&groupId=${group.groupId}&groupName=${name}`
    })
  },

  onRename() {
    if (!requireLogin() || !this.data.isOwner) return
    const group = this.data.group
    wx.showModal({
      title: '修改群名称',
      editable: true,
      placeholderText: group.groupName || '',
      content: group.groupName || '',
      success: async (res) => {
        if (!res.confirm) return
        const groupName = (res.content || '').trim()
        if (!groupName) {
          wx.showToast({ title: '名称不能为空', icon: 'none' })
          return
        }
        try {
          const updated = await updateGroup(this.buildUpdatePayload({ groupName }))
          this.applyMutationResult(updated)
          wx.showToast({ title: '已更新', icon: 'success' })
        } catch (err) {
          toastError(err, '更新失败')
        }
      }
    })
  },

  onMemberAction(e) {
    if (!this.data.isOwner) return
    const index = Number(e.currentTarget.dataset.index)
    const member = this.data.members[index]
    if (!member) return
    if (String(member.userId) === String(readUserId(getApp().globalData.userInfo))) {
      wx.showToast({ title: '不能操作自己', icon: 'none' })
      return
    }

    const items = []
    const actions = []

    if (Number(member.roleType) === ROLE_TYPE.MEMBER) {
      items.push('升为管理员')
      actions.push('promote')
    }
    if (Number(member.roleType) === ROLE_TYPE.ADMIN) {
      items.push('降为成员')
      actions.push('demote')
    }
    items.push('让出群主')
    actions.push('transfer')
    items.push('移除出群')
    actions.push('remove')

    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        const action = actions[res.tapIndex]
        if (action) this.runMemberAction(action, member)
      }
    })
  },

  async runMemberAction(action, member) {
    const group = this.data.group
    if (!group) return

    try {
      let updated = null
      if (action === 'promote') {
        updated = await updateGroup(
          this.buildUpdatePayload({
            groupMembers: [
              {
                groupMemberId: member.groupMemberId,
                userId: member.userId,
                roleType: ROLE_TYPE.ADMIN,
                status: MEMBER_STATUS.NORMAL
              }
            ]
          })
        )
      } else if (action === 'demote') {
        updated = await updateGroup(
          this.buildUpdatePayload({
            groupMembers: [
              {
                groupMemberId: member.groupMemberId,
                userId: member.userId,
                roleType: ROLE_TYPE.MEMBER,
                status: MEMBER_STATUS.NORMAL
              }
            ]
          })
        )
      } else if (action === 'transfer') {
        const ok = await this.confirmModal('让出群主', `确定将群主转让给「${member.memberName}」？`)
        if (!ok) return
        updated = await updateGroup(
          this.buildUpdatePayload({
            ownerUserId: member.userId,
            groupMembers: [
              {
                groupMemberId: member.groupMemberId,
                userId: member.userId,
                roleType: ROLE_TYPE.OWNER,
                status: MEMBER_STATUS.NORMAL
              }
            ]
          })
        )
      } else if (action === 'remove') {
        const ok = await this.confirmModal('移除成员', `确定移除「${member.memberName}」？`)
        if (!ok) return
        updated = await updateGroup(
          this.buildUpdatePayload({
            groupMembers: [
              {
                groupMemberId: member.groupMemberId,
                userId: member.userId,
                roleType: member.roleType,
                status: MEMBER_STATUS.EXITED
              }
            ]
          })
        )
      }
      this.applyMutationResult(updated)
      wx.showToast({ title: '已更新', icon: 'success' })
    } catch (err) {
      toastError(err, '操作失败')
    }
  },

  confirmModal(title, content) {
    return new Promise((resolve) => {
      wx.showModal({
        title,
        content,
        success: (res) => resolve(!!res.confirm)
      })
    })
  },

  onDissolve() {
    if (!requireLogin() || !this.data.isOwner) return
    wx.showModal({
      title: '解散群组',
      content: '解散后不可恢复，确认解散？',
      confirmColor: '#C45C26',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await updateGroup(
            this.buildUpdatePayload({
              status: GROUP_STATUS.DISSOLVED
            })
          )
          await syncScopeAfterGroupChange()
          wx.showToast({ title: '已解散', icon: 'success' })
          setTimeout(() => {
            wx.switchTab({ url: '/pages/groups/groups' })
          }, 400)
        } catch (err) {
          toastError(err, '解散失败')
        }
      }
    })
  },

  onExit() {
    if (!requireLogin()) return
    if (this.data.isOwner) {
      wx.showToast({ title: '群主请先转让或解散', icon: 'none' })
      return
    }
    wx.showModal({
      title: '退出群组',
      content: '确定退出当前群组？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const groupId =
            this.data.groupId || (this.data.group && this.data.group.groupId)
          await exitGroup(groupId)
          await syncScopeAfterGroupChange()
          wx.showToast({ title: '已退出', icon: 'success' })
          setTimeout(() => {
            wx.switchTab({ url: '/pages/groups/groups' })
          }, 400)
        } catch (err) {
          toastError(err, '退出失败')
        }
      }
    })
  },

  goApplyList() {
    const groupId = this.data.groupId || (this.data.group && this.data.group.groupId) || ''
    // 从申请页返回时允许再刷一次待审红点
    this._refreshPendingOnShow = true
    wx.navigateTo({
      url: `/pages/group-apply/group-apply?groupId=${groupId}`
    })
  }
})
