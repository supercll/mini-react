import { REACT_TEXT, REACT_FRAGMENT } from './utils'
import { addEvent } from './event'
import { REACT_FORWARD_REF } from './element'
import { MOVE, PLACEMENT, DELETE } from './flags'
/**
 * 需要把虚拟DOM转换成真实DOM并且插入容器中
 * @param {*} vdom 虚拟DOM
 * @param {*} container 容器
 */
function render(vdom, container) {
  mount(vdom, container)
}
function mount(vdom, container) {
  let newDOM = createDOM(vdom)
  container.appendChild(newDOM)
}

function createDOM(vdom) {
  let { type, props, ref } = vdom
  let dom //真实DOM元素
  if (type === REACT_FRAGMENT) {
    dom = document.createDocumentFragment()
  } else if (type && type.$$typeof === REACT_FORWARD_REF) {
    return mountForwardComponent(vdom)
  } else if (type === REACT_TEXT) {
    dom = document.createTextNode(props) //props是个字符串，不是一个DOM节点
  } else if (typeof type === 'function') {
    if (type.isReactComponent) {
      return mountClassComponent(vdom)
    } else {
      return mountFunctionComponent(vdom)
    }
  } else {
    //如果type是一个普通字符串的话，说明它是是一个原生组件div span p
    dom = document.createElement(type)
  }
  if (props) {
    //更新属性 DOM 老属性对象 新属性对象
    updateProps(dom, {}, props)
    //这是指的只有一个儿子的情况
    if (typeof props.children === 'object' && props.children.type) {
      props.children.mountIndex = 0
      mount(props.children, dom)
    } else if (Array.isArray(props.children)) {
      reconcileChildren(props.children, dom)
    }
  }
  //在创建真实DOM的，把虚拟DOM和真实DOM进行关联
  vdom.dom = dom
  if (ref) ref.current = dom
  return dom
}

function updateProps(dom, oldProps = {}, newProps = {}) {
  for (let key in newProps) {
    if (key === 'children') {
      continue
    } else if (key === 'style') {
      let styleObj = newProps[key]
      for (let attr in styleObj) {
        dom.style[attr] = styleObj[attr]
      }
    } else if (/^on[A-Z].*/.test(key)) {
      //dom[key.toLowerCase()] = newProps[key];
      addEvent(dom, key.toLowerCase(), newProps[key])
    } else {
      //虚拟DOM属性一般来刚好和dom的属性相同的，都是驼峰命名 className
      //dom.className = 'title' setAttribute();
      dom[key] = newProps[key]
    }
  }
}

function mountFunctionComponent(vdom) {
  let { type: FunctionComponent, props } = vdom
  let renderVdom = FunctionComponent(props)
  //先缓存一次渲染出来的虚拟DOM，放置在虚拟DOM上
  vdom.oldRenderVdom = renderVdom
  return createDOM(renderVdom)
}

function mountClassComponent(vdom) {
  let { type: ClassComponent, props, ref } = vdom
  let classInstance = new ClassComponent(props)
  vdom.classInstance = classInstance
  if (ref) ref.current = classInstance
  if (classInstance.componentWillMount) classInstance.componentWillMount()
  let renderVdom = classInstance.render()
  //先缓存一次渲染出来的虚拟DOM，放置在组件实例上
  classInstance.oldRenderVdom = renderVdom
  let dom = createDOM(renderVdom)
  if (classInstance.componentDidMount) classInstance.componentDidMount()
  return dom
}
/**
 *
 * @param {*} vdom
 */
function mountForwardComponent(vdom) {
  let { type, props, ref } = vdom
  let renderVdom = type.render(props, ref)
  vdom.oldRenderVdom = renderVdom
  return createDOM(renderVdom)
}

function reconcileChildren(children, parentDOM) {
  for (let index = 0; index < children.length; index++) {
    children[index].mountIndex = index
    mount(children[index], parentDOM)
  }
}
/**
 * 从虚拟DOM获取真实DOM
 * @param {*} vdom 原生的div=>真实DIV节点,函数组件 oldRenderVdom才可能有真实DOM
 */
export function findDOM(vdom) {
  if (!vdom) return null
  if (vdom.dom) {
    //当vdom对应原生组件的时候，可以返回真实DOM
    return vdom.dom
  } else {
    //如果是类组件或者说函数组件的话
    //vdom.type.isReactComponent
    let renderVdom = vdom.classInstance
      ? vdom.classInstance.oldRenderVdom
      : vdom.oldRenderVdom
    return findDOM(renderVdom)
  }
}
/**
 * 比较 虚拟DOM，更新真实DOM
 * @param {*} parentDOM
 * @param {*} oldVdom
 * @param {*} newVdom
 */
export function compareTwoVdom(parentDOM, oldVdom, newVdom, nextDOM) {
  debugger
  if (!oldVdom && !newVdom) {
    return null
  } else if (oldVdom && !newVdom) {
    //老的有，新的没有，那就是删除
    unmountVdom(oldVdom)
  } else if (!oldVdom && newVdom) {
    let newDOM = createDOM(newVdom) //此处会有一个问题我们后面解决
    if (nextDOM) {
      parentDOM.insertBefore(newDOM, nextDOM)
    } else {
      parentDOM.appendChild(newDOM)
    }
    //老的虚拟DOM存在，并且新的虚拟DOM也存在，并且类型相同，是一个函数组件或者是同一个类组件
  } else if (oldVdom && newVdom && oldVdom.type !== newVdom.type) {
    unmountVdom(oldVdom)
    let newDOM = createDOM(newVdom) //此处会有一个问题我们后面解决
    if (nextDOM) {
      parentDOM.insertBefore(newDOM, nextDOM)
    } else {
      parentDOM.appendChild(newDOM)
    }
  } else {
    //老节点存在，新节点也存在，类似也一样，我们进行深度的DOM-DIFF过程
    updateElement(oldVdom, newVdom)
  }
}
function updateElement(oldVdom, newVdom) {
  if (oldVdom.type === REACT_FRAGMENT) {
    let currentDOM = (newVdom.dom = findDOM(oldVdom))
    updateChildren(currentDOM, oldVdom.props.children, newVdom.props.children)
  } else if (oldVdom.type === REACT_TEXT) {
    //如果新老节点都是文本节点的话
    let currentDOM = (newVdom.dom = findDOM(oldVdom))
    if (oldVdom.props !== newVdom.props) {
      currentDOM.textContent = newVdom.props
    }
  } else if (typeof oldVdom.type === 'string') {
    //就是原生节点
    let currentDOM = (newVdom.dom = findDOM(oldVdom))
    updateProps(currentDOM, oldVdom.props, newVdom.props)
    updateChildren(currentDOM, oldVdom.props.children, newVdom.props.children)
  } else if (typeof oldVdom.type === 'function') {
    if (oldVdom.type.isReactComponent) {
      updateClassComponent(oldVdom, newVdom)
    } else {
      updateFunctionComponent(oldVdom, newVdom)
    }
  }
}
function updateClassComponent(oldVdom, newVdom) {
  const classInstance = (newVdom.classInstance = oldVdom.classInstance)
  if (classInstance.componentWillReceiveProps) {
    classInstance.componentWillReceiveProps(newVdom.props) //组件将要接收到新的属性
  }
  classInstance.updater.emitUpdate(newVdom.props)
}
function updateFunctionComponent(oldVdom, newVdom) {
  let currentDOM = findDOM(oldVdom)
  if (!currentDOM) return
  let parentDOM = currentDOM.parentNode
  const { type, props } = newVdom
  let newRenderVdom = type(props)
  compareTwoVdom(parentDOM, oldVdom.oldRenderVdom, newRenderVdom)
  newVdom.oldRenderVdom = newRenderVdom
}
function updateChildren(parentDOM, oldVChildren, newVChildren) {
  oldVChildren = Array.isArray(oldVChildren) ? oldVChildren : [oldVChildren]
  newVChildren = Array.isArray(newVChildren) ? newVChildren : [newVChildren]

  let lastPlacedIndex = -1 //上一次不需要移动的老节点的挂载索引
  let keyedOldMap = {} // 设置老结点索引map
  oldVChildren.forEach((oldVChild, index) => {
    let oldKey = oldVChild.key ? oldVChild.key : index
    keyedOldMap[oldKey] = oldVChild
  })
  let patch = []
  newVChildren.forEach((newVChild, index) => {
    newVChild.mountIndex = index //直接重置为新的挂载索引
    let newKey = newVChild.key ? newVChild.key : index
    let oldVChild = keyedOldMap[newKey] // 通过新dom的key找到老dom结点
    //说明找到了此key对应的老节节点
    if (oldVChild) {
      updateElement(oldVChild, newVChild) //递归更新虚拟DOM

      if (oldVChild.mountIndex < lastPlacedIndex) {
        // 如果当前老结点的挂载结点小于上一个不需要移动的挂载结点，说明这个老的dom结点应该插入在这之前
        patch.push({
          type: MOVE,
          oldVChild,
          newVChild,
          mountIndex: index,
        })
      }
      delete keyedOldMap[newKey]
      lastPlacedIndex = Math.max(lastPlacedIndex, oldVChild.mountIndex) // 更新不需要移动的挂载结点
    } else {
      // 找不到老结点，就是新增的dom
      patch.push({
        type: PLACEMENT,
        newVChild,
        mountIndex: index,
      })
    }
  })
  console.log(patch)
  //获取需要移动的节点
  let moveVChild = patch
    .filter(action => action.type === MOVE)
    .map(action => action.oldVChild)
  //没有复用到的老节点 ABCDEF
  Object.values(keyedOldMap)
    .concat(moveVChild)
    .forEach(oldVChild => {
      let currentDOM = findDOM(oldVChild)
      currentDOM.remove()
    })
  //[A,C,E]
  patch.forEach(action => {
    let { type, oldVChild, newVChild, mountIndex } = action
    let childNodes = parentDOM.childNodes //现在删除元素的真实DOM节点
    if (type === PLACEMENT) {
      let newDOM = createDOM(newVChild)
      let childNode = childNodes[mountIndex]
      if (childNode) {
        parentDOM.insertBefore(newDOM, childNode)
      } else {
        parentDOM.appendChild(newDOM)
      }
    } else if (type === MOVE) {
      let oldDOM = findDOM(oldVChild) //B的真实DOM
      let childNode = childNodes[mountIndex]
      if (childNode) {
        parentDOM.insertBefore(oldDOM, childNode)
      } else {
        parentDOM.appendChild(oldDOM)
      }
    }
  })
}
function unmountVdom(vdom) {
  const { type, props, ref } = vdom
  const currentDOM = findDOM(vdom)
  if (vdom.classInstance && vdom.classInstance.componentWillUnmount) {
    vdom.classInstance.componentWillUnmount()
  }
  if (ref) {
    ref.current = null
  }
  if (props.children) {
    let children = Array.isArray(props.children)
      ? props.children
      : [props.children]
    children.forEach(unmountVdom)
  }
  if (currentDOM) currentDOM.remove()
}
const ReactDOM = {
  render,
}
export default ReactDOM
