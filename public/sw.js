self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {title:'Roomie',message:'Tienes una novedad en tu hogar.'};
  event.waitUntil(self.registration.showNotification(data.title,{body:data.message,icon:'/icon.svg',data:{href:data.href||'/'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const path=event.notification.data.href;
  event.waitUntil(clients.openWindow(path.startsWith('/')&&!path.startsWith('//')?path:'/'));
});
