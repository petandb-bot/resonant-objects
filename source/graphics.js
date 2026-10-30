/* RESONANT OBJECTS v0.10 — GPU field renderer
 * WebGL2 > WebGL1. Audio remains Web Audio (WebGL is graphics only).
 * Pass 1: native-resolution color field, geometry and GPU connection ribbons.
 * Pass 2: half-resolution double-buffered temporal resonance (GPU ping-pong).
 * Pass 3: composite with optical glow and resonance diffusion.
 * The 2D path is only a compatibility fallback, not the normal renderer.
 */
const FIELD_GLSL = {
 quadVS:`attribute vec2 aCorner; varying vec2 vUV;
 void main(){vUV=aCorner*.5+.5;gl_Position=vec4(aCorner,0.,1.);}`,
 objectVS:`attribute vec2 aCorner;varying vec2 vP;
 uniform vec2 uCenter,uScreen;uniform float uRadius,uAngle;
 void main(){vec2 p=aCorner*1.65;vP=p;
 float c=cos(uAngle),s=sin(uAngle);vec2 q=vec2(p.x*c-p.y*s,p.x*s+p.y*c);
 vec2 xy=uCenter+q*uRadius;vec2 uv=xy/uScreen;
 gl_Position=vec4(uv.x*2.-1.,1.-uv.y*2.,0.,1.);}`,
 bgFS:`precision mediump float;varying vec2 vUV;uniform float uTime,uWorld;
 float glow(vec2 p,vec2 c, float k){return exp(-length((p-c)*vec2(1.25,1.15))*k);}
 void main(){vec2 p=vec2(vUV.x,1.-vUV.y);
 vec3 c;
 if(uWorld<.5){
  c=mix(vec3(.72,.95,.96),vec3(.83,.82,.98),p.x*.53+p.y*.19);
  c+=vec3(.14,.13,.15)*glow(p,vec2(.15,.82),4.5);
  c+=vec3(.08,.15,.15)*glow(p,vec2(.82,.22),3.8);
 }else if(uWorld<1.5){
  c=mix(vec3(1.,.87,.91),vec3(.89,.88,1.),p.x*.4+p.y*.2);
  c+=vec3(.02,.10,.02)*glow(p,vec2(.15,.72),4.2);
  c+=vec3(.12,.09,.04)*glow(p,vec2(.88,.22),4.2);
 }else if(uWorld<2.5){
  c=mix(vec3(.97,.91,.79),vec3(.81,.92,.88),p.x*.58+p.y*.18);
  c+=vec3(.055,.04,.08)*glow(p,vec2(.22,.83),4.2);
 }else{
  c=mix(vec3(.37,.58,.78),vec3(.51,.49,.71),p.x*.64+p.y*.12);
  c+=vec3(.11,.13,.13)*glow(p,vec2(.8,.22),4.5);
  c+=vec3(.09,.06,.12)*glow(p,vec2(.20,.80),3.2);
 }
 float veil=sin(p.x*7.1+p.y*5.2+uTime*.035)*sin(p.x*2.1-p.y*5.3);
 c+=veil*.008;gl_FragColor=vec4(clamp(c,0.,1.),1.);}`,
 objectFS:`precision highp float;varying vec2 vP;
 uniform float uKind,uSeed,uEnergy,uGesture,uTime,uMove,uAura,uWorld;uniform vec3 uColor;
 const float PI=3.14159265359;
 float poly(vec2 p,float N){float a=atan(p.y,p.x)+PI*.5;float s=2.*PI/N;
 return length(p)*cos(mod(a+s*.5,s)-s*.5)-cos(PI/N)*.92;}
 void main(){vec2 p=vP;float r=length(p),a=atan(p.y,p.x);
 float sd=r-.96,ridge=0.;
 if(uWorld<.5){ // JEWEL: facets, clear and refractive.
  if(uKind<.5){sd=r-.96;ridge=exp(-pow((r-.78)/.07,2.));}
  else if(uKind<1.5){sd=poly(p,3.);ridge=exp(-pow((abs(p.x)*.72+abs(p.y)*.55-.35)/.065,2.))*.6;}
  else if(uKind<2.5){sd=poly(p,6.);ridge=exp(-pow((r-.55)/.060,2.));}
  else if(uKind<3.5){sd=abs(r-.72)-.20;ridge=exp(-pow((r-.72)/.07,2.));}
  else if(uKind<4.5){sd=length(vec2(p.x/1.11,p.y/.60))-.93;ridge=exp(-pow((p.y+p.x*.16)/.09,2.));}
  else if(uKind<5.5){sd=poly(p,4.);ridge=exp(-pow((abs(p.x)+abs(p.y)-.59)/.08,2.));}
  else if(uKind<6.5){sd=max(abs(p.x*.88)+abs(p.y*.36),abs(p.y*.92)+abs(p.x*.18))-.83;ridge=exp(-pow((abs(p.y*.42+p.x*.35)-.20)/.065,2.));}
  else {sd=r-(.78+.19*cos(6.*a));ridge=exp(-pow((sin(a*3.)*r)/.09,2.))*.5;}
 }else if(uWorld<1.5){ // CANDY: elastic soft geometric bodies.
  float bounce=.035*(uEnergy+uGesture)*sin(a*4.+uTime*15.+uSeed);
  float superRadius=pow(pow(abs(p.x),3.8)+pow(abs(p.y),3.8),1./3.8);
  sd=mix(r,superRadius,.28+.22*mod(uKind,3.))-.93+bounce;
  ridge=exp(-pow((r-.62)/.25,2.))*.3;
 }else if(uWorld<2.5){ // CERAMIC: restrained, matte rounded geometry.
  sd=mix(r,poly(p,5.+mod(uKind,3.)),.22)-.92;
  ridge=exp(-pow((r-.78)/.16,2.))*.16;
 }else{ // METAL: specular rings and anodized shapes.
  sd=mix(r,poly(p,6.+mod(uKind,3.)),.54)-.93;
  ridge=exp(-pow((r-.69)/.05,2.))*.96;
 }
 float body=1.-smoothstep(-.022,.022,sd);float edge=exp(-pow(sd/.032,2.));
 float shine=exp(-pow(length((p-vec2(-.34,.40))*vec2(.87,1.2))/.45,2.));
 if(uWorld>1.5 && uWorld<2.5)shine*=.27;
 if(uWorld>2.5)shine=pow(shine,.38)*.85;
 float interference=sin(p.x*8.6+p.y*5.2+uSeed)*sin(p.y*4.9-p.x*2.3);
 vec3 col=mix(uColor,vec3(.98,.997,1.),(uWorld>1.5&&uWorld<2.5?.09:.27)+.11*interference+.24*shine);
 col=mix(col,vec3(.36,.65,1.),(uWorld>1.5&&uWorld<2.5?.055:.16)*smoothstep(-.8,.8,p.x-p.y));
 float facets=exp(-pow(sin(10.*a+uSeed*2.8+r*12.)/.34,2.))*.13;
 col+=body*(facets*vec3(.8,.95,1.)+.20*ridge+shine*.18)+uEnergy*.21+uGesture*vec3(.09,.15,.24)*ridge;
 col=mix(col,vec3(1.),edge*.73);
 float halo=exp(-pow(max(sd,0.)/.24,1.15))*(.12+.12*uAura);
 float ring=uEnergy*exp(-pow((r-1.16-uEnergy*.09)/.040,2.));
 float moved=uMove*exp(-pow((r-1.11)/.033,2.))*.68;
 float rubbing=uGesture*exp(-pow((r-1.25)/.060,2.))*.65;
 float trace=clamp(ring+moved+rubbing,0.,1.);
 col=mix(col,vec3(.93,.99,1.),trace*.9);
 float alpha=clamp(body*.94+edge*.37+halo+trace*.88,0.,1.);
 gl_FragColor=vec4(col,alpha);}`,
 ribbonVS:`attribute vec2 aPos;attribute vec2 aRibbon;attribute float aPower;
 uniform vec2 uScreen;varying vec2 vRibbon;varying float vPower;
 void main(){vRibbon=aRibbon;vPower=aPower;vec2 uv=aPos/uScreen;
 gl_Position=vec4(uv.x*2.-1.,1.-uv.y*2.,0.,1.);}`,
 ribbonFS:`precision mediump float;varying vec2 vRibbon;varying float vPower;
 uniform float uTime;
 void main(){float core=exp(-pow((vRibbon.y-.5)*4.2,2.));
 float z=fract(uTime*.38+vRibbon.x*.71);float point=exp(-pow((vRibbon.x-z)/.036,2.));
 float a=(core*.52+point*core*.7)*vPower;
 gl_FragColor=vec4(mix(vec3(.40,.68,.95),vec3(.99,.99,1.),point*.7),clamp(a,0.,.8));}`,
 temporalFS:`precision highp float;varying vec2 vUV;
 uniform sampler2D uPrev;uniform vec2 uSize;uniform vec4 uNodes[11];
 uniform float uCount,uTime,uTrace;
 void main(){vec3 fresh=vec3(0.);vec2 flow=vec2(0.);
 for(int i=0;i<11;i++){
  if(float(i)>=uCount)break;
  vec4 n=uNodes[i];float energy=n.w;
  vec2 delta=(vUV-n.xy)*uSize;float d=length(delta);float radius=n.z;
  float waveRadius=radius*(1.25+mod(uTime*1.07+float(i)*.34,1.4));
  float wave=exp(-pow((d-waveRadius)/max(2.5,radius*.14),2.))*energy;
  float core=exp(-d/max(6.,radius*.85))*energy;
  vec3 hue=mix(vec3(.26,.63,.99),vec3(.96,.58,.89),mod(float(i)*.27,1.));
  fresh+=hue*(wave*.11+core*.015);
  flow+=normalize(delta+vec2(.0001))*(.00008+energy*.00023)*exp(-d/max(2.,radius*2.));
 }
 vec3 old=texture2D(uPrev,clamp(vUV-flow,0.,1.)).rgb;
 vec3 color=clamp(old*.914+fresh*uTrace,0.,1.);
 gl_FragColor=vec4(color,1.);}`,
 compositeFS:`precision mediump float;varying vec2 vUV;
 uniform sampler2D uScene,uHistory;uniform vec2 uPixel;
 uniform float uAura,uTrace;
 void main(){vec3 scene=texture2D(uScene,vUV).rgb;
 vec3 glow=vec3(0.);
 glow+=texture2D(uScene,vUV+vec2(4.,0.)*uPixel).rgb;
 glow+=texture2D(uScene,vUV-vec2(4.,0.)*uPixel).rgb;
 glow+=texture2D(uScene,vUV+vec2(0.,4.)*uPixel).rgb;
 glow+=texture2D(uScene,vUV-vec2(0.,4.)*uPixel).rgb;
 glow*=.25;
 vec3 highlight=max(glow-scene*.86-vec3(.10),0.);
 vec3 field=texture2D(uHistory,vUV).rgb;
 vec3 combined=scene+highlight*uAura*.46+field*uTrace*.82;
 // Gentle tone-map prevents repeated feedback from making the field pure white.
 combined=combined/(vec3(1.)+max(combined-vec3(.88),0.)*.75);
 gl_FragColor=vec4(clamp(combined,0.,1.),1.);}`
};
class VisualRenderer{
 constructor(canvas,overlay,onStatus=()=>{}){
  this.canvas=canvas;this.overlay=overlay;this.overlayCtx=overlay.getContext('2d');
  this.onStatus=onStatus;this.W=1;this.H=1;this.dpr=1;
  this.gl=null;this.ready=false;this.mode='none';this.lost=false;
  this.aura=.48;this.trace=.38;this.quality='balanced';this.post=true;
  this.trailFrames=0;this.fallbackCanvas=null;this.frame=0;this.validateGPU=true;this.renderFailures=0;
  this.init();
  canvas.addEventListener('webglcontextlost',e=>{
   e.preventDefault();
   // Keep the instrument visible while Safari/Chrome recovers the GPU context.
   this.enableFallback('2D graphics · GPU context lost');
   this.lost=false;
   this.canvas.dispatchEvent(new Event('rendererrestored'));
  });
  canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.init();this.resize(this.W,this.H);this.onStatus(this.mode.toUpperCase()+' · GPU pipeline restored');this.canvas.dispatchEvent(new Event('rendererrestored'));});
 }
 setFX(aura,trace){this.aura=Math.max(0,Math.min(1,aura/100));this.trace=Math.max(0,Math.min(1,trace/100));
  if(!this.trace){this.trailFrames=0;this.clearHistory();}}
 setQuality(q){if(!['eco','balanced','high'].includes(q))return;this.quality=q;this.resize(this.W,this.H);}
 needsFrame(){return this.trailFrames>0;}
 shader(type,source){const g=this.gl,s=g.createShader(type);g.shaderSource(s,source);g.compileShader(s);
  if(!g.getShaderParameter(s,g.COMPILE_STATUS)){const msg=g.getShaderInfoLog(s);g.deleteShader(s);throw Error(msg);}return s;}
 program(vs,fs){const g=this.gl,p=g.createProgram();const a=this.shader(g.VERTEX_SHADER,vs),b=this.shader(g.FRAGMENT_SHADER,fs);
  g.attachShader(p,a);g.attachShader(p,b);g.linkProgram(p);g.deleteShader(a);g.deleteShader(b);
  if(!g.getProgramParameter(p,g.LINK_STATUS)){const msg=g.getProgramInfoLog(p);g.deleteProgram(p);throw Error(msg);}return p;}
 locate(p,attrs,uniforms){const g=this.gl,result={};for(const a of attrs)result[a]=g.getAttribLocation(p,a);
  for(const u of uniforms)result[u]=g.getUniformLocation(p,u);return result;}
 init(){const c=this.canvas;
  const config={alpha:false,depth:false,stencil:false,antialias:false,preserveDrawingBuffer:false,powerPreference:'low-power'};
  const g=this.gl=c.getContext('webgl2',config)||c.getContext('webgl',config);
  if(!g){this.enableFallback('WebGL unsupported');return;}
  this.mode=(typeof WebGL2RenderingContext!=='undefined'&&g instanceof WebGL2RenderingContext)?'webgl2':'webgl1';
  try{
   this.programs={
    bg:this.program(FIELD_GLSL.quadVS,FIELD_GLSL.bgFS),
    obj:this.program(FIELD_GLSL.objectVS,FIELD_GLSL.objectFS),
    line:this.program(FIELD_GLSL.ribbonVS,FIELD_GLSL.ribbonFS),
    trail:this.program(FIELD_GLSL.quadVS,FIELD_GLSL.temporalFS),
    compose:this.program(FIELD_GLSL.quadVS,FIELD_GLSL.compositeFS)
   };
   this.bg=this.locate(this.programs.bg,['aCorner'],['uTime','uWorld']);
   this.obj=this.locate(this.programs.obj,['aCorner'],['uCenter','uScreen','uRadius','uAngle','uKind','uSeed','uEnergy','uGesture','uTime','uMove','uAura','uColor','uWorld']);
   this.line=this.locate(this.programs.line,['aPos','aRibbon','aPower'],['uScreen','uTime']);
   this.trail=this.locate(this.programs.trail,['aCorner'],['uPrev','uNodes[0]','uCount','uTime','uSize','uTrace']);
   this.compose=this.locate(this.programs.compose,['aCorner'],['uScene','uHistory','uPixel','uAura','uTrace']);
   this.quadBuffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.quadBuffer);
   g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),g.STATIC_DRAW);
   this.lineBuffer=g.createBuffer();this.target=null;this.history=[];this.historyIndex=0;
   g.disable(g.DEPTH_TEST);g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);
   this.ready=true;this.post=true;this.overlay.style.display='block';
   if(this.fallbackCanvas){this.fallbackCanvas.remove();this.fallbackCanvas=null;}
   this.canvas.style.opacity='1';this.validateGPU=true;this.onStatus(this.mode.toUpperCase()+' · GPU pipeline');
  }catch(e){console.warn('WebGL pipeline:',e);this.enableFallback('Graphics compatibility mode');}
 }
 enableFallback(message){
  // A WebGL canvas cannot acquire 2D after context creation. Fallback lives in another canvas.
  if(!this.gl){this.c2d=this.canvas.getContext('2d');this.canvas.style.opacity='1';}
  else{
   if(!this.fallbackCanvas){this.fallbackCanvas=document.createElement('canvas');
    this.fallbackCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    this.canvas.before(this.fallbackCanvas);}
   this.c2d=this.fallbackCanvas.getContext('2d');this.canvas.style.opacity='0';
  }
  this.mode='canvas2d';this.ready=!!this.c2d;this.overlay.style.display='block';this.onStatus(message);
 }
 makeTarget(w,h){const g=this.gl,tex=g.createTexture();g.bindTexture(g.TEXTURE_2D,tex);
  g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);
  g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
  g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
  g.texImage2D(g.TEXTURE_2D,0,g.RGBA,w,h,0,g.RGBA,g.UNSIGNED_BYTE,null);
  const fbo=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,fbo);
  g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,tex,0);
  if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE){g.deleteTexture(tex);g.deleteFramebuffer(fbo);throw Error('FBO incomplete');}
  return {tex,fbo,w,h};
 }
 clearHistory(){if(!this.gl||!this.ready||!this.history?.length)return;const g=this.gl;
  for(const t of this.history){g.bindFramebuffer(g.FRAMEBUFFER,t.fbo);g.viewport(0,0,t.w,t.h);g.clearColor(0,0,0,1);g.clear(g.COLOR_BUFFER_BIT);}
  g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,this.canvas.width,this.canvas.height);}
 freeTargets(){if(!this.gl)return;for(const t of [this.target,...(this.history||[])])if(t){this.gl.deleteTexture(t.tex);this.gl.deleteFramebuffer(t.fbo);}
  this.target=null;this.history=[];}
 resize(w,h){this.W=w;this.H=h;
  const cap=this.quality==='eco'?1:this.quality==='high'?1.7:1.3;
  let dpi=Math.min(window.devicePixelRatio||1,cap);
  const maxPixels=this.quality==='eco'?440000:this.quality==='high'?1900000:950000;
  dpi=Math.min(dpi,Math.sqrt(maxPixels/Math.max(1,w*h)));
  this.dpr=dpi;
  const pw=Math.max(1,Math.round(w*dpi)),ph=Math.max(1,Math.round(h*dpi));
  this.canvas.width=pw;this.canvas.height=ph;this.overlay.width=pw;this.overlay.height=ph;
  if(this.fallbackCanvas){this.fallbackCanvas.width=pw;this.fallbackCanvas.height=ph;}
  if(this.mode==='canvas2d'||!this.ready)return;
  const g=this.gl;
  this.freeTargets();
  try{
   this.target=this.makeTarget(pw,ph);
   const tw=Math.max(2,Math.ceil(pw*.50)),th=Math.max(2,Math.ceil(ph*.50));
   this.history=[this.makeTarget(tw,th),this.makeTarget(tw,th)];
   this.historyIndex=0;
   for(const t of this.history){g.bindFramebuffer(g.FRAMEBUFFER,t.fbo);g.viewport(0,0,t.w,t.h);g.clearColor(0,0,0,1);g.clear(g.COLOR_BUFFER_BIT);}
   this.post=true;this.validateGPU=true;
  }catch(e){console.warn('Post-processing unavailable, using direct WebGL',e);
   this.freeTargets();this.post=false;this.onStatus(this.mode.toUpperCase()+' · direct graphics');}
  g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,pw,ph);
 }
 quad(info){const g=this.gl;g.bindBuffer(g.ARRAY_BUFFER,this.quadBuffer);
  g.enableVertexAttribArray(info.aCorner);g.vertexAttribPointer(info.aCorner,2,g.FLOAT,false,0,0);
  g.drawArrays(g.TRIANGLES,0,6);g.disableVertexAttribArray(info.aCorner);}
 draw(time,notes,state){if(!this.ready||this.lost)return;
  if(this.mode==='canvas2d'){this.drawFallback(time,notes,state);this.drawFallbackLines(time,notes,state);this.drawThreads(time,notes,state);return;}
  try{
   this.drawGPU(time,notes,state);this.drawThreads(time,notes,state);
   // On the first frame after (re)initialization, verify that the GPU wrote pixels.
   // A successful context acquisition alone does not guarantee a visible frame.
   if(this.validateGPU){
    this.validateGPU=false;
    const g=this.gl,pixel=new Uint8Array(4);
    g.readPixels(Math.floor(this.canvas.width*.5),Math.floor(this.canvas.height*.5),1,1,g.RGBA,g.UNSIGNED_BYTE,pixel);
    const error=g.getError();
    if(error!==g.NO_ERROR || pixel[0]+pixel[1]+pixel[2]<28)
     throw Error('GPU frame validation failed (error '+error+', pixel '+Array.from(pixel).join(',')+')');
   }
  }catch(error){
   console.error('GPU render failed; switching to Canvas 2D:',error);
   this.renderFailures++;
   this.enableFallback('2D graphics · automatic GPU recovery');
   if(this.ready){this.drawFallback(time,notes,state);this.drawFallbackLines(time,notes,state);this.drawThreads(time,notes,state);}
  }
 }
 drawScene(time,notes,state){const g=this.gl;
  g.disable(g.BLEND);g.useProgram(this.programs.bg);g.uniform1f(this.bg.uTime,time);g.uniform1f(this.bg.uWorld,state.materialType||0);this.quad(this.bg);
  g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);
  this.drawLinks(time,notes,state);
  g.useProgram(this.programs.obj);g.uniform2f(this.obj.uScreen,this.W,this.H);
  g.uniform1f(this.obj.uTime,time);
  g.uniform1f(this.obj.uAura,this.aura);g.uniform1f(this.obj.uWorld,state.materialType||0);
  for(const n of notes){g.uniform2f(this.obj.uCenter,n.x,n.y);g.uniform1f(this.obj.uRadius,n.r);
   g.uniform3f(this.obj.uColor,...n.color);g.uniform1f(this.obj.uKind,n.kind);
   g.uniform1f(this.obj.uSeed,n.id*1.131+.7);g.uniform1f(this.obj.uEnergy,n.energy);
   g.uniform1f(this.obj.uGesture,n.gesture||0);
   g.uniform1f(this.obj.uMove,n.dragged?1:0);
   g.uniform1f(this.obj.uAngle,n.angle);this.quad(this.obj);}
 }
 drawLinks(time,notes,state){const g=this.gl,verts=[];
  const reach=Math.max(95,Math.min(this.W,this.H)*.86);
  for(let i=0;i<notes.length;i++){
   const a=notes[i];const nearest=notes.map((n,j)=>({n,j,d:Math.hypot(n.x-a.x,n.y-a.y)}))
    .filter(v=>v.j!==i&&v.d<reach).sort((x,y)=>x.d-y.d).slice(0,3);
   for(const {n:b,j,d} of nearest){if(j<i)continue;
    const energy=Math.max(a.energy,b.energy),power=.01+energy*.52;
    if(power<.035)continue;
    const dx=b.x-a.x,dy=b.y-a.y,nx=-dy/d,ny=dx/d,width=(1.3+energy*2.6+(state.dragging?1.6:0));
    const positions=[[0,0],[1,0],[0,1],[0,1],[1,0],[1,1]];
    for(const [t,v] of positions)verts.push(a.x+dx*t+nx*(v-.5)*width,a.y+dy*t+ny*(v-.5)*width,t,v,power);
   }
  }
  if(!verts.length)return;
  g.useProgram(this.programs.line);g.uniform2f(this.line.uScreen,this.W,this.H);g.uniform1f(this.line.uTime,time);
  g.bindBuffer(g.ARRAY_BUFFER,this.lineBuffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array(verts),g.DYNAMIC_DRAW);
  for(const [name,size,offset] of [['aPos',2,0],['aRibbon',2,8],['aPower',1,16]]){
   const id=this.line[name];g.enableVertexAttribArray(id);g.vertexAttribPointer(id,size,g.FLOAT,false,20,offset);}
  g.drawArrays(g.TRIANGLES,0,verts.length/5);
  for(const name of ['aPos','aRibbon','aPower'])g.disableVertexAttribArray(this.line[name]);
 }
 drawGPU(time,notes,state){const g=this.gl,pw=this.canvas.width,ph=this.canvas.height;
  const surface=this.post?this.target:null;
  g.bindFramebuffer(g.FRAMEBUFFER,surface?.fbo||null);g.viewport(0,0,pw,ph);
  this.drawScene(time,notes,state);
  if(!this.post)return;
  // Feedback: only the trail texture carries previous frames. Scene never feeds itself.
  const next=1-this.historyIndex,src=this.history[this.historyIndex],dst=this.history[next];
  g.disable(g.BLEND);g.bindFramebuffer(g.FRAMEBUFFER,dst.fbo);g.viewport(0,0,dst.w,dst.h);
  g.useProgram(this.programs.trail);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,src.tex);
  g.uniform1i(this.trail.uPrev,0);g.uniform2f(this.trail.uSize,this.W,this.H);
  g.uniform1f(this.trail.uCount,notes.length);g.uniform1f(this.trail.uTime,time);
  g.uniform1f(this.trail.uTrace,this.trace);
  const nvec=new Float32Array(44);
  for(let i=0;i<notes.length;i++){const n=notes[i];nvec.set([n.x/this.W,1-n.y/this.H,n.r,n.energy],i*4);}
  g.uniform4fv(this.trail['uNodes[0]'],nvec);this.quad(this.trail);
  this.historyIndex=next;
  g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,pw,ph);
  g.useProgram(this.programs.compose);
  g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.target.tex);g.uniform1i(this.compose.uScene,0);
  g.activeTexture(g.TEXTURE1);g.bindTexture(g.TEXTURE_2D,dst.tex);g.uniform1i(this.compose.uHistory,1);
  g.uniform2f(this.compose.uPixel,1/pw,1/ph);g.uniform1f(this.compose.uAura,this.aura);
  g.uniform1f(this.compose.uTrace,this.trace);this.quad(this.compose);
  const active=notes.some(n=>n.energy>.03||(n.gesture||0)>.03);
  if(active&&this.trace>0)this.trailFrames=95;
  else if(this.trailFrames>0)this.trailFrames--;
  this.frame++;
 }
 // 2D linework overlays the WebGL field; the geometric scene remains GPU-rendered.
 // Persistent link curves carry an energy pulse from the most recently struck note.
 drawThreads(time,notes,state){
  const c=this.overlayCtx,d=this.dpr;if(!c)return;
  c.setTransform(d,0,0,d,0,0);
  if(this.mode!=='canvas2d')c.clearRect(0,0,this.W,this.H);
  const all=state.connections||[];
  for(const e of all){const a=notes[e.a],b=notes[e.b];if(!a||!b)continue;
   const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1;
   const mag=Math.min(1,Math.max(a.energy,b.energy)*.65+e.flash*.75);
   const bend=Math.min(13,L*.12)*(e.a%2?1:-1);
   const mx=(a.x+b.x)/2-dy/L*bend,my=(a.y+b.y)/2+dx/L*bend;
   c.beginPath();c.moveTo(a.x,a.y);c.quadraticCurveTo(mx,my,b.x,b.y);
   c.strokeStyle=`rgba(255,255,255,${.62+mag*.34})`;c.lineWidth=4+mag*3;c.shadowColor='#92ddff';c.shadowBlur=7+mag*9;c.stroke();
   c.shadowBlur=0;c.beginPath();c.moveTo(a.x,a.y);c.quadraticCurveTo(mx,my,b.x,b.y);
   c.strokeStyle=`rgba(77,132,192,${.36+mag*.3})`;c.lineWidth=1.1;c.stroke();
   if(e.flash>.025){const t=(time*.7+e.a*.17)%1;
    const px=(1-t)*(1-t)*a.x+2*(1-t)*t*mx+t*t*b.x,py=(1-t)*(1-t)*a.y+2*(1-t)*t*my+t*t*b.y;
    c.beginPath();c.arc(px,py,3+e.flash*2.5,0,Math.PI*2);c.fillStyle='rgba(255,255,255,.96)';c.shadowColor='#6bc4fd';c.shadowBlur=13;c.fill();c.shadowBlur=0;}
  }
  const candidate=state.threadPreview;
  if(candidate){const a=notes[candidate.a],b=notes[candidate.b];if(a&&b){
   c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineWidth=2.7;
   c.setLineDash([5,7]);c.strokeStyle=`rgba(255,255,255,${.28+candidate.progress*.6})`;c.stroke();c.setLineDash([]);
   const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;c.beginPath();c.arc(cx,cy,4+candidate.progress*6,-Math.PI/2,-Math.PI/2+candidate.progress*Math.PI*2);
   c.lineWidth=2;c.strokeStyle='rgba(93,152,201,.84)';c.stroke();
  }}
 }

 // Compatibility only. It is *not* composited into the WebGL path.
 drawFallback(time,notes,state){const c=this.c2d,W=this.W,H=this.H,d=this.dpr;
  c.setTransform(d,0,0,d,0,0);const bg=c.createLinearGradient(0,0,W,H);
  const ramps=[['#c2f6e8','#cedff9','#e7d3fc'],['#ffe5ea','#fcd6dd','#d9d4fc'],['#f7e8cf','#deebe2','#e6d4c4'],['#86acd1','#8298c4','#b1a8d1']][state.materialType||0];bg.addColorStop(0,ramps[0]);bg.addColorStop(.55,ramps[1]);bg.addColorStop(1,ramps[2]);
  c.fillStyle=bg;c.fillRect(0,0,W,H);
  for(const n of notes){c.save();c.translate(n.x,n.y);c.rotate(n.angle);
   const halo=c.createRadialGradient(0,0,n.r*.42,0,0,n.r*1.7);
   halo.addColorStop(0,n.hex+'45');halo.addColorStop(1,n.hex+'00');
   c.fillStyle=halo;c.beginPath();c.arc(0,0,n.r*1.7,0,Math.PI*2);c.fill();
   const grad=c.createLinearGradient(-n.r,-n.r,n.r,n.r);
   grad.addColorStop(0,'#ffffff');grad.addColorStop(.23,n.hex);grad.addColorStop(.56,'#c6efff');grad.addColorStop(1,n.hex);
   c.globalAlpha=.95;c.beginPath();
   if((state.materialType===0||state.materialType===3)&&(n.kind===1||n.kind===2||n.kind===5||n.kind===6)){const sides=n.kind===1?3:n.kind===2?6:4;
    for(let i=0;i<sides;i++){const a=Math.PI*2*i/sides-Math.PI/2;
     if(i===0)c.moveTo(Math.cos(a)*n.r*.92,Math.sin(a)*n.r*.92);
     else c.lineTo(Math.cos(a)*n.r*.92,Math.sin(a)*n.r*.92);}c.closePath();}
   else{c.arc(0,0,n.r*.94,0,Math.PI*2);}
   c.fillStyle=state.materialType===2?n.hex:grad;c.shadowBlur=12+n.energy*22+(n.gesture||0)*12;c.shadowColor=n.hex;c.fill();
   c.shadowBlur=0;c.strokeStyle='#ffffffd9';c.lineWidth=2;c.stroke();
   if(state.materialType===0&&n.kind===3){c.globalCompositeOperation='destination-out';c.beginPath();c.arc(0,0,n.r*.48,0,Math.PI*2);c.fill();}
   c.restore();}
 }
 drawFallbackLines(time,notes,state){const c=this.overlayCtx,d=this.dpr;
  c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,this.W,this.H);
  c.lineWidth=1;const reach=Math.min(260,Math.max(95,this.H*.8));
  for(let i=0;i<notes.length;i++)for(let j=i+1;j<notes.length;j++){
   const a=notes[i],b=notes[j],distance=Math.hypot(a.x-b.x,a.y-b.y);
   if(distance>reach||Math.max(a.energy,b.energy)<.18)continue;
   c.strokeStyle=`rgba(255,255,255,${Math.min(.66,Math.max(a.energy,b.energy)*.35)})`;
   c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}
  for(const n of notes){if(n.dragged){
   c.lineWidth=2;c.strokeStyle="rgba(255,255,255,.85)";c.beginPath();c.arc(n.x,n.y,n.r*1.32,0,Math.PI*2);c.stroke();c.lineWidth=1;
  }c.strokeStyle=`rgba(255,255,255,${.25+n.energy*.65})`;
   c.beginPath();c.arc(n.x,n.y,n.r*(1.20+n.energy*.3+(n.gesture||0)*.15),0,Math.PI*2);c.stroke();}
 }
}


