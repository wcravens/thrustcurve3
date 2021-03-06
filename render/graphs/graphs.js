/*
 * Copyright 2016 John Coker for ThrustCurve.org
 * Licensed under the ISC License, https://opensource.org/licenses/ISC
 */
'use strict';

const units = require('../../lib/units'),
      analyze = require('../../simulate/analyze'),
      svg = require('../svg');

const SVG = svg.contentType;
const AllFormats = [SVG];

function fractionDigits(maxValue) {
  var digits;

  if (typeof maxValue != 'number' || isNaN(maxValue))
    return 0;

  maxValue = Math.abs(maxValue);
  if (maxValue < 0.00005)
    return 4;

  digits = 0;
  maxValue *= 10;
  while (maxValue < 10 && digits < 4) {
    digits++;
    maxValue *= 10;
  }

  return digits;
}

function layoutAxis(minValue, maxValue, max) {
  var digits, shift, v0, v1, incr10, incr, axis, v;

  // make sure we have a value range
  if (typeof minValue != 'number' || isNaN(minValue))
    return [{ label: '—', value: 0 }, { label: '—', value: 1 }];
  if (maxValue <= minValue) {
    return [
      { label: minValue.toFixed(), value: minValue },
      { label: '—', value: minValue + 1 }
    ];
  }

  // get the number of fractional digits to start with
  digits = fractionDigits(maxValue);

  // make sure we have a usable maximum number of division
  if (typeof max != 'number' || isNaN(max) || max < 3) {
    return [
      { label: minValue.toFixed(digits), value: minValue },
      { label: maxValue.toFixed(digits), value: maxValue }
    ];
  }

  // find an increment that produces a reasonable number of divisions
  digits++;
  shift = Math.pow(10, digits);
  incr10 = 1 / shift;
  for (;;) {
    // try tenths
    incr = incr10;
    v0 = Math.floor(minValue / incr) * incr;
    v1 = Math.ceil(maxValue / incr) * incr;
    if ((v1 - v0) / incr <= max)
      break;

    // try fifths
    incr = incr10 * 2;
    v0 = Math.floor(minValue / incr) * incr;
    v1 = Math.ceil(maxValue / incr) * incr;
    if ((v1 - v0) / incr <= max)
      break;

    // try quarters
    incr = incr10 * 2.5;
    v0 = Math.floor(minValue / incr) * incr;
    v1 = Math.ceil(maxValue / incr) * incr;
    if ((v1 - v0) / incr <= max) {
      digits++;
      break;
    }

    // try halves
    incr = incr10 * 5;
    v0 = Math.floor(minValue / incr) * incr;
    v1 = Math.ceil(maxValue / incr) * incr;
    if ((v1 - v0) / incr <= max)
      break;

    // on to next tenth
    incr10 *= 10;
    if (digits > 0)
      digits--;
  }

  // lay out labels based on range and increment
  axis = [];
  v1 += incr / 10;
  for (v = v0; v < v1; v += incr)
    axis.push({ label: v.toFixed(digits), value: v });

  return axis;
}

const LEGEND_PAD_X = 1.7;
const LEGEND_PAD_Y = 1.3;

function numberWidth(s, em) {
  return s.length * em * 0.65;
}

function layoutGraph(info) {
  var em, xAxis, yAxis, chart, xScale, yScale, title, w, x, i;

  // determine the desired font size
  em = 12;
  if (info.height < 25 * em)
    em = info.height / 25;

  chart = {
    top: em * LEGEND_PAD_Y,
    bottom: info.height - em * LEGEND_PAD_Y - em
  };
  chart.height = chart.bottom - chart.top;

  // lay out the Y axis
  yAxis = layoutAxis(info.yMin, info.yMax, 10);
  x = 0;
  for (i = 0; i < yAxis.length; i++) {
    w = numberWidth(yAxis[i].label, em);
    if (w > x)
      x = w;
  }
  chart.left = em * LEGEND_PAD_X + x;
  yScale = chart.height / (yAxis[yAxis.length - 1].value - yAxis[0].value);

  // lay out the X axis
  w = numberWidth(info.xMax.toFixed(fractionDigits(info.xMax)), em);
  xAxis = layoutAxis(info.xMin, info.xMax, info.width / (w * 4));
  i = xAxis.length - 1;
  w = numberWidth(xAxis[i].label, em);
  chart.right = info.width - w / 2;
  chart.width = chart.right - chart.left;
  xScale = chart.width / (xAxis[xAxis.length - 1].value - xAxis[0].value);

  // title is along the top
  title = {
    left: chart.left,
    right: chart.right,
    center: (chart.left + chart.right) / 2,
    top: 0,
    bottom: em
  };

  // return layout values to graph
  return {
    em: em,
    ascender: em * 0.8,
    descender: em * 0.2,
    chart: chart,
    title: title,
    xAxis: xAxis,
    yAxis: yAxis,
    xLegend: {
      left: title.left,
      right: title.right,
      center: title.center,
      top: info.height - em,
      bottom: info.height
    },
    yLegend: {
      left: 0,
      right: em,
      top: chart.top,
      bottom: chart.bottom,
      center: (chart.top + chart.bottom) / 2
    },
    xScale: xScale,
    plotX: function(v) {
      return chart.left + (v - xAxis[0].value) * xScale;
    },
    yScale: yScale,
    plotY: function(v) {
      return chart.bottom - (v - yAxis[0].value) * yScale;
    },
  };
}

function thrustCurve(spec) {
  var stats, image, width, height, unit, layout, yConvert, x0, y1, x, y, label, i;

  if (spec == null || spec.data == null)
    return;
  stats = analyze.stats(spec.data);
  if (stats == null)
    return;
  if (spec.width >= 1 && spec.height >= 1) {
    width = spec.width;
    height = spec.height;
  } else {
    width = 300;
    height = 200;
  }
  if (spec.unit)
    unit = units.force.get(spec.unit);
  if (unit == null)
    unit = units.force.get('N');
  yConvert = 1 / unit.toMKS;

  layout = layoutGraph({
    width: width,
    height: height,
    xMin: 0,
    xMax: stats.maxTime,
    yMin: 0,
    yMax: stats.maxThrust * yConvert
  });

  image = new svg.Image(width, height);
  image.font = layout.em + 'px Helvetica';

  // fill the chart area
  image.fillStyle = 'white';
  image.fillRect(layout.chart.left, layout.chart.top, layout.chart.width, height);

  // fill under the thrust curve
  image.fillStyle = '#e7e7e7';
  image.beginPath();
  image.moveTo(layout.plotX(0), layout.plotY(0));
  for (i = 0; i < spec.data.points.length; i++) {
    if (spec.data.points[i].time > 0)
        image.lineTo(layout.plotX(spec.data.points[i].time), layout.plotY(spec.data.points[i].thrust * yConvert));
  }
  i = spec.data.points.length - 1;
  if (spec.data.points[i].thrust > 0)
    image.lineTo(layout.plotX(spec.data.points[i].time), layout.plotY(0));
  image.fill();

  // draw the title and copyright
  image.fillStyle = 'black';
  if (spec.title) {
    image.textAlign = 'left';
    image.fillText(spec.title, layout.chart.left, layout.ascender);
  }
  image.textAlign = 'right';
  image.fillText('© ThrustCurve.org ' + new Date().getFullYear(), layout.chart.right, layout.ascender);

  // draw the X axis legend
  image.textAlign = 'center';
  image.fillText('Time (seconds)', (layout.chart.left + layout.chart.right) / 2, height - layout.descender);

  // draw the Y axis legend
  image.textAlign = 'center';
  image.fillTextVert('Thrust (' + unit.description + ')', layout.ascender, (layout.chart.top + layout.chart.bottom) / 2);

  // draw the X axis labels
  image.strokeStyle = '#aaa';
  image.textAlign = 'center';
  y1 = layout.chart.bottom + layout.em / 3;
  for (i = 0; i < layout.xAxis.length; i++) {
    x = layout.plotX(layout.xAxis[i].value);
    image.beginPath();
    image.moveTo(x, layout.chart.top);
    image.lineTo(x, y1);
    image.stroke();

    image.fillText(layout.xAxis[i].label, x, y1 + layout.ascender);
  }

  // draw the Y axis labels and grid lines
  i = layout.yAxis.length - 1;
  image.textAlign = 'right';
  x0 = layout.chart.left - layout.em / 3;
  for (i = 0; i < layout.yAxis.length; i++) {
    y = layout.plotY(layout.yAxis[i].value);

    image.beginPath();
    image.moveTo(x0, y);
    image.lineTo(layout.chart.right, y);
    image.stroke();

    image.fillText(layout.yAxis[i].label, x0 - layout.em / 10, y + layout.em / 3);
  }

  // draw the annotations
  image.strokeStyle = image.fillStyle = '#2e448c';
  image.lineWidth = 0.5;
  if (stats.avgThrust > 0) {
    y = layout.plotY(stats.avgThrust * yConvert);

    image.beginPath();
    image.moveTo(layout.chart.left, y);
    image.lineTo(layout.chart.right, y);
    image.stroke();

    image.textAlign = 'right';
    label = 'avg. ' + (stats.avgThrust * yConvert).toFixed(unit.digits) + unit.label;
    image.fillText(label, layout.chart.right - layout.em / 4, y - layout.descender);
  }
  if (stats.burnStart > 0.005) {
    // only show if label would be on graph
    x = layout.plotX(stats.burnStart);
    if (x >= layout.chart.left + layout.ascender) {
      image.beginPath();
      image.moveTo(x, layout.chart.top);
      image.lineTo(x, layout.chart.bottom);
      image.stroke();
  
      image.textAlign = 'right';
      label = 'start ' + stats.burnStart.toFixed(2) + 's';
      image.fillTextVert(label, x - layout.descender, layout.chart.top + layout.em / 4);
    }
  }
  if (stats.burnEnd > 0) {
    x = layout.plotX(stats.burnEnd);
   image.beginPath();
   image.moveTo(x, layout.chart.top);
   image.lineTo(x, layout.chart.bottom);
   image.stroke();

   image.textAlign = 'right';
   label = 'end ' + stats.burnEnd.toFixed(2) + 's';
   image.fillTextVert(label, x - layout.descender, layout.chart.top + layout.em / 4);
  }

  // draw the thrust curve line
  image.strokeStyle = '#9e1a20';
  image.lineWidth = 3;
  image.beginPath();
  image.moveTo(layout.plotX(0), layout.plotY(0));
  for (i = 0; i < spec.data.points.length; i++) {
    if (spec.data.points[i].time > 0)
      image.lineTo(layout.plotX(spec.data.points[i].time), layout.plotY(spec.data.points[i].thrust * yConvert));
  }
  image.stroke();

  // draw the thrust curve points
  image.fillStyle = 'white';
  image.strokeStyle = '#9e1a20';
  image.lineWidth = 2;
  for (i = 0; i < spec.data.points.length; i++) {
    x = layout.plotX(spec.data.points[i].time);
    y = layout.plotY(spec.data.points[i].thrust * yConvert);
    label = spec.data.points[i].time.toFixed(3) + 's' + ' ' +
            spec.data.points[i].thrust.toFixed(3) + unit.label;
    image.fillCircle(x, y, 3, label);
    image.strokeCircle(x, y, 3, label);
  }

  return image;
}

/**
 * The <b>graphs</b> module builds chart images for thrust curves and
 * simulation results.
 *
 * @module graphs
 */
module.exports = {
  /**
   * The list of supported image formats.
   * @member {string[]}
   */
  AllFormats: AllFormats,

  /**
   * The MIME type for SVG images.
   * @member {string}
   */
  SVG: SVG,

  /**
   * Build a thrust curve graph as an image object and return it.
   * If an error occurs, null is returned.
   * @function
   * @param {object} spec graph information
   * @param {object} spec.data parsed simulator file data
   * @param {number} spec.width target image width
   * @param {height} spec.height target image width
   * @param {string} [spec.title] graph title
   * @param {string} [spec.unit] force unit to use
   * @return {object} constructed image object
   */
  thrustCurve: thrustCurve,

  /**
   * Build a thrust curve graph and send it to the response.
   * If an error occurs, 500 status is sent.
   * @function
   * @param {object} res Express response object
   * @param {object} spec graph information (see thrustcurve)
   * @return {boolean} true if image sent
   */
  sendThrustCurve: function(res, spec) {
    var image = thrustCurve(spec);
    if (image == null) {
      res.status(500).send();
      return false;
    } else {
      res.type(image.format).send(image.render());
      return true;
    }
  },
};
