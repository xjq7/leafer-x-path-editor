/* eslint-disable no-plusplus */
import { IPathCommandData, IPathCommandObject } from 'leafer-ui';
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
      point.name = 'M';
      point.x = path[++i];
      point.y = path[++i];
    } else if (path[i] === L) {
      point.name = 'L';
      point.x = path[++i];
      point.y = path[++i];
    } else if (path[i] === C) {
      point.name = 'C';
      pointData[pointData.length - 1].x2 = path[++i];
      pointData[pointData.length - 1].y2 = path[++i];
      point.x1 = path[++i];
      point.y1 = path[++i];
      point.x = path[++i];
      point.y = path[++i];
    } else if (path[i] === Q) {
      point.name = 'Q';
      pointData[pointData.length - 1].x2 = path[++i];
      pointData[pointData.length - 1].y2 = path[++i];
      point.x = path[++i];
      point.y = path[++i];
    } else if (path[i] === Z) {
      point.name = 'Z';
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

  points.forEach((point, index) => {
    const { name, x = 0, y = 0, x1 = 0, y1 = 0 } = point;

    const prev = points[index - 1];

    if (name === 'M') {
      pathData.push(M, x, y);
    } else if (name === 'L') {
      pathData.push(L, x, y);
    } else if (name === 'C') {
      pathData.push(C, prev.x2 || 0, prev.y2 || 0, x1, y1, x, y);
    } else if (name === 'Q') {
      pathData.push(Q, prev.x2 || 0, prev.y2 || 0, x, y);
    } else if (name === 'Z') {
      pathData.push(Z);
    }
  });

  return pathData;
}
