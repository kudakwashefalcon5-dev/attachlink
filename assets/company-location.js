(() => {
  'use strict';
  const apiRoot='../../backend/api/';
  const cacheKey='attachlink:registration-office-location';
  const node=(tag,text,cls)=>{
    const el=document.createElement(tag);
    if(text)el.textContent=text;
    if(cls)el.className=cls;
    return el;
  };
  async function api(path,data) {
    const init={cache:'no-store',credentials:'same-origin'};
    if(data) {
      const {csrf_token}=await api('auth/csrf.php');
      Object.assign(init,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,csrf_token})});
    }
    const response=await fetch(apiRoot+path,init);
    const result=await response.json();
    if(!response.ok||!result.ok)throw Error(result.message||'Could not load the location.');
    return result;
  }
  function registerDraft(accountId,details) {
    if(!details)return;
    try { sessionStorage.setItem(cacheKey,JSON.stringify({accountId,details})); } catch {}
  }
  function localDraft(accountId) {
    try {
      const saved=JSON.parse(sessionStorage.getItem(cacheKey));
      return String(saved?.accountId)===String(accountId)?saved.details:null;
    } catch { return null; }
  }
  function parsePin(value) {
    const coordinate=/^(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)(?:,|$)/;
    let text=value.trim();
    if(/^https?:\/\//i.test(text)) {
      const url=new URL(text);
      if(!['www.google.com','google.com','maps.google.com'].includes(url.hostname)
        || (url.hostname!=='maps.google.com'&&!url.pathname.startsWith('/maps'))) {
        throw Error('Use a full Google Maps URL, coordinates, or place the pin on the map.');
      }
      text=url.searchParams.get('q')||url.pathname.split('@')[1]||'';
    }
    const match=text.match(coordinate);
    if(!match||Math.abs(Number(match[1]))>90||Math.abs(Number(match[2]))>180) {
      throw Error('Enter latitude, longitude or use a full Google Maps URL with coordinates.');
    }
    return [Number(match[1]),Number(match[2])];
  }
  async function mount(root,{admin=false,companyId,accountId,registration=false,onChange}={}) {
    if(!root || root.dataset.mounted)return;
    root.dataset.mounted='true';
    root.classList.add('al-location');
    const message=node('p','Loading locations…','al-location-state');
    message.setAttribute('role','status');
    root.append(message);
    const endpoint='company-location.php'+(admin?'?company_id='+encodeURIComponent(companyId):'');
    let directory, record;
    try {
      [directory,record]=await Promise.all([api('location-towns.php'),registration?null:api(endpoint)]);
    } catch(error) {
      message.textContent=error.message;
      return;
    }
    const summary=node('p','','al-location-state');
    const warning=node('p','','al-location-warning');
    warning.setAttribute('role','status');
    const field=(label,input)=>{
      const wrapper=node('label');
      input.setAttribute('aria-label',label);
      wrapper.append(node('span',label),input);
      return wrapper;
    };
    const province=node('select'), town=node('select'), address=node('input'), landmark=node('textarea');
    for(const item of directory.provinces)province.add(new Option(item.name,item.id));
    province.add(new Option('Select province',''),0);
    province.value='';
    address.maxLength=255;
    landmark.maxLength=300;
    landmark.rows=2;
    const actions=node('div','','al-location-actions');
    const button=(label,handler,group=actions)=>{
      const el=node('button',label);
      el.type='button';
      el.addEventListener('click',handler);
      group.append(el);
      return el;
    };
    const mapHost=node('div','','al-location-map');
    mapHost.setAttribute('aria-label','Company location map');
    const coords=node('p','Select a town, then click on the map to place an exact pin.','al-location-state');
    const pasted=node('input');pasted.type='text';
    const pasteField=field('Full Google Maps URL or latitude, longitude',pasted);
    const confirmPin=node('input');confirmPin.type='checkbox';
    const confirmLow=node('input');confirmLow.type='checkbox';
    const pinConfirmation=field('I confirm this exact location is the office.',confirmPin);
    const lowConfirmation=field('I confirm this result even though the reported accuracy is worse than 500 m.',confirmLow);
    const saveActions=node('div','','al-location-actions');
    let pin,marker,radius,map,confirmedDraft;
    let pinGeneration=0;
    const selectedTown=()=>directory.towns.find(item=>String(item.id)===town.value);
    function renderPin() {
      if(marker){marker.remove();marker=null;}
      if(radius){radius.remove();radius=null;}
      const current=selectedTown();
      pinConfirmation.hidden=!pin;
      lowConfirmation.hidden=!pin||pin.accuracy_m===null||pin.accuracy_m<=500;
      warning.textContent='';
      coords.textContent=current?'Town centre shown. Click the map to place an exact pin.':'Select a town to place a company pin.';
      if(!current||!map)return;
      const point=pin?[pin.latitude,pin.longitude]:[Number(current.latitude),Number(current.longitude)];
      map.setView(point,pin?13:12);
      marker=L.marker(point,{draggable:Boolean(pin),title:pin?'Exact company pin':'Town centre'}).addTo(map);
      marker.bindTooltip(node('span',pin?'Exact company pin':current.name));
      if(pin) {
        marker.on('dragend',()=>{const point=marker.getLatLng();setPin(point.lat,point.lng,'employer_pin');});
        coords.textContent=pin.latitude.toFixed(6)+', '+pin.longitude.toFixed(6)
          +(pin.accuracy_m===null?'':' · Reported accuracy '+pin.accuracy_m+' m');
        if(pin.accuracy_m>500)warning.textContent='Low accuracy. Adjust the pin or explicitly confirm the result.';
        const [s,w,n,e]=directory.bounds;
        if(pin.latitude<s||pin.latitude>n||pin.longitude<w||pin.longitude>e)warning.textContent+=' This pin is outside the configured Zimbabwe boundary.';
        if(pin.accuracy_m>0)radius=L.circle(point,{radius:pin.accuracy_m,interactive:false}).addTo(map);
      }
    }
    function setPin(lat,lon,source,accuracy=null) {
      pinGeneration++;
      pin={latitude:Number(Number(lat).toFixed(6)),longitude:Number(Number(lon).toFixed(6)),location_source:source,accuracy_m:accuracy};
      confirmPin.checked=confirmLow.checked=false;
      renderPin();
    }
    function fillTowns(value='') {
      town.replaceChildren(new Option('Select town',''));
      for(const item of directory.towns) {
        if(String(item.province_id)===province.value)town.add(new Option(item.name,item.id));
      }
      town.value=value;
      town.disabled=!province.value;
    }
    function clearPin(){pinGeneration++;pin=null;renderPin();}
    province.onchange=()=>{fillTowns();clearPin();};
    town.onchange=clearPin;
    function applyDetails(details) {
      province.value=String(details?.province_id||'');
      fillTowns(String(details?.town_id||''));
      address.value=details?.physical_address||'';
      landmark.value=details?.landmark_directions||'';
      pin=null;
      confirmPin.checked=confirmLow.checked=false;
      if(details?.location_precision==='exact')setPin(details.latitude,details.longitude,details.location_source,details.accuracy_m===null?null:Number(details.accuracy_m));
      else renderPin();
    }
    function payload() {
      if(!selectedTown())throw Error('Choose a province and town.');
      if(pin&&!confirmPin.checked)throw Error('Confirm the office pin before continuing.');
      if(!lowConfirmation.hidden&&!confirmLow.checked)throw Error('Confirm the low GPS accuracy or adjust the pin.');
      return {province_id:Number(province.value),town_id:Number(town.value),physical_address:address.value.trim(),
        landmark_directions:landmark.value.trim(),location_precision:pin?'exact':'town',...pin,
        pin_confirmed:confirmPin.checked,confirm_low_accuracy:confirmLow.checked};
    }
    const locate=button("Use my current location (I'm at the office)",()=>{
      if(!selectedTown()){message.textContent='Choose the office province and town first.';return;}
      if(!window.isSecureContext||!navigator.geolocation){message.textContent='Device location is unavailable here. Choose a town or place the pin manually.';return;}
      locate.disabled=true;
      const generation=++pinGeneration;
      navigator.geolocation.getCurrentPosition(({coords:position})=>{
        locate.disabled=false;
        if(generation!==pinGeneration)return;
        setPin(position.latitude,position.longitude,'employer_gps_once',Number(position.accuracy.toFixed(2)));
        message.textContent='Device location captured. Check the pin and confirm before saving.';
      },error=>{
        locate.disabled=false;
        if(generation!==pinGeneration)return;
        message.textContent=(error.code===1?'Location permission denied.':error.code===3?'The location request timed out.':'Device location is unavailable.')
          +' Choose a town or place the pin manually.';
      },{enableHighAccuracy:true,timeout:10000,maximumAge:0});
    });
    if(admin)locate.hidden=true;
    button("I'm not at the office",()=>{clearPin();message.textContent='Town-level location selected.';});
    button('Place pasted pin',()=>{
      if(!selectedTown()){message.textContent='Choose a province and town first.';return;}
      try {setPin(...parsePin(pasted.value),'pasted_link');message.textContent='Check and confirm the pasted pin.';}
      catch(error){message.textContent=error.message;}
    },saveActions);
    const reviewActions=node('div','','al-location-actions');
    function renderRecord() {
      if(!record)return;
      const data=record.location;
      summary.textContent=data.town_id
        ? [data.town_name,data.province_name,data.location_precision,data.location_source,data.accuracy_m===null?null:data.accuracy_m+' m accuracy',
          'Review: '+data.location_review_status,data.location_approved_at?'Verified location':null].filter(Boolean).join(' · ')
        : 'Location not set. Review: '+data.location_review_status;
      if(record.pending)summary.textContent+=' · A new location is pending review.';
      if(admin) {
        approve.hidden=!record.pending&&(!data.town_id||Boolean(data.location_approved_at));
        reject.hidden=!record.pending;
      }
    }
    async function submit(action) {
      try {
        const value=action==='save'?payload():{};
        if(registration) {
          confirmedDraft=value;
          message.textContent='Location ready. After signing in, open Company Profile to save it.';
          return;
        }
        for(const el of reviewActions.children)el.disabled=true;
        record=await api(endpoint,{...value,action,company_id:companyId,revision:record.revision});
        if(!admin){try{sessionStorage.removeItem(cacheKey);}catch{}}
        applyDetails(record.pending||record.location);
        renderRecord();
        onChange?.(record.location);
        message.textContent=(record.warning?record.warning+' ':'')+(record.pending?'Submitted for administrator review.':'Location updated.');
      }catch(error){message.textContent=error.message;}
      finally{for(const el of reviewActions.children)el.disabled=false;}
    }
    button(registration?'Confirm location for later':admin?'Save approved location':'Save company location',()=>submit('save'),reviewActions);
    const approve=button('Approve location',()=>submit('approve'),reviewActions);
    const reject=button('Reject proposal',()=>submit('reject'),reviewActions);
    approve.hidden=reject.hidden=true;
    root.append(summary,node('p',"We use your device's location once to place your company on the map. Students will see this location."),
      field('Province',province),field('Town',town),field('Physical address',address),field('Landmark directions',landmark),
      actions,mapHost,coords,warning,pinConfirmation,lowConfirmation,pasteField,saveActions,reviewActions);
    if(window.L) {
      map=L.map(mapHost,{attributionControl:true}).setView([-19,29.8],6);
      if(directory.tiles.url){
        const attribution=node('span',directory.tiles.attribution);
        L.tileLayer(directory.tiles.url,{maxZoom:19,attribution:attribution.innerHTML}).addTo(map);
      }
      map.attributionControl.addAttribution('Town data: GeoNames (CC BY 4.0)');
      map.on('click',event=>{
        if(selectedTown())setPin(event.latlng.lat,event.latlng.lng,'employer_pin');
      });
      new ResizeObserver(()=>map.invalidateSize()).observe(mapHost);
    } else mapHost.hidden=true;
    const draft=registration?null:localDraft(accountId);
    applyDetails(record?.pending||draft||record?.location);
    renderRecord();
    message.textContent=draft&&!record?.pending?'Registration location loaded. Review and save it here.':'';
    return {draft:()=>{
      try { return JSON.stringify(payload())===JSON.stringify(confirmedDraft)?confirmedDraft:null; }
      catch { return null; }
    }};
  }
  window.AttachLinkLocation={mount,registerDraft};
})();
