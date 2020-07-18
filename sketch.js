// TODO: polygon internal designs (stripes, decrease line strokes, etc)
// TODO: shearing (pushing polys along cut instead of perpendicular)
// TODO: flipping (need to add 3D to do this and then rotate around axis)
// TODO: polygon deleting


const controls_width = 300;

let polygons;
let num_cuts;

let poly_radius;
let num_points;

let auto_apply_movement = true;
let auto_remove_movement = true;

let queued_cuts = [];
let held_down = false;
let x1, x2, y1, y2;


function get_polygon_centroid(pts) {
  var first = pts[0],
    last = pts[pts.length - 1];
  if (first.x != last.x || first.y != last.y) pts.push(first);
  var twicearea = 0,
    x = 0,
    y = 0,
    nPts = pts.length,
    p1, p2, f;
  for (var i = 0, j = nPts - 1; i < nPts; j = i++) {
    p1 = pts[i];
    p2 = pts[j];
    f = p1.x * p2.y - p2.x * p1.y;
    twicearea += f;
    x += (p1.x + p2.x) * f;
    y += (p1.y + p2.y) * f;
  }
  f = twicearea * 3;
  return [x / f, y / f];
}


function get_points(lines) {
  let points = [];
  lines.forEach(function(shape_line) {
    points.push(shape_line[0]);
  })
  return points;
}


function polygon_points(x, y, radius, npoints) {
  let angle = TWO_PI / npoints;
  let points = [];
  for (let a = 0; a < TWO_PI; a += angle) {
    let sx = x + cos(a + PI / npoints) * radius;
    let sy = y + sin(a + PI / npoints) * radius;

    points.push([sx, sy]);
  }
  return points;
}

function create_polygon_class(x, y, radius, npoints) {
  let points = polygon_points(x, y, radius, npoints);
  let vectors = [];
  for (let i = 0; i < points.length; i++) {
    vectors.push([
      createVector(points[i][0], points[i][1]),
      createVector(points[(i + 1) % npoints][0], points[(i + 1) % npoints][1])
    ]);
  }

  return new Polygon(vectors)
}


function calc_center(lines) {
  let total_x = 0;
  let total_y = 0;

  lines.forEach(function(shape_line) {
    total_x += shape_line[0].x + shape_line[1].x;
    total_y += shape_line[0].y + shape_line[1].y;
  });

  const final_x = total_x / lines.length / 2;
  const final_y = total_y / lines.length / 2;

  return [final_x, final_y];
}


class Polygon {
  constructor(lines, intersected = 0) {
    this.lines = lines;
    this.update_center();
    this.intersected = intersected;
    this.movements = [];
    this.fill_color = null;
  }

  update_center() {
    let res1 = calc_center(this.lines);
    // temporary one based on center of points
    this.center = createVector(res1[0], res1[1]);
    this.lines = clockwise_lines(this.center, this.lines);
    // this calculation needs ordered points
    let res = get_polygon_centroid(get_points(this.lines));
    // overwrite initial center with actual polygon centroid
    this.center = createVector(res[0], res[1]);
  }


  intersect_points(p1, p2) {

    let intersections = [];
    let intersect_lines = [];

    for (let i = 0; i < this.lines.length; i++) {
      let l = this.lines[i];
      let intersection = intersect_point(p1, p2, l[0], l[1]);
      if (intersection != null) {
        intersections.push(intersection);
        intersect_lines.push(i);
      }
    }

    if (intersections.length == 2) {
      if (intersect_lines[0] > intersect_lines[1]) {
        intersections = [intersections[1], intersections[0]];
        intersect_lines = [intersect_lines[1], intersect_lines[0]];
      }
    }

    return [intersections, intersect_lines]
  }

  move() {
    let new_lines = this.lines.slice();
    this.movements.forEach(function(movement) {
      for (let i = 0; i < new_lines.length; i++) {
        new_lines[i][0] = p5.Vector.add(new_lines[i][0], movement);
        new_lines[i][1] = p5.Vector.add(new_lines[i][1], movement);
      }
    })
    this.lines = new_lines;
    if (auto_remove_movement) {
      this.movements = [];
    }
    this.update_center();
  }

  draw(size_frac = 1) {
    const center = this.center;

    beginShape();
    for (let i = 0; i < this.lines.length; i++) {
      let temp = p5.Vector.lerp(center, this.lines[i][0], size_frac);
      vertex(
        temp.x,
        temp.y
      );
    }
    endShape(CLOSE);
  }
}


function clockwise_lines(center, lines) {
  let angles = [];
  lines.forEach(function(l) {
    angles.push(center.sub(l).heading());
  })
  lines.slice().sort(function(a, b) {
    return angles.indexOf(a) - angles.indexOf(b);
  });
  return lines;
}


function intersect_point(p1, p2, p3, p4) {
  const ua = ((p4.x - p3.x) * (p1.y - p3.y) -
      (p4.y - p3.y) * (p1.x - p3.x)) /
    ((p4.y - p3.y) * (p2.x - p1.x) -
      (p4.x - p3.x) * (p2.y - p1.y));

  const ub = ((p2.x - p1.x) * (p1.y - p3.y) -
      (p2.y - p1.y) * (p1.x - p3.x)) /
    ((p4.y - p3.y) * (p2.x - p1.x) -
      (p4.x - p3.x) * (p2.y - p1.y));

  const x = p1.x + ua * (p2.x - p1.x);
  const y = p1.y + ua * (p2.y - p1.y);

  let intersection = createVector(x, y);

  if ((ua < 0) | (ua > 1) | (ub < 0) | (ub > 1)) {
    intersection = null;
  }

  return intersection;
}


function mousePressed() {
  held_down = true;
  x1 = mouseX;
  x2 = mouseX;
  y1 = mouseY;
  y2 = mouseY;
}


function mouseDragged() {
  if (held_down) {
    x2 = mouseX;
    y2 = mouseY;
  }
}


function mouseReleased() {
  queued_cuts.push([createVector(x1, y1), createVector(x2, y2)]);
  held_down = false;
}

let auto_move_sel;
let auto_reset_sel;
let move_button;
let move_magnitude_slider;
let color_1;
let color_2;
let color_picker_0;
let color_picker_1;
let color_picker_2;
let has_outline;
let outline_weight;
let outline_weight_slider;
let outline_color;
let color_type_sel;
let color_type;
let outline_color_picker;
let num_points_slider;
let polygon_size_slider;


function setup() {
  cnv = createCanvas(windowWidth, windowHeight);
  smooth(8)

  num_points = 8;

  color_1 = color(11, 48, 102);
  color_2 = color(71, 152, 209);

  has_outline = true;
  outline_weight = 5;
  outline_color = color(0);

  textAlign(LEFT);
  auto_move_sel = createSelect();
  auto_move_sel.position(160, 50);
  auto_move_sel.option(auto_apply_movement);
  auto_move_sel.option(!auto_apply_movement);
  auto_move_sel.changed(swap_auto_movement);

  textAlign(LEFT);
  auto_reset_sel = createSelect();
  auto_reset_sel.position(160, 70);
  auto_reset_sel.option(auto_remove_movement);
  auto_reset_sel.option(!auto_remove_movement);
  auto_reset_sel.changed(swap_auto_remove);

  textSize(15);
  button = createButton('Apply movement');
  button.position(10, 90);
  button.mousePressed(move_polygons);

  textSize(15);
  button = createButton('Reset movement');
  button.position(140, 90);
  button.mousePressed(reset_movement);

  move_magnitude_slider = createSlider(0, 10, 1, 0.1);
  move_magnitude_slider.position(10, 140);

  color_picker_0 = createColorPicker(color(255));
  color_picker_0.position(100, 215);

  color_picker_1 = createColorPicker(color_1);
  color_picker_1.position(100, 245);

  color_picker_2 = createColorPicker(color_2);
  color_picker_2.position(100, 275);

  color_type = 'Interpolate';
  textAlign(LEFT);
  color_type_sel = createSelect();
  color_type_sel.position(100, 190);
  color_type_sel.option('Interpolate');
  color_type_sel.option('Random between');
  color_type_sel.changed(swap_color_type);

  outline_weight_slider = createSlider(0, 20, outline_weight);
  outline_weight_slider.position(10, 340);

  outline_color_picker = createColorPicker(color(0));
  outline_color_picker.position(100, 365);

  num_points_slider = createSlider(3, 10, num_points, 1);
  num_points_slider.position(10, 430);

  polygon_size_slider = createSlider(0.1, 0.5, 0.3, 0.01);
  polygon_size_slider.position(10, 490);

  generate();
}


function draw_text() {
  push();

  noStroke();
  fill(0);

    textSize(25)
    text('PolyCutter', 10, 10, 200, 40)

  textSize(15);

  text('Auto move when cut', 10, 50, 200, 20);
  text('Auto reset movement', 10, 70, 200, 40);
  text('Movement magnitude', 10, 120, 200, 40);

    text('Color fill type', 10, 190, 340, 50);
  text('Background', 10, 215, 340, 20);
  text('Color 1', 10, 245, 340, 50);
  text('Color 2', 10, 275, 340, 80);

  text('Outline width', 10, 340)
  text('Outline color', 10, 380)

  text('Polygon points', 10, 420)
  text('Polygon size', 10, 480)

  text('Execution mode')
  pop();
}


function swap_auto_movement() {
  auto_apply_movement = !auto_apply_movement;
}


function swap_auto_remove() {
  auto_remove_movement = !auto_remove_movement;
}


function swap_color_type() {
  color_type = color_type_sel.value();
}


function move_polygons() {
  polygons.forEach(function(polygon) {
    polygon.move();
  });
}


function reset_movement() {
  polygons.forEach(function(polygon) {
    polygon.movements = [];
  });
}


function generate() {
  background(color_picker_0.color());

    polygons = [create_polygon_class((width - controls_width) / 2 + controls_width, height / 2, height * polygon_size_slider.value(), num_points_slider.value())];


  for (let i = 0; i < polygons.length; i++) {
    strokeWeight(outline_weight);
    stroke(outline_color_picker.color());
    fill(color_picker_1.color());
    polygons[i].move();
    polygons[i].draw();
  }

  draw_text()

}


function draw() {
  background(color_picker_0.color());

  noStroke()
  fill(255)
  rect(0, 0, controls_width, height)

  if (queued_cuts.length > 0) {
    let new_polygons = [];

    const angle1 = PI * 2 * random();
    const angle2 = angle1 + PI + (random() - 0.5) * PI;
    const radius = width;
    const vecs = queued_cuts.pop();
    const p1 = vecs[0];
    const p2 = vecs[1];

    const movement_length = move_magnitude_slider.value();
    let intersect_counts = 0;

    for (let i = 0; i < polygons.length; i++) {
      let res = polygons[i].intersect_points(p1, p2)

      if (res[0].length == 2) {
        intersect_counts += 1;
        const two_polys = split_polygon(polygons[i], res[0], res[1]);
        new_polygons.push(apply_movement(two_polys[0], [p1, p2], movement_length));
        new_polygons.push(apply_movement(two_polys[1], [p1, p2], movement_length));
      } else {
        new_polygons.push(apply_movement(polygons[i], [p1, p2], movement_length));
      }
    }

    if (intersect_counts == 0) {
      for (let i = 0; i < polygons.length; i++) {
        polygons[i].movements.pop();
      }
    }
    polygons = new_polygons;
  }

  let min_cuts = 100;
  let max_cuts = 0;

  polygons.forEach(function(polygon) {
    const intersections = polygon.intersected;
    if (intersections < min_cuts) {
      min_cuts = intersections;
    }
    if (intersections > max_cuts) {
      max_cuts = intersections;
    }
  });

  polygons.forEach(function(polygon) {
    strokeWeight(outline_weight_slider.value());
    stroke(outline_color_picker.color());
    if (max_cuts == 0) {
      fill(color_picker_1.color());
    } else {
      if (color_type == 'Interpolate') {
        color_value = (polygon.intersected - min_cuts) / max_cuts;
      } else {
        if (polygon.fill_color == null) {
          color_value = random();
          polygon.fill_color = color_value;
        } else {
          color_value = polygon.fill_color;
        }
      }
      fill(lerpColor(color_picker_1.color(), color_picker_2.color(), color_value));
    }
    if (auto_apply_movement) {
      polygon.move();
    }
    polygon.draw(1.0);
  });

  if (held_down) {
    push();
    noFill();
    colorMode(RGB, 255);
    stroke(255, 0, 0);
    strokeWeight(3);
    line(x1, y1, x2, y2);
    pop();
  }

  draw_text()
}


function split_polygon(polygon, intersect_points, intersect_lines) {
  let linesets = [];
  linesets.push([]);
  linesets.push([]);
  const num_lines = polygon.lines.length;
  const intersected = polygon.intersected;

  let checkpoints = 0;

  for (let i = 0; i < num_lines; i++) {
    if (checkpoints == 0) {
      if ((i == intersect_lines[0]) | (i == intersect_lines[1])) {
        linesets[1].push([polygon.lines[i][0], intersect_points[0]]);
        linesets[1].push([intersect_points[0], intersect_points[1]]);
        linesets[0].push([intersect_points[1], intersect_points[0]]);
        linesets[0].push([intersect_points[0], polygon.lines[i][1]]);
        checkpoints += 1;
      } else {
        linesets[1].push(polygon.lines[i]);
      }
    } else if (checkpoints == 1) {
      if ((i == intersect_lines[0]) | (i == intersect_lines[1])) {
        linesets[0].push([polygon.lines[i][0], intersect_points[1]]);
        linesets[1].push([intersect_points[1], polygon.lines[i][1]]);
        checkpoints += 1;
      } else {
        linesets[0].push(polygon.lines[i]);
      }
    } else {
      linesets[1].push(polygon.lines[i]);
    }
  }

  let poly1 = new Polygon(linesets[0], intersected + 1);
  let poly2 = new Polygon(linesets[1], intersected + 1);

  return [poly1, poly2];
}


function apply_movement(polygon, intersect_points, movement_length) {
  let intersect_line = p5.Vector.sub(intersect_points[1], intersect_points[0]);
  let center_line = p5.Vector.sub(polygon.center, intersect_points[0]);

  let angle = intersect_line.angleBetween(center_line);
  const threshold = 0;
  let side_mult;
  if (angle < threshold) {
    side_mult = -1
  } else {
    side_mult = 1;
  }

  let unit_intersect = intersect_line.normalize();
  let normal = p5.Vector.mult(createVector(-unit_intersect.y, unit_intersect.x), side_mult);

  let move_vector = p5.Vector.mult(normal, movement_length);

  polygon.movements.push(move_vector);

  return polygon;
}


function keyPressed() {
  if (key == 'r') {
    generate();
  }
}


function keyPressed() {
    if (key == 's') {
        let c = get(controls_width, 0, width - controls_width, height);
        // saveCanvas.image(c, 0, 0);
        save(c);
    }
}
