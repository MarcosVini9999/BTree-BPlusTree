class BaseNode extends Observable {
  constructor(fanout) {
    super()
    this.fanout = fanout
    this.keys = []
    this.pointers = []
  }

  clone() {
    const clone = JSON.parse(JSON.stringify(this))
    return clone
  }
}

class BPlusTreeNode extends BaseNode {
  constructor(fanout) {
    super(fanout)
    this.id = uuidv4()
  }

  mostLeftKey() {
    return this.keys[0]
  }

  mostLeftPointer() {
    return this.pointers[0]
  }

  mostRightKey() {
    return this.keys[this.keys.length - 1]
  }

  mostRightPointer() {
    return this.pointers[this.pointers.length - 1]
  }

  isNodeFull() {
    return this.keys.length === this.fanout - 1
  }

  isNodeOverfull() {
    return this.keys.length >= this.fanout
  }

  hasMinimumKeys() {
    const minimumKeys = Math.ceil((this.fanout - 1) / 2)
    return this.keys.length >= minimumKeys
  }

  hasKey(key) {
    return this.keys.includes(key)
  }

  nonNullPointers() {
    return this.pointers.filter(p => p !== null)
  }

  lastNonNullPointer() {
    const validPointers = this.pointers.filter(p => p !== null)
    const lastNonNullPointerIndex = validPointers.length - 1
    return this.pointers[lastNonNullPointerIndex]
  }

  insert(value, pointer, index) {
    this.notifyAll({
      type: 'insertKey',
      data: {
        key: {
          node: this,
          value,
          index,
        },
        pointer,
      },
    })
  }

  delete(value) {
    this.notifyAll({
      type: 'deleteKey',
      data: {
        node: this,
        key: {
          value,
        },
      },
    })
  }

  toJSON() {
    const clone = JSON.parse(
      JSON.stringify({
        id: this.id,
        keys: this.keys,
        pointers: this.pointers,
      }),
    )
    return clone
  }

  /**
   * Sabendo que o nó tem menos que o mínimo de chaves,
   * então o nó é combinado com um de seus irmãos
   */
  redistribute(sibling, parent, k) {
    const predecessorKey = sibling.mostRightKey()
    const predecessorPointer = sibling.mostRightPointer()

    // remova a útima chave do irmão predecessor
    sibling.delete(predecessorKey, predecessorPointer)

    // insira a chave e o ponteiro do predecessor no nó
    this.insert(k, predecessorPointer)

    // atualize a chave do pai
    const parentKeyIndex = parent.pointers.findIndex(p => p === this)
    parent.keys[parentKeyIndex] = this.mostLeftKey()
  }

  deleteKey(value) {
    const i = this.keys.findIndex(k => isLowerOrEqual(value, k))

    if (value !== this.keys[i]) return
    this.keys.splice(i, 1)

    this.notifyAll({
      type: 'deleteKey',
      data: {
        node: this,
        key: {
          value,
        },
      },
    })
  }
}

class InternalNode extends BPlusTreeNode {
  constructor(fanout) {
    super(fanout)
  }

  insert(value, pointer) {
    /**
     * Dado o valor e o ponteiro, percorra as chaves do nó
     * até encontrar a posição i em que o valor é menor
     * que alguma das chaves do nó
     */

    const i = this.keys.findIndex(k => isLower(value, k))

    // Caso a chave seja menor que uma das chaves do nó
    // então a chave é inserida na posição i
    // e o ponteiro da posição i é deslocado para a direita

    if (i !== -1) {
      this.keys.splice(i, 0, value)
      this.pointers.splice(i + 1, 0, pointer)
      super.insert(value, pointer, i)
      return
    }

    // Caso a chave seja maior que todas as chaves do nó
    // então a chave é inserida na última posição
    this.keys.push(value)
    this.pointers.push(pointer)
    super.insert(value, pointer, i)
  }

  delete(value) {
    const i = this.keys.findIndex(k => isLowerOrEqual(value, k))

    // Caso a chave seja igual a uma das chaves do nó
    // então a chave é removida da posição i
    // e o ponteiro da chave é removido da posição i + 1
    // Caso a chave seja menor que uma das chaves do nó
    // então a chave não existe no nó
    if (value !== this.keys[i]) return

    this.keys.splice(i, 1)
    this.pointers.splice(i + 1, 1)
    super.delete(value)
  }

  split(rightNode) {
    const middleIndex = Math.ceil(this.fanout / 2)
    const pointersMiddleIndex = Math.ceil((this.fanout + 1) / 2)
    const keysToInsertInRightNode = this.keys.slice(middleIndex)
    const pointersToInsertInRightNode = this.pointers.slice(pointersMiddleIndex)

    keysToInsertInRightNode.forEach((key, index) => {
      const pointer = pointersToInsertInRightNode[index]
      this.delete(key)
      rightNode.insert(key, pointer)
    })

    const k2 = rightNode.mostLeftKey()
    rightNode.deleteKey(k2)
    return k2
  }
}

class LeafNode extends BPlusTreeNode {
  constructor(fanout) {
    super(fanout)
  }

  insert(value, pointer) {
    const i = this.keys.findIndex(k => isLowerOrEqual(value, k))

    // Caso a chave seja menor que uma das chaves do nó
    // então a chave é inserida na posição i
    // e o ponteiro da posição i é deslocado para a direita\
    // Caso a chave seja maior que todas as chaves do nó
    // então o último ponteiro é o nó que contém a chave
    const insertKeyIndex = i !== -1 ? i : this.keys.length
    this.keys.splice(insertKeyIndex, 0, value)
    this.pointers.splice(insertKeyIndex, 0, pointer)
    super.insert(value, pointer, insertKeyIndex)
  }

  delete(value) {
    const i = this.keys.findIndex(k => isLowerOrEqual(value, k))

    // Caso a chave seja igual a uma das chaves do nó
    // então a chave é removida da posição i
    // e o ponteiro da chave é removido da posição i + 1
    // Caso a chave seja menor que uma das chaves do nó
    // então a chave não existe no nó
    if (value !== this.keys[i]) return

    this.keys.splice(i, 1)
    this.pointers.splice(i, 1)
    super.delete(value)
  }

  /**
   * Divide o nó em dois e retorna o nó da direita
   */
  split(rightSibling) {
    const middleIndex = Math.ceil(this.fanout / 2)
    const keysRightNode = this.keys.slice(middleIndex)
    const pointersRightNode = this.pointers.slice(middleIndex)

    keysRightNode.forEach((key, index) => {
      this.delete(key)
      rightSibling.insert(key, pointersRightNode[index])
    })
  }
}
