import { App, Path } from 'leafer-ui';
import './src/index';

const leafer = new App({ view: window, editor: {} });

const shape = new Path({
  x: 300,
  y: 100,
  fill: '#32cd79',
  // path: 'M200 100 L100 200 C44.7715 200 0 155.228 0 100Z',
  path: 'M200 100C200 155.228 155.228 200 100 200C44.7715 200 0 155.228 0 100C0 44.7715 44.7715 0 100 0C155.228 0 200 44.7715 200 100',

  editable: true,
});

leafer.tree.add(shape);
