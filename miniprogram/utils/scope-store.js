/**
 * 概览/账单 scopeType 全局偏好。
 * 规则：已加入群组时默认群组(2)；用户手动切个人则本会话记住；无群组强制个人。
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
 * @returns {{ scopeType: number, scopeLabel: string, currentGroupId: *, groupIndex: number }}
 */
function applyScopePreference(groupList = []) {
  const app = getAppSafe()
  const list = groupList || []

  if (!app) {
    return {
      scopeType: SCOPE_TYPE.PERSONAL,
      scopeLabel: '个人',
      currentGroupId: null,
      groupIndex: 0
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
      groupIndex: 0
    }
  }

  // 已加入群组：默认群组；仅当用户主动切过个人时保持个人
  if (!app.globalData.scopePreferPersonal) {
    app.globalData.scopeType = SCOPE_TYPE.GROUP
  } else {
    app.globalData.scopeType = SCOPE_TYPE.PERSONAL
  }

  let currentGroupId = app.globalData.currentGroupId
  let groupIndex = list.findIndex((g) => String(g.groupId) === String(currentGroupId))
  if (groupIndex < 0) {
    groupIndex = 0
    currentGroupId = list[0].groupId
  }
  app.globalData.currentGroupId = currentGroupId

  const scopeType = normalizeScopeType(app.globalData.scopeType)
  return {
    scopeType,
    scopeLabel: scopeTypeLabel(scopeType),
    currentGroupId,
    groupIndex
  }
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

/** 创建/加入群组成功：概览与账单默认切到群组 */
function preferGroupScopeAfterJoin(groupId) {
  return setGlobalScopeType(SCOPE_TYPE.GROUP, { groupId })
}

module.exports = {
  applyScopePreference,
  setGlobalScopeType,
  preferGroupScopeAfterJoin
}
