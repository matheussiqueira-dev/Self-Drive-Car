const carCanvas=document.getElementById("carCanvas");
const networkCanvas=document.getElementById("networkCanvas");
if(!carCanvas||!networkCanvas) throw new Error("Canvas elements not found");

const carCtx=carCanvas.getContext("2d");
const networkCtx=networkCanvas.getContext("2d");

const STORAGE_KEYS={
  bestBrain:"neuralDrive.bestBrain",
  settings:"neuralDrive.settings",
  history:"neuralDrive.history",
  api:"neuralDrive.api"
};

const DEFAULT_CONFIG={
  population:100,
  trafficCount:50,
  laneCount:3,
  mutationRate:0.1,
  carWidth:30,
  carHeight:50,
  trafficSpeedMin:1.2,
  trafficSpeedMax:2.2,
  trafficMinGap:260,
  trafficGapJitter:220,
  startSafeDistance:700,
  resetTrafficOnGeneration:true,
  autoResetOnExtinction:true,
  extinctionDelayMs:700
};

const PRESETS={
  balanced:{population:100,trafficCount:50,mutationRate:0.1,laneCount:3,autoResetOnExtinction:true},
  fast:{population:60,trafficCount:28,mutationRate:0.16,laneCount:3,autoResetOnExtinction:true},
  dense:{population:120,trafficCount:85,mutationRate:0.08,laneCount:4,autoResetOnExtinction:true}
};

const LIMITS={
  population:{min:20,max:300},
  trafficCount:{min:10,max:200},
  mutationRate:{min:0.01,max:0.5},
  laneCount:{min:2,max:5}
};

const COLORS={best:"#4fd0ff",ghost:"#9fb4c8",traffic:"#ff7676"};

const ui={
  generation:document.getElementById("generation"),population:document.getElementById("population"),
  bestDistance:document.getElementById("bestDistance"),aliveCars:document.getElementById("aliveCars"),
  fps:document.getElementById("fps"),simSpeed:document.getElementById("simSpeed"),
  simStatus:document.getElementById("simStatus"),statusDot:document.getElementById("statusDot"),
  roadBadge:document.getElementById("roadBadge"),networkBadge:document.getElementById("networkBadge"),
  historyList:document.getElementById("historyList"),historySummary:document.getElementById("historySummary"),
  saveBrain:document.getElementById("saveBrain"),resetGeneration:document.getElementById("resetGeneration"),
  discardBrain:document.getElementById("discardBrain"),pauseResume:document.getElementById("pauseResume"),
  exportBrain:document.getElementById("exportBrain"),importBrain:document.getElementById("importBrain"),
  importBrainFile:document.getElementById("importBrainFile"),applySettings:document.getElementById("applySettings"),
  syncHistory:document.getElementById("syncHistory"),toggleSensors:document.getElementById("toggleSensors"),
  toggleGhosts:document.getElementById("toggleGhosts"),toggleNetwork:document.getElementById("toggleNetwork"),
  speedSelect:document.getElementById("speedSelect"),autoResetToggle:document.getElementById("autoResetToggle"),
  autoSaveToggle:document.getElementById("autoSaveToggle"),populationInput:document.getElementById("populationInput"),
  trafficInput:document.getElementById("trafficInput"),mutationInput:document.getElementById("mutationInput"),
  lanesInput:document.getElementById("lanesInput"),apiBaseUrl:document.getElementById("apiBaseUrl"),
  apiKey:document.getElementById("apiKey"),presets:Array.from(document.querySelectorAll("[data-preset]"))
};

const clamp=(v,min,max,fallback)=>{const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;};
const fmtDist=(v)=>`${Math.max(0,Math.round(v))} m`;
const fmtDuration=(ms)=>{const s=Math.max(0,Math.round(ms/1000));return `${Math.floor(s/60)}m ${String(s%60).padStart(2,"0")}s`;};
const fmtDate=(iso)=>{const d=new Date(iso);return Number.isNaN(d.getTime())?"-":d.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});};
const updateText=(el,val)=>{if(!el) return;const next=String(val);if(el.textContent!==next) el.textContent=next;};

class SafeStorage{
  static readJSON(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
  static writeJSON(key,val){try{localStorage.setItem(key,JSON.stringify(val));return true;}catch{return false;}}
  static remove(key){try{localStorage.removeItem(key);return true;}catch{return false;}}
}

const cloneBrain=(brain)=>{if(!brain) return null;return typeof structuredClone==="function"?structuredClone(brain):JSON.parse(JSON.stringify(brain));};

class BrainStore{
  load(){const b=SafeStorage.readJSON(STORAGE_KEYS.bestBrain,null);return this.#isValid(b)?b:null;}
  save(brain){if(!this.#isValid(brain)) return null;const c=cloneBrain(brain);SafeStorage.writeJSON(STORAGE_KEYS.bestBrain,c);return c;}
  clear(){SafeStorage.remove(STORAGE_KEYS.bestBrain);}
  export(brain){
    if(!this.#isValid(brain)) return false;
    const payload={version:1,exportedAt:new Date().toISOString(),brain};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`neural-drive-brain-${Date.now()}.json`;
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(a.href);return true;
  }
  async importFile(file){const parsed=JSON.parse(await file.text());const brain=parsed?.brain??parsed;if(!this.#isValid(brain)) throw new Error("Invalid brain");return this.save(brain);}
  #isValid(candidate){
    if(!candidate||typeof candidate!=="object"||!Array.isArray(candidate.levels)||candidate.levels.length===0) return false;
    return candidate.levels.every((l)=>l&&Array.isArray(l.inputs)&&Array.isArray(l.outputs)&&Array.isArray(l.biases)&&Array.isArray(l.weights));
  }
}

class RunApiClient{
  constructor(cfg){this.setConfig(cfg);}
  setConfig(cfg){this.baseUrl=this.#sanitize(cfg?.baseUrl);this.apiKey=cfg?.apiKey?String(cfg.apiKey).trim():"";}
  get hasEndpoint(){return Boolean(this.baseUrl);}
  async fetchRuns(limit=12){
    if(!this.hasEndpoint) return [];
    const res=await fetch(`${this.baseUrl}/api/v1/runs?limit=${limit}`,{headers:this.#headers(false)});
    if(!res.ok) throw new Error(`Fetch runs failed: ${res.status}`);
    const payload=await res.json();
    return Array.isArray(payload?.data)?payload.data:[];
  }
  async createRun(run){
    if(!this.hasEndpoint) return null;
    const res=await fetch(`${this.baseUrl}/api/v1/runs`,{method:"POST",headers:this.#headers(true),body:JSON.stringify(run)});
    if(!res.ok) throw new Error(`Create run failed: ${res.status}`);
    const payload=await res.json();
    return payload?.data??null;
  }
  #headers(withBody){const h={Accept:"application/json"};if(withBody) h["Content-Type"]="application/json";if(this.apiKey) h["x-api-key"]=this.apiKey;return h;}
  #sanitize(url){if(!url) return "";const t=String(url).trim().replace(/\/$/,"");try{const u=new URL(t);return u.protocol==="http:"||u.protocol==="https:"?u.toString().replace(/\/$/,""):"";}catch{return "";}}
}

class HistoryStore{
  constructor(apiClient){this.apiClient=apiClient;this.entries=this.#sanitize(SafeStorage.readJSON(STORAGE_KEYS.history,[]));}
  add(entry){if(!entry||typeof entry!=="object") return;this.entries.unshift(entry);this.entries=this.#sanitize(this.entries).slice(0,120);SafeStorage.writeJSON(STORAGE_KEYS.history,this.entries);}
  getTop(limit=8){return this.entries.slice().sort((a,b)=>b.bestDistance-a.bestDistance).slice(0,limit);}
  summary(){const best=this.getTop(1)[0];return best?`Top: ${fmtDist(best.bestDistance)} em ${this.entries.length} runs`:"Sem dados ainda";}
  merge(remote){
    if(!Array.isArray(remote)||remote.length===0) return 0;
    const ids=new Set(this.entries.map((e)=>e.id));let merged=0;
    remote.forEach((e)=>{if(e&&e.id&&!ids.has(e.id)){this.entries.push(e);ids.add(e.id);merged++;}});
    this.entries=this.#sanitize(this.entries).slice(0,120);SafeStorage.writeJSON(STORAGE_KEYS.history,this.entries);return merged;
  }
  async syncRemote(limit=12){
    if(!this.apiClient.hasEndpoint) return {synced:0,merged:0};
    let synced=0;for(const run of this.entries.slice(0,limit)){try{await this.apiClient.createRun(run);synced++;}catch{break;}}
    let merged=0;try{merged=this.merge(await this.apiClient.fetchRuns(limit));}catch{}
    return {synced,merged};
  }
  #sanitize(entries){
    if(!Array.isArray(entries)) return [];
    return entries.filter((e)=>e&&typeof e==="object").map((e)=>({
      id:String(e.id??`${Date.now()}-${Math.random().toString(16).slice(2,8)}`),
      generation:Number(e.generation)||0,bestDistance:Number(e.bestDistance)||0,averageFitness:Number(e.averageFitness)||0,
      alivePeak:Number(e.alivePeak)||0,durationMs:Number(e.durationMs)||0,reason:String(e.reason??"manual"),
      endedAt:e.endedAt||new Date().toISOString(),
      config:{population:Number(e.config?.population)||DEFAULT_CONFIG.population,trafficCount:Number(e.config?.trafficCount)||DEFAULT_CONFIG.trafficCount,mutationRate:Number(e.config?.mutationRate)||DEFAULT_CONFIG.mutationRate,laneCount:Number(e.config?.laneCount)||DEFAULT_CONFIG.laneCount}
    }));
  }
}
class SimulationEngine{
  constructor(config){
    this.config={...config};this.road=null;this.cars=[];this.traffic=[];this.bestCar=null;this.generation=1;
    this.bestDistance=0;this.averageFitness=0;this.aliveCars=this.config.population;this.peakAlive=this.config.population;
    this.extinctionTimestamp=null;this.generationStartedAt=performance.now();
  }

  setRoad(road){
    const prev=this.road;this.road=road;
    if(!prev||!road) return;
    this.#realign(prev,road,this.cars);
    this.#realign(prev,road,this.traffic);
  }

  initialize(savedBrain){
    this.cars=this.#generateCars(this.config.population);
    this.bestCar=this.cars[0]||null;
    this.#applyBrain(savedBrain);
    this.traffic=this.#generateTraffic(this.config.trafficCount);
    this.bestDistance=0;this.averageFitness=0;this.aliveCars=this.config.population;this.peakAlive=this.config.population;
    this.extinctionTimestamp=null;this.generationStartedAt=performance.now();
  }

  applyConfig(next){this.config={...this.config,...next};}

  step(timestamp){
    this.traffic.forEach((t)=>t.update(this.road,[]));
    let bestFit=-Infinity,avg=0,alive=0,leader=this.bestCar||this.cars[0];

    for(let i=0;i<this.cars.length;i++){
      const car=this.cars[i];car.update(this.road,this.traffic);
      if(!car.damaged) alive++;
      avg+=car.fitness;
      if(car.fitness>bestFit){bestFit=car.fitness;leader=car;}
    }

    this.bestCar=leader||this.bestCar;
    this.aliveCars=alive;
    this.peakAlive=Math.max(this.peakAlive,alive);
    this.averageFitness=this.cars.length?avg/this.cars.length:0;
    if(this.bestCar) this.bestDistance=Math.max(this.bestDistance,Math.max(0,Math.round(-this.bestCar.y)));

    let shouldReset=false;
    if(this.config.autoResetOnExtinction){
      if(alive===0){
        if(this.extinctionTimestamp===null) this.extinctionTimestamp=timestamp;
        else if(timestamp-this.extinctionTimestamp>=this.config.extinctionDelayMs){shouldReset=true;this.extinctionTimestamp=null;}
      }else this.extinctionTimestamp=null;
    }

    return {aliveCount:alive,shouldReset};
  }

  countAliveCars(){
    let alive=0;
    for(let i=0;i<this.cars.length;i++) if(!this.cars[i].damaged) alive++;
    this.aliveCars=alive;
    return alive;
  }

  resetGeneration({savedBrain,reason,timestamp,keepTraffic}){
    const report=this.createGenerationReport(reason,timestamp);
    this.generation++;
    this.cars=this.#generateCars(this.config.population);
    this.bestCar=this.cars[0]||null;
    if(savedBrain) this.#applyBrain(savedBrain);
    if(keepTraffic) this.#repositionTraffic();
    else if(this.config.resetTrafficOnGeneration) this.traffic=this.#generateTraffic(this.config.trafficCount);

    this.bestDistance=0;this.averageFitness=0;this.aliveCars=this.cars.length;this.peakAlive=this.cars.length;
    this.extinctionTimestamp=null;this.generationStartedAt=timestamp;
    return report;
  }

  createGenerationReport(reason,timestamp){
    return {
      id:`${Date.now()}-${Math.random().toString(16).slice(2,8)}`,
      generation:this.generation,
      bestDistance:this.bestDistance,
      averageFitness:Number(this.averageFitness.toFixed(2)),
      alivePeak:this.peakAlive,
      durationMs:Math.max(0,Math.round(timestamp-this.generationStartedAt)),
      reason,
      endedAt:new Date().toISOString(),
      config:{population:this.config.population,trafficCount:this.config.trafficCount,mutationRate:this.config.mutationRate,laneCount:this.config.laneCount}
    };
  }

  #generateCars(count){
    const cars=[];
    const laneIndex=Math.floor(this.config.laneCount/2);
    for(let i=0;i<count;i++) cars.push(new Car(this.road.getLaneCenter(laneIndex),100,this.config.carWidth,this.config.carHeight,"AI"));
    return cars;
  }

  #generateTraffic(count){
    const generated=[];
    const laneOffsets=new Array(this.config.laneCount).fill(-this.config.startSafeDistance);
    const speedRange=Math.max(0.1,this.config.trafficSpeedMax-this.config.trafficSpeedMin);
    const spawn=(lane,y)=>generated.push(new Car(this.road.getLaneCenter(lane),y,30,50,"DUMMY",this.config.trafficSpeedMin+Math.random()*speedRange));

    for(let i=0;i<count;i++){
      const lane=Math.floor(Math.random()*this.config.laneCount);
      const gap=this.config.trafficMinGap+Math.random()*this.config.trafficGapJitter;
      laneOffsets[lane]-=gap;const y=laneOffsets[lane];spawn(lane,y);
      if(Math.random()<0.24){
        const lane2=(lane+1+Math.floor(Math.random()*2))%this.config.laneCount;
        const pairGap=this.config.trafficMinGap*0.7+Math.random()*(this.config.trafficGapJitter*0.5);
        laneOffsets[lane2]=Math.min(laneOffsets[lane2],y-pairGap);spawn(lane2,y);
      }
    }

    return generated;
  }

  #applyBrain(brain){
    if(!brain) return;
    for(let i=0;i<this.cars.length;i++){
      this.cars[i].brain=cloneBrain(brain);
      if(i!==0) NeuralNetwork.mutate(this.cars[i].brain,this.config.mutationRate);
    }
  }

  #realign(prev,next,list){
    if(!Array.isArray(list)||list.length===0) return;
    const laneWidth=prev.width/prev.laneCount;
    list.forEach((car)=>{
      const laneIndex=Math.min(prev.laneCount-1,Math.max(0,Math.round((car.x-prev.left)/laneWidth)));
      car.x=next.getLaneCenter(laneIndex);
    });
  }

  #repositionTraffic(){
    if(!this.bestCar) return;
    const shift=this.bestCar.y-100;
    this.traffic.forEach((trafficCar)=>{trafficCar.y+=shift;});
  }
}

class AppController{
  constructor(){
    this.brainStore=new BrainStore();
    const apiCfg=SafeStorage.readJSON(STORAGE_KEYS.api,{baseUrl:"",apiKey:""});
    this.apiClient=new RunApiClient(apiCfg);
    this.historyStore=new HistoryStore(this.apiClient);

    const persisted=SafeStorage.readJSON(STORAGE_KEYS.settings,{});
    this.config=this.#mergeConfig(DEFAULT_CONFIG,persisted);
    this.engine=new SimulationEngine(this.config);
    this.savedBrain=this.brainStore.load();

    this.sim={showSensors:true,showGhosts:true,showNetwork:true,paused:false,speedSteps:1,autoSaveBest:false};
    this.carCanvasSize={width:0,height:0};this.networkCanvasSize={width:0,height:0};
    this.lastFrameTime=performance.now();this.smoothedFps=60;this.lastFpsUpdate=0;
    this.statusOverride=null;this.statusOverrideUntil=0;this.networkTick=0;this.lastDrawnBrain=null;
  }

  init(){
    this.#hydrateUi();
    this.#bindEvents();
    this.#resizeCanvases();
    this.engine.initialize(this.savedBrain);
    updateText(ui.population,this.config.population);
    updateText(ui.generation,this.engine.generation);
    this.#updateSimSpeed(this.sim.speedSteps);
    this.#renderHistory();
    this.#refreshStatus("Simulacao ativa","running");
    requestAnimationFrame((ts)=>this.#animate(ts));
  }
  #bindEvents(){
    ui.saveBrain?.addEventListener("click",()=>this.#saveBestBrain());
    ui.discardBrain?.addEventListener("click",()=>this.#discardBrain());
    ui.resetGeneration?.addEventListener("click",()=>this.#advanceGeneration("manual"));
    ui.pauseResume?.addEventListener("click",()=>this.#togglePause());
    ui.applySettings?.addEventListener("click",()=>this.#applySettingsFromForm());

    ui.exportBrain?.addEventListener("click",()=>{
      const brain=this.engine.bestCar?.brain||this.savedBrain;
      this.brainStore.export(brain)?this.#setTransientStatus("Cerebro exportado","running",2400):this.#setTransientStatus("Nada para exportar","error",2600);
    });

    ui.importBrain?.addEventListener("click",()=>ui.importBrainFile?.click());
    ui.importBrainFile?.addEventListener("change",async(event)=>{
      const file=event.target.files?.[0];if(!file) return;
      try{this.savedBrain=await this.brainStore.importFile(file);this.#setTransientStatus("Cerebro importado","running",2400);this.#advanceGeneration("brain-import");}
      catch{this.#setTransientStatus("Falha ao importar cerebro","error",3200);}finally{event.target.value="";}
    });

    ui.toggleSensors?.addEventListener("change",(event)=>{this.sim.showSensors=Boolean(event.target.checked);});
    ui.toggleGhosts?.addEventListener("change",(event)=>{this.sim.showGhosts=Boolean(event.target.checked);});
    ui.toggleNetwork?.addEventListener("change",(event)=>{this.sim.showNetwork=Boolean(event.target.checked);});

    ui.autoResetToggle?.addEventListener("change",(event)=>{
      this.config.autoResetOnExtinction=Boolean(event.target.checked);
      this.engine.applyConfig({autoResetOnExtinction:this.config.autoResetOnExtinction});
      this.#persistSettings();
    });

    ui.autoSaveToggle?.addEventListener("change",(event)=>{this.sim.autoSaveBest=Boolean(event.target.checked);this.#persistSettings();});
    ui.speedSelect?.addEventListener("change",(event)=>this.#updateSimSpeed(Number(event.target.value)));

    ui.presets.forEach((button)=>button.addEventListener("click",()=>this.#applyPreset(button.dataset.preset)));

    ui.syncHistory?.addEventListener("click",async()=>{await this.#syncHistory();});
    window.addEventListener("resize",()=>this.#resizeCanvases());

    window.addEventListener("keydown",(event)=>{
      if(event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement||event.target instanceof HTMLTextAreaElement) return;
      switch(event.key.toLowerCase()){
        case " ": event.preventDefault();this.#togglePause();break;
        case "r": this.#advanceGeneration("manual");break;
        case "s": this.#saveBestBrain();break;
        default:break;
      }
    });
  }

  #mergeConfig(base,persisted){
    const cfg={...base,...persisted};
    cfg.population=clamp(cfg.population,LIMITS.population.min,LIMITS.population.max,base.population);
    cfg.trafficCount=clamp(cfg.trafficCount,LIMITS.trafficCount.min,LIMITS.trafficCount.max,base.trafficCount);
    cfg.mutationRate=clamp(cfg.mutationRate,LIMITS.mutationRate.min,LIMITS.mutationRate.max,base.mutationRate);
    cfg.laneCount=clamp(cfg.laneCount,LIMITS.laneCount.min,LIMITS.laneCount.max,base.laneCount);
    cfg.autoResetOnExtinction=cfg.autoResetOnExtinction!==false;
    return cfg;
  }

  #hydrateUi(){
    if(ui.populationInput) ui.populationInput.value=String(this.config.population);
    if(ui.trafficInput) ui.trafficInput.value=String(this.config.trafficCount);
    if(ui.mutationInput) ui.mutationInput.value=String(this.config.mutationRate);
    if(ui.lanesInput) ui.lanesInput.value=String(this.config.laneCount);
    if(ui.autoResetToggle) ui.autoResetToggle.checked=this.config.autoResetOnExtinction;

    this.sim.autoSaveBest=Boolean(SafeStorage.readJSON(STORAGE_KEYS.settings,{}).autoSaveBest);
    if(ui.autoSaveToggle) ui.autoSaveToggle.checked=this.sim.autoSaveBest;

    if(ui.apiBaseUrl) ui.apiBaseUrl.value=this.apiClient.baseUrl;
    if(ui.apiKey) ui.apiKey.value=this.apiClient.apiKey;
  }

  #persistSettings(){
    SafeStorage.writeJSON(STORAGE_KEYS.settings,{
      population:this.config.population,trafficCount:this.config.trafficCount,mutationRate:this.config.mutationRate,
      laneCount:this.config.laneCount,autoResetOnExtinction:this.config.autoResetOnExtinction,autoSaveBest:this.sim.autoSaveBest
    });
  }

  #persistApiConfig(){
    SafeStorage.writeJSON(STORAGE_KEYS.api,{baseUrl:ui.apiBaseUrl?.value?.trim()??"",apiKey:ui.apiKey?.value?.trim()??""});
  }

  #applyPreset(name){
    const p=PRESETS[name];if(!p) return;
    if(ui.populationInput) ui.populationInput.value=String(p.population);
    if(ui.trafficInput) ui.trafficInput.value=String(p.trafficCount);
    if(ui.mutationInput) ui.mutationInput.value=String(p.mutationRate);
    if(ui.lanesInput) ui.lanesInput.value=String(p.laneCount);
    if(ui.autoResetToggle) ui.autoResetToggle.checked=p.autoResetOnExtinction;
    this.#applySettingsFromForm();
    this.#setTransientStatus(`Preset ${name} aplicado`,"running",2200);
  }

  #applySettingsFromForm(){
    const next={
      population:clamp(ui.populationInput?.value,LIMITS.population.min,LIMITS.population.max,this.config.population),
      trafficCount:clamp(ui.trafficInput?.value,LIMITS.trafficCount.min,LIMITS.trafficCount.max,this.config.trafficCount),
      mutationRate:clamp(ui.mutationInput?.value,LIMITS.mutationRate.min,LIMITS.mutationRate.max,this.config.mutationRate),
      laneCount:clamp(ui.lanesInput?.value,LIMITS.laneCount.min,LIMITS.laneCount.max,this.config.laneCount),
      autoResetOnExtinction:Boolean(ui.autoResetToggle?.checked)
    };

    this.config={...this.config,...next};
    this.engine.applyConfig(this.config);
    this.#persistSettings();
    this.#resizeCanvases();
    this.#advanceGeneration("settings");
    updateText(ui.population,this.config.population);
    this.#setTransientStatus("Parametros aplicados","running",2200);
  }

  #updateSimSpeed(val){this.sim.speedSteps=clamp(val,1,8,1);updateText(ui.simSpeed,`${this.sim.speedSteps}x`);}
  #togglePause(){this.sim.paused=!this.sim.paused;if(ui.pauseResume) ui.pauseResume.textContent=this.sim.paused?"Retomar":"Pausar";}

  #saveBestBrain(){
    const best=this.engine.bestCar?.brain;
    if(!best){this.#setTransientStatus("Sem cerebro para salvar","error",2600);return;}
    this.savedBrain=this.brainStore.save(best);
    this.#setTransientStatus("Melhor cerebro salvo","running",2200);
  }

  #discardBrain(){this.savedBrain=null;this.brainStore.clear();this.#setTransientStatus("Cerebro salvo removido","running",2200);}

  #advanceGeneration(reason){
    const now=performance.now();
    if(this.sim.autoSaveBest&&this.engine.bestCar?.brain) this.savedBrain=this.brainStore.save(this.engine.bestCar.brain);

    const report=this.engine.resetGeneration({savedBrain:this.savedBrain,reason,timestamp:now,keepTraffic:false});
    if(report.bestDistance>0){
      this.historyStore.add(report);
      this.#renderHistory();
      if(this.apiClient.hasEndpoint) this.apiClient.createRun(report).catch(()=>{});
    }

    updateText(ui.generation,this.engine.generation);
    updateText(ui.population,this.config.population);
    this.lastDrawnBrain=null;
  }

  async #syncHistory(){
    this.apiClient.setConfig({baseUrl:ui.apiBaseUrl?.value??"",apiKey:ui.apiKey?.value??""});
    this.#persistApiConfig();
    if(!this.apiClient.hasEndpoint){this.#setTransientStatus("Informe uma API URL valida","error",2800);return;}

    this.#setTransientStatus("Sincronizando historico...","syncing",3200);
    try{
      const result=await this.historyStore.syncRemote(12);
      this.#renderHistory();
      this.#setTransientStatus(`Sync concluido: ${result.synced} enviados, ${result.merged} recebidos`,"running",3200);
    }catch{this.#setTransientStatus("Falha na sincronizacao","error",3200);}
  }
  #renderHistory(){
    if(!ui.historyList) return;
    ui.historyList.innerHTML="";
    const entries=this.historyStore.getTop(8);

    if(entries.length===0){
      const empty=document.createElement("li");
      empty.className="history-empty";
      empty.textContent="Nenhuma geracao encerrada ainda.";
      ui.historyList.appendChild(empty);
      updateText(ui.historySummary,this.historyStore.summary());
      return;
    }

    entries.forEach((entry)=>{
      const item=document.createElement("li");item.className="history-item";
      const main=document.createElement("div");main.className="history-main";
      const generationLabel=document.createElement("strong");
      generationLabel.textContent=`G${entry.generation}`;
      const distanceLabel=document.createElement("span");
      distanceLabel.textContent=fmtDist(entry.bestDistance);
      main.appendChild(generationLabel);
      main.appendChild(distanceLabel);
      const meta=document.createElement("div");meta.className="history-meta";
      [`duracao ${fmtDuration(entry.durationMs)}`,`pico vivos ${entry.alivePeak}`,`motivo ${entry.reason}`,fmtDate(entry.endedAt)].forEach((value)=>{
        const tag=document.createElement("span");
        tag.textContent=value;
        meta.appendChild(tag);
      });
      item.appendChild(main);item.appendChild(meta);ui.historyList.appendChild(item);
    });

    updateText(ui.historySummary,this.historyStore.summary());
  }

  #resizeCanvases(){
    this.carCanvasSize=this.#resizeCanvas(carCanvas,carCtx);
    this.networkCanvasSize=this.#resizeCanvas(networkCanvas,networkCtx);
    this.engine.setRoad(new Road(this.carCanvasSize.width/2,this.carCanvasSize.width*0.9,this.config.laneCount));
    this.lastDrawnBrain=null;
  }

  #resizeCanvas(canvas,ctx){
    const bounds=canvas.getBoundingClientRect();
    const width=Math.max(1,bounds.width),height=Math.max(1,bounds.height),dpr=window.devicePixelRatio||1;
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    return {width,height};
  }

  #updateFps(ts){
    const delta=ts-this.lastFrameTime;this.lastFrameTime=ts;
    const instant=1000/Math.max(1,delta);this.smoothedFps=this.smoothedFps*0.9+instant*0.1;
    if(ts-this.lastFpsUpdate>250){updateText(ui.fps,Math.round(this.smoothedFps));this.lastFpsUpdate=ts;}
  }

  #animate(ts){
    this.#updateFps(ts);
    let alive=this.engine.aliveCars;

    if(!this.sim.paused){
      for(let step=0;step<this.sim.speedSteps;step++){
        const result=this.engine.step(ts);alive=result.aliveCount;
        if(result.shouldReset){this.#advanceGeneration("extinction");break;}
      }
    }else alive=this.engine.countAliveCars();

    this.#drawScene();
    updateText(ui.aliveCars,alive);
    updateText(ui.bestDistance,fmtDist(this.engine.bestDistance));
    updateText(ui.generation,this.engine.generation);
    this.#refreshStatus(this.#statusMessage(),this.#statusState());

    requestAnimationFrame((next)=>this.#animate(next));
  }

  #drawScene(){
    const best=this.engine.bestCar;
    if(!best||!this.engine.road) return;

    carCtx.clearRect(0,0,this.carCanvasSize.width,this.carCanvasSize.height);
    networkCtx.clearRect(0,0,this.networkCanvasSize.width,this.networkCanvasSize.height);

    carCtx.save();
    carCtx.translate(0,-best.y+this.carCanvasSize.height*0.72);
    this.engine.road.draw(carCtx);

    const minY=best.y-this.carCanvasSize.height*1.5;
    const maxY=best.y+this.carCanvasSize.height*0.9;
    this.engine.traffic.forEach((trafficCar)=>{if(trafficCar.y>minY&&trafficCar.y<maxY) trafficCar.draw(carCtx,COLORS.traffic);});

    if(this.sim.showGhosts){
      carCtx.globalAlpha=0.17;
      this.engine.cars.forEach((car)=>{if(car!==best) car.draw(carCtx,COLORS.ghost);});
      carCtx.globalAlpha=1;
    }

    best.draw(carCtx,COLORS.best,this.sim.showSensors);
    carCtx.restore();

    if(this.sim.paused) this.#drawPausedOverlay();

    if(!this.sim.showNetwork){this.#drawNetworkPlaceholder("Network hidden");return;}

    this.networkTick++;
    const skip=this.sim.speedSteps>=4?2:1;
    if(this.networkTick%skip===0||this.lastDrawnBrain!==best.brain){
      Visualizer.drawNetwork(networkCtx,best.brain);
      this.lastDrawnBrain=best.brain;
    }
  }

  #drawPausedOverlay(){
    carCtx.save();carCtx.fillStyle="rgba(7, 11, 18, 0.6)";
    carCtx.fillRect(0,0,this.carCanvasSize.width,this.carCanvasSize.height);
    carCtx.fillStyle="#edf6ff";carCtx.font="600 20px 'Syne', 'Segoe UI', sans-serif";
    carCtx.textAlign="center";carCtx.textBaseline="middle";
    carCtx.fillText("Simulacao pausada",this.carCanvasSize.width/2,this.carCanvasSize.height/2);carCtx.restore();
  }

  #drawNetworkPlaceholder(text){
    networkCtx.save();networkCtx.fillStyle="rgba(7, 12, 20, 0.8)";
    networkCtx.fillRect(0,0,this.networkCanvasSize.width,this.networkCanvasSize.height);
    networkCtx.fillStyle="#9ab2c7";networkCtx.font="600 16px 'Syne', 'Segoe UI', sans-serif";
    networkCtx.textAlign="center";networkCtx.textBaseline="middle";
    networkCtx.fillText(text,this.networkCanvasSize.width/2,this.networkCanvasSize.height/2);networkCtx.restore();
  }

  #setTransientStatus(message,state,duration){this.statusOverride={message,state};this.statusOverrideUntil=performance.now()+duration;}

  #statusState(){if(this.statusOverride&&performance.now()<this.statusOverrideUntil) return this.statusOverride.state;this.statusOverride=null;return this.sim.paused?"paused":"running";}
  #statusMessage(){if(this.statusOverride&&performance.now()<this.statusOverrideUntil) return this.statusOverride.message;return this.sim.paused?"Simulacao pausada":"Simulacao ativa";}

  #refreshStatus(message,state){
    updateText(ui.simStatus,message);
    if(ui.statusDot) ui.statusDot.dataset.state=state;
    if(ui.roadBadge) ui.roadBadge.textContent=this.sim.paused?"Paused":"Live";
    if(ui.networkBadge) ui.networkBadge.textContent=this.sim.showNetwork?(this.sim.paused?"Paused":"Live"):"Off";
  }
}

const app=new AppController();
app.init();
