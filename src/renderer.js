/* RESONANT OBJECTS — WebGL / 2D renderer
   音響とは独立。WebGL 2を優先、WebGL 1もGLSL ES 1.00で対応。
   レンダリング解像度を制限し、実機でのGPU負荷を抑える。
   オーバーレイの線画は描画コストを抑えたCanvas 2D。
 */
const GL_SHADER={
 vs:`attribute vec2 aCorner; varying vec2 vP;
     uniform vec2 uCenter,uScreen;uniform float uRadius,uAngle;
     void main(){vec2 p=vec2(aCorner.x*1.68,aCorner.y*1.68);vP=p;
       float cs=cos(uAngle),sn=sin(uAngle);vec2 q=vec2(p.x*cs-p.y*sn,p.x*sn+p.y*cs);
       vec2 xy=uCenter+q*uRadius;vec2 uv=xy/uScreen;
       gl_Position=vec4(uv.x*2.-1.,1.-uv.y*2.,0.,1.);}`,
 bgvs:`attribute vec2 aCorner;varying vec2 vUV;
       void main(){vUV=aCorner*.5+.5;gl_Position=vec4(aCorner,0.,1.);}`,
 bgfs:`precision mediump float;varying vec2 vUV;uniform float uTime;
    float bloom(vec2 uv,vec2 p,float rad){return exp(-length((uv-p)*vec2(1.25,1.5))*rad);}
    void main(){vec2 uv=vec2(vUV.x,1.-vUV.y);
      vec3 col=mix(vec3(.78,.94,.94),vec3(.86,.85,.96),uv.x*.68+uv.y*.11);
      col+=vec3(.12,.06,.13)*bloom(uv,vec2(.69,.38),3.4);
      col+=vec3(.08,.08,.09)*bloom(uv,vec2(.22,.87),4.0);
      col+=vec3(.07,.13,.10)*bloom(uv,vec2(.15,.18),3.9);
      col=mix(col,vec3(.97,.98,.93),.14*bloom(uv,vec2(.49,.46),1.9));
      float weave=sin(uv.x*7.1+uv.y*5.6+uTime*.07)*sin(uv.y*4.4-uv.x*3.3);
      col+=weave*.007;
      gl_FragColor=vec4(clamp(col,0.,1.),1.);}`,
 objfs:`precision highp float;varying vec2 vP;
  uniform float uKind,uSeed,uEnergy,uTime,uMove,uAngle;uniform vec3 uColor;
  const float PI=3.14159265359;
  float poly(vec2 p,float N){float a=atan(p.y,p.x)+PI*.5;float sector=2.*PI/N;
    return length(p)*cos(mod(a+sector*.5,sector)-sector*.5)-cos(PI/N)*.92;}
  void main(){vec2 p=vP;float r=length(p);float a=atan(p.y,p.x);
    float sd=r-1.;float ridge=0.;float inner=0.;
    if(uKind<.5){sd=r-.96;ridge=exp(-pow((r-.78)/.07,2.));}
    else if(uKind<1.5){sd=poly(p,3.);ridge=exp(-pow((abs(p.x)*.72+abs(p.y)*.55-.35)/.06,2.))*.6;}
    else if(uKind<2.5){sd=poly(p,6.);ridge=exp(-pow((r-.53)/.055,2.));}
    else if(uKind<3.5){sd=abs(r-.72)-.205;inner=1.;ridge=exp(-pow((r-.70)/.07,2.));}
    else if(uKind<4.5){sd=length(vec2(p.x/1.11,p.y/.58))-.94;ridge=exp(-pow((p.y+p.x*.14)/.09,2.));}
    else if(uKind<5.5){sd=poly(p,4.);ridge=exp(-pow((abs(p.x)+abs(p.y)-.62)/.08,2.));}
    else if(uKind<6.5){sd=max(abs(p.x*.88)+abs(p.y*.37),abs(p.y*.92)+abs(p.x*.18))-.82;ridge=exp(-pow((abs(p.y*.42+p.x*.35)-.20)/.065,2.));}
    else {sd=r-(.78+.20*cos(6.*a));ridge=exp(-pow((sin(a*3.)*r)/.09,2.))*.5;}
    float aa=.025;float body=1.-smoothstep(-aa,aa,sd);
    float halo=exp(-pow(max(sd,0.)/.26,1.30))*.17;
    float edge=exp(-pow(sd/.037,2.));
    float shimmer=sin(p.x*6.2+p.y*4.4+uSeed)*sin(p.y*5.7-p.x*1.5);
    float gleam=exp(-pow(length((p-vec2(-.36,.36))*vec2(.9,1.2))/.39,2.));
    vec3 col=mix(uColor,vec3(.98,.98,1.),.45+.19*shimmer+.20*gleam);
    col=mix(col,vec3(.41,.73,.99),.15*smoothstep(-.7,.7,p.x-p.y));
    col+=.31*gleam+.32*ridge+uEnergy*.19;
    col=mix(col,vec3(1.),.61*edge);
    // 透明感とコントラストを保ち、CGのプラスチック球にしない。
    float alpha=clamp(body*.94+halo+edge*.40,0.,1.);
    // 発音体の外側に発光するリング。
    float pulse=uEnergy*exp(-pow((r-1.13-uEnergy*.15)/.043,2.));
    float moveRing=uMove*exp(-pow((r-1.12)/.034,2.))*.6;
    float blend=clamp(pulse+moveRing,0.,1.);
    alpha=clamp(alpha+blend*.9,0.,1.);
    col=mix(col,mix(uColor,vec3(1.),.7),blend);
    gl_FragColor=vec4(col,alpha);}`
};
class VisualRenderer {
 constructor(canvas,overlay,onStatus=()=>{}){
  this.canvas=canvas;this.overlay=overlay;this.ctx=overlay.getContext('2d');this.onStatus=onStatus;
  this.gl=null;this.ready=false;this.fallback=false;this.lost=false;this.W=1;this.H=1;this.dpr=1;
  this.init();
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.ready=false;this.onStatus('WebGL paused');});
  canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.init();this.resize(this.W,this.H);this.onStatus('Graphics restored');});
 }
 shader(type,src){const g=this.gl,s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);
  if(!g.getShaderParameter(s,g.COMPILE_STATUS)){const message=g.getShaderInfoLog(s);g.deleteShader(s);throw new Error(message);}return s;}
 program(v,f){const g=this.gl,p=g.createProgram(),a=this.shader(g.VERTEX_SHADER,v),b=this.shader(g.FRAGMENT_SHADER,f);
  g.attachShader(p,a);g.attachShader(p,b);g.linkProgram(p);g.deleteShader(a);g.deleteShader(b);
  if(!g.getProgramParameter(p,g.LINK_STATUS)){const message=g.getProgramInfoLog(p);g.deleteProgram(p);throw new Error(message);}return p;}
 init(){
  const c=this.canvas;
  const gl=this.gl=c.getContext('webgl2',{alpha:false,antialias:true,depth:false,powerPreference:'low-power'})||
    c.getContext('webgl',{alpha:false,antialias:true,depth:false,powerPreference:'low-power'});
  if(!gl){this.fallback=true;this.c2d=c.getContext('2d');this.ready=!!this.c2d;this.onStatus('2D graphics fallback');return;}
  try{
   this.pBg=this.program(GL_SHADER.bgvs,GL_SHADER.bgfs);this.pObj=this.program(GL_SHADER.vs,GL_SHADER.objfs);
   this.quadBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quadBuffer);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
   this.bgInfo=this.locate(this.pBg,['uTime']);this.objInfo=this.locate(this.pObj,['uCenter','uScreen','uRadius','uColor','uKind','uSeed','uEnergy','uTime','uMove','uAngle']);
   gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
   this.ready=true;this.fallback=false;
  }catch(e){console.error('WebGL setup:',e);this.onStatus('WebGL shader error');this.ready=false;}
 }
 locate(p,names){const g=this.gl,o={a:g.getAttribLocation(p,'aCorner')};for(const n of names)o[n]=g.getUniformLocation(p,n);return o;}
 quad(info){const g=this.gl;g.bindBuffer(g.ARRAY_BUFFER,this.quadBuffer);g.enableVertexAttribArray(info.a);
  g.vertexAttribPointer(info.a,2,g.FLOAT,false,0,0);g.drawArrays(g.TRIANGLES,0,6);g.disableVertexAttribArray(info.a);}
 resize(w,h){this.W=w;this.H=h;this.dpr=Math.min(window.devicePixelRatio||1,1.6);
  this.canvas.width=Math.round(w*this.dpr);this.canvas.height=Math.round(h*this.dpr);
  this.overlay.width=Math.round(w*this.dpr);this.overlay.height=Math.round(h*this.dpr);
  if(this.gl&&this.ready)this.gl.viewport(0,0,this.canvas.width,this.canvas.height);}
 draw(time,notes,state){if(!this.ready||this.lost)return;
  if(this.fallback)this.drawFallback(time,notes,state);else this.drawGL(time,notes,state);
  this.drawFilaments(time,notes,state);
 }
 drawGL(time,notes,state){const g=this.gl;g.viewport(0,0,this.canvas.width,this.canvas.height);
  g.useProgram(this.pBg);g.uniform1f(this.bgInfo.uTime,time);this.quad(this.bgInfo);
  g.useProgram(this.pObj);g.uniform2f(this.objInfo.uScreen,this.W,this.H);
  g.uniform1f(this.objInfo.uTime,time);g.uniform1f(this.objInfo.uMove,state.move?1:0);
  for(const n of notes){
   g.uniform2f(this.objInfo.uCenter,n.x,n.y);
   g.uniform1f(this.objInfo.uRadius,n.r);
   g.uniform3f(this.objInfo.uColor,...n.color);
   g.uniform1f(this.objInfo.uKind,n.kind);
   g.uniform1f(this.objInfo.uSeed,n.id*1.131+.7);
   g.uniform1f(this.objInfo.uEnergy,n.energy);
   g.uniform1f(this.objInfo.uAngle,n.angle);
   this.quad(this.objInfo);
  }
 }
 // fallback: WebGL 非対応でも図形を崩さずに描く。iOS古い機種のための保険。
 drawFallback(time,notes,state){const c=this.c2d,W=this.W,H=this.H,d=this.dpr;
  c.setTransform(d,0,0,d,0,0);
  const bg=c.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#c8faf1');bg.addColorStop(.43,'#cfd8f7');bg.addColorStop(.76,'#d5e1fb');bg.addColorStop(1,'#c7efe9');
  c.fillStyle=bg;c.fillRect(0,0,W,H);
  // 光の雲は背景にのみ乗せ、音を鳴らす領域は明瞭に保つ。
  for(const [x,y,rgb,r] of [[.28,.16,'255,255,254',.60],[.80,.25,'173,236,240',.58],[.52,.74,'226,183,255',.55],[.18,.89,'255,235,207',.62]]){
    const cx=x*W,cy=y*H,R=Math.max(W,H)*r;
    const glow=c.createRadialGradient(cx,cy,0,cx,cy,R);
    glow.addColorStop(0,`rgba(${rgb},.19)`);glow.addColorStop(.55,`rgba(${rgb},.07)`);glow.addColorStop(1,`rgba(${rgb},0)`);
    c.fillStyle=glow;c.fillRect(0,0,W,H);
  }
  for(const n of notes){const {x,y,r,kind,angle}=n;c.save();c.translate(x,y);c.rotate(angle);
   // 影の代わりに周辺に透過光を置き、立体アイコンではなく音の結晶として見せる。
   const halo=c.createRadialGradient(0,0,r*.43,0,0,r*1.75);
   halo.addColorStop(0,n.hex+'39');halo.addColorStop(.56,n.hex+'1f');halo.addColorStop(1,n.hex+'00');
   c.fillStyle=halo;c.beginPath();c.arc(0,0,r*1.75,0,Math.PI*2);c.fill();
   const grad=c.createLinearGradient(-r,-r,r,r);
   grad.addColorStop(0,'#ffffff');grad.addColorStop(.19,n.hex);
   grad.addColorStop(.47,'#d4faff');grad.addColorStop(.70,n.hex);grad.addColorStop(1,'#92b9ef');
   c.globalAlpha=.94;this.shapePath(c,kind,r);
   c.shadowColor=n.hex;c.shadowBlur=12+n.energy*18;c.fillStyle=grad;c.fill();
   c.shadowBlur=0;c.lineWidth=2.1;c.strokeStyle='#ffffffee';c.stroke();
   c.save();c.clip();
   // 中心で交わる屈折線と虹色の薄膜。高解像度でもジャギーを抑える。
   const inner=c.createRadialGradient(-r*.28,-r*.32,r*.02,0,0,r*1.1);
   inner.addColorStop(0,'#ffffffa8');inner.addColorStop(.5,'#f9ffff1a');inner.addColorStop(1,'#4877ce23');
   c.fillStyle=inner;c.fillRect(-r*1.2,-r*1.2,r*2.4,r*2.4);
   c.strokeStyle='#ffffff8b';c.lineWidth=.9;
   for(let k=0;k<3;k++){const a=k*Math.PI/3+.3;
     c.beginPath();c.moveTo(-Math.cos(a)*r,-Math.sin(a)*r);c.lineTo(Math.cos(a)*r,Math.sin(a)*r);c.stroke();}
   c.restore();
   if(kind===3){c.beginPath();c.arc(0,0,r*.54,0,Math.PI*2);c.strokeStyle='#ffffffd8';c.lineWidth=2;c.stroke();}
   if(kind===0||kind===2){
     c.beginPath();c.arc(-r*.25,-r*.34,r*.30,Math.PI*1.11,Math.PI*1.72);
     c.strokeStyle='#fffffff2';c.lineWidth=2;c.stroke();
   }
   c.globalAlpha=1;
   c.restore();
  }
 }
 shapePath(c,kind,r){c.beginPath();const count=kind===1?3:kind===2?6:kind===5?4:kind===6?4:128;
  if(kind===3){c.arc(0,0,r*.95,0,Math.PI*2);c.arc(0,0,r*.53,Math.PI*2,0,true);return;}
  for(let i=0;i<=count;i++){const a=Math.PI*2*i/count-Math.PI/2;let rad=r*.90;
   if(kind===4)rad*=1;else if(kind===7)rad*=(.84+.18*Math.cos(6*a));
   const x=Math.cos(a)*rad*(kind===4?1.12:1),y=Math.sin(a)*rad*(kind===4?.6:1);
   if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
  }c.closePath();
 }
 drawFilaments(time,notes,state){const c=this.ctx,W=this.W,H=this.H,d=this.dpr;
  c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,W,H);
  const cx=W*.5,cy=H*.5,base=Math.min(W,H);
  // 記号のイラスト化ではなく、物体の「距離・共鳴」を可視化する。
  c.save();c.lineWidth=.9;
  const active=notes.some(n=>n.energy>.015);
  c.strokeStyle='rgba(255,255,255,.36)';
  for(const scale of [.40,.52]){c.beginPath();c.ellipse(cx,cy,Math.min(W*.35,base*.95)*scale*2,Math.min(H*.38,base*.36)*scale*2,0,0,Math.PI*2);c.stroke();}
  if(state.motion==='orbit'||active){c.setLineDash([2,7]);c.strokeStyle='rgba(255,255,255,.45)';c.beginPath();c.ellipse(cx,cy,Math.min(W*.38,base*.91),H*.39,0,0,Math.PI*2);c.stroke();c.setLineDash([]);}
  const maxReach=Math.min(260,Math.max(95,base*.76));
  for(let i=0;i<notes.length;i++)for(let j=i+1;j<notes.length;j++){
   const a=notes[i],b=notes[j],dist=Math.hypot(a.x-b.x,a.y-b.y);
   if(dist>maxReach)continue;
   const strength=Math.max(a.energy,b.energy),alpha=(state.move?.35:.095)+strength*.24;
   c.strokeStyle=`rgba(255,255,255,${alpha.toFixed(3)})`;c.lineWidth=state.move?1.35:.8;
   c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();
  }
  for(const n of notes){
   // アクティブ音がオービットとして残る。実際の当たり判定は動かさない。
   const halo=n.r*(1.18+n.energy*.25),opacity=.13+n.energy*.56;
   c.strokeStyle=`rgba(255,255,255,${opacity})`;c.lineWidth=1.0+n.energy*1.5;
   c.beginPath();c.arc(n.x,n.y,halo,0,Math.PI*2);c.stroke();
   if(n.energy>.08){c.strokeStyle=`rgba(133,180,240,${n.energy*.40})`;c.lineWidth=1;
    c.beginPath();c.arc(n.x,n.y,n.r*(1.42+n.energy*.5),0,Math.PI*2);c.stroke();}
   if(state.motion!=='still'){
    const a=time*(state.motion==='orbit'?.42:.19)+n.id*1.51;
    const px=n.x+Math.cos(a)*n.r*1.32,py=n.y+Math.sin(a)*n.r*.92;
    c.fillStyle='rgba(255,255,255,.75)';c.beginPath();c.arc(px,py,2.1,0,Math.PI*2);c.fill();
   }
  }
  c.restore();
 }
}
