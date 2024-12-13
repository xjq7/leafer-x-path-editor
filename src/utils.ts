/* eslint-disable no-plusplus */
import { IPathCommandData, IPathCommandObject } from '@leafer-ui/interface';
import { PathCommandMap as Command } from '@leafer-ui/core';
import { IPoint } from './type';

const { M, L, C, Q, Z } = Command;

/**
 * IPathCommandData 转 IPathCommandObject 结构
 *
 * @export
 * @param {IPathCommandData} path
 * @return {*}  {IPathCommandObject[]}
 */
export function pathData2CommandObject(
  path: IPathCommandData
): IPathCommandObject[] {
  const pointData: IPathCommandObject[] = [];

  for (let i = 0; i < path.length; i++) {
    if (path[i] === M) {
      pointData.push({
        name: 'M',
        x: path[++i],
        y: path[++i],
      });
    } else if (path[i] === L) {
      pointData.push({
        name: 'L',
        x: path[++i],
        y: path[++i],
      });
    } else if (path[i] === C) {
      pointData.push({
        name: 'C',
        x1: path[++i],
        y1: path[++i],
        x2: path[++i],
        y2: path[++i],
        x: path[++i],
        y: path[++i],
      });
    } else if (path[i] === Q) {
      pointData.push({
        name: 'Q',
        x1: path[++i],
        y1: path[++i],
        x: path[++i],
        y: path[++i],
      });
    } else if (path[i] === Z) {
      pointData.push({
        name: 'Z',
      });
    }
  }

  return pointData;
}

/**
 * 将 IPathCommandData 转成 IPoint 结构
 *
 * @export
 * @param {IPathCommandData} path
 * @return {*}
 */
export function pathData2Point(path: IPathCommandData) {
  const pointData: IPoint[] = [];
  for (let i = 0; i < path.length; i++) {
    const point: IPoint = {} as IPoint;

    if (path[i] === M) {
      point.x = path[++i];
      point.y = path[++i];
      point.type = 'start';
    } else if (path[i] === L) {
      point.x = path[++i];
      point.y = path[++i];
    } else if (path[i] === C) {
      pointData[pointData.length - 1].x2 = path[++i];
      pointData[pointData.length - 1].y2 = path[++i];
      point.x1 = path[++i];
      point.y1 = path[++i];
      point.x = path[++i];
      point.y = path[++i];
    } else if (path[i] === Q) {
      pointData[pointData.length - 1].x2 = path[++i];
      pointData[pointData.length - 1].y2 = path[++i];
      point.x = path[++i];
      point.y = path[++i];
    } else if (path[i] === Z) {
      point.type = 'end';
    }
    pointData.push(point);
  }

  return pointData;
}

/**
 * 将 IPoint 结构转成 IPathCommandData 结构
 *
 * @export
 * @param {IPoint[]} points
 * @return {*}
 */
export function point2PathData(points: IPoint[]) {
  const pathData: IPathCommandData = [];

  const getPrev = (index: number) => {
    if (index === 0) {
      return points[points.length - 1];
    }
    return points[index - 1];
  };

  points.forEach((point, index) => {
    const { type, x, y, x1, y1 } = point;

    const prev = getPrev(index);

    if (type === 'end') {
      pathData.push(Z);
    } else if (type === 'start') {
      pathData.push(M, x, y);
    } else {
      if (
        prev.x2 === undefined &&
        prev.y2 === undefined &&
        x1 === undefined &&
        y1 === undefined
      ) {
        pathData.push(L, x, y);
      } else if (
        prev.x2 !== undefined &&
        prev.y2 !== undefined &&
        x1 !== undefined &&
        y1 !== undefined
      ) {
        pathData.push(C, prev.x2 || 0, prev.y2 || 0, x1, y1, x, y);
      } else if (prev.x2 !== undefined && prev.y2 !== undefined) {
        pathData.push(Q, prev.x2 || 0, prev.y2 || 0, x, y);
      } else if (x1 !== undefined && y1 !== undefined) {
        pathData.push(Q, x1, y1, x, y);
      }
    }
  });

  return pathData;
}

/**
 * 浮点数保留一位小数, 整数不变
 *
 * @export
 * @param {number} val
 * @param {number} [precision=1]
 * @return {*}
 */
export function toFixed(val: number, precision: number = 1) {
  if (Number.isInteger(val)) return val;
  return Number(val.toFixed(precision));
}

/**
 * 欧几里得距离计算
 *
 * @export
 * @param {number} x
 * @param {number} y
 * @param {number} x1
 * @param {number} y1
 * @return {*}
 */
export function calculateEuclideanDistance(
  x: number,
  y: number,
  x1: number,
  y1: number
) {
  return Math.sqrt(Math.pow(x1 - x, 2) + Math.pow(y1 - y, 2));
}

/**
 * 二维空间的叉积计算
 *
 * @export
 * @param {number} x
 * @param {number} y
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @return {*}
 */
export function calculateCrossProduct(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  return Math.abs((x - x1) * (y2 - y1) - (y - y1) * (x2 - x1));
}

/**
 * 夹取
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @return {*}
 */
export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
