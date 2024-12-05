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

export { pointRadius, selectPointStyle, pointStyle, unSelectPointStyle };
