// blockchain.js

function sha256Hex(input) {
  return sha256(input);
}

class Block {
  constructor(index, timestamp, data, previousHash = "", nonce = 0) {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data; // treatment record object
    this.previousHash = previousHash;
    this.nonce = nonce;
    this.hash = this.computeHash();
  }
  computeHash() {
    const payload = JSON.stringify({
      index: this.index,
      timestamp: this.timestamp,
      data: this.data,
      previousHash: this.previousHash,
      nonce: this.nonce
    });
    return sha256Hex(payload);
  }
}

class Blockchain {
  constructor(storageKey = "simple_chain_qr") {
    this.storageKey = storageKey;
    this.chain = [];
    this.load();
    if (this.chain.length === 0) {
      this.chain.push(this.createGenesisBlock());
      this.persist();
    }
  }
  createGenesisBlock() {
    return new Block(0, new Date().toISOString(), { genesis: true }, "0");
  }
  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }
  addBlock(data) {
    const prev = this.getLatestBlock();
    const newBlock = new Block(prev.index + 1, new Date().toISOString(), data, prev.hash);
    if (!this.isNewBlockValid(newBlock, prev)) throw new Error("Invalid block");
    this.chain.push(newBlock);
    this.persist();
    return newBlock;
  }
  isNewBlockValid(block, prev) {
    if (block.previousHash !== prev.hash) return false;
    if (block.hash !== block.computeHash()) return false;
    if (block.index !== prev.index + 1) return false;
    return true;
  }
  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const curr = this.chain[i];
      const prev = this.chain[i - 1];
      if (curr.hash !== curr.computeHash()) return false;
      if (curr.previousHash !== prev.hash) return false;
    }
    return true;
  }
  persist() { localStorage.setItem(this.storageKey, JSON.stringify(this.chain)); }
  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) { this.chain = []; return; }
      const arr = JSON.parse(raw);
      this.chain = arr.map(
        (b) =>
          Object.assign(new Block(b.index, b.timestamp, b.data, b.previousHash, b.nonce), {
            hash: b.hash
          })
      );
    } catch {
      this.chain = [];
    }
  }
  clear() {
    localStorage.removeItem(this.storageKey);
    this.chain = [this.createGenesisBlock()];
    this.persist();
  }
}

window.SimpleChain = { Blockchain };
