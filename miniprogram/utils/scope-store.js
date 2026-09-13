/**
 * 概览/账单 scopeType 全局偏好。
 * 规则：
 * - 当前有加入的群组 → 默认群组(2)，使用后端当前群
 * - 当前没有加入的群组 → 默认个人(1)
 * - 用户手动切个人后本会话可保持个人（仍有群时）
 */

const {
  SCOPE_TYPE,
  normalizeScopeType,
  scopeTypeLabel
} = require('./bill-map')

function getAppSafe() {
  try {
    return getApp()
  } catch (e) {
    return null
  }
}

/**
 * 根据群组列表同步 globalData.scopeType / currentGroupId
 * @param {Array} groupList
 * @param {{ currentGroupId?: * }} [options]
 * @returns {{ scopeType: number, scopeLabel: string, currentGroupId: *, groupIndex: number, currentGroupName: string }}
 */
function applyScopePreference(groupList = [], options = {}) {
  const app = getAppSafe()
  const list = groupList || []

  if (!app) {
    return {
      scopeType: SCOPE_TYPE.PERSONAL,
      scopeLabel: '个人',
      currentGroupId: null,
      groupIndex: 0,
      currentGroupName: ''
    }
  }

  if (!list.length) {
    app.globalData.scopeType = SCOPE_TYPE.PERSONAL
    app.globalData.currentGroupId = null
    app.globalData.scopePreferPersonal = false
    return {
      scopeType: SCOPE_TYPE.PERSONAL,
      scopeLabel: scopeTypeLabel(SCOPE_TYPE.PERSONAL),
      currentGroupId: null,
      groupIndex: 0,
      currentGroupName: ''
    }
  }

  // 有群组：默认群组；仅当用户主动切过个人时保持个人
  if (!app.globalData.scopePreferPersonal) {
    app.globalData.scopeType = SCOPE_TYPE.GROUP
  } else {
    app.globalData.scopeType = SCOPE_TYPE.PERSONAL
  }

  if (options.currentGroupId != null && options.currentGroupId !== '') {
    app.globalData.currentGroupId = options.currentGroupId
  }

  let currentGroupId = app.globalData.currentGroupId
  let groupIndex = list.findIndex((g) => String(g.groupId) === String(currentGroupId))
  if (groupIndex < 0) {
    groupIndex = 0
    currentGroupId = list[0].groupId
  }
  app.globalData.currentGroupId = currentGroupId

  const currentGroup = list[groupIndex] || list[0]
  const scopeType = normalizeScopeType(app.globalData.scopeType)
  return {
    scopeType,
    scopeLabel: scopeTypeLabel(scopeType),
    currentGroupId,
    groupIndex,
    currentGroupName: (currentGroup && currentGroup.groupName) || ''
  }
}

/**
 * 退出/解散群组后重新同步：无群→个人；仍有群→默认当前群
 */
async function syncScopeAfterGroupChange() {
  const app = getAppSafe()
  // 群组成员关系变化后按默认规则重算，不沿用「手动切个人」偏好
  if (app) {
    app.globalData.scopePreferPersonal = false
  }

  const { getGroups, selectGroup } = require('../api/group')
  const { pickActiveGroups } = require('./group-map')
  const { list } = await getGroups()
  let currentGroupId = null
  let currentGroupName = ''

  if (list && list.length) {
    const { newest } = pickActiveGroups(list)
    const selectId =
      (newest && newest.groupId) ||
      (list[0] && list[0].groupId) ||
      null
    if (selectId != null) {
      const current = await selectGroup(selectId).catch(() => null)
      if (current && current.groupId != null) {
        currentGroupId = current.groupId
        currentGroupName = current.groupName || ''
      } else {
        currentGroupId = selectId
        currentGroupName = (newest && newest.groupName) || (list[0] && list[0].groupName) || ''
      }
    }
  }

  const scope = applyScopePreference(list || [], { currentGroupId })
  if (currentGroupName) {
    scope.currentGroupName = currentGroupName
  }
  return scope
}

/**
 * 写入全局 scopeType
 * @param {number} scopeType
 * @param {{ fromUser?: boolean, groupId?: * }} [options]
 */
function setGlobalScopeType(scopeType, options = {}) {
  const app = getAppSafe()
  const next = normalizeScopeType(scopeType)
  if (!app) return next

  app.globalData.scopeType = next
  if (options.fromUser) {
    app.globalData.scopePreferPersonal = next === SCOPE_TYPE.PERSONAL
  } else if (next === SCOPE_TYPE.GROUP) {
    app.globalData.scopePreferPersonal = false
  }
  if (options.groupId != null && options.groupId !== '') {
    app.globalData.currentGroupId = options.groupId
  }
  return next
}

/**
 * 概览/账单/记账共用：当前选中的群组 id。
 * 仅当全局 scope 为群组时有效；个人模式下返回 null（群组页不展示「当前」）。
 */
function getActiveSelectedGroupId() {
  const app = getAppSafe()
  if (!app) return null
  if (normalizeScopeType(app.globalData.scopeType) !== SCOPE_TYPE.GROUP) return null
  const id = app.globalData.currentGroupId
  if (id == null || id === '') return null
  return id
}

/** 选中某个群组（联动概览/账单/记账/群组页「当前」标签） */
function selectGroupScope(groupId, options = {}) {
  if (groupId == null || groupId === '') {
    return setGlobalScopeType(SCOPE_TYPE.PERSONAL, { fromUser: !!options.fromUser })
  }
  return setGlobalScopeType(SCOPE_TYPE.GROUP, {
    fromUser: !!options.fromUser,
    groupId
  })
}

/** 切到个人（群组页不再展示「当前」） */
function selectPersonalScope(options = {}) {
  return setGlobalScopeType(SCOPE_TYPE.PERSONAL, { fromUser: options.fromUser !== false })
}

/** 创建/加入群组成功：概览与账单默认切到群组 */
function preferGroupScopeAfterJoin(groupId) {
  return selectGroupScope(groupId, { fromUser: false })
}

module.exports = {
  applyScopePreference,
  syncScopeAfterGroupChange,
  setGlobalScopeType,
  getActiveSelectedGroupId,
  selectGroupScope,
  selectPersonalScope,
  preferGroupScopeAfterJoin
}
