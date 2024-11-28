import { Box, DragEvent, Path, Ellipse, PointerEvent, UI } from 'leafer-ui';
import { InnerEditor, registerInnerEditor } from '@leafer-in/editor';
import { pathData2Point, point2PathData } from './utils';
import { AnyObject, IPoint, PointIdx } from './type';

const pointRadius = 6;

const selectPointStyle = {
  stroke: 'white',
  fill: '#5f84f9',
};

const unSelectPointStyle = {
  stroke: '#5f84f9',
  fill: 'white',
};

const pointStyle = {
  width: pointRadius * 2,
  height: pointRadius * 2,
  strokeWidth: 2,
  ...unSelectPointStyle,
};

@registerInnerEditor()
export class SVGPathEditor extends InnerEditor {
  public get tag() {
    return 'SVGPathEditor';
  }

  // 描边 box
  private strokeBox = new Box();

  // 顶点 box
  private pointsBox = new Box();

  // 控制点 box
  private controlsBox = new Box();

  /** 顶点数据 */
  private points: IPoint[] = [];

  // 存储 innerId => 当前 顶点索引 以及左右相邻顶点索引数据
  private pointIdxMap: Map<number, PointIdx> = new Map();

  // 用于 记录每个左右控制点与顶点的 关联关系
  private controlMap: Map<number, IPoint> = new Map();

  // 当前选中的 顶点
  private selectPoint?: Ellipse;

  // 用来实时绘制编辑形状的副本
  private editTargetDuplicate!: Path;

  constructor(props: any) {
    super(props);
    this.pointsBox = new Box();
    this.controlsBox = new Box();
    this.strokeBox = new Box();

    this.view.addMany(this.strokeBox, this.controlsBox, this.pointsBox);

    this.eventIds = [
      this.pointsBox.on_(DragEvent.DRAG, this.handlePointDrag.bind(this)),
      this.pointsBox.on_(PointerEvent.TAP, this.handlePointTap.bind(this)),
      this.controlsBox.on_(DragEvent.DRAG, this.handleControlDrag.bind(this)),
      this.editor.app.on_(PointerEvent.DOUBLE_TAP, (e: any) => {
        if (e.target === this.editTarget) return;
        this.editor.closeInnerEditor();
      }),
    ];
  }

  public onLoad(): void {
    // 统一转换成结构化数据, 并做了相对位置的处理
    this.points = this.innerTransform(
      pathData2Point(this.editTarget.getPath())
    );

    this.editTargetDuplicate = this.editTarget.clone() as Path;

    this.editTarget.parent?.add(this.editTargetDuplicate);
    this.drawPoints();
    this.drawStroke();

    // 隐藏 编辑元素
    this.editTarget.visible = false;
    // 去除 editor 的描边
    this.editor.selector.targetStroker.visible = false;

    // 2. 载入控制点
    this.editBox.add(this.view); // 添加在 editor 或 editBox 中都可以， 注意editBox本身具有定位
  }

  public onUpdate(): void {}

  public onUnload(): void {
    this.closeInnerEditor();
    // 4. 卸载控制点
    this.editBox.remove(this.view);
  }

  /**
   * 处理控制点的点击
   *
   * @private
   * @param {*} e
   * @memberof SVGPathEditor
   */
  private handlePointTap(e: any) {
    this.handleSelectPoint(e.target);
    this.updateControl();
  }

  /**
   * 处理控制点的拖动
   *
   * @private
   * @param {*} e
   * @memberof SVGPathEditor
   */
  private handleControlDrag(e: any) {
    const { isLeft, isRight } = e.target.data;

    const { moveX, moveY } = e;

    const { innerId } = e.target;

    const x = e.target.x + moveX;
    const y = e.target.y + moveY;

    // 更新 point 位置
    e.target.set({
      x,
      y,
    });

    const pointObj = this.controlMap.get(innerId);

    if (pointObj) {
      if (isLeft) {
        pointObj.x1 = x;
        pointObj.y1 = y;
      } else if (isRight) {
        pointObj.x2 = x;
        pointObj.y2 = y;
      }

      this.updateControl();
      this.drawInnerPath();
      this.drawStroke();
    }
  }

  /**
   * 处理控制点的拖动
   *
   * @private
   * @param {*} e
   * @memberof SVGPathEditor
   */
  private handlePointDrag(e: any) {
    const { moveX, moveY } = e;

    const { innerId } = e.target;

    const x = e.target.x + moveX;
    const y = e.target.y + moveY;

    // 更新 point 位置
    e.target.set({
      x,
      y,
    });

    this.handleSelectPoint(e.target);

    const pointObj = this.pointIdxMap.get(innerId);
    // 更新 pointData 数据
    if (pointObj) {
      const { index } = pointObj;

      const point = this.points[index];

      point.x = x;
      point.y = y;

      if (point.x1 !== undefined) point.x1 += moveX;
      if (point.y1 !== undefined) point.y1 += moveY;
      if (point.x2 !== undefined) point.x2 += moveX;
      if (point.y2 !== undefined) point.y2 += moveY;

      // 更新控制点位置
      this.updateControl();
      // 更新 path
      this.drawInnerPath();

      this.drawStroke();
    }
  }

  handleSelectPoint(el: Ellipse) {
    this.selectPoint?.set({ ...unSelectPointStyle });
    this.selectPoint = el;
    this.selectPoint.set({ ...selectPointStyle });
  }

  /**
   * 将 path 转成内部数据
   *
   * @param {IPoint[]} points
   * @return {*}
   * @memberof SVGPathEditor
   */
  innerTransform(points: IPoint[]) {
    const { worldTransform, boxBounds } = this.editTarget;
    const { scaleX, scaleY } = worldTransform;
    const { x, y } = boxBounds;
    return points.map((point) => {
      const newPoint = { ...point } as AnyObject;
      ['x', 'x1', 'x2'].forEach((key) => {
        if (newPoint[key] !== undefined) {
          newPoint[key] = (newPoint[key] - x) * scaleX;
        }
      });

      ['y', 'y1', 'y2'].forEach((key) => {
        if (newPoint[key] !== undefined) {
          newPoint[key] = (newPoint[key] - y) * scaleY;
        }
      });

      return newPoint;
    }) as IPoint[];
  }

  /**
   * 将 innerPath 转成外部 path 数据
   *
   * @private
   * @param {IPoint[]} points
   * @return {*}
   * @memberof SVGPathEditor
   */
  private outerTransform(points: IPoint[]) {
    const { worldTransform, boxBounds } = this.editTarget;
    const { scaleX, scaleY } = worldTransform;
    const { x, y } = boxBounds;
    return points.map((point) => {
      const newPoint = { ...point } as AnyObject;

      ['x', 'x1', 'x2'].forEach((key) => {
        if (newPoint[key] !== undefined) {
          newPoint[key] = newPoint[key] / scaleX + x;
        }
      });

      ['y', 'y1', 'y2'].forEach((key) => {
        if (newPoint[key] !== undefined) {
          newPoint[key] = newPoint[key] / scaleY + y;
        }
      });
      return newPoint;
    }) as IPoint[];
  }

  /**
   * 关闭后处理数据
   *
   * @private
   * @memberof SVGPathEditor
   */
  private closeInnerEditor() {
    this.editTarget.parent?.remove(this.editTargetDuplicate);
    this.editTarget.path = point2PathData(this.outerTransform(this.points));
    this.editTarget.visible = true;
    this.editor.selector.targetStroker.visible = true;
    this.editor.off_(this.eventIds);
    this.eventIds = [];
    this.points = [];
  }

  public onDestroy(): void {
    this.pointsBox = null as unknown as Box;
  }

  /**
   * 编辑器内的 Path 副本
   *
   * @private
   * @memberof SVGPathEditor
   */
  private drawInnerPath() {
    this.editTargetDuplicate.set({
      path: point2PathData(this.outerTransform(this.points)),
    });
  }

  /**
   * 初始化控制点
   *
   * @private
   * @memberof SVGPathEditor
   */
  private drawPoints() {
    this.pointIdxMap.clear();

    let firstIdx: number;
    let firstPoint: PointIdx;
    let lastIdx: number;
    let lastPoint: PointIdx;

    // 这里绘制顶点时, 同时记录了顶点与相邻点的关系, 用 leftIdx 跟 rightIdx 来记录
    const points = this.points
      .map((pointObj, index) => {
        const { x = 0, y = 0, name } = pointObj;
        if (name === 'Z') return null;

        if (!firstIdx) firstIdx = index;

        const point = new Ellipse({
          x,
          y,
          ...pointStyle,
          cursor: 'move',
          offsetX: -pointRadius,
          offsetY: -pointRadius,
        });

        const currentPoint = {
          index,
          leftIdx: lastIdx,
          rightIdx: index,
        };

        if (!firstPoint) firstPoint = currentPoint;
        this.pointIdxMap.set(point.innerId, currentPoint);

        if (lastPoint) {
          lastPoint.rightIdx = index;
        }
        lastPoint = currentPoint;
        lastIdx = index;

        return point;
      })
      .filter(Boolean);

    firstPoint.leftIdx = lastIdx;
    lastPoint.rightIdx = firstPoint.index;

    this.pointsBox.set({ children: points as Ellipse[] });
  }

  /**
   * 绘制 path 描边
   *
   * @private
   * @memberof SVGPathEditor
   */
  private drawStroke() {
    const strokePath = new Path({
      stroke: '#2193FF',
      strokeWidth: 1,
      path: point2PathData(this.points),
    });

    this.strokeBox.set({ children: [strokePath] });
  }

  /**
   * 为顶点创建控制点
   *
   * @param {IPoint} [point]
   * @return {*}  {UI[]}
   * @memberof SVGPathEditor
   */
  createControl(point?: IPoint): UI[] {
    if (!point) return [];
    const { x, y, x1, x2, y1, y2 } = point;

    let leftControl;
    let rightControl;
    if (x1 !== undefined && y1 !== undefined) {
      leftControl = new Ellipse({
        x: x1,
        y: y1,
        ...pointStyle,
        cursor: 'move',
        data: {
          isLeft: true,
        },
        editable: true,
        offsetX: -pointRadius,
        offsetY: -pointRadius,
      });

      this.controlMap.set(leftControl.innerId, point);
    }

    if (x2 !== undefined && y2 !== undefined) {
      rightControl = new Ellipse({
        x: x2,
        y: y2,
        ...pointStyle,
        cursor: 'move',
        data: {
          isRight: true,
        },
        editable: true,
        offsetX: -pointRadius,
        offsetY: -pointRadius,
      });
      this.controlMap.set(rightControl.innerId, point);
    }
    let path = '';

    if (leftControl && rightControl) {
      path = `M ${x1} ${y1} L ${x} ${y} L ${x2} ${y2}`;
    } else if (leftControl) {
      path = `M ${x1} ${y1} L ${x} ${y}`;
    } else if (rightControl) {
      path = `M ${x} ${y} L ${x2} ${y2}`;
    }
    let linePath;

    if (path) {
      linePath = new Path({
        path,
        stroke: '#2193FF',
        strokeWidth: 1,
        editable: false,
      });
    }

    return [linePath, leftControl, rightControl].filter(Boolean);
  }

  /**
   * 通过 选中顶点 来选择展示它与相邻两点的控制点
   *
   * @return {*}
   * @memberof SVGPathEditor
   */
  updateControl() {
    const { innerId } = this.selectPoint || {};
    if (!innerId) return;

    const pointObj = this.pointIdxMap.get(innerId);
    if (pointObj === undefined) return;

    const prevPointControl = this.createControl(this.points[pointObj.index]);
    const currentPointControl = this.createControl(
      this.points[pointObj.leftIdx]
    );
    const nextPointControl = this.createControl(this.points[pointObj.rightIdx]);

    this.controlsBox.set({
      children: [
        ...prevPointControl,
        ...currentPointControl,
        ...nextPointControl,
      ],
    });
  }
}

// 5. 注册编辑器
Path.setEditInner('SVGPathEditor');
