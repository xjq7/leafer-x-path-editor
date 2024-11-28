import { App, Path } from 'leafer-ui';

import './src/index';

const leafer = new App({ view: window, editor: {} });

const shape = new Path({
  x: 100,
  y: 100,
  fill: '#32cd79',
  path: [
    { name: 'M', x: 200, y: 200 },
    { name: 'L', x: 50, y: 330 },
    { name: 'L', x: 200, y: 100 },
    {
      name: 'C',
      x1: 350,
      y1: 300,
      x2: 420,
      y2: 420,
      x: 300,
      y: 380,
    },
    {
      name: 'C',
      x: 200,
      y: 550,
      x1: 300,
      y1: 400,
      x2: 200,
      y2: 300,
    },
    { name: 'L', x: 410, y: 670 },
    { name: 'Z' },
  ],
  editable: true,
});

leafer.tree.add(shape);
