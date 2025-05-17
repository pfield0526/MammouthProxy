/**
 * Mammouth账号管理器
 * 提供Cookie轮换功能
 */

class AccountManager {
  constructor(cookies) {
    this.cookies = this.initCookies(cookies)
    this.unavailableCookies = new Set()
    this.currentIndex = 0
    this.unlimitedIndex = 0
  }
  
  markAsUnavailable(cookie) {
    this.unavailableCookies.add(cookie)
  }
  
  getNextAvailableCookie() {
    if (this.cookies.length === 0) {
      return null
    }
    
    // 如果所有Cookie都不可用，则返回第一个
    if (this.unavailableCookies.size >= this.cookies.length) {
      return this.cookies[0]
    }
    
    // 尝试查找可用账号
    for (let i = 0; i < this.cookies.length; i++) {
      // 轮换索引
      this.currentIndex = (this.currentIndex + 1) % this.cookies.length
      const cookie = this.cookies[this.currentIndex]
      
      // 如果这个Cookie可用，就返回它
      if (!this.unavailableCookies.has(cookie)) {
        return cookie
      }
    }
    
    // 如果循环结束还没找到，返回第一个Cookie
    return this.cookies[0]
  }
  
  getAnyCookie() {
    if (this.cookies.length === 0) {
      return null
    }
    
    this.unlimitedIndex = (this.unlimitedIndex + 1) % this.cookies.length
    return this.cookies[this.unlimitedIndex]
  }

  initCookies(cookies) {
    return cookies.split(',').map(cookie => cookie.trim()).filter(cookie => cookie)
  }
}


const COOKIES = process.env.COOKIES || ""
const accountManager = new AccountManager(COOKIES)

module.exports = accountManager 