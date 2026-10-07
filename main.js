// CS405 · Lab 1 — your first triangle in WebGPU (starter)
// Work through the TODOs in order. After each one, check the matching
// checkpoint on the lab slides. The reference solution is in ../lab1-solution/.

const canvas = document.querySelector('canvas');
if (!navigator.gpu) throw new Error('WebGPU not available');

const adapter = await navigator.gpu.requestAdapter();
const device  = await adapter.requestDevice();

const ctx = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
ctx.configure({ device, format, alphaMode: 'opaque' });
console.log('WebGPU ready:', format);

const SHADER = `
  struct U {time: f32, aspect: f32, mouse: vec2f};
  @group(0) @binding(0) var<uniform> u: U;

  struct VSOut {
    @builtin(position) pos: vec4f,
    @location(0) colour: vec4f
  };


  @vertex fn vs(@builtin(vertex_index) i: u32)
       -> VSOut {
      var p = array<vec2f, 6>(
         vec2f(-0.5,  -0.5),
         vec2f(-0.5, 0.5),
         vec2f( 0.5, -0.5),

         vec2f( -0.5, 0.5),
         vec2f( 0.5,  0.5),
         vec2f(0.5,  -0.5))
         ;

      var c = array<vec3f, 6>(
         vec3f(1.0, 0.0, 0.0),
         vec3f(0.0, 1.0, 0.0),
         vec3f(0.0, 0.0, 1.0),
         vec3f(1.0, 0.0, 0.0),
         vec3f(0.0, 1.0, 0.0),
         vec3f(0.0, 0.0, 1.0)
         );

      let a = u.time;
      //let q = vec2f(p[i].x * cos(a) - p[i].y * sin(a),
      //              (p[i].x * sin(a) + p[i].y * cos(a)) * u.aspect);
      let R = mat2x2f(cos(a), -sin(a),
                      sin(a), -cos(a));
      p[i] = R * p[i];

      let S = mat2x2f(1.5, 0.0,
                      0.0, 0.6);
      // p[i] = R * S * p[i];
      // p[i] = S * R * p[i];
      // p[i] = transpose(R) * p[i];

      var out: VSOut;
      // out.pos = vec4f(q + u.mouse, 0.0,1.0);
      out.pos = vec4f(p[i] + u.mouse, 0.0,1.0);
      out.colour = vec4f(c[i], 1.0);
      return out;
  }
  @fragment fn fs(in: VSOut) -> @location(0) vec4f {
    return in.colour;
  }` ;

const module = device.createShaderModule({ code: SHADER });

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: { module, entryPoint: 'vs' },
  fragment: { module, entryPoint: 'fs', targets: [{ format }] }
});


const ubuf = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});

const bind = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer: ubuf } }]
});

// ---------------------------------------------------------------------------
// TODO 5 — your turn: a square (two triangles), correct aspect ratio,
//   and the shape following the mouse.
// ---------------------------------------------------------------------------
let mouseX = 0;
let mouseY = 0;

window.addEventListener('mousemove', (e) => {
  // Get the exact size and position of the canvas on the screen
    const rect = canvas.getBoundingClientRect();

    // Calculate mouse position relative to the top-left of the canvas
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert to WebGPU NDC (-1.0 to 1.0) using the canvas dimensions
    mouseX = (x / rect.width) * 2.0 - 1.0;
    mouseY = -((y / rect.height) * 2.0 - 1.0);
});

const t0 = performance.now();

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
}
window.addEventListener('resize', resize);
resize();

function frame() {

  const t = (performance.now() - t0) * 0.001;
  const aspectRatio = canvas.width / canvas.height;

  device.queue.writeBuffer(ubuf, 0, new Float32Array([t, aspectRatio, mouseX, mouseY]));

  const enc = device.createCommandEncoder();
  const pass = enc.beginRenderPass({ colorAttachments: [{
    view: ctx.getCurrentTexture().createView(),
    clearValue: { r: 0.19, g: 0.2, b: 0.6, a: 1 },
    loadOp: 'clear', storeOp: 'store' }] });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bind);
  pass.draw(6);
  pass.end();

  device.queue.submit([enc.finish()]);

  requestAnimationFrame(frame);
}
frame();
