# leafer-x-path-editor

一款基于 Path 绘制的 图形编辑器

对标 figma 形状编辑能力, 可实现 任意图形 多顶点控制能力

## 示例

<img src='./example.gif'/>

## 使用

### 安装

```sh
npm install leafer-x-path-editor
# or yarn
yarn add leafer-x-path-editor
# or pnpm
pnpm install leafer-x-path-editor
```

### 示例

```ts
import { App, Path } from 'leafer-ui';
// 引入 leafer-x-path-editor
import 'leafer-x-path-editor';

const leafer = new App({ view: window, editor: {} });

// 双击 Path 即可进入内部编辑模式
const shape = new Path({
  x: 300,
  y: 100,
  fill: '#32cd79',
  path: 'M200 100C200 155.228 155.228 200 100 200C44.7715 200 0 155.228 0 100C0 44.7715 44.7715 0 100 0C155.228 0 200 44.7715 200 100Z',
  editable: true,
});

leafer.tree.add(shape);
```

### 使用说明

进入编辑模式自动初始化所有顶点

点击任意顶点将激活他与相邻两点的控制点, 每个顶点最多有两个控制点

没有控制点时 与相邻点则是直线连接

存在一个控制点时, 比如右控制点 则是与右邻点 连接一条二次贝塞尔曲线

存在两个控制点时, 比如左邻点有右控制点, 当前顶点有左控制点, 则在左邻点与当前顶点 连接一条三次贝塞尔曲线

### 编辑模式

通过双击进入编辑模式

双击任意区域可退出编辑, 并自动保存编辑数据

### 控制点生成与取消

按住 Ctrl/Command 点击顶点时, 如果顶点没有任何控制点 则生成两个默认控制点

如果 存在控制点, 则去除所有控制点

### 控制点模式切换

使用快捷键切换控制点模式

按住 Ctrl/Command 拖动控制点时时 则为 自由拖动模式

当自动吸附到 角度对称 或者角度对称等长模式, 结束拖动时, 当前控制点会切换为对应模式

注:

- 角度对称模式: 拖动左控制点时, 始终保持右控制点与之对称
- 角度对称等长模式: 拖动左控制点时, 始终保持右控制点与之对称且 左右控制点距离顶点始终等长
