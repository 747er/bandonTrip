import { speedColor } from "@/lib/windMath";

/**
 * Wind particles on WebGL: every particle is a short ribbon from where it was to where
 * the wind carried it, all drawn in one call, over a canvas that fades a little each
 * frame so the ribbons leave trails. Positions are CSS pixels of the canvas.
 *
 * The caller supplies `sample(x, y)`: the wind at a screen point as [east, south] mph
 * (screen axes), or null where there is no data.
 */
export type Sampler = (x: number, y: number) => [number, number] | null;

const VERT = `
attribute vec2 a_pos;
attribute vec4 a_color;
uniform vec2 u_size;
varying vec4 v_color;
void main() {
  vec2 clip = a_pos / u_size * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_color = a_color;
}`;
const FRAG = `
precision mediump float;
varying vec4 v_color;
void main() { gl_FragColor = v_color; }`;

/** Pixels a particle moves per frame for each mph of wind */
const PX_PER_MPH = 0.13;
const WIDTH = 1.5;
const FADE = 0.09;
const STRIDE = 6; // x, y, r, g, b, a
const VERTS = 6; // two triangles per ribbon

export class WindParticles {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private quad: WebGLBuffer;
  private aPos: number;
  private aColor: number;
  private uSize: WebGLUniformLocation | null;
  private w = 0;
  private h = 0;
  private count = 0;
  private x = new Float32Array(0);
  private y = new Float32Array(0);
  private age = new Float32Array(0);
  private life = new Float32Array(0);
  private data = new Float32Array(0);
  private sample: Sampler = () => null;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      antialias: false,
    });
    if (!gl) throw new Error("WebGL is not available");
    this.gl = gl;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    gl.useProgram(program);
    this.program = program;
    this.aPos = gl.getAttribLocation(program, "a_pos");
    this.aColor = gl.getAttribLocation(program, "a_color");
    this.uSize = gl.getUniformLocation(program, "u_size");
    this.buffer = gl.createBuffer()!;
    this.quad = gl.createBuffer()!;
    gl.enable(gl.BLEND);
    gl.enableVertexAttribArray(this.aPos);
    gl.enableVertexAttribArray(this.aColor);
  }

  /** Match the canvas to its CSS size. Soft content: rendered below full display density. */
  resize(width: number, height: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = width;
    this.h = height;
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    const count = Math.min(2000, Math.max(240, Math.round((width * height) / 800)));
    this.count = count;
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.age = new Float32Array(count);
    this.life = new Float32Array(count);
    this.data = new Float32Array(count * VERTS * STRIDE);
    for (let i = 0; i < count; i++) this.spawn(i, true);

    // A full-canvas quad for the fade pass, in the same pixel space as the ribbons.
    const gl = this.gl;
    const q = [0, 0, width, 0, 0, height, 0, height, width, 0, width, height];
    const quad = new Float32Array(6 * STRIDE);
    for (let i = 0; i < 6; i++) quad.set([q[i * 2], q[i * 2 + 1], 0, 0, 0, FADE], i * STRIDE);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    this.clear();
  }

  setSampler(sample: Sampler) {
    this.sample = sample;
  }

  clear() {
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  private spawn(i: number, scatter = false) {
    this.x[i] = Math.random() * this.w;
    this.y[i] = Math.random() * this.h;
    this.life[i] = 45 + Math.random() * 75;
    this.age[i] = scatter ? Math.random() * this.life[i] : 0;
  }

  private bind(buffer: WebGLBuffer) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, STRIDE * 4, 0);
    gl.vertexAttribPointer(this.aColor, 4, gl.FLOAT, false, STRIDE * 4, 8);
  }

  /** Advance every particle one step and draw. */
  frame() {
    const { gl, data } = this;
    if (this.w === 0) return;
    let n = 0;
    for (let i = 0; i < this.count; i++) {
      const x0 = this.x[i];
      const y0 = this.y[i];
      const wind = this.sample(x0, y0);
      if (!wind) {
        this.spawn(i);
        continue;
      }
      const mph = Math.hypot(wind[0], wind[1]);
      const x1 = x0 + wind[0] * PX_PER_MPH;
      const y1 = y0 + wind[1] * PX_PER_MPH;
      this.x[i] = x1;
      this.y[i] = y1;
      this.age[i]++;
      if (this.age[i] > this.life[i] || x1 < -4 || y1 < -4 || x1 > this.w + 4 || y1 > this.h + 4) {
        this.spawn(i);
        continue;
      }
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (len < 0.02) continue;
      // A ribbon: the segment widened to WIDTH along its normal.
      const nx = (-(y1 - y0) / len) * (WIDTH / 2);
      const ny = ((x1 - x0) / len) * (WIDTH / 2);
      const [r, g, b] = speedColor(mph);
      // Fade in at birth and out at death; calmer air is drawn fainter.
      const a = Math.sin((Math.PI * this.age[i]) / this.life[i]) * Math.min(1, 0.45 + mph / 14) * 0.95;
      const cr = (r / 255) * a;
      const cg = (g / 255) * a;
      const cb = (b / 255) * a;
      const corners = [
        x0 - nx, y0 - ny, x0 + nx, y0 + ny, x1 - nx, y1 - ny,
        x1 - nx, y1 - ny, x0 + nx, y0 + ny, x1 + nx, y1 + ny,
      ];
      for (let k = 0; k < VERTS; k++) {
        data[n++] = corners[k * 2];
        data[n++] = corners[k * 2 + 1];
        data[n++] = cr;
        data[n++] = cg;
        data[n++] = cb;
        data[n++] = a;
      }
    }

    gl.useProgram(this.program);
    gl.uniform2f(this.uSize, this.w, this.h);
    // Fade what is already there...
    gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
    this.bind(this.quad);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // ...then lay this frame's ribbons over it.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.bind(this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, n / STRIDE);
  }

  /** Nothing to release by hand: the context goes with the canvas. (Forcing it lost
   *  would also kill it for a remount onto the same canvas.) */
  destroy() {
    this.clear();
  }
}
