import { REACT_TEXT } from './constants'
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
  if (!newDOM) return
  container.appendChild(newDOM)
}
function createDOM(vdom) {
  let { type, props, ref } = vdom
  let dom //真实DOM元素
  if (type === REACT_TEXT) {
    dom = document.createTextNode(props) //props是个字符串，不是一个DOM节点
  } else if (typeof type === 'function') {
    if (type.isReactComponent) {
      return mountClassComponent(vdom)
    } else {
      // 挂载函数组件
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

// 多个子元素时拆分处理
function reconcileChildren(children, parentDOM) {
  for (let index = 0; index < children.length; index++) {
    children[index].mountIndex = index
    mount(children[index], parentDOM)
  }
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
      // 绑定事件
      dom[key.toLowerCase()] = newProps[key]
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
  if (!renderVdom) return null
  vdom.oldRenderVdom = renderVdom
  return createDOM(renderVdom)
}

function mountClassComponent(vdom) {
  let { type, props } = vdom
  let classInstance = new type(props) // type为类组件函数类，创建类实例
  let renderVdom = classInstance.render()
  classInstance.oldRenderVdom = renderVdom
  let dom = createDOM(renderVdom)
  return dom
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
export function compareTowVdom(parentDOM, oldVdom, newVdom) {
  let oldDOM = findDOM(oldVdom)
  let newDOM = createDOM(newVdom)
  parentDOM.replaceChild(newDOM, oldDOM)
}

const ReactDOM = {
  render,
  createPortal: render,
}
export default ReactDOM
