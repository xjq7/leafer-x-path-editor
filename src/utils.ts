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
