const BigNumber = require('big-number')
const VouchPacket = require('./protocols').VouchPacket
const uuid = require('uuid/v4')

class Voucher {
  constructor (main) {
    this.main = main
    this.vouchableAddresses = []
    this.vouchablePeers = []
    this.vouchingMap = {}
  }

  onPlugin (prefix) {
    const plugin = this.main.getPlugin(prefix)
    if (plugin.isPrivate) {
      const peerLedger = plugin.getInfo().prefix
      // auto-vouch all existing ledger VirtualPeers -> BTP peer
      this.addVouchablePeer(peerLedger)
    } else {
      // auto-vouch ledger VirtualPeer -> all existing BTP peers
      this.addVouchableAddress(plugin.getAccount())
      // and add the plugin ledger as a destination in to the routing table:
    }
  }

  addVouchablePeer (peerLedger) {
    this.vouchablePeers.push(peerLedger)
    return Promise.all(this.vouchableAddresses.map(address => {
      return this.vouchBothWays(peerLedger, address)
    }))
  }

  addVouchableAddress (address) {
    this.vouchableAddresses.push(address)
    return Promise.all(this.vouchablePeers.map(peerLedger => {
      return this.vouchBothWays(peerLedger, address)
    }))
  }

  checkVouch (fromAddress, amount) {
    if (!this.vouchingMap[fromAddress]) {
      return Promise.resolve(false)
    }
    return this.main.plugins[this.vouchingMap[fromAddress]].getBalance().then(balance => {
      return new BigNumber(balance).gte(amount)
    })
  }

  vouchBothWays (peerLedger, address) {
    [VouchPacket.VOUCH, VouchPacket.REACHME].map(callId => {
      this.main.plugins[peerLedger].sendRequest({
        id: uuid(),
        custom: {
          vouch: VouchPacket.serialize({ callId, address }).toString('base64')
        }
      })
    })
  }
}

module.exports = Voucher
