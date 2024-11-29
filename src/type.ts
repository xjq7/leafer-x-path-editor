type PointType = 'start' | 'end';

export interface IPoint {
  /** 当前顶点 */
  x?: number;
  y?: number;
  /**
   * 左 控制点
   */
  x1?: number;
  y1?: number;
  /**
   * 右 控制点
   */
  x2?: number;
  y2?: number;
  // 模式
  mode?: string;
  // 顶点类型
  type: PointType;
}

export type AnyObject = Record<string, any>;

export interface PointIdx {
  index: number;
  leftIdx: number;
  rightIdx: number;
}
