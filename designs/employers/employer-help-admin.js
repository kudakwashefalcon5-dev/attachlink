/* Direct original Stitch Help & Support navigation to the administrator messaging thread. */
(()=>{'use strict';
function init(){
 document.querySelectorAll('a[data-path="help-support"]').forEach(link=>{
  link.href='messages.html?support=1';
  link.title='Contact AttachLink Administrator Support';
 });
}
document.addEventListener('click',event=>{
 const a=event.target instanceof Element?event.target.closest('a[data-path="help-support"]'):null;
 if(!a)return;
 event.preventDefault();event.stopImmediatePropagation();
 location.assign(new URL('messages.html?support=1',location.href).href);
},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
