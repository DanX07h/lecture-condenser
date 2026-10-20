export function setupDashboard(){
  const names={dashboard:'Overview',lectures:'Lecture notes',slides:'Slide notes',library:'My notes',flashcards:'Flashcards'};
  function route(requested){
    // Keep old reader bookmarks working inside My notes.
    const detail=requested==='reader'||requested==='library/note';
    return {view:detail?'library':Object.hasOwn(names,requested)?requested:'dashboard',detail};
  }
  function render(){
    const {view,detail}=route(window.location.hash.slice(1));
    for(const panel of document.querySelectorAll('[data-panel]'))panel.hidden=panel.dataset.panel!==view;
    document.getElementById('notes-list-view').hidden=detail;
    document.getElementById('notes-detail-view').hidden=!detail;
    for(const link of document.querySelectorAll('[data-nav]')){
      if(link.dataset.nav===view)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    }
    document.getElementById('current-page').textContent=names[view];
    document.title=`${detail?'Study notes · ':''}${names[view]} · Lecture Condenser`;
    document.getElementById('create-flashcard').hidden=view!=='library'||!detail;
    // Views stay mounted to preserve drafts, folder selection and current notes.
    document.getElementById('main-content').scrollTop=0;
  }
  function navigate(requested){
    const {view,detail}=route(requested),hash=detail?'library/note':view;
    if(window.location.hash==='#'+hash)render();else {window.location.hash=hash;render();}
  }
  window.addEventListener('hashchange',render);
  render();
  return {navigate};
}
