import {
  Box,
  DragEvent,
  Path,
  Ellipse,
  PointerEvent,
  UI,
} from '@leafer-ui/core';
import { InnerEditor, registerInnerEditor } from '@leafer-in/editor';
import { IBoundsData, IMatrixWithScaleData } from '@leafer-ui/interface';

import {
  clamp,
  calculateCrossProduct,
  calculateEuclideanDistance,
  pathData2Point,
  point2PathData,
  toFixed,
} from './utils';
import { AnyObject, IPoint, MirrorMode, PointIdx } from './type';
import { PathEditorEvent } from './event';

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

  // 控制点移动过程中的吸附状态盒子
  private controlAbsorbBox = new Box();

  /** 顶点数据 */
  private points: IPoint[] = [];

  // 存储 innerId => 当前 顶点索引 以及左右相邻顶点索引数据
  private pointIdxMap: Map<number, PointIdx> = new Map();

  // 用于 记录每个左右控制点与顶点的 关联关系
  private controlMap: Map<number, IPoint> = new Map();

  // 当前交互的控制点状态
  private controlAbsorbStatus: {
    isMirrorAngle?: boolean;
    isMirrorAngleLength?: boolean;
  } = {};
  // 当前选中的 顶点
  private selectPoint?: Ellipse;

  // 当前选中的 控制点
  private selectControlPoint?: Ellipse;

  // 用来实时绘制编辑形状的副本
  private editTargetDuplicate!: Path;

  // 键盘事件
  private keyEvents: { type: string; event: any }[] = [];

  // 当前按下的键
  private downKey: number[] = [];

  // 缓存上次的世界相对变换属性
  private prevTransform: {
    worldTransform: IMatrixWithScaleData;
    boxBounds: IBoundsData;
  };

  // 点的选中样式
  private selectPointStyle = {
    stroke: 'white',
    fill: '#2193FF',
  };

  // 点的非选中样式
  private unSelectPointStyle = {
    stroke: '#2193FF',
    fill: 'white',
  };

  // 默认点的半径
  private pointRadius = 6;

  // 选中点样式
  private pointStyle: AnyObject = {
    width: this.pointRadius * 2,
    height: this.pointRadius * 2,
    strokeWidth: 2,
    ...this.unSelectPointStyle,
  };

  constructor(props: any) {
    super(props);
    this.pointsBox = new Box();
    this.controlsBox = new Box();
    this.strokeBox = new Box();
    this.controlAbsorbBox = new Box();

    this.view.addMany(
      this.strokeBox,
      this.controlsBox,
      this.pointsBox,
      this.controlAbsorbBox
    );

    this.eventIds = [
      this.pointsBox.on_(DragEvent.DRAG, this.handlePointDrag.bind(this)),
      this.pointsBox.on_(PointerEvent.TAP, this.handlePointTap.bind(this)),
      this.controlsBox.on_(DragEvent.DRAG, this.handleControlDrag.bind(this)),
      this.controlsBox.on_(DragEvent.END, this.handleControlDragEnd.bind(this)),
      this.controlsBox.on_(
        PointerEvent.DOWN,
        this.handleControlDown.bind(this)
      ),
      this.controlsBox.on_(PointerEvent.UP, this.handleControlUp.bind(this)),
      this.editor.app.on_(PointerEvent.DOUBLE_TAP, (e: any) => {
        if (e.target === this.editTarget) return;
        this.editor.closeInnerEditor();
      }),
    ];
  }

  // 是否是 按下 Command 或 Ctrl 状态
  private isCtrl() {
    if (this.downKey.length !== 1) return false;
    return this.downKey.some((val) => [17, 91].includes(val));
  }

  private addKeyEventListener() {
    const handleKeyDownEvent = (e: any) => {
      this.downKey.push(e.keyCode);
    };

    document.addEventListener('keydown', handleKeyDownEvent);

    const handleKeyUpEvent = (e: any) => {
      this.downKey = this.downKey.filter((val) => e.keyCode !== val);
    };

    document.addEventListener('keyup', handleKeyUpEvent);

    this.keyEvents.push({ type: 'keydown', event: handleKeyDownEvent });
    this.keyEvents.push({ type: 'keyup', event: handleKeyUpEvent });
  }

  private removeKeyEventListener() {
    this.keyEvents.forEach(({ type, event }) => {
      document.removeEventListener(type, event);
    });
    this.keyEvents = [];
  }

  public onLoad(): void {
    // 初始化 point 样式
    this.calculatePointStyle(this.editTarget.worldTransform);
    // 统一转换成结构化数据, 并做了相对位置的处理
    this.points = this.innerTransformPoints(
      pathData2Point(this.editTarget.getPath())
    );
    this.points = this.calculateMirrorMode(this.points);

    this.editTargetDuplicate = this.editTarget.clone() as Path;

    this.editTarget.parent?.add(this.editTargetDuplicate);

    this.drawPoints();
    this.drawStroke();

    const oldValue = this.editTarget.clone();
    // 隐藏 编辑元素
    this.editTarget.visible = false;
    this.editor.emitEvent(
      new PathEditorEvent(PathEditorEvent.CHANGE, {
        value: this.editTarget,
        oldValue,
      })
    );
    // 去除 editor 的描边
    this.editor.selector.targetStroker.visible = false;

    // 2. 载入控制点
    this.editBox.add(this.view); // 添加在 editor 或 editBox 中都可以， 注意editBox本身具有定位
    this.addKeyEventListener();
  }

  //  画布发生变更时可调用来重新生成所有元素
  private reDraw() {
    if (!this.prevTransform) return;

    const { worldTransform, boxBounds } = this.prevTransform;

    this.points = this.innerTransformPoints(
      this.outerTransformPoints(this.points, worldTransform, boxBounds)
    );
    this.drawPoints();
    this.drawStroke();
    this.updateControl();
  }

  // 处理画布变更的影响
  public onUpdate(): void {
    const { boxBounds, worldTransform } = this.editTarget;
    const { scaleX, scaleY } = worldTransform;

    // 根据缩放系数动态调整点的大小
    this.calculatePointStyle(worldTransform);

    // 对比上一次的 transform, 不同时则重绘所有元素
    if (
      this.prevTransform &&
      (scaleX !== this.prevTransform.worldTransform.scaleX ||
        scaleY !== this.prevTransform.worldTransform.scaleY)
    ) {
      this.reDraw();
    }

    this.prevTransform = {
      worldTransform: { ...worldTransform },
      boxBounds: { ...boxBounds },
    };
  }

  public onUnload(): void {
    this.closeInnerEditor();
    this.removeKeyEventListener();
    // 4. 卸载控制点
    this.editBox.remove(this.view);
  }

  /**
   * 计算初始数据的控制点模式
   *
   * @private
   * @param {IPoint[]} points
   * @return {*}
   * @memberof SVGPathEditor
   */
  private calculateMirrorMode(points: IPoint[]) {
    return points.map((point) => {
      const { x, y, x1, y1, x2, y2 } = point;

      if (
        x1 !== undefined &&
        y1 !== undefined &&
        x2 != undefined &&
        y2 !== undefined
      ) {
        let mode: MirrorMode = 'no-mirror';
        const crossProduct = calculateCrossProduct(x, y, x1, y1, x2, y2);

        if (crossProduct === 0) {
          mode = 'mirror-angle';

          const distance1 = toFixed(
            calculateEuclideanDistance(x, y, x1, y1),
            1
          );
          const distance2 = toFixed(
            calculateEuclideanDistance(x, y, x2, y2),
            1
          );

          if (distance1 === distance2) {
            mode = 'mirror-angle-length';
          }
        }

        return { ...point, mode };
      }

      return point;
    });
  }

  /**
   *
   *
   * @private
   * @param {IMatrixWithScaleData} transform
   * @memberof SVGPathEditor
   */
  private calculatePointStyle(transform: IMatrixWithScaleData) {
    const { scaleX, scaleY } = transform;
    // 根据缩放系数动态调整点的大小
    if (scaleX === scaleY) {
      const radius = clamp(6 * scaleX, 5, 7);
      this.pointRadius = radius;

      this.pointStyle.width = radius * 2;
      this.pointStyle.height = radius * 2;
      this.pointStyle.strokeWidth = clamp(1.4 * scaleX, 1, 2);
    }
  }

  /**
   * 处理控制点的点击
   *
   * @private
   * @param {*} e
   * @memberof SVGPathEditor
   */
  private handlePointTap(e: any) {
    if (this.isCtrl()) {
      const { innerId } = e.target;
      const pointIdx = this.pointIdxMap.get(innerId);
      const point = this.points[pointIdx.index];

      if (
        (point.x1 !== undefined && point.y1 !== undefined) ||
        (point.x2 !== undefined && point.y2 !== undefined)
      ) {
        point.x1 = undefined;
        point.x2 = undefined;
        point.y1 = undefined;
        point.y2 = undefined;
      } else {
        const [x1, y1, x2, y2] = this.getDefaultControls(
          this.points[pointIdx.leftIdx],
          this.points[pointIdx.index],
          this.points[pointIdx.rightIdx]
        );

        point.x1 = x1;
        point.y1 = y1;
        point.x2 = x2;
        point.y2 = y2;
        point.mode = 'mirror-angle-length';
      }
      this.drawInnerPath();
    }

    this.handleSelectPoint(e.target);
    this.updateControl();
  }

  /**
   * 获取顶点默认控制点
   *
   * @param {IPoint} A 左邻点
   * @param {IPoint} B 目标顶点
   * @param {IPoint} C 右邻点
   * @return {*}
   * @memberof SVGPathEditor
   */
  getDefaultControls(A: IPoint, B: IPoint, C: IPoint) {
    const L_AC = calculateEuclideanDistance(C.x, C.y, A.x, A.y);

    // 目标线段长度
    const L_DES = 0.6 * L_AC;

    // 方向向量
    const dirX = C.x - A.x;
    const dirY = C.y - A.y;

    // 归一化方向向量
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    const unitX = dirX / len;
    const unitY = dirY / len;

    // 计算目标线段端点
    const halfLen = L_DES / 2;
    const D = {
      x: B.x + halfLen * unitX,
      y: B.y + halfLen * unitY,
    };

    const E = {
      x: B.x - halfLen * unitX,
      y: B.y - halfLen * unitY,
    };

    return [E.x, E.y, D.x, D.y];
  }

  private handleControlDown(e: any) {
    this.selectControlPoint = e.target;
  }
  private handleControlUp() {
    this.selectControlPoint = null;
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

    const { innerId, x: targetX, y: targetY } = e.target;

    const { x: transformMoveX, y: transformMoveY } =
      this.getTransformMovePosition(moveX, moveY);

    const newX = targetX + transformMoveX;
    const newY = targetY + transformMoveY;

    // 更新 point 位置
    e.target.set({
      x: newX,
      y: newY,
    });

    const pointObj = this.controlMap.get(innerId);

    if (pointObj) {
      // 自由拖动模式
      if (this.isCtrl()) {
        pointObj.mode = 'no-mirror';
      }

      // 更新当前拖动点
      if (isLeft) {
        pointObj.x1 = newX;
        pointObj.y1 = newY;
      } else if (isRight) {
        pointObj.x2 = newX;
        pointObj.y2 = newY;
      }

      // 计算当前处于哪种模式
      const { x, y, x1, y1, x2, y2, mode } = pointObj;

      if (
        x1 !== undefined &&
        y1 !== undefined &&
        x2 !== undefined &&
        y2 !== undefined &&
        mode !== 'mirror-angle-length'
      ) {
        if (mode !== 'mirror-angle') {
          // 直线吸附
          const distance1 = calculateEuclideanDistance(x, y, x1, y1);
          const distance2 = calculateEuclideanDistance(x, y, x2, y2);
          const length = distance1 + distance2;

          // 动态调整误差阈值
          const epsilon = (120 * clamp(length, 40, 800)) / 150; // 根据距离设置阈值
          const crossProduct = calculateCrossProduct(x, y, x1, y1, x2, y2);

          if (crossProduct <= epsilon) {
            this.controlAbsorbStatus.isMirrorAngle = true;

            let currentX, currentY, mirrorX, mirrorY;
            if (isLeft) {
              currentX = x2;
              currentY = y2;
              mirrorX = x1;
              mirrorY = y1;
            } else {
              currentX = x1;
              currentY = y1;
              mirrorX = x2;
              mirrorY = y2;
            }

            const { x: newX, y: newY } = this.getMirrorPoint(
              currentX,
              currentY,
              x,
              y,
              mirrorX,
              mirrorY
            );
            if (isLeft) {
              pointObj.x1 = newX;
              pointObj.y1 = newY;
            } else {
              pointObj.x2 = newX;
              pointObj.y2 = newY;
            }
          } else {
            this.controlAbsorbStatus.isMirrorAngle = false;
          }
        }

        // 等长吸附
        if (this.controlAbsorbStatus.isMirrorAngle || mode === 'mirror-angle') {
          const distance1 = calculateEuclideanDistance(x, y, x1, y1);
          const distance2 = calculateEuclideanDistance(x, y, x2, y2);

          const threshold = this.pointRadius / 2;

          if (Math.abs(distance1 - distance2) <= threshold) {
            if (isLeft) {
              pointObj.x1 = x - (x2 - x);
              pointObj.y1 = y - (y2 - y);
            } else {
              pointObj.x2 = x - (x1 - x);
              pointObj.y2 = y - (y1 - y);
            }

            this.controlAbsorbStatus.isMirrorAngleLength = true;
          } else {
            this.controlAbsorbStatus.isMirrorAngleLength = false;
          }
        } else {
          if (this.controlAbsorbStatus.isMirrorAngleLength) {
            this.controlAbsorbStatus.isMirrorAngleLength = false;
          }
        }
      }

      // 根据控制点模式 来计算另一个控制点 的位置
      if (pointObj.mode === 'mirror-angle-length') {
        if (isLeft) {
          pointObj.x2 -= transformMoveX;
          pointObj.y2 -= transformMoveY;
        } else if (isRight) {
          pointObj.x1 -= transformMoveX;
          pointObj.y1 -= transformMoveY;
        }
      } else if (pointObj.mode === 'mirror-angle') {
        let x1 = pointObj.x1,
          y1 = pointObj.y1,
          x2 = pointObj.x2,
          y2 = pointObj.y2;
        if (isRight) {
          x1 = pointObj.x2;
          y1 = pointObj.y2;
          x2 = pointObj.x1;
          y2 = pointObj.y1;
        }

        const { x, y } = pointObj;

        const { x: newX, y: newY } = this.getMirrorPoint(x1, y1, x, y, x2, y2);

        if (isLeft) {
          pointObj.x2 = newX;
          pointObj.y2 = newY;
          x;
        } else {
          pointObj.x1 = newX;
          pointObj.y1 = newY;
        }
      }

      let absorbBox: UI[] = [];

      let desX;
      let desY;

      if (isLeft) {
        desX = pointObj.x1;
        desY = pointObj.y1;
      } else {
        desX = pointObj.x2;
        desY = pointObj.y2;
      }
      if (this.controlAbsorbStatus.isMirrorAngle) {
        const absorbPath = new Path({
          path: `M ${x} ${y} L ${desX} ${desY}`,
          stroke: 'red',
          strokeWidth: 1,
        });
        absorbBox.push(absorbPath);
      }

      if (this.controlAbsorbStatus.isMirrorAngleLength) {
        this.selectControlPoint.fill = 'red';
        const absorbPoint = new Ellipse({
          x: desX,
          y: desY,
          width: this.pointRadius,
          height: this.pointRadius,
          offsetX: -this.pointRadius / 2,
          offsetY: -this.pointRadius / 2,
          fill: 'red',
        });
        absorbPoint.fill = 'red';
        absorbBox.push(absorbPoint);
      }
      this.controlAbsorbBox.set({
        children: [...absorbBox],
      });
      this.updateControl();
      this.drawInnerPath();
    }
  }

  /**
   * 保持 控制点 处于同一直线, 该方法用于获取 另一个控制点 应该在直线上的位置
   *
   * @param {number} currentX
   * @param {number} currentY
   * @param {number} centerX
   * @param {number} centerY
   * @param {number} mirrorX
   * @param {number} mirrorY
   * @return {*}
   * @memberof SVGPathEditor
   */
  getMirrorPoint(
    currentX: number,
    currentY: number,
    centerX: number,
    centerY: number,
    mirrorX: number,
    mirrorY: number
  ) {
    // 另一个控制点跟顶点的距离
    const distance = calculateEuclideanDistance(
      mirrorX,
      mirrorY,
      centerX,
      centerY
    );

    // 当前移动点的方向向量
    const dirX = currentX - centerX;
    const dirY = currentY - centerY;
    const length = Math.sqrt(dirX * dirX + dirY * dirY);

    // 归一化方向向量
    const unitX = dirX / length;
    const unitY = dirY / length;

    // 计算另一个控制点的位置
    const newX = centerX - unitX * distance;
    const newY = centerY - unitY * distance;

    return { x: newX, y: newY };
  }

  private handleControlDragEnd(e: any) {
    const { innerId } = e.target;

    const point = this.controlMap.get(innerId);

    if (point) {
      const { x1, y1, x2, y2 } = point;

      if (
        x1 !== undefined &&
        y1 !== undefined &&
        x2 !== undefined &&
        y2 !== undefined
      ) {
        if (this.controlAbsorbStatus.isMirrorAngle) {
          point.mode = 'mirror-angle';
        }
        if (
          (this.controlAbsorbStatus.isMirrorAngle ||
            point.mode === 'mirror-angle') &&
          this.controlAbsorbStatus.isMirrorAngleLength
        ) {
          point.mode = 'mirror-angle-length';
        }
      }
    }

    this.controlAbsorbStatus = {};
    this.controlAbsorbBox.set({ children: [] });
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

    let { x: targetX, y: targetY } = e.target;

    const { x: transformMoveX, y: transformMoveY } =
      this.getTransformMovePosition(moveX, moveY);

    const x = targetX + transformMoveX;
    const y = targetY + transformMoveY;

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

      if (point.x1 !== undefined) point.x1 += transformMoveX;
      if (point.y1 !== undefined) point.y1 += transformMoveY;
      if (point.x2 !== undefined) point.x2 += transformMoveX;
      if (point.y2 !== undefined) point.y2 += transformMoveY;

      // 更新控制点位置
      this.updateControl();
      // 更新 path
      this.drawInnerPath();
    }
  }

  handleSelectPoint(el: Ellipse) {
    this.selectPoint?.set({ ...this.unSelectPointStyle });
    this.selectPoint = el;
    this.selectPoint?.set({ ...this.selectPointStyle });
  }

  /**
   * 将 path 转成内部数据
   *
   * @param {IPoint[]} points
   * @return {*}
   * @memberof SVGPathEditor
   */
  innerTransformPoints(
    points: IPoint[],
    worldTransform?: IMatrixWithScaleData,
    boxBounds?: IBoundsData
  ) {
    worldTransform = worldTransform || this.editTarget.worldTransform;
    boxBounds = boxBounds || this.editTarget.boxBounds;

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
  private outerTransformPoints(
    points: IPoint[],
    worldTransform?: IMatrixWithScaleData,
    boxBounds?: IBoundsData
  ) {
    worldTransform = worldTransform || this.editTarget.worldTransform;
    boxBounds = boxBounds || this.editTarget.boxBounds;

    const { scaleX, scaleY } = worldTransform;
    const { x, y } = boxBounds;
    return points.map((point) => {
      const newPoint = { ...point } as AnyObject;

      ['x', 'x1', 'x2'].forEach((key) => {
        if (newPoint[key] !== undefined) {
          newPoint[key] = toFixed(newPoint[key] / scaleX + x);
        }
      });

      ['y', 'y1', 'y2'].forEach((key) => {
        if (newPoint[key] !== undefined) {
          newPoint[key] = toFixed(newPoint[key] / scaleY + y);
        }
      });
      return newPoint;
    }) as IPoint[];
  }

  /**
   * 对移动位置做矩阵变换, 因为 Path 旋转后, 位置移动也跟着旋转了
   *
   * @private
   * @param {number} moveX
   * @param {number} moveY
   * @return {*}
   * @memberof SVGPathEditor
   */
  private getTransformMovePosition(moveX: number, moveY: number) {
    const { worldTransform } = this.prevTransform;
    const { a, b, c, d, scaleX, scaleY } = worldTransform;
    moveX /= scaleX;
    moveY /= scaleY;
    return {
      x: moveX * a + moveY * b,
      y: moveX * c + moveY * d,
    };
  }

  /**
   * 关闭后处理数据
   *
   * @private
   * @memberof SVGPathEditor
   */
  private closeInnerEditor() {
    this.editTarget.parent?.remove(this.editTargetDuplicate);

    const oldValue = this.editTarget.clone();

    this.editTarget.visible = true;
    this.editTarget.path = point2PathData(
      this.outerTransformPoints(this.points)
    );

    this.editor.emitEvent(
      new PathEditorEvent(PathEditorEvent.CHANGE, {
        value: this.editTarget,
        oldValue,
      })
    );

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
      path: point2PathData(this.outerTransformPoints(this.points)),
    });
    this.drawStroke();
  }

  /**
   * 初始化控制点
   *
   * @private
   * @memberof SVGPathEditor
   */
  private drawPoints() {
    let firstIdx: number;
    let firstPoint: PointIdx;
    let lastIdx: number;
    let lastPoint: PointIdx;

    const newPointIdxMap = new Map(this.pointIdxMap);

    const selectIdxObj = this.pointIdxMap.get(this.selectPoint?.innerId);
    const selectIdx = selectIdxObj?.index;

    // 这里绘制顶点时, 同时记录了顶点与相邻点的关系, 用 leftIdx 跟 rightIdx 来记录
    const points = this.points
      .map((pointObj, index) => {
        const { x = 0, y = 0, type } = pointObj;
        if (type === 'end') return null;

        if (!firstIdx) firstIdx = index;

        const pointStyles =
          selectIdx === index
            ? { ...this.pointStyle, ...this.selectPointStyle }
            : { ...this.pointStyle, ...this.unSelectPointStyle };

        const point = new Ellipse({
          x,
          y,
          cursor: 'move',
          offsetX: -this.pointRadius,
          offsetY: -this.pointRadius,
          ...pointStyles,
        });
        if (selectIdx === index) {
          this.selectPoint = point;
        }

        const currentPoint = {
          index,
          leftIdx: lastIdx,
          rightIdx: index,
        };

        if (!firstPoint) firstPoint = currentPoint;
        newPointIdxMap.set(point.innerId, currentPoint);

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

    this.pointIdxMap = newPointIdxMap;

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
        ...this.pointStyle,
        cursor: 'pointer',
        data: {
          isLeft: true,
        },
        editable: true,
        offsetX: -this.pointRadius,
        offsetY: -this.pointRadius,
      });

      this.controlMap.set(leftControl.innerId, point);
    }

    if (x2 !== undefined && y2 !== undefined) {
      rightControl = new Ellipse({
        x: x2,
        y: y2,
        ...this.pointStyle,
        cursor: 'pointer',
        data: {
          isRight: true,
        },
        editable: true,
        offsetX: -this.pointRadius,
        offsetY: -this.pointRadius,
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
    if (!innerId) {
      return;
    }

    const pointObj = this.pointIdxMap.get(innerId);
    if (pointObj === undefined) return;

    // 这里需要清除选中点外其他的 控制点 map
    if (this.selectControlPoint) {
      const point = this.controlMap.get(this.selectControlPoint.innerId);
      this.controlMap.clear();
      this.controlMap.set(this.selectControlPoint.innerId, point);
    } else {
      this.controlMap.clear();
    }

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
