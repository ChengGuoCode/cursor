/**
 * 运行环境配置（不依赖 getApp，避免启动竞态下拼出相对路径）。
 * app.js / 我的页切换 Mock 时通过 setEnv 同步。
 */

const env = {
  useMock: false,
  apiBaseUrl: 'http://127.0.0.1:9095'
}

function getEnv() {
  // 若 App 已就绪，以 globalData 为准（支持运行时切换）
  try {
    const app = getApp()
    if (app && app.globalData) {
      if (typeof app.globalData.useMock === 'boolean') {
        env.useMock = app.globalData.useMock
      }
      if (app.globalData.apiBaseUrl) {
        env.apiBaseUrl = String(app.globalData.apiBaseUrl)
      }
    }
  } catch (e) {
    /* App 未就绪时用模块内默认值 */
  }
  return env
}

function setEnv(partial = {}) {
  if (typeof partial.useMock === 'boolean') env.useMock = partial.useMock
  if (partial.apiBaseUrl) env.apiBaseUrl = String(partial.apiBaseUrl)
  return env
}

module.exports = {
  getEnv,
  setEnv
}
