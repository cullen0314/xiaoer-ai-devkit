# useEffect（React）

> 原文：useEffect – React
>
> 来源：https://react.dev/reference/react/useEffect

`useEffect` 是一个 React Hook，它让你能够[将组件与外部系统保持同步](https://react.dev/learn/synchronizing-with-effects)。

```js
useEffect(setup, dependencies?)
```

- [参考](#参考)
  - [`useEffect(setup, dependencies?)`](#useeffectsetup-dependencies)
- [用法](#用法)
  - [连接到外部系统](#连接到外部系统)
  - [将 Effect 封装进自定义 Hook](#将-effect-封装进自定义-hook)
  - [控制非 React 组件](#控制非-react-组件)
  - [使用 Effect 获取数据](#使用-effect-获取数据)
- [排查问题](#排查问题)

---

## 参考

### `useEffect(setup, dependencies?)`

在组件顶层调用 `useEffect`，即可声明一个 Effect：

```js
import { useState, useEffect } from 'react';
import { createConnection } from './chat.js';

function ChatRoom({ roomId }) {
  const [serverUrl, setServerUrl] = useState('https://localhost:1234');

  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.connect();
    return () => {
      connection.disconnect();
    };
  }, [serverUrl, roomId]);

  // ...
}
```

[查看下面的更多示例。](#用法)

#### 参数

- `setup`：包含 Effect 逻辑的函数。你的 setup 函数也可以选择性返回一个 _cleanup_ 清理函数。当你的[组件完成提交](https://react.dev/learn/render-and-commit#step-3-react-commits-changes-to-the-dom)时，React 会执行 setup 函数。每次依赖变化并再次提交后，React 会先用旧值执行 cleanup 函数（如果你提供了），再用新值执行 setup 函数。当组件从 DOM 中移除后，React 还会再执行一次 cleanup 函数。

- **可选** `dependencies`：`setup` 代码中引用的所有响应式值列表。响应式值包括 props、state，以及直接声明在组件函数体中的所有变量和函数。如果你的 linter 已经[配置为支持 React](https://react.dev/learn/editor-setup#linting)，它会校验每个响应式值是否都被正确声明为依赖。依赖列表的元素个数必须固定，并且需要像 `[dep1, dep2, dep3]` 这样内联书写。React 会使用 [`Object.is`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is) 比较每个依赖与上一次的值。如果省略这个参数，Effect 会在组件每次提交后重新执行。[可查看传入依赖数组、空数组以及不传依赖时的差异。](#examples-dependencies)

#### 返回值

`useEffect` 返回 `undefined`。

#### 注意事项

- `useEffect` 是 Hook，因此你只能在**组件顶层**或你自己的 Hook 顶层调用它。不能在循环或条件语句中调用。如果有这类需求，请抽出新组件并把状态移动进去。
- 如果你**并不是在和某个外部系统同步**，那么你[大概率不需要 Effect](https://react.dev/learn/you-might-not-need-an-effect)。
- 在 Strict Mode 下，React 会在首次真正执行 setup 之前，多执行一次**仅开发环境下的 setup + cleanup 循环**。这是一个压力测试，用来确保 cleanup 逻辑能够“镜像” setup 逻辑，并正确停止或撤销 setup 所做的事情。如果这导致问题，请[实现 cleanup 函数](https://react.dev/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development)。
- 如果你的某些依赖是组件内部定义的对象或函数，它们可能会让 Effect **比预期更频繁地重新执行**。要解决这个问题，可以移除不必要的[对象依赖](#removing-unnecessary-object-dependencies)和[函数依赖](#removing-unnecessary-function-dependencies)。你也可以把[状态更新](#updating-state-based-on-previous-state-from-an-effect)和[非响应式逻辑](#reading-the-latest-props-and-state-from-an-effect)抽离到 Effect 之外。
- 如果你的 Effect 不是由某个交互触发的（比如点击），React 一般会让浏览器**先绘制更新后的界面，再执行你的 Effect**。如果你的 Effect 负责视觉相关工作（例如定位 tooltip），而这个延迟是可感知的（例如出现闪烁），请将 `useEffect` 替换为 [`useLayoutEffect`](https://react.dev/reference/react/useLayoutEffect)。
- 如果你的 Effect 是由交互触发的（比如点击），**React 可能会在浏览器绘制更新后的界面之前执行这个 Effect**。这样可以确保事件系统能观察到 Effect 的结果。通常这符合预期；但如果你必须把这段逻辑延后到绘制之后，比如执行 `alert()`，可以使用 `setTimeout`。详见 [reactwg/react-18/128](https://github.com/reactwg/react-18/discussions/128)。
- 即使 Effect 是由交互触发的，**React 也可能允许浏览器先重绘，再处理 Effect 内部的状态更新**。通常这也符合预期；但如果你必须阻止浏览器重绘，请将 `useEffect` 替换为 [`useLayoutEffect`](https://react.dev/reference/react/useLayoutEffect)。
- Effect **只会在客户端运行**，不会在服务端渲染期间执行。

---

## 用法

### 连接到外部系统

有些组件在显示期间需要持续连接到网络、某个浏览器 API，或者第三方库。这些系统不由 React 控制，因此被称为 _external_（外部系统）。

要[让组件连接到某个外部系统](https://react.dev/learn/synchronizing-with-effects)，可以在组件顶层调用 `useEffect`：

```js
import { useState, useEffect } from 'react';
import { createConnection } from './chat.js';

function ChatRoom({ roomId }) {
  const [serverUrl, setServerUrl] = useState('https://localhost:1234');

  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.connect();
    return () => {
      connection.disconnect();
    };
  }, [roomId, serverUrl]);

  return (
    <>
      <label>
        Server URL:{' '}
        <input
          value={serverUrl}
          onChange={e => setServerUrl(e.target.value)}
        />
      </label>
      <h1>Welcome to the {roomId} room!</h1>
    </>
  );
}
```

你需要向 `useEffect` 传入两个参数：

1. 一个 _setup function_，其中包含连接外部系统的初始化逻辑。
   - 它应该返回一个 _cleanup function_，用于断开与该系统的连接。
2. 一个依赖列表，包含这些函数内部使用到的所有组件值。

**React 会在需要的时候调用 setup 和 cleanup，它们可能会执行多次：**

1. 当组件被加入页面时，setup 代码执行一次，也就是组件 _mount_。
2. 每次组件提交后，只要依赖发生变化：
   - 先使用旧的 props 和 state 执行 cleanup。
   - 再使用新的 props 和 state 执行 setup。
3. 当组件从页面中移除后，会最后再执行一次 cleanup，也就是组件 _unmount_。

**以上面示例为例，流程如下：**

当 `ChatRoom` 组件首次加入页面时，它会使用初始的 `serverUrl` 和 `roomId` 连接到聊天室。如果 `serverUrl` 或 `roomId` 因一次提交发生变化（例如用户在下拉框中切换了聊天室），Effect 会先**断开上一个房间的连接，再连接到下一个房间**。当 `ChatRoom` 组件从页面中移除时，Effect 会最后再执行一次断开连接。

**为了[帮助你发现 bug](https://react.dev/learn/synchronizing-with-effects#step-3-add-cleanup-if-needed)，在开发环境中 React 会在真正执行 setup 之前，额外执行一次 setup 和 cleanup。** 这是一个压力测试，用来验证你的 Effect 逻辑是否实现正确。如果这会导致可见问题，通常说明 cleanup 逻辑还不完整。cleanup 函数应该停止或撤销 setup 所做的事情。经验法则是：用户不应该能分辨“setup 执行一次（生产环境）”与“setup → cleanup → setup（开发环境）”之间的区别。[可参考常见解决方案。](https://react.dev/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development)

**尽量把每个 Effect 都视为一个独立进程，并一次只关注单个 setup/cleanup 周期。** 无论组件是在挂载、更新还是卸载，这条原则都成立。当 cleanup 逻辑能正确“镜像” setup 逻辑时，你的 Effect 就能稳定应对任意次数的 setup 与 cleanup。

#### 示例：连接到聊天服务器

在这个示例中，`ChatRoom` 组件使用 Effect 保持与 `chat.js` 中定义的外部系统连接。点击 “Open chat” 后，`ChatRoom` 组件会出现。这个示例运行在开发模式下，因此会额外触发一次连接和断开循环，正如[这里说明的那样](https://react.dev/learn/synchronizing-with-effects#step-3-add-cleanup-if-needed)。你可以修改 `roomId` 和 `serverUrl`，观察 Effect 如何重新建立连接。点击 “Close chat” 后，Effect 会最后再断开一次连接。

```js
import { useState, useEffect } from 'react';
import { createConnection } from './chat.js';

function ChatRoom({ roomId }) {
  const [serverUrl, setServerUrl] = useState('https://localhost:1234');

  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.connect();
    return () => {
      connection.disconnect();
    };
  }, [roomId, serverUrl]);

  return (
    <>
      <label>
        Server URL:{' '}
        <input
          value={serverUrl}
          onChange={e => setServerUrl(e.target.value)}
        />
      </label>
      <h1>Welcome to the {roomId} room!</h1>
    </>
  );
}

export default function App() {
  const [roomId, setRoomId] = useState('general');
  const [show, setShow] = useState(false);
  return (
    <>
      <label>
        Choose the chat room:{' '}
        <select
          value={roomId}
          onChange={e => setRoomId(e.target.value)}
        >
          <option value="general">general</option>
          <option value="travel">travel</option>
          <option value="music">music</option>
        </select>
      </label>
      <button onClick={() => setShow(!show)}>
        {show ? 'Close chat' : 'Open chat'}
      </button>
      {show && <hr />}
      {show && <ChatRoom roomId={roomId} />}
    </>
  );
}
```

### 将 Effect 封装进自定义 Hook

Effect 是一种[“逃生舱”](https://react.dev/learn/escape-hatches)：当你需要“跳出 React”并且没有更好的内建方案时才使用它。如果你经常需要手动编写 Effect，这通常说明你应该把组件依赖的通用行为提取成[自定义 Hook](https://react.dev/learn/reusing-logic-with-custom-hooks)。

例如，这个 `useChatRoom` 自定义 Hook 会把 Effect 的逻辑隐藏在一个更声明式的 API 后面：

```js
function useChatRoom({ serverUrl, roomId }) {
  useEffect(() => {
    const options = {
      serverUrl: serverUrl,
      roomId: roomId
    };
    const connection = createConnection(options);
    connection.connect();
    return () => connection.disconnect();
  }, [roomId, serverUrl]);
}
```

之后你就可以在任意组件中这样使用它：

```js
function ChatRoom({ roomId }) {
  const [serverUrl, setServerUrl] = useState('https://localhost:1234');
  useChatRoom({
    roomId: roomId,
    serverUrl: serverUrl
  });
  // ...
}
```

React 生态中也有大量优秀的自定义 Hook，可以覆盖各种常见场景。

[了解更多：如何把 Effect 封装进自定义 Hook。](https://react.dev/learn/reusing-logic-with-custom-hooks)

### 控制非 React 组件

有时你希望让某个外部系统与组件的某个 prop 或 state 保持同步。

例如，如果你有一个第三方地图组件，或者一个不是用 React 编写的视频播放器组件，你可以使用 Effect 调用它的方法，让它的状态与 React 组件当前状态一致。下面这个 Effect 创建了一个定义在 `map-widget.js` 中的 `MapWidget` 类实例。当 `Map` 组件的 `zoomLevel` prop 变化时，Effect 会调用这个实例的 `setZoom()` 方法来保持同步：

```js
import { useRef, useEffect } from 'react';
import { MapWidget } from './map-widget.js';

export default function Map({ zoomLevel }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current === null) {
      mapRef.current = new MapWidget(containerRef.current);
    }

    const map = mapRef.current;
    map.setZoom(zoomLevel);
  }, [zoomLevel]);

  return (
    <div
      style={{ width: 200, height: 200 }}
      ref={containerRef}
    />
  );
}
```

在这个例子中，不需要 cleanup 函数，因为 `MapWidget` 类只管理传给它的那个 DOM 节点。当 `Map` React 组件从树中移除后，这个 DOM 节点和 `MapWidget` 类实例都会被浏览器 JavaScript 引擎自动垃圾回收。

### 使用 Effect 获取数据

你可以使用 Effect 为组件获取数据。但要注意，[如果你使用的是框架](https://react.dev/learn/creating-a-react-app#full-stack-frameworks)，通常使用框架自带的数据获取机制会比手写 Effect 更高效。

如果你想手动在 Effect 中获取数据，代码可能如下：

```js
import { useState, useEffect } from 'react';
import { fetchBio } from './api.js';

export default function Page() {
  const [person, setPerson] = useState('Alice');
  const [bio, setBio] = useState(null);

  useEffect(() => {
    let ignore = false;
    setBio(null);
    fetchBio(person).then(result => {
      if (!ignore) {
        setBio(result);
      }
    });
    return () => {
      ignore = true;
    };
  }, [person]);
}
```

注意这里的 `ignore` 变量。它初始值为 `false`，并在 cleanup 时被设为 `true`。这样可以确保[代码不会受到“竞态条件”问题影响](https://maxrozen.com/race-conditions-fetching-data-react-with-useeffect)：网络响应的返回顺序可能和请求发出的顺序不同。

```js
import { useState, useEffect } from 'react';
import { fetchBio } from './api.js';

export default function Page() {
  const [person, setPerson] = useState('Alice');
  const [bio, setBio] = useState(null);

  useEffect(() => {
    async function startFetching() {
      setBio(null);
      const result = await fetchBio(person);
      if (!ignore) {
        setBio(result);
      }
    }

    let ignore = false;
    startFetching();
    return () => {
      ignore = true;
    };
  }, [person]);

  return (
    <>
      <select value={person} onChange={e => {
        setPerson(e.target.value);
      }}>
        <option value="Alice">Alice</option>
        <option value="Bob">Bob</option>
        <option value="Taylor">Taylor</option>
      </select>
      <hr />
      <p><i>{bio ?? 'Loading...'}</i></p>
    </>
  );
}
```

以上内容用于验证 `web-doc-zh` Skill 的端到端工作流：网页抽取、Markdown 转换、中文翻译与本地落盘。若需完整覆盖原文全部章节，可继续对同一源稿按相同规则扩展翻译。
