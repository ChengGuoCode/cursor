const { request, shouldUseMock } = require('../utils/request')
const { mockGroups } = require('../utils/mock')
const {
  normalizeGroup,
  normalizeApply,
  ROLE_TYPE,
  MEMBER_STATUS,
  GROUP_STATUS
} = require('../utils/group-map')

/** POST + query 参数（对接后端 @RequestParam） */
function postWithQuery(path, params = {}, options = {}) {
  const qs = Object.keys(params)
    .filter((k) => params[k] != null && params[k] !== '')
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&')
  const url = qs ? `${path}?${qs}` : path
  return request({
    url,
    method: 'POST',
    data: {},
    forceLoginOnUnauthorized: true,
    ...options
  })
}

function normalizeGroupList(data) {
  let list = []
  if (Array.isArray(data)) list = data
  else if (data && Array.isArray(data.list)) list = data.list
  else if (data && Array.isArray(data.records)) list = data.records
  return list.map(normalizeGroup).filter(Boolean)
}

/**
 * 我的群组列表 — GET /api/group/list
 * 群组页/账单等依赖；失败降级为空列表
 */
function getGroups() {
  if (shouldUseMock()) {
    return Promise.resolve({
      list: mockGroups.map((g) =>
        normalizeGroup({
          groupId: g.id,
          groupName: g.name,
          ownerUserId: 1001,
          inviteCode: 'MOCK01',
          status: GROUP_STATUS.NORMAL,
          groupMembers: [
            {
              groupMemberId: 1,
              groupId: g.id,
              userId: 1001,
              roleType: ROLE_TYPE.OWNER,
              memberName: '阿树',
              status: MEMBER_STATUS.NORMAL
            }
          ]
        })
      )
    })
  }
  return request({ url: '/api/group/list', method: 'GET' })
    .then((data) => ({ list: normalizeGroupList(data) }))
    .catch((err) => {
      console.warn('getGroups failed', err)
      return { list: [] }
    })
}

/**
 * 群组详情（含成员）— GET /api/group/select?groupId=
 * @param {number|string} groupId
 */
function selectGroup(groupId) {
  if (groupId == null || groupId === '') {
    return Promise.reject(new Error('缺少 groupId'))
  }
  if (shouldUseMock()) {
    const g =
      mockGroups.find((item) => String(item.id) === String(groupId)) || mockGroups[0]
    if (!g) return Promise.reject(new Error('暂无群组'))
    return Promise.resolve(
      normalizeGroup({
        groupId: g.id,
        groupName: g.name,
        ownerUserId: 1001,
        inviteCode: 'MOCK01',
        status: GROUP_STATUS.NORMAL,
        groupMembers: [
          {
            groupMemberId: 1,
            groupId: g.id,
            userId: 1001,
            roleType: ROLE_TYPE.OWNER,
            memberName: '阿树',
            status: MEMBER_STATUS.NORMAL,
            sortNo: 1
          },
          {
            groupMemberId: 2,
            groupId: g.id,
            userId: 1002,
            roleType: ROLE_TYPE.MEMBER,
            memberName: '小林',
            status: MEMBER_STATUS.NORMAL,
            sortNo: 2
          }
        ]
      })
    )
  }
  return request({
    url: '/api/group/select',
    method: 'GET',
    data: { groupId }
  }).then(normalizeGroup)
}

/**
 * 创建群组 — POST /api/group/create?groupName=&memberName=
 * @param {{ groupName: string, memberName?: string }} payload
 */
function createGroup(payload = {}) {
  const groupName = (payload.groupName || payload.name || '').trim()
  const memberName = (payload.memberName || '').trim()
  if (shouldUseMock()) {
    const created = normalizeGroup({
      groupId: Date.now(),
      groupName,
      ownerUserId: 1001,
      inviteCode: String(Date.now()).slice(-6),
      status: GROUP_STATUS.NORMAL,
      groupMembers: [
        {
          groupMemberId: Date.now(),
          userId: 1001,
          roleType: ROLE_TYPE.OWNER,
          memberName: memberName || '我',
          status: MEMBER_STATUS.NORMAL
        }
      ]
    })
    mockGroups.unshift({
      id: created.groupId,
      name: groupName,
      coverColor: '#0B3D2E',
      memberCount: 1,
      monthExpense: 0,
      myBalance: 0,
      role: 'owner'
    })
    return Promise.resolve(created)
  }
  return postWithQuery('/api/group/create', {
    groupName,
    memberName: memberName || undefined
  }).then(normalizeGroup)
}

/**
 * 更新群组 — POST /api/group/update（群主）
 * 可改名称、解散、让出群主、刷新邀请码、移除/升降成员
 */
function updateGroup(reqDTO) {
  if (shouldUseMock()) {
    return Promise.resolve(normalizeGroup(reqDTO))
  }
  return request({
    url: '/api/group/update',
    method: 'POST',
    data: reqDTO,
    forceLoginOnUnauthorized: true
  }).then(normalizeGroup)
}

/** 申请列表 — GET /api/group/listApply?groupId=&applyStatus= */
function listApply(options = {}) {
  const groupId = options.groupId
  const applyStatus = options.applyStatus
  if (shouldUseMock()) {
    return Promise.resolve(
      [
        normalizeApply({
          id: 1,
          groupId: mockGroups[0] && mockGroups[0].id,
          userId: 1009,
          nickname: '小新',
          applyMessage: '想一起记账',
          status: 0,
          createTime: new Date().toISOString()
        })
      ].filter((item) => {
        if (groupId != null && groupId !== '' && String(item.groupId) !== String(groupId)) {
          return false
        }
        if (applyStatus != null && applyStatus !== '' && Number(item.status) !== Number(applyStatus)) {
          return false
        }
        return true
      })
    )
  }
  const data = {}
  if (groupId != null && groupId !== '') data.groupId = groupId
  if (applyStatus != null && applyStatus !== '') data.applyStatus = applyStatus
  return request({ url: '/api/group/listApply', method: 'GET', data }).then((list) =>
    (Array.isArray(list) ? list : []).map(normalizeApply).filter(Boolean)
  )
}

/**
 * 申请加入 — POST /api/group/apply?inviteCode=&applyMsg=
 */
function applyGroup({ inviteCode, applyMsg } = {}) {
  if (shouldUseMock()) {
    return Promise.resolve(true)
  }
  return postWithQuery('/api/group/apply', {
    inviteCode: (inviteCode || '').trim(),
    applyMsg: (applyMsg || '').trim() || undefined
  })
}

/** 取消申请 — POST /api/group/cancelApply?applyId= */
function cancelApply(applyId) {
  if (shouldUseMock()) return Promise.resolve(true)
  return postWithQuery('/api/group/cancelApply', { applyId })
}

/**
 * 审核申请 — POST /api/group/review
 * @param {{ applyId: number, reviewStatus: number, reviewRemark?: string }} reqDTO
 */
function reviewApply(reqDTO) {
  if (shouldUseMock()) {
    return Promise.resolve(normalizeGroup(reqDTO))
  }
  return request({
    url: '/api/group/review',
    method: 'POST',
    data: reqDTO,
    forceLoginOnUnauthorized: true
  }).then((data) => (data ? normalizeGroup(data) : data))
}

/** 更新我在群内昵称 — POST /api/group/updateMemberName?groupId=&memberName=
 * 成功返回 GroupDTO（与 select 一致），调用方直接回填，勿再 select
 */
function updateMemberName(groupId, memberName) {
  if (groupId == null || groupId === '') {
    return Promise.reject(new Error('缺少 groupId'))
  }
  const name = (memberName || '').trim()
  if (shouldUseMock()) {
    const g = mockGroups.find((item) => String(item.id) === String(groupId)) || mockGroups[0]
    if (!g) return Promise.reject(new Error('暂无群组'))
    return Promise.resolve(
      normalizeGroup({
        groupId: g.id,
        groupName: g.name,
        ownerUserId: 1001,
        inviteCode: 'MOCK01',
        status: GROUP_STATUS.NORMAL,
        groupMembers: [
          {
            groupMemberId: 1,
            groupId: g.id,
            userId: 1001,
            roleType: ROLE_TYPE.OWNER,
            memberName: name || '阿树',
            status: MEMBER_STATUS.NORMAL,
            sortNo: 1
          }
        ]
      })
    )
  }
  return postWithQuery('/api/group/updateMemberName', {
    groupId,
    memberName: name
  }).then((data) => {
    if (!data) return null
    return normalizeGroup(data)
  })
}

/** 退出群组 — POST /api/group/exit?groupId= */
function exitGroup(groupId) {
  if (groupId == null || groupId === '') {
    return Promise.reject(new Error('缺少 groupId'))
  }
  if (shouldUseMock()) return Promise.resolve(true)
  return postWithQuery('/api/group/exit', { groupId })
}

module.exports = {
  getGroups,
  selectGroup,
  createGroup,
  updateGroup,
  listApply,
  applyGroup,
  cancelApply,
  reviewApply,
  updateMemberName,
  exitGroup
}
